// TC-513 (docs/TEST.md): the Sessions list when alice has thousands of sessions (PAGE-WEB-SESSIONS), against the local test
// server (seeded). The page must be http://localhost:5190 (`npm run dev`). It adds alice's 4000 sessions itself, then prints
// PASS/FAIL per step and any console errors. Codes are read from $L/server.log and never printed.
// usage: node web/app/tests/many-sessions.mjs <screenshot dir>
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** The title app-db.py gives the i-th session it adds. */
const added = (i) => `tmp${crypto.createHash('md5').update(String(i)).digest('hex').slice(0, 8)}-${i}`;

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
  const context = async (opts, cookies) => {
    const ctx = await browser.newContext({ locale: 'en-US', timezoneId: 'Asia/Shanghai', ...opts, ...(cookies && { storageState: { cookies, origins: [] } }) });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push([current, m.text()]));
    page.on('pageerror', (e) => consoleErrors.push([current, `pageerror: ${e.message}`]));
    return page;
  };
  const page = await context({ viewport: { width: 1440, height: 900 } });
  current = 'login alice';
  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');
  const { cookies } = await page.context().storageState();

  const rows = (p) => p.getByRole('navigation', { name: 'My sessions' }).getByRole('link');
  const more = (p) => p.getByRole('button', { name: /^Load more sessions/ });
  const moreName = async (p) => ((await more(p).count()) ? await more(p).getAttribute('aria-label') : 'no Load more');
  const note = 'Only your 200 most recent sessions are listed.';

  await step('TC-513 #1', async () => {
    await page.goto(base + '/sessions');
    await rows(page).first().waitFor();
    await wait(500);
    const n = await rows(page).count();
    ok('TC-513 #1 alice with 2 sessions: both listed, no Load more', n === 2 && !(await more(page).count()), `${n} rows, ${await moreName(page)}`);
  });
  await step('TC-513 #2', async () => {
    const got = execFileSync('uv', ['run', '-q', `${root}mobile/tests/app-db.py`, 'many-sessions', 'alice@imbo.test'], { encoding: 'utf8' }).trim();
    const t0 = Date.now();
    await page.goto(base + '/sessions');
    await rows(page).nth(19).waitFor({ timeout: 3000 });
    const took = (Date.now() - t0) / 1000;
    await wait(300);
    const n = await rows(page).count();
    const last = await rows(page).nth(19).innerText();
    ok(
      'TC-513 #2 with 4002 sessions: within 3 s the 20 most recent, the 20th the 18th added, then Load more with 180 left',
      got === 'added 4000' && n === 20 && last.includes(added(18)) && (await moreName(page)) === 'Load more sessions, 180 left',
      `${got}; ${n} rows in ${took.toFixed(1)} s, the 20th ${last.split('\n')[0]}; ${await moreName(page)}`,
    );
  });
  await step('TC-513 #3', async () => {
    await more(page).click();
    await rows(page).nth(39).waitFor();
    const n = await rows(page).count();
    const focused = await page.evaluate(() => document.activeElement?.textContent ?? '');
    const fades = await rows(page).nth(20).evaluate((a) => a.classList.contains('pick-in'));
    ok(
      'TC-513 #3 Load more: 20 more, 160 left, the keyboard on the first new row (the 19th added), which fades in',
      n === 40 && focused.includes(added(19)) && fades && (await moreName(page)) === 'Load more sessions, 160 left',
      `${n} rows; focused ${focused.slice(0, 40)}; fades ${fades}; ${await moreName(page)}`,
    );
  });
  await step('TC-513 #4', async () => {
    for (let i = 0; i < 8; i++) await more(page).click();
    await page.getByText(note).waitFor();
    const n = await rows(page).count();
    const last = await rows(page).last().innerText();
    await page.getByText(note).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/tc513-4.png` });
    ok(
      'TC-513 #4 8 more: 200 listed, the last the 198th added, no Load more, the note under them',
      n === 200 && last.includes(added(198)) && !(await more(page).count()),
      `${n} rows, the last ${last.split('\n')[0]}; ${await moreName(page)}`,
    );
  });
  await step('TC-513 #5', async () => {
    const p = await context({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', locale: 'zh-CN' }, cookies);
    await p.goto(base + '/sessions');
    const b = p.getByRole('button', { name: '加载更多会话，还有 180 个' });
    await b.scrollIntoViewIfNeeded();
    const box = await b.boundingBox();
    const words = await b.innerText();
    await p.screenshot({ path: `${out}/tc513-5.png` });
    ok(
      'TC-513 #5 dark, 390 wide, in Chinese: the button reads 加载更多 还有 180 个, inside the window',
      /加载更多\s*还有 180 个/.test(words) && box.x >= 0 && box.x + box.width <= 390,
      `${words.replace(/\s+/g, ' ')}; ${Math.round(box.x)}–${Math.round(box.x + box.width)}`,
    );
    await p.context().close();
  });
} finally {
  await browser.close();
}
const unexpected = consoleErrors.filter(([at, text]) => !expected[at]?.test(text));
for (const [at, text] of unexpected) console.log(`console error during ${at}: ${text}`);
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(`${failed} failed, ${unexpected.length} unexpected console errors`);
process.exit(failed || unexpected.length ? 1 : 0);
