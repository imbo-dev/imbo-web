// TC-550 (docs/TEST.md): the message box is three lines tall when empty, grows with its text up to 40% of the chat pane,
// then scrolls inside without a scrollbar. Setup is the TC's 前置; the page must be http://localhost:5190 (`npm run dev`).
// Prints PASS/FAIL per step, then any console errors the steps don't expect. Codes are read from $L/server.log and never
// printed.
// usage: node web/app/tests/composer.mjs <screenshot dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const base = 'http://localhost:5190';
const L = '/tmp/imbo-t';
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
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
// The box, its outline and the pane it's a share of, in CSS pixels.
const measure = (page) =>
  page.locator('textarea.composer').evaluate((ta) => {
    const cs = getComputedStyle(ta);
    const shell = ta.closest('.composer-shell');
    const main = ta.closest('main');
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    return {
      h: ta.offsetHeight,
      shell: shell.offsetHeight,
      line: parseFloat(cs.lineHeight),
      pad,
      three: 3 * parseFloat(cs.lineHeight) + pad,
      cap: main.clientHeight * 0.4,
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
  Array.from({ length: n }, (_, i) => `T550 ${from + i}`);
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

  await step('TC-550 #1', async () => {
    await openBob(page);
    const m = await measure(page);
    const hint = await page.locator('textarea.composer').getAttribute('placeholder');
    const aligned = m.buttons.every((b) => near(b, m.bottom, 8));
    await shot(page, 'tc550-1');
    ok('TC-550 #1 empty box is three lines tall, buttons along its bottom', near(m.h, m.three) && hint === "Message bob's inbox" && aligned, JSON.stringify({ ...m, hint }));
  });
  await step('TC-550 #2', async () => {
    await page.locator('textarea.composer').click();
    await typeLines(page, lines(5), true);
    await wait(300);
    const m = await measure(page);
    await shot(page, 'tc550-2');
    ok('TC-550 #2 five lines: box grows to 5 lines, outline follows', near(m.h, 5 * m.line + m.pad) && near(m.shell, m.h + 2), JSON.stringify(m));
  });
  await step('TC-550 #3', async () => {
    await typeLines(page, lines(35, 6), false);
    await wait(300);
    const m = await measure(page);
    await shot(page, 'tc550-3');
    ok('TC-550 #3 forty lines: box stops at 40% of the pane, scrolled to the end, no scrollbar', near(m.h, m.cap) && near(m.top + m.client, m.scroll) && m.bar === 0, JSON.stringify(m));
  });
  await step('TC-550 #4', async () => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await wait(400);
    const m = await measure(page);
    await shot(page, 'tc550-4');
    ok('TC-550 #4 shorter window: the limit follows the pane', near(m.h, m.cap) && m.cap < 0.4 * 700, JSON.stringify(m));
  });
  await step('TC-550 #5', async () => {
    await page.locator('textarea.composer').press('Enter');
    await page.locator('main article', { hasText: 'T550 40' }).first().waitFor({ timeout: 10_000 });
    await wait(400);
    const m = await measure(page);
    const v = await page.locator('textarea.composer').inputValue();
    await shot(page, 'tc550-5');
    ok('TC-550 #5 sent: box empty, back to three lines', v === '' && near(m.h, m.three), JSON.stringify({ ...m, v }));
  });
  await step('TC-550 #6', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base + '/sessions');
    await page.getByRole('navigation', { name: 'Sessions' }).getByRole('link', { name: /t550/ }).click();
    await page.locator('textarea.composer').waitFor();
    await wait(400);
    const m = await measure(page);
    await shot(page, 'tc550-6');
    ok('TC-550 #6 session pane: empty box is three lines tall', near(m.h, m.three), JSON.stringify(m));
  });
  await step('TC-550 #7', async () => {
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
    await ctx2.addCookies(cookies);
    const p = await ctx2.newPage();
    p.on('console', (m) => m.type() === 'error' && consoleErrors.push([current, m.text()]));
    await openBob(p);
    const empty = await measure(p);
    const hint = await p.locator('textarea.composer').getAttribute('placeholder');
    await shot(p, 'tc550-7-empty');
    await p.locator('textarea.composer').click();
    await typeLines(p, lines(40), true);
    await wait(300);
    const full = await measure(p);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await shot(p, 'tc550-7-full');
    await p.locator('textarea.composer').fill('');
    await ctx2.close();
    ok('TC-550 #7 390 wide, Chinese: three lines empty, 40% when full, no sideways overflow', near(empty.h, empty.three) && hint === '给 bob 的收件箱 发消息' && near(full.h, full.cap) && full.bar === 0 && wide === 0, JSON.stringify({ empty: empty.h, three: empty.three, hint, full: full.h, cap: full.cap, wide }));
  });
} finally {
  await browser.close();
}
for (const [where, text] of consoleErrors) console.log(`console error (${where}): ${text}`);
