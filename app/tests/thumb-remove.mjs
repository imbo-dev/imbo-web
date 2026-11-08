// TC-624 (docs/TEST.md): the × on a picture attached in the web composer is on top of the thumbnail and takes it off,
// against the local test server (`IMBO_WEB_ORIGIN=http://localhost:5190 crates/scripts/local-env.sh up alice:bob`); the
// page must be http://localhost:5190 (`npm run dev`) and the files in ~/.cache/imbo-test/media. Sets up the 前置 itself.
// Prints PASS/FAIL per step, then any console errors the steps don't expect. Codes are read from $L/server.log and never
// printed.
// usage: node web/app/tests/thumb-remove.mjs <screenshot dir>
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

// 前置: bob's computer sends alice T624 hello (API-015), so the chat is in her list.
const r = await fetch(`${api}/v1/messages`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token('bob')}`, 'content-type': 'application/json' },
  body: JSON.stringify({ to: 'alice', body: 'T624 hello', client_msg_id: 'T624 hello' }),
});
if (!r.ok) throw new Error(`bob's T624 hello: ${r.status}`);

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
  const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 800 } });
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
  await page.getByText('T624 hello').first().click();
  await page.getByRole('textbox', { name: /^Message / }).waitFor();

  const chips = () => page.getByRole('list', { name: 'Attached files' });
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  /** Whether the × is drawn inside the thumbnail's top right corner and is what a click at its middle lands on. */
  const onTop = async (p) => {
    const thumb = chips().locator(':scope > li').first();
    const x = thumb.getByRole('button', { name: 'Remove T531-small.png' });
    const [t, b] = [await thumb.boundingBox(), await x.boundingBox()];
    const inside = !!t && !!b && b.x >= t.x && b.y >= t.y && b.x + b.width <= t.x + t.width && b.y + b.height <= t.y + t.height;
    const corner = inside && b.x + b.width / 2 > t.x + t.width / 2 && b.y + b.height / 2 < t.y + t.height / 2;
    const hit = !!b && (await p.evaluate(([cx, cy]) => !!document.elementFromPoint(cx, cy)?.closest('button[aria-label="Remove T531-small.png"]'), [b.x + b.width / 2, b.y + b.height / 2]));
    return { ok: corner && hit, detail: `thumb ${t && `${Math.round(t.width)}x${Math.round(t.height)}`}, × at ${b && `${Math.round(b.x - t.x)},${Math.round(b.y - t.y)}`}, in the top right ${corner}, a click lands on it ${hit}` };
  };

  await step('1 attach T531-small.png: a 72×72 thumbnail, its × in the top right corner, on top', async () => {
    await page.locator('input[type=file][multiple]').setInputFiles(`${MEDIA}/T531-small.png`);
    await chips().locator('img').first().waitFor();
    await wait(300);
    const v = await onTop(page);
    await shot(page, '01-attached');
    ok('1 attach T531-small.png: a 72×72 thumbnail, its × in the top right corner, on top', v.ok, v.detail);
  });
  await step('2 click the ×: no thumbnail left', async () => {
    await chips().getByRole('button', { name: 'Remove T531-small.png' }).click({ timeout: 5000 });
    await chips().waitFor({ state: 'detached', timeout: 5000 });
    await shot(page, '02-removed');
    ok('2 click the ×: no thumbnail left', (await chips().count()) === 0);
  });
  await step('3 dark, 390×844: attach again, the × in the top right corner, on top', async () => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('input[type=file][multiple]').setInputFiles(`${MEDIA}/T531-small.png`);
    await chips().locator('img').first().waitFor();
    await wait(300);
    const v = await onTop(page);
    await shot(page, '03-dark-390');
    ok('3 dark, 390×844: attach again, the × in the top right corner, on top', v.ok, v.detail);
  });
} finally {
  await browser.close();
}
console.log(consoleErrors.length ? `console errors:\n${consoleErrors.join('\n')}` : '\nno console errors');
