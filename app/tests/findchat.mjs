// TC-571 (docs/TEST.md): finding a chat by name at the top of the web chat list, against the local test server, started
// with `crates/scripts/local-env.sh up alice:bob,alice:carol`; the page must be http://localhost:5190 (`npm run dev`). Sets
// up the 前置 itself. Prints PASS/FAIL per step, then any unexpected console errors. Codes are read from $L/server.log and
// never printed.
// usage: node web/app/tests/findchat.mjs <screenshot dir>
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

// 前置: list from the top T571设计组, carol, bob.
as('bob', `send ${ids.alice} 'T571 bob 一'`);
as('carol', `send ${ids.alice} 'T571 carol 一'`);
as('alice', 'group create T571设计组');
as('alice', `group invite T571设计组 ${ids.bob}`);
as('bob', 'group join T571设计组');
as('alice', "send T571设计组 'T571 群一'");

const browser = await chromium.launch();
const step = async (id, fn) => {
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  // Expected: the 401 of /v1/me before signing in.
  page.on('console', (m) => m.type() === 'error' && !/status of 401 /.test(m.text()) && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  // Anything the page asks the server for that carries what was typed.
  const asked = [];
  // Only strings no address of the page holds by itself: "bo" is in /v1/inbox.
  const typed = ['BO', 't571', '设计', 'zzz'];
  page.on('request', (r) => {
    const u = decodeURIComponent(r.url());
    if (typed.some((x) => u.includes(x))) asked.push(u);
  });
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
  const list = () => page.getByRole('navigation', { name: 'Chats', includeHidden: true });
  const titles = () => list().locator('a span.block.truncate.text-body').evaluateAll((els) => els.map((e) => e.firstChild.textContent));
  const box = () => page.getByRole('searchbox', { name: 'Search chats' });
  const rowOf = (title) => list().locator('a', { has: page.locator('span.block.truncate.text-body', { hasText: new RegExp(`^${title}`) }) });
  const empty = () => page.getByRole('status').filter({ hasText: /^No chat names contain/ });

  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');
  await rowOf('bob').waitFor();
  const all = await titles();

  await step('1 the box is above New group; BO leaves bob', async () => {
    const [b, g] = [await box().boundingBox(), await page.getByRole('button', { name: 'New group' }).boundingBox()];
    await box().fill('BO');
    const t = await titles();
    await shot('01-bo');
    ok('1 the box is above New group; BO leaves bob', b.y + b.height <= g.y && t.join() === 'bob', `box bottom ${Math.round(b.y + b.height)}, New group top ${Math.round(g.y)}; ${t}`);
  });
  await step('2 t571 and 设计 both leave the group', async () => {
    await box().fill('t571');
    const a = await titles();
    await box().fill('设计');
    const z = await titles();
    ok('2 t571 and 设计 both leave the group', a.join() === 'T571设计组' && z.join() === 'T571设计组', `t571 → ${a}; 设计 → ${z}`);
  });
  await step('3 nothing matches: the list goes, a line says so', async () => {
    await box().fill('zzz');
    const shown = await list().isVisible();
    const line = await empty().innerText();
    await shot('03-none');
    ok('3 nothing matches: the list goes, a line says so', !shown && line === 'No chat names contain “zzz”', `list visible ${shown}; "${line}"`);
  });
  await step('4 Esc empties the box, every chat back in its order', async () => {
    await box().press('Escape');
    const v = await box().inputValue();
    const t = await titles();
    ok('4 Esc empties the box, every chat back in its order', v === '' && t.join() === all.join() && t.length === 3, `box "${v}"; ${t} vs ${all}`);
  });
  await step('5 opening a chat found keeps the box and the narrowed list', async () => {
    await box().fill('car');
    await rowOf('carol').click();
    await page.waitForURL(/\/chats\/\d+$/);
    await page.locator('textarea.composer').waitFor();
    const v = await box().inputValue();
    const t = await titles();
    ok('5 opening a chat found keeps the box and the narrowed list', v === 'car' && t.join() === 'carol', `box "${v}"; ${t}`);
  });
  await step('6 at 390×844: the box fits, back from a chat it still holds what was typed', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/chats');
    await box().fill('bo');
    await rowOf('bob').click();
    await page.getByRole('link', { name: 'Back to chats' }).click();
    await box().waitFor();
    const v = await box().inputValue();
    const t = await titles();
    const b = await box().boundingBox();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth);
    await shot('06-phone');
    ok('6 at 390×844: the box fits, back from a chat it still holds what was typed', v === 'bo' && t.join() === 'bob' && b.x + b.width <= 390 && wide <= 390, `box "${v}"; ${t}; box right ${Math.round(b.x + b.width)}; page ${wide} wide`);
  });
  ok('7 nothing typed was sent to the server', asked.length === 0, asked.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
console.log(checks.join('\n'));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : '\nno console errors');
