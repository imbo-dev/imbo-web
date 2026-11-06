// TC-615 (docs/TEST.md): accepting or declining requests to join a group in the web's request list (FLOW-GROUP-APPROVE),
// against the local test server started with `crates/scripts/local-env.sh up alice:bob,alice:carol`; the page
// must be http://localhost:5190 (`npm run dev`). Sets up the 前置 itself: alice makes t615 and lets anyone find it, and
// carol asks to join with the note T615 carol; dave, whom local-env.sh doesn't make, is seeded into $L/extra/dave. Prints PASS/FAIL per step, then any unexpected console errors. Codes are
// read from $L/server.log and never printed.
// usage: node web/app/tests/join-requests.mjs <screenshot dir>
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** `who`'s computer sign-in calling the API. */
async function api(who, method, path, body) {
  const token = fs.readFileSync(`${L}/${who}/credentials`, 'utf8').match(/^token = "(.*)"/m)[1];
  const r = await fetch(`http://127.0.0.1:18080${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  return [r.status, await r.json().catch(() => null)];
}
const apply = (who, note) => api(who, 'POST', `/v1/groups/${gid}/join-requests`, { note });

const codeLines = (email) => fs.readFileSync(`${L}/server.log`, 'utf8').split('\n').filter((l) => l.includes('mail-log-only code=') && l.endsWith(`email=${email}`));
async function codeFor(email, after) {
  for (let i = 0; i < 50; i++) {
    const lines = codeLines(email);
    if (lines.length > after) return lines.at(-1).match(/code=(\d+)/)[1];
    await wait(200);
  }
  throw new Error(`no code for ${email}`);
}

sh('IMBO_DATA_DIR=$L/server "$S" dev seed --homes $L/extra --names dave >/dev/null');
as('alice', 'group create t615');
as('alice', 'group discoverable t615 on');
const gid = (await api('alice', 'GET', '/v1/groups'))[1].groups.find((g) => g.name === 't615').id;
await apply('carol', 'T615 carol');

const browser = await chromium.launch();
const step = async (id, fn) => {
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};

try {
  const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  // Expected: the 401 of /v1/me before signing in.
  page.on('console', (m) => m.type() === 'error' && !/status of 401 /.test(m.text()) && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
  const requests = () => page.getByRole('region', { name: 'Requests' });
  const row = (who) => requests().locator('li', { hasText: `${who} wants to join t615` });

  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');

  await step('1 carol wants to join t615, her note, Accept and Decline', async () => {
    await page.goto(base + '/contacts');
    await row('carol').waitFor();
    const text = await row('carol').innerText();
    const accept = await row('carol').getByRole('button', { name: /^Accept/ }).count();
    const decline = await row('carol').getByRole('button', { name: /^Decline/ }).count();
    await shot('01-requests');
    ok('1 carol wants to join t615, her note, Accept and Decline', /T615 carol/.test(text) && accept === 1 && decline === 1, `${text}; accept ${accept}; decline ${decline}`);
  });
  await step('2 dave asks while the page is open: his row within 5 s, no reload', async () => {
    const t0 = Date.now();
    const [status] = await apply('extra/dave', 'T615 dave');
    await row('dave').waitFor({ timeout: 5000 });
    const ms = Date.now() - t0;
    const text = await row('dave').innerText();
    ok('2 dave asks while the page is open: his row within 5 s, no reload', status === 201 && /T615 dave/.test(text), `${status}; ${ms} ms; ${text}`);
  });
  await step('3 Accept carol: her row goes, t615 is in her groups', async () => {
    await row('carol').getByRole('button', { name: /^Accept/ }).click();
    await row('carol').waitFor({ state: 'detached' });
    const groups = (await api('carol', 'GET', '/v1/groups'))[1].groups.map((g) => g.name);
    await shot('03-accepted');
    ok('3 Accept carol: her row goes, t615 is in her groups', groups.includes('t615'), groups.join(', '));
  });
  await step('4 Decline dave: his row goes, his request is declined', async () => {
    await row('dave').getByRole('button', { name: /^Decline/ }).click();
    await row('dave').waitFor({ state: 'detached' });
    const mine = (await api('extra/dave', 'GET', '/v1/requests?direction=out&include=join&status=all'))[1].requests.find((r) => r.kind === 'join' && r.group?.id === gid);
    ok('4 Decline dave: his row goes, his request is declined', mine?.status === 'declined', JSON.stringify(mine));
  });
  await step('5 dark at 390×844: dave asks again, note and both buttons on screen, no sideways scroll', async () => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 390, height: 844 });
    const [status] = await apply('extra/dave', 'T615 dave');
    await page.goto(base + '/contacts');
    await row('dave').waitFor();
    const inside = async (loc) => {
      const b = await loc.boundingBox();
      return !!b && b.x >= 0 && b.x + b.width <= 390;
    };
    const note = await inside(row('dave').getByText('T615 dave'));
    const accept = await inside(row('dave').getByRole('button', { name: /^Accept/ }));
    const decline = await inside(row('dave').getByRole('button', { name: /^Decline/ }));
    const sideways = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth);
    await shot('05-phone-dark');
    ok('5 dark at 390×844: dave asks again, note and both buttons on screen, no sideways scroll', status === 201 && note && accept && decline && !sideways, `${status}; note ${note}; accept ${accept}; decline ${decline}; sideways ${sideways}`);
  });
} finally {
  await browser.close();
}
console.log(checks.join('\n'));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : '\nno console errors');
