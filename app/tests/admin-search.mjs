// TC-560 (docs/TEST.md): on the admin Users page, a search keeps its result when the list of every account, asked for
// first, answers last. Runs against the local test server; the page must be http://localhost:5190 (`npm run dev`).
// The list without `q` (API-065) is held back 3 s here. Prints PASS/FAIL per step, then any console errors.
// Codes are read from $L/server.log and never printed.
// usage: node web/app/tests/admin-search.mjs <screenshot dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const base = 'http://localhost:5190';
const L = '/tmp/imbo-t';
const hold = 3000;
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const ok = (name, cond, detail = '') => console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, ' ')}` : ''}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const codes = (e) => fs.readFileSync(`${L}/server.log`, 'utf8').split('\n').filter((l) => l.includes('mail-log-only code=') && l.endsWith(`email=${e}`));
async function codeFor(e, n) {
  for (let i = 0; i < 50; i++) {
    const c = codes(e);
    if (c.length > n) return c.at(-1).match(/code=(\d+)/)[1];
    await wait(200);
  }
  throw new Error(`no code for ${e}`);
}

const browser = await chromium.launch();
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // 前置: the admin signs in on the web.
  await page.goto(base + '/login');
  const n = codes('admin@imbo.test').length;
  await page.getByLabel('Email').fill('admin@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('admin@imbo.test', n));
  const name = page.getByLabel('Name');
  await Promise.race([name.waitFor(), page.waitForURL(/\/(chats|welcome)/)]);
  if (await name.isVisible()) {
    await name.fill('Imbo Admin');
    await page.getByRole('button', { name: 'Create account' }).click();
  }
  await page.waitForURL(/\/(chats|welcome)/);

  await page.route('**/v1/admin/accounts?*', async (route) => {
    if (!new URL(route.request().url()).searchParams.has('q')) await wait(hold);
    await route.continue();
  });
  const status = () => page.getByRole('status').filter({ hasText: /match|accounts/ }).first();
  const rows = () => page.locator('tbody tr');
  const box = () => page.getByLabel('Search by account ID or email');

  async function search(tag) {
    await page.goto(base + '/admin/users');
    await box().fill('bob@imbo.test');
    await status().filter({ hasText: 'match' }).waitFor({ timeout: hold });
    const s1 = await status().innerText();
    ok(`${tag}1 search answers first: 1 match, one row`, s1 === '1 match' && (await rows().count()) === 1 && /bob@imbo\.test/.test(await rows().first().innerText()), `${s1}; ${await rows().count()} rows`);
    await wait(hold + 1000);
    const s2 = await status().innerText();
    const r2 = await rows().count();
    ok(`${tag}2 the whole list answers later: still 1 match, one row`, s2 === '1 match' && r2 === 1 && page.url().includes('q=bob%40imbo.test'), `${s2}; ${r2} rows; ${page.url().replace(base, '')}`);
    await page.screenshot({ path: `${out}/${tag || 'desktop-'}search.png` });
  }

  await search('');

  await box().fill('');
  await status().filter({ hasText: 'accounts, newest first' }).waitFor({ timeout: hold + 3000 });
  const s3 = await status().innerText();
  const total = Number(s3.replace(/[^\d]/g, ''));
  ok('3 cleared: every account again', total > 1 && (await rows().count()) === Math.min(total, 50), `${s3}; ${await rows().count()} rows`);

  await page.setViewportSize({ width: 390, height: 844 });
  await search('390-');
} finally {
  await browser.close();
}
const unexpected = errors.filter((e) => !/401|Failed to load resource/.test(e));
console.log(unexpected.length ? `console errors:\n${unexpected.join('\n')}` : '\nno console errors');
