// TC-569 (docs/TEST.md): finding messages in a chat on the web against the local test server, started with
// `crates/scripts/local-env.sh up alice:bob`; the page must be http://localhost:5190 (`npm run dev`). Sets up the 前置 itself:
// bob sends 62 messages, 29 a minute under the rate limit (about 2 minutes). Prints PASS/FAIL per step, then any unexpected
// console errors. Codes are read from $L/server.log and never printed.
// usage: node web/app/tests/search.mjs <screenshot dir>
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
const as = (who, args) => sh(`IMBO_HOME=$L/${who} "$IMBO" ${args}`);
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

// 前置: the first, 60 fillers, the newest; the first isn't on the newest page.
as('bob', `send ${ids.alice} 'T569 第一条 needle'`);
for (let n = 1; n <= 60; n++) {
  if (n % 29 === 0) await wait(61_000);
  as('bob', `send ${ids.alice} 'T569 填充 ${n}'`);
}
as('bob', `send ${ids.alice} 'T569 Needle 新的'`);

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
  const searches = [];
  page.on('request', (r) => r.url().includes('/search?q=') && searches.push(decodeURIComponent(r.url().split('q=')[1])));
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
  const row = (text) => page.locator('article', { has: page.locator('p', { hasText: new RegExp(`^${text}$`) }) });
  const box = () => page.getByRole('searchbox', { name: 'Search in this chat' });
  const opener = () => page.getByRole('button', { name: 'Search in this chat' });
  const hits = () => page.getByRole('list', { name: 'Messages found' }).getByRole('listitem');
  const pane = () => page.getByLabel('Messages with bob');
  const fits = async (loc, w) => {
    const b = await loc.boundingBox();
    return !!b && b.x >= 0 && b.x + b.width <= w;
  };

  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');

  await step('1 Search: the header turns into a box, focus in it', async () => {
    await page.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: /bob/ }).click();
    await row('T569 Needle 新的').waitFor();
    await opener().click();
    await box().waitFor();
    const hint = await box().getAttribute('placeholder');
    const focused = await box().evaluate((el) => document.activeElement === el);
    ok('1 Search: the header turns into a box, focus in it', hint === 'Search in this chat' && focused, `placeholder ${hint}; focused ${focused}`);
  });
  await step('2 typing needle sends one search, two found, newest first, marked', async () => {
    await box().pressSequentially('needle', { delay: 50 });
    await hits().first().waitFor();
    await wait(500);
    const texts = await hits().allInnerTexts();
    const marks = await page.getByRole('list', { name: 'Messages found' }).locator('mark').allInnerTexts();
    await shot('02-found');
    ok(
      '2 typing needle sends one search, two found, newest first, marked',
      searches.length === 1 && texts.length === 2 && /T569 Needle 新的/.test(texts[0]) && /T569 第一条 needle/.test(texts[1]) && texts.every((x) => /^bob /.test(x) && /\d\d:\d\d/.test(x)) && marks.join('|') === 'Needle|needle',
      `searches ${JSON.stringify(searches)}; ${texts.join(' / ')}; marked ${marks.join(',')}`
    );
  });
  await step('3 picking the second jumps to it and flashes it', async () => {
    const loaded = await row('T569 第一条 needle').count();
    await hits().nth(1).click();
    await row('T569 第一条 needle').waitFor();
    await wait(400);
    const flash = await row('T569 第一条 needle').evaluate((el) => el.classList.contains('reply-flash'));
    await wait(800);
    const inView = await row('T569 第一条 needle').evaluate((el) => {
      const b = el.getBoundingClientRect();
      const p = el.closest('.scroll-pane').getBoundingClientRect();
      return b.top >= p.top && b.bottom <= p.bottom;
    });
    const closed = (await box().count()) === 0 && (await opener().isVisible());
    await shot('03-jumped');
    ok('3 picking the second jumps to it and flashes it', loaded === 0 && closed && flash && inView, `loaded before ${loaded}; search closed ${closed}; flash ${flash}; in view ${inView}`);
  });
  await step('4 more than 50: 50 listed and a line that says so', async () => {
    await opener().click();
    await box().fill('填充');
    await page.getByText('Showing the latest 50').waitFor();
    const n = await hits().count();
    await shot('04-fifty');
    ok('4 more than 50: 50 listed and a line that says so', n === 50, `${n} listed`);
  });
  await step('5 nothing found', async () => {
    await box().fill('没有这几个字');
    await page.getByText('No messages found').waitFor();
    ok('5 nothing found', true);
  });
  await step('6 Esc closes it, the list stays put, focus back on Search', async () => {
    const top = await pane().evaluate((el) => el.scrollTop);
    await box().press('Escape');
    await wait(300);
    const after = await pane().evaluate((el) => el.scrollTop);
    const closed = (await box().count()) === 0;
    const focus = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    ok('6 Esc closes it, the list stays put, focus back on Search', closed && top === after && focus === 'Search in this chat', `closed ${closed}; scrollTop ${top} → ${after}; focus on ${focus}`);
  });
  await step('7 at 390×844 the box, its close and the results fit', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(page.url());
    await row('T569 Needle 新的').waitFor();
    await opener().click();
    await box().fill('needle');
    await hits().first().waitFor();
    const all = [await fits(box(), 390), await fits(page.getByRole('button', { name: 'Close search' }), 390), await fits(page.getByRole('list', { name: 'Messages found' }), 390)];
    const sideways = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth);
    await shot('07-phone');
    ok('7 at 390×844 the box, its close and the results fit', all.every(Boolean) && !sideways, `box, close, results ${all}; sideways ${sideways}`);
  });
} finally {
  await browser.close();
}
console.log(checks.join('\n'));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : '\nno console errors');
