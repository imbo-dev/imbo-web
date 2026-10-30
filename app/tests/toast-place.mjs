// TC-346 (docs/TEST.md): on a phone-wide window, where a dialog rises from the bottom of the screen, a notice doesn't cover
// the dialog's buttons; on a wide window notices stay at the bottom. Setup is §3「网页建群、处理申请与换邮箱」, the page
// http://localhost:5190 (`npm run dev`). Prints PASS/FAIL per step. Codes are read from $L/server.log and never printed.
// usage: node web/app/tests/toast-place.mjs <screenshot dir>
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
const sh = (cmd) => execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8' }).replace(/\x1b\[[0-9;]*m/g, '');
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
const step = async (id, fn) => {
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};
const overlap = (a, b) => !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const fmt = (b) => (b ? `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}×${Math.round(b.height)}` : 'none');

sh(`IMBO_HOME=$L/alice "$IMBO" group create T346`);
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');

  const dialog = () => page.getByRole('dialog');
  const notice = () => page.locator('[data-sonner-toast]').filter({ hasText: 'Saved.' }).first();
  const invite = () => dialog().getByRole('button', { name: 'Invite contacts' });
  const close = () => dialog().getByRole('button', { name: 'Close', exact: true }).last();
  const openDetails = async () => {
    await page.getByRole('button', { name: 'T346' }).first().click();
    await dialog().getByRole('heading', { name: 'T346' }).waitFor();
    await dialog().getByRole('checkbox', { name: /checkout/ }).waitFor();
  };
  const save = async () => {
    await dialog().getByRole('checkbox', { name: /checkout/ }).click();
    await dialog().getByRole('button', { name: 'Save' }).click();
    await notice().waitFor({ timeout: 8000 });
    // Let it finish sliding in.
    await wait(600);
  };

  await step('TC-346 #1', async () => {
    await page.getByRole('navigation', { name: 'Chats' }).getByText('T346').click();
    await page.waitForURL(/\/chats\/\d+$/);
    await openDetails();
    await save();
    const t = await notice().boundingBox();
    const i = await invite().boundingBox();
    const c = await close().boundingBox();
    await page.screenshot({ path: `${out}/tc346-1.png` });
    ok('TC-346 #1 phone: the notice in the top half, clear of Invite contacts and Close',
      !!t && t.y + t.height <= 844 / 2 && !overlap(t, i) && !overlap(t, c),
      `notice ${fmt(t)} / Invite contacts ${fmt(i)} / Close ${fmt(c)}`);
  });

  await step('TC-346 #2', async () => {
    const shown = await notice().isVisible();
    const b = await invite().boundingBox();
    const [x, y] = [b.x + b.width / 2, b.y + b.height / 2];
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.textContent?.trim() ?? '', [x, y]);
    await page.mouse.click(x, y);
    const opened = await dialog().getByRole('heading', { name: 'Invite to T346' }).waitFor({ timeout: 3000 }).then(() => true, () => false);
    await page.screenshot({ path: `${out}/tc346-2.png` });
    ok('TC-346 #2 with the notice up, Invite contacts takes the tap', shown && hit === 'Invite contacts' && opened, `notice up ${shown}, at its middle: ${hit || 'nothing'}, invite opened ${opened}`);
  });

  await step('TC-346 #3', async () => {
    await page.keyboard.press('Escape');
    await dialog().waitFor({ state: 'detached', timeout: 5000 });
    await page.setViewportSize({ width: 1280, height: 800 });
    await notice().waitFor({ state: 'detached', timeout: 10000 });
    await openDetails();
    await save();
    const t = await notice().boundingBox();
    await page.screenshot({ path: `${out}/tc346-3.png` });
    ok('TC-346 #3 wide: the notice at the bottom, in the middle', !!t && t.y >= 800 / 2 && Math.abs(t.x + t.width / 2 - 640) <= 2, `notice ${fmt(t)}`);
  });
} finally {
  await browser.close();
}
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(`${failed} failed`);
process.exit(failed ? 1 : 0);
