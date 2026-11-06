// TC-572 (docs/TEST.md): the message box is one line tall when empty, grows with its text up to four lines, then
// scrolls inside without a scrollbar, against the local test server, started with `crates/scripts/local-env.sh up
// alice:bob`; the page must be http://localhost:5190 (`npm run dev`). Sets up the rest of the 前置 itself.
// Prints PASS/FAIL per step, then any console errors the steps don't expect. Codes are read from $L/server.log and never
// printed.
// usage: node web/app/tests/composer.mjs <screenshot dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const crates = new URL('../../../crates/', import.meta.url).pathname;
const base = 'http://localhost:5190';
const L = '/tmp/imbo-t';
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const sh = (cmd) => execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8' });
const as = (who, args) => sh(`IMBO_HOME=$L/${who} "$IMBO" ${args} 2>&1`);
const ids = Object.fromEntries(fs.readFileSync(`${L}/ids.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').slice(0, 2)));
as('alice', 'dev fake-session 55000000-0000-0000-0000-000000572001 --title t572');
as('bob', `send ${ids.alice} 'T572 hi'`);
const ok = (name, cond, detail = '') => console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, ' ')}` : ''}`);
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

let current = 'login';
const consoleErrors = [];
const step = async (name, fn) => {
  current = name;
  try {
    await fn();
  } catch (e) {
    ok(name, false, e.message.split('\n')[0]);
  }
};
// The box and its outline, in CSS pixels.
const measure = (page) =>
  page.locator('textarea.composer').evaluate((ta) => {
    const cs = getComputedStyle(ta);
    const shell = ta.closest('.composer-shell');
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    return {
      h: ta.offsetHeight,
      shell: shell.offsetHeight,
      line: parseFloat(cs.lineHeight),
      pad,
      one: parseFloat(cs.lineHeight) + pad,
      four: 4 * parseFloat(cs.lineHeight) + pad,
      top: ta.scrollTop,
      client: ta.clientHeight,
      scroll: ta.scrollHeight,
      bar: ta.offsetWidth - ta.clientWidth,
      bottom: shell.getBoundingClientRect().bottom,
      buttons: [...ta.closest('form').querySelectorAll('button')].map((b) => b.getBoundingClientRect().bottom),
    };
  });
const near = (a, b, d = 1) => Math.abs(a - b) <= d;
const lines = (n, from = 1) =>
  Array.from({ length: n }, (_, i) => `T572 ${from + i}`);
// Types the lines one by one, Shift+Enter between them, as a person would.
async function typeLines(page, ls, first) {
  const box = page.locator('textarea.composer');
  for (const [i, l] of ls.entries()) {
    if (i > 0 || !first) await box.press('Shift+Enter');
    await box.pressSequentially(l, { delay: 0 });
  }
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const page = await ctx.newPage();
  // Before signing in, the page asks who is signed in and gets 401.
  page.on('console', (m) => m.type() === 'error' && !(current === 'login' && m.text().includes('401')) && consoleErrors.push([current, m.text()]));
  page.on('pageerror', (e) => consoleErrors.push([current, `pageerror: ${e.message}`]));
  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');
  const { cookies } = await ctx.storageState();
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  const openBob = async (p) => {
    await p.goto(base + '/chats');
    await p.getByRole('navigation', { name: /Chats|对话/ }).getByRole('link', { name: /^bob/ }).first().click();
    await p.locator('textarea.composer').waitFor();
    await wait(400);
  };

  await step('TC-572 #1', async () => {
    await openBob(page);
    const m = await measure(page);
    const hint = await page.locator('textarea.composer').getAttribute('placeholder');
    const aligned = m.buttons.every((b) => near(b, m.bottom, 8));
    await shot(page, 'tc572-1');
    ok('TC-572 #1 empty box is one line tall, buttons along its bottom', near(m.h, m.one) && hint === "Message bob's inbox" && aligned, JSON.stringify({ ...m, hint }));
  });
  await step('TC-572 #2', async () => {
    await page.locator('textarea.composer').click();
    await typeLines(page, lines(2), true);
    await wait(300);
    const m = await measure(page);
    await shot(page, 'tc572-2');
    ok('TC-572 #2 two lines: box grows to 2 lines, outline follows', near(m.h, 2 * m.line + m.pad) && near(m.shell, m.h + 2), JSON.stringify(m));
  });
  await step('TC-572 #3', async () => {
    await typeLines(page, lines(2, 3), false);
    await wait(300);
    const m = await measure(page);
    await shot(page, 'tc572-3');
    ok('TC-572 #3 four lines: box is four lines tall, nothing scrolled', near(m.h, m.four) && m.top === 0, JSON.stringify(m));
  });
  await step('TC-572 #4', async () => {
    await typeLines(page, lines(36, 5), false);
    await wait(300);
    const m = await measure(page);
    await shot(page, 'tc572-4');
    ok('TC-572 #4 forty lines: box stays four lines, scrolled to the end, no scrollbar', near(m.h, m.four) && near(m.top + m.client, m.scroll) && m.bar === 0, JSON.stringify(m));
  });
  await step('TC-572 #5', async () => {
    await page.locator('textarea.composer').press('Enter');
    await page.locator('main article', { hasText: 'T572 40' }).first().waitFor({ timeout: 10_000 });
    await wait(400);
    const m = await measure(page);
    const v = await page.locator('textarea.composer').inputValue();
    await shot(page, 'tc572-5');
    ok('TC-572 #5 sent: box empty, back to one line', v === '' && near(m.h, m.one), JSON.stringify({ ...m, v }));
  });
  await step('TC-572 #6', async () => {
    await page.goto(base + '/sessions');
    await page.getByRole('navigation', { name: 'Sessions' }).getByRole('link', { name: /t572/ }).click();
    await page.locator('textarea.composer').waitFor();
    await wait(400);
    const m = await measure(page);
    await shot(page, 'tc572-6');
    ok('TC-572 #6 session pane: empty box is one line tall', near(m.h, m.one), JSON.stringify(m));
  });
  await step('TC-572 #7', async () => {
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
    await ctx2.addCookies(cookies);
    const p = await ctx2.newPage();
    p.on('console', (m) => m.type() === 'error' && consoleErrors.push([current, m.text()]));
    await openBob(p);
    const empty = await measure(p);
    const hint = await p.locator('textarea.composer').getAttribute('placeholder');
    await shot(p, 'tc572-7-empty');
    await p.locator('textarea.composer').click();
    await typeLines(p, lines(40), true);
    await wait(300);
    const full = await measure(p);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await shot(p, 'tc572-7-full');
    await p.locator('textarea.composer').fill('');
    await ctx2.close();
    ok('TC-572 #7 390 wide, Chinese: one line empty, four lines when full, no sideways overflow', near(empty.h, empty.one) && hint === '给 bob 的收件箱 发消息' && near(full.h, full.four) && full.bar === 0 && wide === 0, JSON.stringify({ empty: empty.h, one: empty.one, hint, full: full.h, four: full.four, wide }));
  });
} finally {
  await browser.close();
}
for (const [where, text] of consoleErrors) console.log(`console error (${where}): ${text}`);
