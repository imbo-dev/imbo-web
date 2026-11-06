// TC-614 (docs/TEST.md): finding a group on the web and asking to join it (FLOW-GROUP-DISCOVER), against the local test
// server started with `crates/scripts/local-env.sh up alice:bob,alice:carol`; the page must be
// http://localhost:5190 (`npm run dev`). Sets up the 前置 itself: alice makes t614 with bob in it and lets anyone find it,
// and t614-closed, which nobody can find. Prints PASS/FAIL per step, then any unexpected console errors. Codes are read
// from $L/server.log and never printed.
// usage: node web/app/tests/group-find.mjs <screenshot dir>
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

/** `who`'s computer sign-in calling the API. */
async function api(who, method, path, body) {
  const token = fs.readFileSync(`${L}/${who}/credentials`, 'utf8').match(/^token = "(.*)"/m)[1];
  const r = await fetch(`http://127.0.0.1:18080${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  return [r.status, await r.json().catch(() => null)];
}
const groupId = async (name) => (await api('alice', 'GET', '/v1/groups'))[1].groups.find((g) => g.name === name).id;

const codeLines = (email) => fs.readFileSync(`${L}/server.log`, 'utf8').split('\n').filter((l) => l.includes('mail-log-only code=') && l.endsWith(`email=${email}`));
async function codeFor(email, after) {
  for (let i = 0; i < 50; i++) {
    const lines = codeLines(email);
    if (lines.length > after) return lines.at(-1).match(/code=(\d+)/)[1];
    await wait(200);
  }
  throw new Error(`no code for ${email}`);
}

as('alice', 'group create t614');
as('alice', `group invite t614 ${ids.bob}`);
as('bob', 'group join t614');
as('alice', 'group discoverable t614 on');
as('alice', 'group create t614-closed');
const gid = await groupId('t614');

const browser = await chromium.launch();
const step = async (id, fn) => {
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};

try {
  const signIn = async (who, opts = {}) => {
    const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 900 }, ...opts });
    const page = await ctx.newPage();
    // Expected: the 401 of /v1/me before signing in.
    page.on('console', (m) => m.type() === 'error' && !/status of 401 /.test(m.text()) && errors.push(`${who} console: ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`${who} pageerror: ${e.message}`));
    await page.goto(base + '/login');
    const before = codeLines(`${who}@imbo.test`).length;
    await page.getByLabel('Email').fill(`${who}@imbo.test`);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText('Check your email').waitFor();
    await page.keyboard.type(await codeFor(`${who}@imbo.test`, before));
    await page.waitForURL('**/chats');
    return page;
  };
  const drawer = (p) => p.getByRole('dialog', { name: 'Find a group' });
  const field = (p) => drawer(p).getByRole('searchbox');
  const row = (p, name) => drawer(p).locator('li', { has: p.locator('span', { hasText: new RegExp(`^${name}$`) }) });
  const openFind = async (p) => {
    await p.getByRole('button', { name: 'Find a group' }).click();
    await field(p).waitFor();
  };
  /** Types `q` and waits for the answer: a row, or the line saying nothing was found. */
  const search = async (p, q, expect) => {
    await field(p).fill(q);
    await (expect ? row(p, expect) : drawer(p).getByText('No group found.')).waitFor();
  };
  const carol = await signIn('carol');
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });

  await step('1 Find a group opens the drawer, focus in the search box', async () => {
    await openFind(carol);
    const focused = await field(carol).evaluate((el) => document.activeElement === el);
    await shot(carol, '01-open');
    ok('1 Find a group opens the drawer, focus in the search box', focused, `focused ${focused}`);
  });
  await step('2 t614: t614 with 2 members and alice, no t614-closed', async () => {
    await search(carol, 't614', 't614');
    const text = await row(carol, 't614').innerText();
    const closed = await drawer(carol).getByText('t614-closed').count();
    await shot(carol, '02-found');
    ok('2 t614: t614 with 2 members and alice, no t614-closed', /2 members/.test(text) && /alice/.test(text) && closed === 0, `${text}; t614-closed shown ${closed}`);
  });
  await step('3 Ask to join with a note: Requested, no button; alice sees the note', async () => {
    await row(carol, 't614').getByRole('button', { name: 'Ask to join' }).click();
    await row(carol, 't614').getByLabel(/Note/).fill('T614 想加入');
    await row(carol, 't614').getByRole('button', { name: 'Send request' }).click();
    await row(carol, 't614').getByText('Requested', { exact: true }).waitFor();
    const buttons = await row(carol, 't614').getByRole('button').count();
    const join = (await api('alice', 'GET', '/v1/requests?include=join'))[1].requests.find((r) => r.kind === 'join' && r.group?.id === gid && r.from.id === Number(ids.carol));
    await shot(carol, '03-requested');
    ok('3 Ask to join with a note: Requested, no button; alice sees the note', buttons === 0 && join?.note === 'T614 想加入', `buttons ${buttons}; ${JSON.stringify(join)}`);
  });
  await step('4 #<ID>: only t614, Requested', async () => {
    await search(carol, `#${gid}`, 't614');
    const rows = await drawer(carol).locator('ul > li').count();
    const text = await row(carol, 't614').innerText();
    ok('4 #<ID>: only t614, Requested', rows === 1 && /Requested/.test(text), `${rows} rows; ${text}`);
  });
  await step('5 t614-nothing: No group found, and why', async () => {
    await search(carol, 't614-nothing');
    const why = await drawer(carol).getByText('A group shows up here once its owner lets anyone find it.').count();
    await shot(carol, '05-none');
    ok('5 t614-nothing: No group found, and why', why === 1, `explained ${why}`);
  });
  await step('6 bob: t614 says Joined, no button', async () => {
    const bob = await signIn('bob');
    await openFind(bob);
    await search(bob, 't614', 't614');
    const text = await row(bob, 't614').innerText();
    const buttons = await row(bob, 't614').getByRole('button').count();
    await shot(bob, '06-bob-joined');
    ok('6 bob: t614 says Joined, no button', /Joined/.test(text) && buttons === 0, `${text}; buttons ${buttons}`);
    await bob.context().close();
  });
  await step('7 dark at 390×844: drawer and results on screen, no sideways scroll', async () => {
    await carol.keyboard.press('Escape');
    await carol.emulateMedia({ colorScheme: 'dark' });
    await carol.setViewportSize({ width: 390, height: 844 });
    await carol.goto(base + '/chats');
    await openFind(carol);
    await search(carol, 't614', 't614');
    await wait(400);
    const inside = async (loc) => {
      const b = await loc.boundingBox();
      return !!b && b.x >= 0 && b.x + b.width <= 390;
    };
    const d = await inside(drawer(carol));
    const r = await inside(row(carol, 't614'));
    const tag = await inside(row(carol, 't614').getByText('Requested', { exact: true }));
    const sideways = await carol.evaluate(() => document.scrollingElement.scrollWidth > innerWidth);
    await shot(carol, '07-phone-dark');
    ok('7 dark at 390×844: drawer and results on screen, no sideways scroll', d && r && tag && !sideways, `drawer ${d}; row ${r}; tag ${tag}; sideways ${sideways}`);
  });
} finally {
  await browser.close();
}
console.log(checks.join('\n'));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : '\nno console errors');
