// TC-570 (docs/TEST.md): unsent text shown as a draft in the web chat list, against the local test server, started with
// `crates/scripts/local-env.sh up alice:bob,alice:carol`; the page must be http://localhost:5190 (`npm run dev`). Sets up
// the 前置 itself. Prints PASS/FAIL per step, then any unexpected console errors. Codes are read from $L/server.log and
// never printed.
// usage: node web/app/tests/draft.mjs <screenshot dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const crates = new URL('../../../crates/', import.meta.url).pathname;
const base = 'http://localhost:5190';
const L = '/tmp/imbo-t';
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const errors = [];
const checks = [];
const ok = (name, cond, detail = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, ' ')}` : ''}`);
const sh = (cmd) => execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8' });
const as = (who, args) => sh(`IMBO_HOME=$L/${who} "$IMBO" ${args} 2>&1`);
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

// 前置: list from the top carol, bob.
as('bob', `send ${ids.alice} 'T570 bob 一'`);
as('carol', `send ${ids.alice} 'T570 carol 一'`);

const browser = await chromium.launch();
const step = async (id, fn) => {
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};
async function until(fn, ms = 12_000) {
  for (const end = Date.now() + ms; Date.now() < end; await wait(250)) if (await fn()) return true;
  return false;
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  // Expected: the 401 of /v1/me before signing in.
  page.on('console', (m) => m.type() === 'error' && !/status of 401 /.test(m.text()) && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
  const list = () => page.getByRole('navigation', { name: 'Chats' });
  const rowOf = (title) => list().locator('a', { has: page.locator('span.block.truncate.text-body', { hasText: new RegExp(`^${title}`) }) });
  const preview = (title) => rowOf(title).locator('span.block.truncate.text-caption').innerText();
  const order = () => list().locator('a span.block.truncate.text-body').evaluateAll((els) => els.map((e) => e.firstChild.textContent));
  const composer = () => page.locator('textarea.composer');
  // The warning colour as the page resolves it, and the colour the Draft label is drawn in.
  const warning = () => page.evaluate(() => {
    const p = document.createElement('span');
    p.style.color = 'var(--semantic-color-feedback-warning)';
    document.body.append(p);
    const c = getComputedStyle(p).color;
    p.remove();
    return c;
  });
  const label = (title) => rowOf(title).locator('span.block.truncate.text-caption > span').evaluate((el) => [el.textContent, getComputedStyle(el).color]);

  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');
  await rowOf('bob').waitFor();

  await step('1 text left in bob, then carol opened: Draft: in the warning colour and the text on one line, time and order kept', async () => {
    const time = await rowOf('bob').locator('time').innerText();
    const was = await order();
    await rowOf('bob').click();
    await composer().pressSequentially('T570 第一行');
    await composer().press('Shift+Enter');
    await composer().pressSequentially('第二行');
    await rowOf('carol').click();
    const p = await preview('bob');
    const [text, color] = await label('bob');
    const w = await warning();
    const now = await order();
    await shot('01-draft');
    ok('1 text left in bob, then carol opened: Draft: in the warning colour and the text on one line, time and order kept', p === 'Draft: T570 第一行 第二行' && text === 'Draft:' && color === w && (await rowOf('bob').locator('time').innerText()) === time && now.join() === was.join(), `"${p}"; label ${color} vs warning ${w}; order ${was} → ${now}`);
  });
  await step('2 back in bob: the text is still in the box, its own row shows the last message', async () => {
    await rowOf('bob').click();
    const v = await composer().inputValue();
    const p = await preview('bob');
    ok('2 back in bob: the text is still in the box, its own row shows the last message', v === 'T570 第一行\n第二行' && !p.startsWith('Draft') && p.includes('T570 bob 一'), `box "${v}"; row "${p}"`);
  });
  await step('3 only spaces left, then carol: no draft', async () => {
    await composer().fill('   ');
    await rowOf('carol').click();
    const p = await preview('bob');
    ok('3 only spaces left, then carol: no draft', !p.startsWith('Draft') && p.includes('T570 bob 一'), `"${p}"`);
  });
  await step('4 sent: the row shows the sent message, no draft', async () => {
    await rowOf('bob').click();
    await composer().fill('T570 发出去');
    await composer().press('Enter');
    await rowOf('carol').click();
    const sent = await until(async () => (await preview('bob')) === 'You: T570 发出去');
    ok('4 sent: the row shows the sent message, no draft', sent, `"${await preview('bob')}"`);
  });
  await step('5 a reload drops the draft', async () => {
    await composer().fill('T570 刷新前');
    await rowOf('bob').click();
    const on = await preview('carol');
    await page.reload();
    await rowOf('carol').waitFor();
    const off = await preview('carol');
    await rowOf('carol').click();
    const v = await composer().inputValue();
    ok('5 a reload drops the draft', on === 'Draft: T570 刷新前' && !off.startsWith('Draft') && v === '', `before "${on}"; after "${off}"; box "${v}"`);
  });
  await step('6 at 390×844: back from a long draft, the row fits, no sideways scroll', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await composer().fill('T570 手机上的草稿，写得很长很长很长很长很长很长很长很长很长很长很长很长很长很长');
    await page.getByRole('link', { name: 'Back to chats' }).click();
    await rowOf('carol').waitFor();
    const [text, color] = await label('carol');
    const w = await warning();
    const b = await rowOf('carol').boundingBox();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth);
    await shot('06-phone');
    ok('6 at 390×844: back from a long draft, the row fits, no sideways scroll', text === 'Draft:' && color === w && b.x >= 0 && b.x + b.width <= 390 && wide <= 390, `label ${color} vs warning ${w}; row right ${Math.round(b.x + b.width)}; page ${wide} wide`);
  });
} finally {
  await browser.close();
}
console.log(checks.join('\n'));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : '\nno console errors');
