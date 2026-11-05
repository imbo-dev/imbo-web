// TC-565 (docs/TEST.md): several pictures in one message as a grid, and attached pictures as thumbnails above the box,
// on the web page against the local test server (`crates/scripts/local-env.sh up alice:bob`); the page must be
// http://localhost:5190 (`npm run dev`) and the files in ~/.cache/imbo-test/media. Sets up the 前置 itself.
// Prints PASS/FAIL per step, then any console errors the steps don't expect. Codes are read from $L/server.log and never
// printed.
// usage: node web/app/tests/grid.mjs <screenshot dir>
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const base = 'http://localhost:5190';
const api = 'http://127.0.0.1:18080';
const L = '/tmp/imbo-t';
const MEDIA = `${os.homedir()}/.cache/imbo-test/media`;
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const checks = [];
const ok = (name, cond, detail = '') => {
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, ' ')}` : ''}`;
  checks.push(line);
  console.log(line);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const token = (who) => fs.readFileSync(`${L}/${who}/credentials`, 'utf8').match(/^token = "(.*)"/m)[1];

// 前置: bob's computer uploads the files (API-026) and sends alice three messages (API-015).
async function upload(name, data = fs.readFileSync(`${MEDIA}/${name}`)) {
  const r = await fetch(`${api}/v1/files`, {
    method: 'POST',
    body: data,
    headers: {
      authorization: `Bearer ${token('bob')}`,
      'content-type': 'application/octet-stream',
      'imbo-file-name': name,
      'imbo-file-sha256': createHash('sha256').update(data).digest('hex'),
    },
  });
  return (await r.json()).file.id;
}
// An uploaded file goes out with one message, so each message uploads its own; `id` keeps the last one of each name.
const id = {};
const load = async (name) => (id[name] = await (name === 'T565-notes.txt' ? upload(name, Buffer.from('T565 notes\n')) : upload(name)));
for (const [body, files] of [
  ['T565 three', ['T580-a.png', 'T580-b.png', 'T580-c.png']],
  ['T565 four', ['T580-a.png', 'T565-notes.txt', 'T580-b.png', 'T580-c.png', 'T531-small.png']],
  ['T565 big', ['T531-small.png', 'T531-big.jpg']],
]) {
  const r = await fetch(`${api}/v1/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token('bob')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ to: 'alice', body, client_msg_id: body, files: await Promise.all(files.map(load)) }),
  });
  if (!r.ok) throw new Error(`bob's ${body}: ${r.status}`);
}

const codeLines = (email) => fs.readFileSync(`${L}/server.log`, 'utf8').split('\n').filter((l) => l.includes('mail-log-only code=') && l.endsWith(`email=${email}`));
async function codeFor(email, after) {
  for (let i = 0; i < 50; i++) {
    const lines = codeLines(email);
    if (lines.length > after) return lines.at(-1).match(/code=(\d+)/)[1];
    await wait(200);
  }
  throw new Error(`no code for ${email}`);
}

const consoleErrors = [];
const browser = await chromium.launch();
const step = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    ok(name, false, e.message.split('\n')[0]);
  }
};

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
  const page = await ctx.newPage();
  // Expected: the 401 of /v1/me before signing in.
  page.on('console', (m) => m.type() === 'error' && !/status of 401 /.test(m.text()) && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');
  const { cookies } = await ctx.storageState();
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  const article = (p, text) => p.locator('main article', { has: p.locator('p', { hasText: new RegExp(`^${text}$`) }) });
  // The squares of one message's grid, in order, as {x, y, w, h}.
  const tiles = async (p, text) => {
    const grid = article(p, text).locator('ul ul').first();
    await grid.locator('img').first().waitFor();
    return grid.locator(':scope > li').evaluateAll((els) =>
      els.map((el) => {
        const b = el.getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      })
    );
  };
  const rows = (ts) => [...new Set(ts.map((b) => b.y))].length;
  const sizes = (ts) => [...new Set(ts.map((b) => `${b.w}x${b.h}`))].join(',');
  const gridText = (p, text) => article(p, text).locator('ul ul').first().innerText();
  const chips = () => page.getByRole('list', { name: 'Attached files' });
  const composer = () => page.locator('textarea.composer');

  await step('1 three pictures: one row of 77×77, gap 4, no names', async () => {
    await page.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: /^bob/ }).first().click();
    const ts = await tiles(page, 'T565 three');
    const gaps = ts.slice(1).map((b, i) => b.x - ts[i].x - ts[i].w);
    const text = await gridText(page, 'T565 three');
    await article(page, 'T565 three').scrollIntoViewIfNeeded();
    await shot(page, '01-three');
    ok('1 three pictures: one row of 77×77, gap 4, no names', ts.length === 3 && rows(ts) === 1 && sizes(ts) === '77x77' && gaps.every((g) => g === 4) && text.trim() === '', `${ts.length} squares, ${rows(ts)} rows, ${sizes(ts)}, gaps ${gaps.join(',')}, text "${text.trim()}"`);
  });
  await step('2 four pictures and a file: two rows of 118×118, the file below', async () => {
    const ts = await tiles(page, 'T565 four');
    const grid = await article(page, 'T565 four').locator('ul ul').first().boundingBox();
    const file = await article(page, 'T565 four').getByText('T565-notes.txt').boundingBox();
    await article(page, 'T565 four').scrollIntoViewIfNeeded();
    await shot(page, '02-four');
    ok('2 four pictures and a file: two rows of 118×118, the file below', ts.length === 4 && rows(ts) === 2 && sizes(ts) === '118x118' && file.y > grid.y + grid.height, `${ts.length} squares, ${rows(ts)} rows, ${sizes(ts)}, file at ${Math.round(file.y)}, grid ends ${Math.round(grid.y + grid.height)}`);
  });
  await step('3 the big one loads when clicked', async () => {
    const load = page.getByTestId(`file-load-${id['T531-big.jpg']}`);
    await load.waitFor();
    const named = await load.getAttribute('aria-label');
    await load.click();
    await page.getByTestId(`file-thumb-${id['T531-big.jpg']}`).waitFor({ timeout: 30_000 });
    ok('3 the big one loads when clicked', named.startsWith('Load image, T531-big.jpg, '), `button "${named}"`);
  });
  await step('4 a square opens full screen; a click beside the picture closes it', async () => {
    await article(page, 'T565 three').getByRole('button', { name: 'T580-b.png' }).click();
    const viewer = page.getByTestId('file-viewer');
    await viewer.waitFor();
    const named = await viewer.getByText('T580-b.png').count();
    const download = await viewer.getByRole('link', { name: /Download/ }).count();
    await wait(300);
    await shot(page, '04-viewer');
    const b = await viewer.locator('img').boundingBox();
    const s = await page.getByTestId('file-viewer-stage').boundingBox();
    await page.mouse.click((s.x + b.x) / 2, b.y + b.height / 2);
    await wait(500);
    const closed = (await viewer.count()) === 0;
    ok('4 a square opens full screen; a click beside the picture closes it', named > 0 && download > 0 && closed, `name ${named}, download ${download}, closed ${closed}`);
  });
  await step('5 three attached pictures: 72×72 thumbnails with ×, no names', async () => {
    await page.locator('input[type=file][multiple]').setInputFiles(['T580-a.png', 'T580-b.png', 'T580-c.png'].map((n) => `${MEDIA}/${n}`));
    await chips().locator('img').nth(2).waitFor();
    const ts = await chips().locator(':scope > li').evaluateAll((els) => els.map((el) => `${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`));
    const xs = await chips().getByRole('button', { name: /^Remove T580-/ }).count();
    const text = (await chips().innerText()).trim();
    await shot(page, '05-attached');
    ok('5 three attached pictures: 72×72 thumbnails with ×, no names', ts.length === 3 && ts.every((s) => s === '72x72') && xs === 3 && text === '', `${ts.join(',')}, × ${xs}, text "${text}"`);
  });
  await step('6 × takes the second one off', async () => {
    await chips().getByRole('button', { name: 'Remove T580-b.png' }).click();
    const left = await chips().locator('img').evaluateAll((els) => els.map((el) => el.alt.split(',')[0]));
    ok('6 × takes the second one off', left.join(',') === 'T580-a.png,T580-c.png', left.join(','));
  });
  await step('7 sent: two 118×118 side by side on my side, nothing above the box', async () => {
    // Both uploaded: the alt text gives the size instead of Uploading….
    await page.waitForFunction(() => [...document.querySelectorAll('ul[aria-label="Attached files"] img')].every((i) => !i.alt.includes('Uploading')), null, { timeout: 15_000 });
    await composer().fill('T565 mine');
    await composer().press('Enter');
    const ts = await tiles(page, 'T565 mine');
    const pane = await article(page, 'T565 mine').boundingBox();
    const grid = await article(page, 'T565 mine').locator('ul ul').first().boundingBox();
    const leftGap = grid.x - pane.x;
    const rightGap = pane.x + pane.width - (grid.x + grid.width);
    const above = await chips().count();
    await shot(page, '07-sent');
    ok('7 sent: two 118×118 side by side on my side, nothing above the box', ts.length === 2 && rows(ts) === 1 && sizes(ts) === '118x118' && ts[1].x - ts[0].x === 122 && rightGap < leftGap && above === 0, `${ts.length} squares, ${sizes(ts)}, step ${ts[1].x - ts[0].x}, gaps left ${Math.round(leftGap)} right ${Math.round(rightGap)}, list above ${above}`);
  });
  await step('8 dark, 390 wide: the grids fit, no sideways scroll', async () => {
    const dark = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US', colorScheme: 'dark', storageState: { cookies, origins: [] } });
    const p = await dark.newPage();
    p.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    await p.goto(base + '/chats');
    await p.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: /^bob/ }).first().click();
    const ts = await tiles(p, 'T565 four');
    await article(p, 'T565 four').scrollIntoViewIfNeeded();
    const inside = ts.every((b) => b.x >= 0 && b.x + b.w <= 390);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth);
    await shot(p, '08-dark-390');
    await dark.close();
    ok('8 dark, 390 wide: the grids fit, no sideways scroll', inside && wide <= 390, `squares inside ${inside}, page ${wide} wide`);
  });
} finally {
  await browser.close();
}
console.log(consoleErrors.length ? `console errors:\n${consoleErrors.join('\n')}` : '\nno console errors');
