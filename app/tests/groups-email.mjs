// TC-330~TC-333 and TC-342 (docs/TEST.md): groups, requests and changing the email on the web, against the local test
// server. Setup is the TCs' 前置 (§3「网页建群、处理申请与换邮箱」); the page must be http://localhost:5190
// (`npm run dev`). The five cases build on each other and run in order. Prints PASS/FAIL per step, then any console
// errors the steps don't expect. Codes are read from $L/server.log and never printed.
// usage: node web/app/tests/groups-email.mjs <screenshot dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const crates = new URL('../../../crates/', import.meta.url).pathname;
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
const sh = (cmd) => execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8' }).replace(/\x1b\[[0-9;]*m/g, '');
const as = (who, args) => sh(`IMBO_HOME=$L/${who} "$IMBO" ${args}`);
const ids = Object.fromEntries(fs.readFileSync(`${L}/ids.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').slice(0, 2)));
const A = Number(ids.alice);
const B = Number(ids.bob);
const session = { checkout: '55555555-aaaa-bbbb-cccc-0000000a0001', 'docs-site': '55555555-aaaa-bbbb-cccc-0000000a0002', 'orders-api': '55555555-aaaa-bbbb-cccc-0000000b0001' };
// A call through mcp-call.py makes the daemon take the fake session for a real one, which it then finds without a process,
// drops, and brings back named by its short ID; seeding it again keeps the name the steps look for (§3).
const inbox = (who, name) => {
  const got = sh(`python3 $M $L/${who} inbox '{}' --session claude-code:${session[name]}`);
  as(who, `dev fake-session ${session[name]} --title ${name}`);
  return got;
};
const tokenOf = (home) => fs.readFileSync(`${home}/credentials`, 'utf8').match(/^token = "(.*)"/m)[1];
const token = (who) => tokenOf(`${L}/${who}`);
const api = async (tok, method, path, body) => {
  const r = await fetch(`http://127.0.0.1:18080${path}`, { method, headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  return [r.status, await r.json().catch(() => null)];
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// What `fn` returns once `done` holds, polling for up to `ms`.
const until = async (fn, done, ms = 15000) => {
  let v;
  for (const end = Date.now() + ms; ; await wait(500)) {
    v = await fn();
    if (done(v) || Date.now() > end) return v;
  }
};

const codeLines = (email) => fs.readFileSync(`${L}/server.log`, 'utf8').split('\n').filter((l) => l.includes('mail-log-only code=') && l.endsWith(`email=${email}`));
async function codeFor(email, after) {
  for (let i = 0; i < 50; i++) {
    const lines = codeLines(email);
    if (lines.length > after) return lines.at(-1).match(/code=(\d+)/)[1];
    await wait(200);
  }
  throw new Error(`no code for ${email}`);
}

// Contrast of an element's text (or border) against the first opaque background behind it, as the page renders it.
const contrast = (loc, prop = 'color') =>
  loc.evaluate((el, prop) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (c) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    };
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    let bg = [0, 0, 0, 0];
    for (let e = el; e && bg[3] < 255; e = e.parentElement) bg = rgba(getComputedStyle(e).backgroundColor);
    const fg = rgba(getComputedStyle(el)[prop]);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return Math.round(((a + 0.05) / (b + 0.05)) * 10) / 10;
  }, prop);
// Elements that cut their text with an ellipsis, or a box that leaves the window.
const clipped = (loc) =>
  loc.evaluate((root) =>
    [root, ...root.querySelectorAll('*')]
      .filter((e) => getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1)
      .map((e) => e.textContent.slice(0, 40))
  );
const inWindow = (box, w, h) => !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= w + 0.5 && box.y + box.height <= h + 0.5;

// Each console error is kept with the step it came in; TC-342 #10 says which ones are expected.
let current = 'login';
const consoleErrors = [];
const expected = { 'login alice': /status of 401 /, 'login bob': /status of 401 /, 'TC-331 #5': /status of 409 /, 'TC-332 #6': /status of 409 /, 'TC-342 #3': /status of 409 /, 'TC-342 #4': /status of 400 /, 'TC-342 #6': /status of 400 / };
const browser = await chromium.launch();
const step = async (id, fn) => {
  current = id;
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};
// Before signing in the page asks who is signed in and gets 401.
const signingIn = async (who, fn) => {
  const was = current;
  current = `login ${who}`;
  await fn();
  current = was;
};

try {
  const newPage = async (who) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push([current, `${who}: ${m.text()}`]));
    page.on('pageerror', (e) => consoleErrors.push([current, `${who} pageerror: ${e.message}`]));
    await signingIn(who, async () => {
      await page.goto(base + '/login');
      const before = codeLines(`${who}@imbo.test`).length;
      await page.getByLabel('Email').fill(`${who}@imbo.test`);
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByText('Check your email').waitFor();
      await page.keyboard.type(await codeFor(`${who}@imbo.test`, before));
      await page.waitForURL('**/chats');
    });
    return page;
  };
  const page = await newPage('alice');
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  const dialog = (p = page) => p.getByRole('dialog');
  const box = (p, name) => dialog(p).getByRole('checkbox', { name });
  const checked = async (p, name) => (await box(p, name).getAttribute('aria-checked')) === 'true';
  const toast = async (p, text) => {
    const t = p.locator('[data-sonner-toast]').filter({ hasText: text }).first();
    try {
      await t.waitFor({ timeout: 8000 });
      return (await t.innerText()).replace(/\s+/g, ' ');
    } catch {
      return `(none) ${(await p.locator('[data-sonner-toast]').allInnerTexts()).join(' | ')}`;
    }
  };
  const chats = (p = page) => p.getByRole('navigation', { name: 'Chats' });
  const contacts = (p = page) => p.getByRole('navigation', { name: 'Contacts' });
  const requestsHeading = (p = page) => p.getByRole('heading', { name: 'Requests' });
  const toContacts = async (p = page) => {
    await p.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Contacts/ }).click();
    await contacts(p).waitFor();
  };
  const groupTitle = (p, name) => p.getByRole('button', { name }).first();
  const dark = async (p, w = 390, h = 844) => {
    await p.setViewportSize({ width: w, height: h });
    await p.emulateMedia({ colorScheme: 'dark' });
  };
  const light = async (p) => {
    await p.setViewportSize({ width: 1280, height: 800 });
    await p.emulateMedia({ colorScheme: 'light' });
  };
  const composer = () => page.locator('textarea.composer');
  let G = 0;

  // TC-330: a new group
  await step('TC-330 #1', async () => {
    await page.goto(base + '/chats');
    await page.getByRole('button', { name: 'New group' }).click();
    await dialog().getByRole('heading', { name: 'New group' }).waitFor();
    await box(page, /checkout/).waitFor();
    const text = await dialog().innerText();
    // Each pick's label: avatar initial, then the name, then its details.
    const labels = await dialog().locator('label:has([role="checkbox"])').allInnerTexts();
    const names = labels.map((l) => l.split('\n').find((x) => x.length > 1));
    await shot(page, 'tc330-1');
    ok('TC-330 #1 New group: name box, sessions, contacts, hint, Create disabled',
      (await dialog().getByLabel('Group name').isVisible()) && text.includes('Your sessions') && ['checkout', 'docs-site', 'bob', 'carol'].every((n) => names.includes(n)) &&
        text.includes('They can accept it in Contacts, or run imbo group join.') && (await dialog().getByRole('button', { name: 'Create group' }).isDisabled()),
      names.join(', '));
  });
  const nameBox = () => dialog().getByLabel('Group name');
  await step('TC-330 #2', async () => {
    await nameBox().fill('a/b');
    await dialog().getByRole('button', { name: 'Create group' }).click();
    await dialog().getByText("A group name can't contain /.").waitFor({ timeout: 5000 });
    ok('TC-330 #2 slash refused', true);
  });
  await step('TC-330 #3', async () => {
    await nameBox().fill('#ops');
    await dialog().getByRole('button', { name: 'Create group' }).click();
    await dialog().getByText("A group name can't start with #.").waitFor({ timeout: 5000 });
    await shot(page, 'tc330-3');
    ok('TC-330 #3 leading # refused', true);
  });
  await step('TC-330 #4', async () => {
    await nameBox().fill('T330 ops');
    for (const n of [/checkout/, /docs-site/, /\bbob\b/]) await box(page, n).click();
    await dialog().getByRole('button', { name: 'Create group' }).click();
    await dialog().waitFor({ state: 'detached', timeout: 8000 });
    const t = await toast(page, 'T330 ops created');
    await chats().getByText('T330 ops').waitFor({ timeout: 8000 });
    await shot(page, 'tc330-4');
    ok('TC-330 #4 created, group chat open, in the list', t.includes('T330 ops created. Invitations sent.') && /\/chats\/\d+$/.test(page.url()), `${t} / ${page.url()}`);
  });
  await step('TC-330 #5', async () => {
    const [, gs] = await api(token('alice'), 'GET', '/v1/groups');
    const g = gs.groups.find((x) => x.name === 'T330 ops');
    G = g.id;
    const [, rq] = await api(token('bob'), 'GET', '/v1/requests');
    const inv = rq.requests.find((r) => r.kind === 'group' && r.group?.name === 'T330 ops' && r.status === 'pending');
    const mine = g.my_sessions.map((x) => x.title).sort().join(', ');
    ok('TC-330 #5 owner alice, two sessions, bob invited', g.owner?.id === A && mine === 'checkout, docs-site' && !!inv, `group ${G} owner ${g.owner?.id} sessions ${mine} invitation ${inv?.id}`);
  });
  await step('TC-330 #6', async () => {
    await composer().fill('T330 hello');
    await composer().press('Enter');
    let got = { checkout: '', 'docs-site': '' };
    await until(() => {
      for (const n of Object.keys(got)) if (!got[n].includes('T330 hello')) got[n] += inbox('alice', n);
      return got;
    }, (g) => g.checkout.includes('T330 hello') && g['docs-site'].includes('T330 hello'));
    ok('TC-330 #6 both sessions got it', got.checkout.includes('T330 hello') && got['docs-site'].includes('T330 hello'));
  });
  await step('TC-330 #7', async () => {
    await dark(page, 1280, 800);
    await page.getByRole('button', { name: 'New group' }).click();
    await dialog().getByRole('heading', { name: 'New group' }).waitFor();
    await wait(400);
    await shot(page, 'tc330-7-dark');
    const title = await contrast(dialog().getByRole('heading', { name: 'New group' }));
    const label = await contrast(dialog().getByText('docs-site').first());
    const boxLine = await contrast(box(page, /checkout/), 'borderTopColor');
    await page.keyboard.press('Escape');
    await dialog().waitFor({ state: 'detached', timeout: 5000 });
    ok('TC-330 #7 dark: text and boxes readable, Esc closes', title >= 4.5 && label >= 4.5 && boxLine >= 3, `title ${title}:1, session ${label}:1, box ${boxLine}:1`);
    await light(page);
  });

  // TC-331: the group's details
  const openDetails = async () => {
    await groupTitle(page, 'T330 ops').click();
    await dialog().getByRole('heading', { name: 'T330 ops' }).waitFor();
    await box(page, /checkout/).waitFor();
  };
  await step('TC-331 #1', async () => {
    await openDetails();
    await wait(300);
    const text = await dialog().innerText();
    await shot(page, 'tc331-1');
    ok('TC-331 #1 id, 1 member, alice Owner You, both sessions picked',
      text.includes(`Group ${G}`) && text.includes('1 member') && /alice\s*\n?\s*Owner\s*\n?\s*You/.test(text) && (await checked(page, /checkout/)) && (await checked(page, /docs-site/)),
      text.slice(0, 200));
  });
  await step('TC-331 #2', async () => {
    await box(page, /docs-site/).click();
    await dialog().getByRole('button', { name: 'Save' }).click();
    const t = await toast(page, 'Saved.');
    const [, gs] = await api(token('alice'), 'GET', '/v1/groups');
    const mine = gs.groups.find((x) => x.id === G).my_sessions.map((x) => x.title).join(', ');
    ok('TC-331 #2 saved, only checkout', t.includes("Saved. 1 session gets T330 ops's messages.") && mine === 'checkout', `${t} / ${mine}`);
  });
  await step('TC-331 #3', async () => {
    await page.keyboard.press('Escape');
    await dialog().waitFor({ state: 'detached', timeout: 5000 });
    await composer().fill('T331 only checkout');
    await composer().press('Enter');
    const got = await until(() => inbox('alice', 'checkout'), (o) => o.includes('T331 only checkout'));
    const other = inbox('alice', 'docs-site');
    ok('TC-331 #3 checkout got it, docs-site nothing new', got.includes('T331 only checkout') && !other.includes('T331'), other.trim().slice(0, 80));
  });
  await step('TC-331 #4', async () => {
    await openDetails();
    await dialog().getByRole('button', { name: 'Invite contacts' }).click();
    await dialog().getByRole('heading', { name: 'Invite to T330 ops' }).waitFor();
    const hint = (await dialog().innerText()).includes(`They can accept it in Contacts, or run imbo group join #${G}.`);
    await shot(page, 'tc331-4');
    await box(page, /\bcarol\b/).click();
    await dialog().getByRole('button', { name: 'Invite' }).click();
    const t = await toast(page, 'Invitation sent.');
    const [, rq] = await api(token('carol'), 'GET', '/v1/requests');
    const inv = rq.requests.find((r) => r.kind === 'group' && r.group?.id === G);
    ok('TC-331 #4 hint with the id, carol invited', hint && t.includes('Invitation sent.') && !!inv, `${t} / request ${inv?.id}`);
  });
  await step('TC-331 #5', async () => {
    await dialog().getByRole('button', { name: 'Invite contacts' }).click();
    await box(page, /\bbob\b/).click();
    await dialog().getByRole('button', { name: 'Invite' }).click();
    const t = await toast(page, 'already has an invitation');
    ok('TC-331 #5 bob already invited', t.includes('bob already has an invitation to this group.'), t);
  });
  await step('TC-331 #6', async () => {
    const said = as('bob', `group join "#${G}"`);
    await page.keyboard.press('Escape');
    await dialog().waitFor({ state: 'detached', timeout: 5000 });
    const text = await until(async () => {
      await openDetails();
      const t = await dialog().innerText();
      if (!t.includes('2 members')) {
        await page.keyboard.press('Escape');
        await dialog().waitFor({ state: 'detached', timeout: 5000 });
      }
      return t;
    }, (t) => t.includes('2 members'));
    ok('TC-331 #6 2 members, bob listed', text.includes('2 members') && /\bbob\b/.test(text.split('Members')[1] ?? ''), said.trim().split('\n')[0]);
  });
  await step('TC-331 #7', async () => {
    await page.keyboard.press('Escape');
    await dialog().waitFor({ state: 'detached', timeout: 5000 });
    await dark(page);
    await openDetails();
    await wait(500);
    await shot(page, 'tc331-7-phone-dark');
    const b = await dialog().boundingBox();
    const cut = await clipped(dialog());
    const title = await contrast(dialog().getByRole('heading', { name: 'T330 ops' }));
    ok('TC-331 #7 phone, dark: fits, nothing cut', inWindow(b, 390, 844) && cut.length === 0 && title >= 4.5, `${JSON.stringify(b)} cut [${cut.join(' | ')}] title ${title}:1`);
    await page.keyboard.press('Escape');
    await dialog().waitFor({ state: 'detached', timeout: 5000 });
    await light(page);
  });

  // TC-332: requests to alice
  sh('IMBO_DATA_DIR=$L/server "$S" dev seed --homes $L/extra --names dave,erin > /dev/null');
  const dave = tokenOf(`${L}/extra/dave`);
  const erin = tokenOf(`${L}/extra/erin`);
  await api(dave, 'POST', '/v1/contacts/requests', { account_id: A, note: 'T332 我是 dave' });
  await api(erin, 'POST', '/v1/contacts/requests', { account_id: A });
  const row = (p, name) => p.locator('section[aria-labelledby="requests-heading"] li').filter({ has: p.getByRole('button', { name: `Accept, ${name}`, exact: true }) });
  await step('TC-332 #1', async () => {
    await toContacts();
    await requestsHeading().waitFor();
    await row(page, 'erin').waitFor();
    const d = await row(page, 'dave').innerText();
    const e = await row(page, 'erin').innerText();
    await shot(page, 'tc332-1');
    ok('TC-332 #1 two rows, dave with the note, Accept and Decline, no terminal hint',
      d.includes('T332 我是 dave') && !e.includes('T332') && /Accept[\s\S]*Decline/.test(d) && /Accept[\s\S]*Decline/.test(e) && !(await page.content()).includes('Answer in a terminal'),
      `${d} | ${e}`);
  });
  await step('TC-332 #2', async () => {
    await dark(page);
    await wait(400);
    await shot(page, 'tc332-2-phone-dark');
    const r = row(page, 'dave');
    const note = r.getByText('T332 我是 dave');
    const parts = [note, r.getByRole('button', { name: 'Accept, dave' }), r.getByRole('button', { name: 'Decline, dave' })];
    const boxes = await Promise.all(parts.map((x) => x.boundingBox()));
    const cut = await clipped(r);
    const c = await contrast(note);
    ok('TC-332 #2 phone, dark: note and buttons whole and readable', boxes.every((b) => inWindow(b, 390, 844)) && cut.length === 0 && c >= 4.5, `note ${c}:1 cut [${cut.join(' | ')}]`);
    await light(page);
  });
  await step('TC-332 #3', async () => {
    await page.getByRole('button', { name: 'Accept, dave', exact: true }).click();
    const t = await toast(page, 'now contacts');
    await row(page, 'dave').waitFor({ state: 'detached', timeout: 5000 });
    await contacts().getByText('dave').waitFor({ timeout: 8000 });
    const [, c] = await api(dave, 'GET', '/v1/contacts');
    ok('TC-332 #3 dave accepted', t.includes('You and dave are now contacts.') && c.contacts.some((x) => x.id === A), t);
  });
  await step('TC-332 #4', async () => {
    await page.getByRole('button', { name: 'Decline, erin', exact: true }).click();
    await row(page, 'erin').waitFor({ state: 'detached', timeout: 5000 });
    await requestsHeading().waitFor({ state: 'detached', timeout: 5000 });
    const listed = await contacts().getByText('erin').count();
    const [, rq] = await api(erin, 'GET', '/v1/requests?direction=out&status=all');
    const st = rq.requests.find((r) => r.to.id === A)?.status;
    ok('TC-332 #4 erin declined, Requests gone', listed === 0 && st === 'declined', `listed ${listed}, status ${st}`);
  });
  await step('TC-332 #5', async () => {
    await api(erin, 'POST', '/v1/contacts/requests', { account_id: A });
    const t0 = Date.now();
    await row(page, 'erin').waitFor({ timeout: 15000 });
    ok('TC-332 #5 erin back within 15 s', true, `${Math.round((Date.now() - t0) / 1000)} s`);
  });
  await step('TC-332 #6', async () => {
    const listed = as('alice', 'contact requests');
    const id = listed.match(/imbo contact accept (\d+)/)?.[1];
    as('alice', `contact accept ${id}`);
    await page.getByRole('button', { name: 'Accept, erin', exact: true }).click();
    const t = await toast(page, 'already');
    await row(page, 'erin').waitFor({ state: 'detached', timeout: 5000 });
    await contacts().getByText('erin').waitFor({ timeout: 15000 });
    await shot(page, 'tc332-6');
    ok('TC-332 #6 already accepted, erin a contact', t.includes('This request was already accepted.'), `request ${id} / ${t}`);
  });

  // TC-333: invitations to bob
  const bob = await newPage('bob');
  as('alice', `group create 'T333 lab'`);
  as('alice', `group create 'T333 skip'`);
  as('alice', `group invite 'T333 lab' ${B}`);
  as('alice', `group invite 'T333 skip' ${B}`);
  await step('TC-333 #1', async () => {
    await toContacts(bob);
    await bob.getByRole('button', { name: 'Accept, alice invited you to T333 skip' }).waitFor();
    const text = await bob.locator('section[aria-labelledby="requests-heading"]').innerText();
    await shot(bob, 'tc333-1');
    ok('TC-333 #1 two invitations with Accept and Decline',
      text.includes('alice invited you to T333 lab') && text.includes('alice invited you to T333 skip') &&
        (await bob.getByRole('button', { name: /^(Accept|Decline), alice invited you to T333 (lab|skip)$/ }).count()) === 4,
      text);
  });
  await step('TC-333 #2', async () => {
    await bob.getByRole('button', { name: 'Accept, alice invited you to T333 lab' }).click();
    await dialog(bob).getByRole('heading', { name: 'T333 lab' }).waitFor();
    await box(bob, /orders-api/).waitFor();
    const t = await toast(bob, 'You joined');
    await wait(300);
    const text = await dialog(bob).innerText();
    await shot(bob, 'tc333-2');
    ok('TC-333 #2 group chat with its details, orders-api unpicked',
      /\/chats\/\d+$/.test(bob.url()) && text.includes('2 members') && /alice\s*\n?\s*Owner/.test(text) && /bob\s*\n?\s*You/.test(text) && !(await checked(bob, /orders-api/)) &&
        t.includes('You joined T333 lab. Pick which sessions get its messages.'),
      `${t} / ${bob.url()}`);
  });
  await step('TC-333 #3', async () => {
    await box(bob, /orders-api/).click();
    await dialog(bob).getByRole('button', { name: 'Save' }).click();
    const t = await toast(bob, 'Saved.');
    ok('TC-333 #3 saved', t.includes("Saved. 1 session gets T333 lab's messages."), t);
  });
  await step('TC-333 #4', async () => {
    as('alice', `send 'T333 lab' 'T333 hello'`);
    let got = '';
    await until(() => (got += inbox('bob', 'orders-api')), (o) => o.includes('T333 hello'));
    ok('TC-333 #4 orders-api got it', got.includes('T333 hello'));
  });
  await step('TC-333 #5', async () => {
    await bob.keyboard.press('Escape');
    await dialog(bob).waitFor({ state: 'detached', timeout: 5000 });
    await toContacts(bob);
    await bob.getByRole('button', { name: 'Decline, alice invited you to T333 skip' }).click();
    await bob.getByRole('button', { name: 'Decline, alice invited you to T333 skip' }).waitFor({ state: 'detached', timeout: 5000 });
    await requestsHeading(bob).waitFor({ state: 'detached', timeout: 5000 });
    ok('TC-333 #5 declined, Requests gone', true);
  });
  await step('TC-333 #6', async () => {
    const list = as('alice', 'group list');
    const members = (name) => list.split('\n').map((l, i, all) => (l.startsWith(`${name} `) ? all[i + 1] : null)).find(Boolean)?.replace(/^\s*members\s+/, '').trim();
    const lab = members('T333 lab');
    const skip = members('T333 skip');
    ok('TC-333 #6 lab alice and bob, skip only alice', lab === 'alice owner, bob' && skip === 'alice owner', `lab: ${lab} / skip: ${skip}`);
  });
  await bob.context().close();

  // TC-342: change the email
  const emailRow = () => page.locator('main').getByText(/@imbo\.test$/).first();
  await step('TC-342 #1', async () => {
    await page.goto(base + '/account');
    await page.getByRole('button', { name: 'Change email' }).waitFor();
    const e = await emailRow().innerText();
    ok('TC-342 #1 Email alice@imbo.test with Change', e === 'alice@imbo.test' && (await page.getByRole('button', { name: 'Change email' }).innerText()) === 'Change', e);
  });
  const emailBox = () => dialog().getByLabel('New email');
  await step('TC-342 #2', async () => {
    await page.getByRole('button', { name: 'Change email' }).click();
    await dialog().getByRole('heading', { name: 'Change email' }).waitFor();
    await shot(page, 'tc342-2');
    ok('TC-342 #2 New email, hint, Send code disabled',
      (await emailBox().isVisible()) && (await dialog().innerText()).includes("We'll send a code to the new email.") && (await dialog().getByRole('button', { name: 'Send code' }).isDisabled()));
  });
  await step('TC-342 #3', async () => {
    await emailBox().fill('bob@imbo.test');
    await dialog().getByRole('button', { name: 'Send code' }).click();
    await dialog().getByText('That email is already used by another Imbo account.').waitFor({ timeout: 5000 });
    ok('TC-342 #3 taken, still on the email', await emailBox().isVisible());
  });
  await step('TC-342 #4', async () => {
    await emailBox().fill('alice@imbo.test');
    await dialog().getByRole('button', { name: 'Send code' }).click();
    await dialog().getByText("That's already your email.").waitFor({ timeout: 5000 });
    await shot(page, 'tc342-4');
    ok('TC-342 #4 same email', true);
  });
  let before = 0;
  await step('TC-342 #5', async () => {
    before = codeLines('t342@imbo.test').length;
    await emailBox().fill('t342@imbo.test');
    await dialog().getByRole('button', { name: 'Send code' }).click();
    await dialog().getByText('Enter the code we sent to').waitFor({ timeout: 5000 });
    const text = await dialog().innerText();
    await wait(1200);
    const later = await dialog().innerText();
    const n = (t) => Number(t.match(/Send a new code in (\d+) s/)?.[1]);
    await shot(page, 'tc342-5');
    ok('TC-342 #5 code step, countdown running', text.includes('Enter the code we sent to t342@imbo.test') && n(later) < n(text), `${n(text)} s → ${n(later)} s`);
  });
  await step('TC-342 #6', async () => {
    const code = await codeFor('t342@imbo.test', before);
    await dialog().getByLabel('Code').fill(code === '000000' ? '111111' : '000000');
    await dialog().getByRole('button', { name: 'Change email' }).click();
    await dialog().getByText('Wrong code. 4 tries left.').waitFor({ timeout: 5000 });
    await shot(page, 'tc342-6');
    ok('TC-342 #6 wrong code', true);
  });
  await step('TC-342 #7', async () => {
    await dialog().getByLabel('Code').fill(await codeFor('t342@imbo.test', before));
    await dialog().getByRole('button', { name: 'Change email' }).click();
    await dialog().waitFor({ state: 'detached', timeout: 8000 });
    const t = await toast(page, 'Email changed');
    await page.locator('main').getByText('t342@imbo.test').waitFor({ timeout: 5000 });
    await shot(page, 'tc342-7');
    ok('TC-342 #7 changed', t.includes('Email changed to t342@imbo.test.'), t);
  });
  await step('TC-342 #8', async () => {
    await page.reload();
    await page.getByRole('button', { name: 'Change email' }).waitFor();
    const e = await emailRow().innerText();
    ok('TC-342 #8 still signed in, new email', !page.url().includes('/login') && e === 't342@imbo.test', `${page.url()} / ${e}`);
  });
  await step('TC-342 #9', async () => {
    await dark(page);
    await page.getByRole('button', { name: 'Change email' }).click();
    await dialog().getByRole('heading', { name: 'Change email' }).waitFor();
    await wait(400);
    await shot(page, 'tc342-9-phone-dark');
    const b = await dialog().boundingBox();
    const hint = await contrast(dialog().getByText("We'll send a code to the new email."));
    await page.keyboard.press('Escape');
    await dialog().waitFor({ state: 'detached', timeout: 5000 });
    ok('TC-342 #9 phone, dark: fits, readable, Esc closes', inWindow(b, 390, 844) && hint >= 4.5, `${JSON.stringify(b)} hint ${hint}:1`);
    await light(page);
  });
  current = 'TC-342 #10';
  const unexpected = consoleErrors.filter(([at, text]) => !(expected[at] && expected[at].test(text)));
  const seen = Object.keys(expected).map((at) => `${at}: ${consoleErrors.filter(([s, t]) => s === at && expected[at].test(t)).length}`);
  ok('TC-342 #10 no console errors but the expected ones', unexpected.length === 0, seen.join(', '));
  for (const [at, text] of unexpected) console.log(`  unexpected at ${at}: ${text.slice(0, 200)}`);
} catch (e) {
  ok(`aborted at ${current}`, false, e.message.split('\n')[0]);
} finally {
  await browser.close();
}
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(`${failed} failed`);
process.exit(failed ? 1 : 0);
