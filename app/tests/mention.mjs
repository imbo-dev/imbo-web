// TC-460, TC-471 and TC-476 (docs/TEST.md): typing @ in a group chat lists the other members and the sessions that get the group's
// messages, filters them, puts in a name, highlights it and takes it out whole, against the local test server. Setup is the TC's 前置 (§3「群里 @ 人与 @ 列表」); the
// page must be http://localhost:5190 (`npm run dev`). Prints PASS/FAIL per step, then any console errors the steps don't
// expect; carol's second session is removed when done. Codes are read from $L/server.log and never printed.
// usage: node web/app/tests/mention.mjs <screenshot dir>
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
const sh = (cmd, env = {}) =>
  execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8', env: { ...process.env, ...env } }).replace(/\x1b\[[0-9;]*m/g, '');
const as = (who, args, env) => sh(`IMBO_HOME=$L/${who} "$IMBO" ${args}`, env);
const ids = Object.fromEntries(fs.readFileSync(`${L}/ids.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').slice(0, 2)));
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

// TC-460 前置: each picks sessions for release-team; carol adds a second one named like bob.
const CAROL_BOB = '55555555-aaaa-bbbb-cccc-0000000c0002';
as('alice', 'group sessions release-team --sessions 0a0001');
as('bob', 'group sessions release-team --sessions 0b0001');
as('carol', `dev fake-session ${CAROL_BOB} --title bob`);
as('carol', 'group sessions release-team --sessions 0c0001,0c0002');

let current = 'login';
const consoleErrors = [];
const expected = { 'login alice': /status of 401 / };
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
  const context = async (viewport, cookies) => {
    const ctx = await browser.newContext({ viewport, locale: 'en-US', ...(cookies && { storageState: { cookies, origins: [] } }) });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push([current, `alice ${viewport.width}: ${m.text()}`]));
    page.on('pageerror', (e) => consoleErrors.push([current, `alice ${viewport.width} pageerror: ${e.message}`]));
    return page;
  };
  const page = await context({ width: 1280, height: 800 });
  current = 'login alice';
  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');
  const { cookies } = await page.context().storageState();

  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  const openChat = async (p, name) => {
    await p.goto(base + '/chats');
    await p.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: new RegExp(`^${name}`) }).first().click();
    await p.getByRole('textbox', { name: `Message ${name}` }).waitFor();
    await p.locator('main article').first().waitFor();
  };
  const list = (p) => p.getByRole('listbox', { name: 'Members and sessions to mention' });
  // The rows as the list shows them: whether each is a member or a session, its name, and whose session it is.
  const rows = (p) =>
    list(p).evaluate((l) =>
      [...l.querySelectorAll('[role=group]')].flatMap((g) => {
        const part = document.getElementById(g.getAttribute('aria-labelledby')).textContent;
        return [...g.querySelectorAll('[role=option]')].map((o) => {
          const [name, owner] = [...o.querySelectorAll('span.truncate')].map((s) => s.textContent);
          return `${part === 'Members' ? 'member' : 'session'} ${name}${owner ? ` (${owner})` : ''}${o.getAttribute('aria-selected') === 'true' ? ' *' : ''}`;
        });
      })
    );
  const box = page.getByRole('textbox', { name: 'Message release-team' });
  const restart = async (typed) => {
    await box.fill('');
    await box.pressSequentially(typed);
  };
  const shown = async () => list(page).isVisible();

  await step('TC-460 #1', async () => {
    await openChat(page, 'release-team');
    await restart('@');
    await list(page).waitFor();
    const r = await rows(page);
    await shot(page, 'tc460-1');
    const want = ['member bob *', 'member carol', 'session checkout (alice)', 'session orders-api (bob)', 'session billing (carol)', 'session bob (carol)'];
    ok('TC-460 #1 @: members bob, carol, then sessions checkout, orders-api, billing, bob; no alice', r.join('|') === want.join('|'), r.join(' / '));
  });
  await step('TC-460 #2', async () => {
    await box.pressSequentially('B');
    await wait(200);
    const r = await rows(page);
    await shot(page, 'tc460-2');
    ok('TC-460 #2 @B: member bob, session billing, session bob', r.join('|') === ['member bob *', 'session billing (carol)', 'session bob (carol)'].join('|'), r.join(' / '));
  });
  await step('TC-460 #3', async () => {
    await box.press('Enter');
    await wait(200);
    const v = await box.inputValue();
    ok("TC-460 #3 Enter: bob's account ID goes in (a session is also named bob), the list closes", v === `@${ids.bob} ` && !(await shown()), JSON.stringify(v));
  });
  await step('TC-460 #4', async () => {
    await restart('@bill');
    await box.press('Tab');
    await wait(200);
    const v = await box.inputValue();
    ok('TC-460 #4 @bill + Tab: @billing, the list closes', v === '@billing ' && !(await shown()), JSON.stringify(v));
  });
  await step('TC-460 #5', async () => {
    await restart('@zz');
    await wait(200);
    const v = await box.inputValue();
    ok('TC-460 #5 @zz: no list', v === '@zz' && !(await shown()), JSON.stringify(v));
  });
  await step('TC-460 #6', async () => {
    await restart('@');
    await list(page).waitFor();
    await box.press('Escape');
    await wait(200);
    const v = await box.inputValue();
    ok('TC-460 #6 @ + Esc: the list closes, @ stays', v === '@' && !(await shown()), JSON.stringify(v));
  });
  await step('TC-460 #7', async () => {
    await restart('@car');
    await box.press('Enter');
    await box.pressSequentially('看下 T460');
    await box.press('Enter');
    const row = page.locator('main article', { hasText: '@carol 看下 T460' }).last();
    await row.locator('time').waitFor();
    await shot(page, 'tc460-7');
    const lines = as('carol', 'inbox').split('\n');
    const head = lines.findIndex((l) => l.includes('alice · Web @ release-team'));
    const inbox = lines.findIndex((l) => l.startsWith('Inbox'));
    ok(
      "TC-460 #7 sent; carol's imbo inbox lists it under Inbox from alice · Web @ release-team",
      inbox >= 0 && head > inbox && lines[head + 1]?.includes('T460') && (await box.inputValue()) === '',
      `${lines[inbox] ?? 'no Inbox line'} | ${(lines[head] ?? 'no alice · Web @ release-team line').trim()} | ${(lines[head + 1] ?? '').trim()}`
    );
  });
  // TC-471: Backspace that reaches into an @name takes all of it, in the same window, after TC-460 #7.
  const reads = async (want) => {
    await wait(200);
    const v = await box.inputValue();
    return [v === want, JSON.stringify(v)];
  };
  await step('TC-471 #1', async () => {
    await restart('@car');
    await box.press('Enter');
    const [same, v] = await reads('@carol ');
    ok('TC-471 #1 @car + Enter: @carol and a space, the list closes', same && !(await shown()), v);
  });
  await step('TC-471 #2', async () => {
    await box.press('Backspace');
    ok('TC-471 #2 Backspace: the space after the name goes first', ...(await reads('@carol')));
  });
  await step('TC-471 #3', async () => {
    await box.press('Backspace');
    ok('TC-471 #3 Backspace again: all of @carol goes at once', ...(await reads('')));
  });
  await step('TC-471 #4', async () => {
    await restart('看 @carol 和 @billing 吧');
    for (let n = 0; n < 6; n++) await box.press('ArrowLeft');
    await box.press('Backspace');
    const [same, v] = await reads('看 @carol 和  吧');
    const open = await shown();
    await box.pressSequentially('x');
    const [after, w] = await reads('看 @carol 和 x 吧');
    ok('TC-471 #4 Backspace inside @billing: all of it goes, the list closes, the caret is where it was', same && !open && after, `${v} then ${w}`);
  });
  await step('TC-471 #5', async () => {
    await restart('@CAROL');
    await box.press('Backspace');
    ok('TC-471 #5 @CAROL typed by hand: goes whole too', ...(await reads('')));
  });
  await step('TC-471 #6', async () => {
    await restart('@car');
    await box.press('Backspace');
    ok("TC-471 #6 @car isn't a name: one letter at a time", ...(await reads('@ca')));
  });
  await step('TC-471 #7', async () => {
    await restart('@carol 好');
    for (let n = 0; n < 4; n++) await box.press('Shift+ArrowLeft');
    await box.press('Backspace');
    ok('TC-471 #7 a selection over part of the name takes the whole name', ...(await reads('')));
    await box.fill('');
  });
  // TC-476: the layer behind the box marks each @name; it must lay out and scroll as the box does.
  const marks = () =>
    box.evaluate((ta) => {
      const layer = ta.previousElementSibling?.matches('[aria-hidden]') ? ta.previousElementSibling : undefined;
      const r = ta.getBoundingClientRect();
      return {
        texts: layer ? [...layer.querySelectorAll('mark')].map((m) => m.textContent) : [],
        // Each mark: whether it shows within the box.
        inside: layer ? [...layer.querySelectorAll('mark')].map((m) => { const b = m.getBoundingClientRect(); return b.top >= r.top && b.bottom <= r.bottom; }) : [],
        tall: layer ? [layer.scrollHeight, ta.scrollHeight] : [],
        scrolled: layer ? [layer.scrollTop, ta.scrollTop] : [],
        colors: layer ? [getComputedStyle(layer.querySelector('mark')).backgroundColor, getComputedStyle(ta.parentElement).backgroundColor] : [],
      };
    });
  await step('TC-476 #1', async () => {
    await restart('看 @carol 和 @zz 吧');
    await wait(200);
    const m = await marks();
    await shot(page, 'tc476-1');
    ok('TC-476 #1 only @carol is marked, the layer lays out as the box does', m.texts.join('|') === '@carol' && m.tall[0] === m.tall[1] && m.colors[0] !== m.colors[1], JSON.stringify(m));
  });
  await step('TC-476 #2', async () => {
    for (let n = 0; n < 8; n++) await box.press('Shift+Enter');
    await box.pressSequentially('@billing');
    await wait(300);
    const m = await marks();
    await shot(page, 'tc476-2');
    ok('TC-476 #2 nine lines down: the box scrolls, @billing is still marked under it', m.texts.join('|') === '@carol|@billing' && m.scrolled[1] > 0 && m.scrolled[0] === m.scrolled[1] && m.inside.join() === 'false,true', JSON.stringify(m));
    await box.fill('');
  });
  await step('TC-460 #8', async () => {
    await openChat(page, 'bob');
    const dm = page.getByRole('textbox', { name: /^Message bob/ });
    await dm.pressSequentially('@');
    await wait(300);
    ok('TC-460 #8 the direct chat with bob: no list', !(await page.getByRole('listbox').count()));
    await dm.fill('');
  });
  // The list on a phone-sized window, for the record.
  current = 'phone';
  const phone = await context({ width: 390, height: 844 }, cookies);
  await openChat(phone, 'release-team');
  await phone.getByRole('textbox', { name: 'Message release-team' }).pressSequentially('@');
  await list(phone).waitFor();
  await shot(phone, 'tc460-390');
  await phone.getByRole('textbox', { name: 'Message release-team' }).fill('');
} finally {
  await browser.close();
  as('carol', `dev fake-session ${CAROL_BOB} --title bob --remove`);
}
const unexpected = consoleErrors.filter(([at, text]) => !expected[at]?.test(text));
for (const [at, text] of unexpected) console.log(`console error during ${at}: ${text}`);
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(`${failed} failed, ${unexpected.length} unexpected console errors`);
process.exit(failed || unexpected.length ? 1 : 0);
