// TC-420~TC-426 (docs/TEST.md): input panels as drawers, sessions 20 at a time, the account ID only on Account, and the
// page in Chinese, against the local test server; TC-427 is a typecheck, not run here. Setup is the TCs' 前置
// (§3「网页抽屉、会话分页与中文界面」); the page must be http://localhost:5190 (`npm run dev`). The cases build on each
// other and run in order. Prints PASS/FAIL per step, then any console errors the steps don't expect. Codes are read from
// $L/server.log and never printed.
// usage: node web/app/tests/five.mjs <screenshot dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const root = new URL('../../../', import.meta.url).pathname;
const base = 'http://localhost:5190';
const L = '/tmp/imbo-t';
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const checks = [];
const ok = (name, cond, detail = '') => {
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, ' ')}` : ''}`;
  checks.push(line);
  console.log(line);
};
const sh = (cmd) => execFileSync('sh', ['-c', `. ${root}crates/scripts/local-env.sh; ${cmd}`], { encoding: 'utf8' }).replace(/\x1b\[[0-9;]*m/g, '');
const home = (who) => (['dave', 'erin'].includes(who) ? `${L}/extra/${who}` : `${L}/${who}`);
const as = (who, args) => sh(`IMBO_HOME=${home(who)} "$IMBO" ${args}`);
const token = (who) => fs.readFileSync(`${home(who)}/credentials`, 'utf8').match(/^token = "(.*)"/m)[1];
const api = async (who, method, path, body) => {
  const r = await fetch(`http://127.0.0.1:18080${path}`, { method, headers: { authorization: `Bearer ${token(who)}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  return [r.status, await r.json().catch(() => null)];
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const codeLines = (email) => fs.readFileSync(`${L}/server.log`, 'utf8').split('\n').filter((l) => l.includes('mail-log-only code=') && l.endsWith(`email=${email}`));
async function codeFor(email, after) {
  for (let i = 0; i < 50; i++) {
    const lines = codeLines(email);
    if (lines.length > after) return lines.at(-1).match(/code=(\d+)/)[1];
    await wait(200);
  }
  throw new Error(`no code for ${email}`);
}

// alice's extra sessions (前置): 14 online, then 10 that went offline, so she has 26 and the pickers start with 20.
const sid = (n) => `55555555-aaaa-bbbb-cccc-0000004200${String(n).padStart(2, '0')}`;
const online = Array.from({ length: 14 }, (_, i) => `on-${String(i + 1).padStart(2, '0')}`);
const offline = Array.from({ length: 10 }, (_, i) => `off-${String(i + 1).padStart(2, '0')}`);
online.forEach((t, i) => as('alice', `dev fake-session ${sid(i + 1)} --title ${t}`));
offline.forEach((t, i) => as('alice', `dev fake-session ${sid(i + 31)} --title ${t}`));
offline.forEach((t, i) => as('alice', `dev fake-session ${sid(i + 31)} --title ${t} --remove`));

let current = 'login';
const consoleErrors = [];
const expected = {
  'login alice': /status of 401 /,
  'login erin': /status of 401 /,
  'TC-426 #5': /status of 409 /,
  'TC-426 #9': /status of 401 /,
};
const browser = await chromium.launch();
const step = async (id, fn) => {
  current = id;
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};

try {
  const watch = (page, who) => {
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push([current, `${who}: ${m.text()}`]));
    page.on('pageerror', (e) => consoleErrors.push([current, `${who} pageerror: ${e.message}`]));
  };
  const login = async (who, viewport = { width: 1280, height: 800 }) => {
    const ctx = await browser.newContext({ viewport, locale: 'en-US' });
    const page = await ctx.newPage();
    watch(page, who);
    const was = current;
    current = `login ${who}`;
    await page.goto(base + '/login');
    const before = codeLines(`${who}@imbo.test`).length;
    await page.getByLabel('Email').fill(`${who}@imbo.test`);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText('Check your email').waitFor();
    await page.keyboard.type(await codeFor(`${who}@imbo.test`, before));
    await page.waitForURL('**/chats');
    current = was;
    return page;
  };
  // Another window signed in as the same person: same cookie, nothing saved in its storage.
  const sameUser = async (page, who, viewport, locale = 'en-US') => {
    const { cookies } = await page.context().storageState();
    const ctx = await browser.newContext({ viewport, locale, storageState: { cookies, origins: [] } });
    const p = await ctx.newPage();
    watch(p, who);
    return p;
  };
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  const dialog = (p) => p.getByRole('dialog').last();
  const settle = (loc) => loc.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))));
  const box = async (loc) => {
    const b = await loc.boundingBox();
    return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.x + b.width), b: Math.round(b.y + b.height) };
  };
  const focused = (p) => p.evaluate(() => (document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '').trim());
  // The label of the focused field.
  const field = (p) => p.evaluate(() => document.activeElement?.labels?.[0]?.textContent?.trim() ?? document.activeElement?.tagName);
  // The drawer's top bar and what is in it: Cancel (or Close) on the left, the main button on the right.
  const drawer = async (p, title) => {
    const d = dialog(p);
    await d.getByRole('heading', { name: title }).waitFor();
    await settle(d);
    const bar = d.locator(':scope > div').first();
    const buttons = await bar.getByRole('button').all();
    const names = await Promise.all(buttons.map((b) => b.innerText()));
    return { d, rect: await box(d), bar: await box(bar), names, boxes: await Promise.all(buttons.map(box)), head: await box(d.getByRole('heading', { name: title })) };
  };
  const wide = (g) => g.rect.r === 1280 && g.rect.y === 0 && g.rect.h === 800 && g.rect.w === 448;
  const narrow = (g, h = 844) => g.rect.x === 0 && g.rect.w === 390 && g.rect.y === 12 && g.rect.b === h;
  const barOk = (g, left, right) =>
    g.names[0] === left && (right === undefined ? g.names.length === 1 : g.names[1] === right) && g.boxes[0].x < (g.boxes[1]?.x ?? Infinity) && g.boxes.every((b) => b.y >= g.bar.y && b.b <= g.bar.b) && g.head.y >= g.bar.b;
  const geo = (g) => `drawer ${JSON.stringify(g.rect)} bar [${g.names.join(' | ')}] title at ${g.head.y}`;
  const centered = (b, w) => Math.abs(b.x + b.w / 2 - w / 2) <= 1 && b.x > 0 && b.r < w;
  const overflow = (p) => p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible' && e.getBoundingClientRect().right > innerWidth + 1).map((e) => e.tagName + ' ' + e.textContent.slice(0, 30)));
  // English words left on a page that should be in Chinese, apart from names, the seeded messages and brand words.
  const english = (p) =>
    p.evaluate(() => {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const words = [];
      for (let n; (n = w.nextNode()); ) {
        const e = n.parentElement;
        if (!e || e.closest('[aria-hidden=true],script,style') || !e.getClientRects().length) continue;
        words.push(...(n.textContent.match(/[A-Za-z][A-Za-z']{2,}/g) || []));
      }
      return words;
    }).then((ws) => [...new Set(ws.filter((x) => !/^(alice|bob|carol|erin|dave|release|team|checkout|docs|site|orders|api|billing|Imbo|imbo|Claude|Code|Codex|English|test|dev|PNG|JPEG|DELETE|Terminal|deploy|window|starts|Hold|merges|main|until|post|here|again|on|off|seed|login|group|join|Billing|webhooks|are|paused|for|the|What|replaced|user_id|has|returned|since|this|morning|Switched|customer_id|and|tests|pass|locally|Can|you|confirm|staging|accepts|changelog|attached|was|dropped|Deploy|Hold)$/.test(x)))]);

  const alice = await login('alice');

  // TC-420: wide window — the panels with a text box slide in from the right, full height
  await step('TC-420 #1', async () => {
    await alice.goto(base + '/contacts');
    await alice.getByRole('button', { name: 'Add contact' }).click();
    const g = await drawer(alice, 'Add a contact');
    await shot(alice, 'tc420-1');
    const send = g.d.getByRole('button', { name: 'Send request' });
    const f = await field(alice);
    ok('TC-420 #1 Add contact: right edge, full height, Cancel | Send request, title under the bar, focus in Account ID or email',
      wide(g) && barOk(g, 'Cancel', 'Send request') && (await send.isDisabled()) && (await g.d.getByText('They get your request in Imbo', { exact: false }).isVisible()) && f === 'Account ID or email', `${geo(g)}; focus ${f}`);
  });
  await step('TC-420 #2', async () => {
    const before = await box(dialog(alice));
    await dialog(alice).getByRole('textbox').first().fill('bob@imbo.test');
    const after = await box(dialog(alice));
    const enabled = await dialog(alice).getByRole('button', { name: 'Send request' }).isEnabled();
    await dialog(alice).getByRole('button', { name: 'Cancel' }).click();
    await dialog(alice).waitFor({ state: 'detached' });
    await wait(100);
    ok('TC-420 #2 typing leaves it in place, Send request enables, Cancel closes back to Add contact',
      JSON.stringify(before) === JSON.stringify(after) && enabled && (await focused(alice)) === 'Add contact', `${JSON.stringify(after)} focus ${await focused(alice)}`);
  });
  await step('TC-420 #3', async () => {
    await alice.goto(base + '/chats');
    await alice.getByRole('button', { name: 'New group' }).click();
    const g = await drawer(alice, 'New group');
    await shot(alice, 'tc420-3');
    ok('TC-420 #3 New group: Cancel | Create group', wide(g) && barOk(g, 'Cancel', 'Create group'), geo(g));
    await alice.keyboard.press('Escape');
    await dialog(alice).waitFor({ state: 'detached' });
  });
  await step('TC-420 #4', async () => {
    await alice.goto(base + '/account');
    await alice.getByRole('button', { name: 'Change email' }).click();
    const g = await drawer(alice, 'Change email');
    await shot(alice, 'tc420-4');
    const f = await field(alice);
    await g.d.getByRole('textbox').fill('alice420@imbo.test');
    await g.d.getByRole('button', { name: 'Send code' }).click();
    await g.d.getByRole('button', { name: 'Use a different email' }).click();
    await g.d.getByRole('button', { name: 'Send code' }).waitFor();
    const back = [await field(alice), await g.d.getByRole('textbox').inputValue()];
    ok('TC-420 #4 Change email: Cancel | Send code, focus in New email; back from the code, focus in it again with the address kept',
      wide(g) && barOk(g, 'Cancel', 'Send code') && f === 'New email' && back[0] === 'New email' && back[1] === 'alice420@imbo.test', `${geo(g)}; focus ${f}, back ${JSON.stringify(back)}`);
    await alice.keyboard.press('Escape');
    await dialog(alice).waitFor({ state: 'detached' });
  });
  await step('TC-420 #5', async () => {
    await alice.getByRole('button', { name: 'Delete account…' }).click();
    const g = await drawer(alice, 'Delete your Imbo account?');
    const del = g.d.getByRole('button', { name: 'Delete account' });
    const off = (await del.getAttribute('aria-disabled')) === 'true';
    await g.d.getByRole('textbox').fill('DELETE');
    const on = (await del.getAttribute('aria-disabled')) !== 'true';
    await shot(alice, 'tc420-5');
    await g.d.getByRole('button', { name: 'Cancel' }).click();
    await dialog(alice).waitFor({ state: 'detached' });
    ok('TC-420 #5 Delete account: Cancel | Delete account, only after DELETE; Cancel keeps the account',
      wide(g) && barOk(g, 'Cancel', 'Delete account') && off && on && (await api('alice', 'GET', '/v1/me'))[0] === 200, geo(g));
  });
  await step('TC-420 #6', async () => {
    await alice.goto(base + '/chats');
    await alice.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: /release-team/ }).first().click();
    await alice.getByRole('button', { name: 'release-team' }).first().click();
    const g = await drawer(alice, 'release-team');
    const members = await box(g.d.getByRole('heading', { name: 'Members' }));
    const sessions = await box(g.d.getByRole('heading', { name: 'Your sessions in this group' }));
    await shot(alice, 'tc420-6');
    ok('TC-420 #6 Group details: Close alone in the bar, Members above Your sessions in this group', wide(g) && barOk(g, 'Close') && members.y < sessions.y, `${geo(g)}; Members ${members.y}, sessions ${sessions.y}`);
  });
  await step('TC-420 #7', async () => {
    await dialog(alice).getByRole('button', { name: 'Leave group…' }).or(dialog(alice).getByRole('button', { name: 'Dissolve group…' })).click();
    await alice.getByRole('heading', { name: /^Dissolve release-team\?/ }).waitFor();
    const top = alice.getByRole('dialog').filter({ has: alice.getByRole('heading', { name: /^Dissolve release-team\?/ }) });
    await settle(top);
    const b = await box(top);
    await shot(alice, 'tc420-7');
    await alice.keyboard.press('Escape');
    await top.waitFor({ state: 'detached' });
    const still = await alice.getByRole('dialog').count();
    await alice.keyboard.press('Escape');
    await alice.getByRole('dialog').first().waitFor({ state: 'detached' });
    ok('TC-420 #7 Dissolve question centered over the drawer; Esc closes only it', centered(b, 1280) && still === 1, JSON.stringify(b));
  });
  await step('TC-420 #8', async () => {
    await alice.goto(base + '/contacts');
    await alice.getByRole('navigation', { name: 'Contacts' }).getByRole('link', { name: /bob/ }).first().click();
    await alice.getByRole('button', { name: 'More for bob' }).first().click();
    await alice.getByRole('menuitem', { name: 'Block bob…' }).click();
    await dialog(alice).getByRole('heading', { name: 'Block bob?' }).waitFor();
    await settle(dialog(alice));
    const block = await box(dialog(alice));
    await shot(alice, 'tc420-8');
    await dialog(alice).getByRole('button', { name: 'Cancel' }).click();
    await dialog(alice).waitFor({ state: 'detached' });
    await alice.getByRole('button', { name: 'More for bob' }).first().click();
    await alice.getByRole('menuitem', { name: 'Remove contact…' }).click();
    await dialog(alice).getByRole('heading', { name: /^Remove bob/ }).waitFor();
    await settle(dialog(alice));
    const remove = await box(dialog(alice));
    await dialog(alice).getByRole('button', { name: 'Cancel' }).click();
    await dialog(alice).waitFor({ state: 'detached' });
    ok('TC-420 #8 Block and Remove contact (buttons only) stay centered dialogs', centered(block, 1280) && centered(remove, 1280) && block.y > 0, `${JSON.stringify(block)} ${JSON.stringify(remove)}`);
  });

  // TC-421: report → the drawer closes, then Report sent
  await step('TC-421 #1', async () => {
    await alice.goto(base + '/contacts');
    await alice.getByRole('navigation', { name: 'Contacts' }).getByRole('link', { name: /carol/ }).first().click();
    await alice.getByRole('button', { name: 'More for carol' }).first().click();
    await alice.getByRole('menuitem', { name: 'Report carol…' }).click();
    const g = await drawer(alice, 'Report carol');
    await shot(alice, 'tc421-1');
    ok('TC-421 #1 Report: Cancel | Send report, reasons and details below', wide(g) && barOk(g, 'Cancel', 'Send report') && (await g.d.getByRole('radio').count()) >= 4, geo(g));
  });
  await step('TC-421 #2', async () => {
    const reports = () => fs.readFileSync(`${L}/server.log`, 'utf8').split('\n').filter((l) => l.includes('mail-log-only report=')).length;
    const before = reports();
    await dialog(alice).getByRole('radio').first().click();
    await dialog(alice).getByRole('textbox').fill('T421 spam links in every chat');
    await dialog(alice).getByRole('button', { name: 'Send report' }).click();
    await alice.getByRole('dialog').filter({ has: alice.getByRole('heading', { name: 'Report sent' }) }).waitFor();
    const n = await alice.getByRole('dialog').count();
    const sent = dialog(alice);
    await settle(sent);
    const b = await box(sent);
    await shot(alice, 'tc421-2');
    const hasBlock = await sent.getByRole('button', { name: 'Block carol' }).isVisible();
    await sent.getByRole('button', { name: 'Not now' }).click();
    await alice.getByRole('dialog').first().waitFor({ state: 'detached' });
    await wait(500);
    ok('TC-421 #2 the drawer is gone; Report sent, centered, asks Block carol / Not now; the report reached the server',
      n === 1 && centered(b, 1280) && hasBlock && reports() === before + 1 && !(await alice.getByRole('menuitem').count()), `${n} dialog(s) ${JSON.stringify(b)}`);
  });

  // TC-422: New group lists 20 sessions, online first, then 20 more each time
  const rows = (d) => d.locator('section').filter({ has: d.page().getByRole('heading', { name: /^Your sessions/ }) }).locator('li');
  const titles = (d) => rows(d).evaluateAll((ls) => ls.map((l) => l.querySelector('span span')?.textContent ?? ''));
  // API-014's order, read when the picker is open: a seeded session can go offline while the script runs.
  let order = [];
  await step('TC-422 #1', async () => {
    await alice.goto(base + '/chats');
    await alice.getByRole('button', { name: 'New group' }).click();
    const d = dialog(alice);
    await d.getByRole('heading', { name: 'New group' }).waitFor();
    await rows(d).first().waitFor();
    const t = await titles(d);
    const states = await rows(d).evaluateAll((ls) => ls.map((l) => /Online/.test(l.textContent)));
    const more = d.getByRole('button', { name: /^Load more sessions, \d+ left$/ });
    const label = await more.innerText();
    await more.scrollIntoViewIfNeeded();
    await shot(alice, 'tc422-1');
    const firstOff = states.indexOf(false);
    const [, now] = await api('alice', 'GET', '/v1/agents');
    order = now.agents.map((a) => a.title);
    const up = now.agents.filter((a) => a.online).length;
    ok('TC-422 #1 20 sessions, online first, in API-014 order; Load more, 6 left',
      t.length === 20 && JSON.stringify(t) === JSON.stringify(order.slice(0, 20)) && up >= 14 && firstOff === up && states.slice(firstOff).every((s) => !s) && order.length === 26 && /^Load more\s+6 left$/.test(label.trim()),
      `${t.length} shown, ${firstOff} online (API-014: ${up}), ${order.length} in all, button "${label}"`);
  });
  await step('TC-422 #2', async () => {
    const d = dialog(alice);
    await d.getByRole('button', { name: /^Load more sessions/ }).click();
    await wait(300);
    const t = await titles(d);
    const f = await focused(alice);
    const focusRow = await alice.evaluate(() => document.activeElement?.closest('li')?.querySelector('span span')?.textContent);
    ok('TC-422 #2 Load more shows the other 6, focus on the first new one, no more button',
      t.length === 26 && JSON.stringify(t) === JSON.stringify(order) && focusRow === order[20] && !(await d.getByRole('button', { name: /^Load more/ }).count()), `${t.length} shown, focus ${focusRow ?? f}`);
  });
  await step('TC-422 #3', async () => {
    const d = dialog(alice);
    await d.getByLabel('Group name').fill('t422');
    await rows(d).filter({ hasText: order[25] }).click();
    await rows(d).filter({ hasText: 'checkout' }).click();
    await d.getByRole('button', { name: 'Create group' }).click();
    await d.waitFor({ state: 'detached' });
    const [, gs] = await api('alice', 'GET', '/v1/groups');
    const g = gs.groups.find((x) => x.name === 't422');
    ok('TC-422 #3 created with the last session and checkout', !!g && g.my_sessions?.length === 2, JSON.stringify(g?.my_sessions?.map((s) => s.title)));
  });

  // TC-423: group details — members first, then my sessions with the ones in the group on top
  await step('TC-423 #1', async () => {
    await alice.goto(base + '/chats');
    await alice.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: /t422/ }).first().click();
    await alice.getByRole('button', { name: 't422' }).first().click();
    const d = dialog(alice);
    await d.getByRole('heading', { name: 'Your sessions in this group' }).waitFor();
    await rows(d).first().waitFor();
    const t = await titles(d);
    const checked = await rows(d).evaluateAll((ls) => ls.map((l) => l.querySelector('[role=checkbox]')?.getAttribute('aria-checked')));
    const rest = order.filter((x) => x !== 'checkout' && x !== order[25]);
    const label = await d.getByRole('button', { name: /^Load more sessions/ }).innerText();
    await shot(alice, 'tc423-1');
    ok('TC-423 #1 the two in the group first and ticked, then the rest in order, 20 shown, Load more, 6 left',
      new Set(t.slice(0, 2)).size === 2 && t.slice(0, 2).every((x) => ['checkout', order[25]].includes(x)) && checked.slice(0, 2).every((c) => c === 'true') && checked.slice(2).every((c) => c === 'false') &&
        JSON.stringify(t.slice(2)) === JSON.stringify(rest.slice(0, 18)) && t.length === 20 && /6 left/.test(label),
      `${t.slice(0, 3).join(', ')}…, ${t.length} shown, "${label}"`);
  });
  await step('TC-423 #2', async () => {
    const d = dialog(alice);
    const members = await box(d.getByRole('heading', { name: 'Members' }));
    const invite = await box(d.getByRole('button', { name: 'Invite contacts' }));
    const sessions = await box(d.getByRole('heading', { name: 'Your sessions in this group' }));
    ok('TC-423 #2 Members, then Invite contacts, then the sessions', members.y < invite.y && invite.y < sessions.y, `${members.y} < ${invite.y} < ${sessions.y}`);
  });
  await step('TC-423 #3', async () => {
    const d = dialog(alice);
    await rows(d).filter({ hasText: order[0] }).click();
    await d.getByRole('button', { name: 'Save' }).click();
    const t = await alice.locator('[data-sonner-toast]').filter({ hasText: 'Saved' }).first().innerText();
    const [, gs] = await api('alice', 'GET', '/v1/groups');
    ok('TC-423 #3 ticking one more and Save: 3 sessions get the group', /Saved\. 3 sessions get t422's messages\./.test(t) && gs.groups.find((x) => x.name === 't422').my_sessions.length === 3, t);
    await alice.keyboard.press('Escape');
    await dialog(alice).waitFor({ state: 'detached' });
  });

  // TC-424: narrow window — the drawers rise from the bottom, 12 px under the top, and stay put while typing
  const phone = await sameUser(alice, 'alice-phone', { width: 390, height: 844 });
  await step('TC-424 #1', async () => {
    await phone.goto(base + '/contacts');
    await phone.getByRole('button', { name: 'Add contact' }).waitFor();
    // Every frame while it rises: the page and the drawer's fields don't scroll as the field takes focus.
    const frames = phone.evaluate(
      () =>
        new Promise((done) => {
          const seen = [];
          const tick = () => {
            const d = document.querySelector('.drawer-panel');
            if (d) seen.push([scrollX, scrollY, d.querySelector('.scroll-pane')?.scrollTop ?? -1, document.activeElement?.tagName]);
            if (seen.length < 40) requestAnimationFrame(tick);
            else done(seen);
          };
          tick();
        })
    );
    await phone.getByRole('button', { name: 'Add contact' }).click();
    const seen = await frames;
    const g = await drawer(phone, 'Add a contact');
    const f = await field(phone);
    await shot(phone, 'tc424-1');
    ok('TC-424 #1 Add contact: full width, top 12, to the bottom, Cancel | Send request; nothing scrolls while it rises with focus in the field',
      narrow(g) && barOk(g, 'Cancel', 'Send request') && seen.every((x) => x[0] === 0 && x[1] === 0 && x[2] === 0) && f === 'Account ID or email',
      `${geo(g)}; ${seen.length} frames, scrolled ${seen.filter((x) => x[0] || x[1] || x[2]).length}; focus ${f}`);
  });
  await step('TC-424 #2', async () => {
    const d = dialog(phone);
    const before = await box(d);
    const input = d.getByRole('textbox').first();
    await input.focus();
    await phone.keyboard.type('someone@example.com');
    await wait(300);
    const after = await box(d);
    const bar = await box(d.getByRole('button', { name: 'Send request' }));
    await shot(phone, 'tc424-2');
    ok('TC-424 #2 focus and typing leave the drawer where it was', JSON.stringify(before) === JSON.stringify(after) && bar.y >= 12 && bar.b <= 12 + 56, JSON.stringify(after));
    await phone.keyboard.press('Escape');
    await d.waitFor({ state: 'detached' });
  });
  await step('TC-424 #3', async () => {
    const seen = [];
    await phone.goto(base + '/chats');
    await phone.getByRole('button', { name: 'New group' }).click();
    let g = await drawer(phone, 'New group');
    seen.push(['New group', narrow(g) && barOk(g, 'Cancel', 'Create group'), g.rect]);
    await shot(phone, 'tc424-3a');
    await phone.keyboard.press('Escape');
    await dialog(phone).waitFor({ state: 'detached' });
    await phone.goto(base + '/account');
    await phone.getByRole('button', { name: 'Change email' }).click();
    g = await drawer(phone, 'Change email');
    seen.push(['Change email', narrow(g) && barOk(g, 'Cancel', 'Send code'), g.rect]);
    await phone.keyboard.press('Escape');
    await dialog(phone).waitFor({ state: 'detached' });
    await phone.getByRole('button', { name: 'Delete account…' }).click();
    g = await drawer(phone, 'Delete your Imbo account?');
    seen.push(['Delete account', narrow(g) && barOk(g, 'Cancel', 'Delete account'), g.rect]);
    await shot(phone, 'tc424-3b');
    await phone.keyboard.press('Escape');
    await dialog(phone).waitFor({ state: 'detached' });
    await phone.goto(base + '/contacts');
    await phone.getByRole('navigation', { name: 'Contacts' }).getByRole('link', { name: /bob/ }).first().click();
    await phone.getByRole('button', { name: 'More for bob' }).first().click();
    await phone.getByRole('menuitem', { name: 'Report bob…' }).click();
    g = await drawer(phone, 'Report bob');
    seen.push(['Report', narrow(g) && barOk(g, 'Cancel', 'Send report'), g.rect]);
    await shot(phone, 'tc424-3c');
    await phone.keyboard.press('Escape');
    await dialog(phone).waitFor({ state: 'detached' });
    await phone.goto(base + '/chats');
    await phone.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: /t422/ }).first().click();
    await phone.getByRole('button', { name: 't422' }).first().click();
    g = await drawer(phone, 't422');
    seen.push(['Group details', narrow(g) && barOk(g, 'Close'), g.rect]);
    await shot(phone, 'tc424-3d');
    await phone.keyboard.press('Escape');
    await dialog(phone).waitFor({ state: 'detached' });
    ok('TC-424 #3 New group, Change email, Delete account, Report, Group details all rise the same way', seen.every((x) => x[1]), seen.filter((x) => !x[1]).map((x) => `${x[0]} ${JSON.stringify(x[2])}`).join('; '));
  });
  await step('TC-424 #4', async () => {
    await phone.goto(base + '/contacts');
    await phone.getByRole('navigation', { name: 'Contacts' }).getByRole('link', { name: /bob/ }).first().click();
    await phone.getByRole('button', { name: 'More for bob' }).first().click();
    await phone.getByRole('menuitem', { name: 'Remove contact…' }).click();
    await dialog(phone).getByRole('heading', { name: /^Remove bob/ }).waitFor();
    await settle(dialog(phone));
    const b = await box(dialog(phone));
    await shot(phone, 'tc424-4');
    await dialog(phone).getByRole('button', { name: 'Cancel' }).click();
    await dialog(phone).waitFor({ state: 'detached' });
    ok('TC-424 #4 Remove contact stays the panel that fits its content, not a drawer', b.y > 12 && b.h < 832 && b.b === 844, JSON.stringify(b));
  });
  await step('TC-424 #5', async () => {
    const motion = async () => {
      await phone.goto(base + '/contacts');
      await phone.getByRole('button', { name: 'Add contact' }).click();
      await dialog(phone).waitFor();
      const name = await dialog(phone).evaluate((d) => getComputedStyle(d).animationName);
      await phone.keyboard.press('Escape');
      await dialog(phone).waitFor({ state: 'detached' });
      return name;
    };
    const normal = await motion();
    await phone.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await motion();
    await phone.emulateMedia({ reducedMotion: null });
    await phone.setViewportSize({ width: 1280, height: 800 });
    const wideNormal = await motion();
    await phone.setViewportSize({ width: 390, height: 844 });
    ok('TC-424 #5 it rises (sheet-in), slides in wide (drawer-in), and with reduced motion only fades', normal === 'sheet-in' && wideNormal === 'drawer-in' && reduced === 'fade-in', `${normal} / ${wideNormal} / reduced ${reduced}`);
  });

  // TC-425: the account ID is only on Account
  await step('TC-425 #1', async () => {
    await alice.goto(base + '/contacts');
    await alice.getByRole('navigation', { name: 'Contacts' }).waitFor();
    const idText = await alice.getByText('Your ID', { exact: false }).count();
    const copy = await alice.getByRole('button', { name: 'Copy account ID' }).count();
    await shot(alice, 'tc425-1');
    await alice.goto(base + '/account');
    const onAccount = await alice.getByRole('button', { name: /Copy account ID/ }).count();
    ok('TC-425 #1 no ID strip or copy button on Contacts; Account still has the ID', idText === 0 && copy === 0 && onAccount >= 1, `Your ID ${idText}, copy ${copy}, on Account ${onAccount}`);
  });
  await step('TC-425 #2', async () => {
    const erin = await login('erin');
    await erin.goto(base + '/contacts');
    const text = 'Add someone with their account ID or email, or share your own ID from Account so they can add you.';
    await erin.getByText(text).waitFor();
    await shot(erin, 'tc425-2');
    ok('TC-425 #2 empty Contacts points to Account', true);
    await erin.context().close();
  });

  // TC-426: the page in Chinese
  await step('TC-426 #1', async () => {
    await alice.goto(base + '/account');
    const group = alice.getByRole('radiogroup', { name: 'Language' });
    const radios = await group.getByRole('radio').evaluateAll((rs) => rs.map((r) => [r.textContent.trim(), r.getAttribute('aria-checked')]));
    await group.scrollIntoViewIfNeeded();
    await shot(alice, 'tc426-1');
    ok('TC-426 #1 Language: English, 简体中文, Follow system; Follow system picked',
      JSON.stringify(radios.map((r) => r[0])) === JSON.stringify(['English', '简体中文', 'Follow system']) && radios[2][1] === 'true', JSON.stringify(radios));
  });
  await step('TC-426 #2', async () => {
    await alice.getByRole('radio', { name: '简体中文' }).click();
    await alice.getByRole('heading', { name: '账号', exact: true }).first().waitFor();
    const tabs = (await alice.getByRole('navigation', { name: '栏目' }).getByRole('link').allInnerTexts()).map((x) => x.split(/\s|\d/)[0]);
    const lang = await alice.evaluate(() => [document.documentElement.lang, localStorage.getItem('imbo.language'), location.pathname]);
    const radios = await alice.getByRole('radio').evaluateAll((rs) => rs.map((r) => [r.textContent.trim(), r.getAttribute('aria-checked')]));
    const f = await focused(alice);
    await shot(alice, 'tc426-2');
    ok('TC-426 #2 Chinese at once, still on /account, focus on 简体中文; English and 简体中文 keep their own words',
      lang[0] === 'zh-CN' && lang[1] === 'zh' && lang[2] === '/account' && tabs.join('/') === '对话/会话/联系人' && JSON.stringify(radios.map((r) => r[0])) === JSON.stringify(['English', '简体中文', '跟随系统']) && radios[1][1] === 'true' && f === '简体中文',
      `${JSON.stringify(lang)} tabs ${tabs.join('/')} radios ${JSON.stringify(radios)} focus ${f}`);
  });
  const pages = [
    ['chats', '/chats'],
    ['chat', null],
    ['sessions', '/sessions'],
    ['contacts', '/contacts'],
    ['account', '/account'],
  ];
  await step('TC-426 #3', async () => {
    await alice.reload();
    await alice.getByRole('heading', { name: '账号', exact: true }).first().waitFor();
    const left = {};
    for (const [name, path] of pages) {
      if (path) await alice.goto(base + path);
      else {
        await alice.goto(base + '/chats');
        await alice.getByRole('link', { name: /release-team/ }).first().click();
      }
      await wait(800);
      await shot(alice, `tc426-3-${name}`);
      const w = await english(alice);
      if (w.length) left[name] = w;
    }
    ok('TC-426 #3 after a reload still Chinese; no English words left on Chats, a chat, Sessions, Contacts, Account (names and messages aside)', !Object.keys(left).length, JSON.stringify(left));
  });
  await step('TC-426 #4', async () => {
    const left = {};
    const open = async (name, go, title) => {
      await go();
      await dialog(alice).getByRole('heading', { name: title }).waitFor();
      await settle(dialog(alice));
      await shot(alice, `tc426-4-${name}`);
      const w = await english(alice);
      if (w.length) left[name] = w;
      await alice.keyboard.press('Escape');
      await dialog(alice).waitFor({ state: 'detached' });
    };
    await alice.goto(base + '/contacts');
    await open('add-contact', () => alice.getByRole('button', { name: '添加联系人' }).click(), '添加联系人');
    await alice.goto(base + '/chats');
    await open('new-group', () => alice.getByRole('button', { name: '新建群' }).click(), '新建群');
    await alice.getByRole('link', { name: /t422/ }).first().click();
    await open('group-details', () => alice.getByRole('button', { name: 't422' }).first().click(), 't422');
    await alice.goto(base + '/contacts');
    await alice.getByRole('link', { name: /bob/ }).first().click();
    await open('report', async () => {
      await alice.getByRole('button', { name: 'bob 的更多操作' }).first().click();
      await alice.getByRole('menuitem', { name: '举报 bob…' }).click();
    }, '举报 bob');
    ok('TC-426 #4 drawers in Chinese: Add contact, New group, Group details, Report', !Object.keys(left).length, JSON.stringify(left));
  });
  await step('TC-426 #5', async () => {
    await alice.goto(base + '/account');
    await alice.getByRole('button', { name: '更换邮箱' }).click();
    const d = dialog(alice);
    await d.getByRole('heading', { name: '更换邮箱' }).waitFor();
    await d.getByRole('textbox').fill('bob@imbo.test');
    await d.getByRole('button', { name: '发送验证码' }).click();
    const err = d.getByRole('alert').or(d.locator('[role=status], .text-destructive')).first();
    await err.waitFor();
    const text = await err.innerText();
    await shot(alice, 'tc426-5');
    ok('TC-426 #5 the server\'s refusal stays in English inside the Chinese drawer', /^[\x20-\x7e’]+$/.test(text.trim()) && /[a-z]/i.test(text), text);
    await alice.keyboard.press('Escape');
    await d.waitFor({ state: 'detached' });
  });
  await step('TC-426 #6', async () => {
    const p = await sameUser(alice, 'alice-zh-phone', { width: 390, height: 844 }, 'en-US');
    await p.goto(base + '/chats');
    await p.evaluate(() => localStorage.setItem('imbo.language', 'zh'));
    const wide = {};
    for (const [name, path] of [['chats', '/chats'], ['contacts', '/contacts'], ['account', '/account']]) {
      await p.goto(base + path);
      await wait(800);
      await shot(p, `tc426-6-${name}`);
      const o = await overflow(p);
      if (o.length) wide[name] = o;
    }
    await p.getByRole('button', { name: '更换邮箱' }).click();
    await dialog(p).getByRole('heading', { name: '更换邮箱' }).waitFor();
    await settle(dialog(p));
    await shot(p, 'tc426-6-change-email');
    const o = await overflow(p);
    if (o.length) wide['change email'] = o;
    await p.context().close();
    ok('TC-426 #6 390 wide in Chinese: nothing runs past the window', !Object.keys(wide).length, JSON.stringify(wide));
  });
  await step('TC-426 #7', async () => {
    await alice.goto(base + '/account');
    // From the keyboard: the arrow key moves to 跟随系统, Space picks it, and focus stays on it after the page redraws.
    await alice.getByRole('radio', { name: '简体中文' }).focus();
    await alice.keyboard.press('ArrowDown');
    // Radix moves focus on the next task.
    await alice.waitForFunction(() => document.activeElement?.textContent?.trim() === '跟随系统');
    await alice.keyboard.press('Space');
    await alice.getByRole('heading', { name: 'Account', exact: true }).first().waitFor();
    const lang = await alice.evaluate(() => [document.documentElement.lang, localStorage.getItem('imbo.language'), location.pathname]);
    const f = await focused(alice);
    ok('TC-426 #7 Follow system with an English browser: back to English, still on /account, focus on Follow system',
      lang[0] === 'en' && lang[1] === 'system' && lang[2] === '/account' && f === 'Follow system', `${JSON.stringify(lang)} focus ${f}`);
  });
  await step('TC-426 #8', async () => {
    const p = await sameUser(alice, 'alice-zh', { width: 1280, height: 800 }, 'zh-CN');
    await p.goto(base + '/account');
    await p.getByRole('heading', { name: '账号', exact: true }).first().waitFor();
    const checked = await p.getByRole('radio', { name: '跟随系统' }).getAttribute('aria-checked');
    await shot(p, 'tc426-8');
    await p.goto(base + '/chats');
    const link = p.getByRole('navigation', { name: '对话' }).getByRole('link', { name: /release-team/ }).first();
    await link.waitFor();
    const lang = await p.evaluate(() => [document.documentElement.lang, localStorage.getItem('imbo.language')]);
    await p.context().close();
    ok('TC-426 #8 Chinese browser, nothing picked: Chinese, Follow system picked; group names as they are', checked === 'true' && lang[0] === 'zh-CN' && lang[1] === null, `${checked} ${JSON.stringify(lang)}`);
  });
  await step('TC-426 #9', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'zh-CN' });
    const p = await ctx.newPage();
    watch(p, 'signed-out');
    await p.goto(base + '/login');
    await p.getByRole('button', { name: '继续' }).waitFor();
    await shot(p, 'tc426-9');
    const w = await english(p);
    await ctx.close();
    ok('TC-426 #9 the sign-in page follows a Chinese browser too', !w.length, w.join(' '));
  });
} catch (e) {
  ok(current, false, e.stack.split('\n').slice(0, 3).join(' '));
} finally {
  await browser.close();
}

const surprises = consoleErrors.filter(([s, m]) => !expected[s]?.test(m));
for (const [s, m] of surprises) console.log(`console error in ${s}: ${m}`);
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(`${checks.length - failed}/${checks.length} PASS, ${surprises.length} unexpected console errors`);
process.exit(failed || surprises.length ? 1 : 0);
