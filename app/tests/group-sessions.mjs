// TC-626 (docs/TEST.md): everyone in a group sees which sessions each member picked for it, in the group's details on the
// web and in `imbo group list` (PAGE-WEB-GROUP, PAGE-GROUP), against the local test server started with
// `IMBO_WEB_ORIGIN=http://localhost:5190 crates/scripts/local-env.sh up alice:bob`; the page must be
// http://localhost:5190 (`npm run dev`). Sets up the 前置 itself: alice makes t626 with her session t626-a, bob joins with
// t626-b. Prints PASS/FAIL per step, then any unexpected console errors. Codes are read from $L/server.log and never
// printed.
// usage: node web/app/tests/group-sessions.mjs <screenshot dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const crates = new URL('../../../crates/', import.meta.url).pathname;
const base = 'http://localhost:5190';
const L = '/tmp/imbo-t';
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const errors = [];
const ok = (name, cond, detail = '') => console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, ' ')}` : ''}`);
const sh = (cmd) => execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8' }).replace(/\x1b\[[0-9;]*m/g, '');
const as = (who, args) => sh(`IMBO_HOME=$L/${who} "$IMBO" ${args} 2>&1`);
const ids = Object.fromEntries(fs.readFileSync(`${L}/ids.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').slice(0, 2)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** `who`'s computer sign-in calling the API. */
async function api(who, method, path, body) {
  const token = fs.readFileSync(`${L}/${who}/credentials`, 'utf8').match(/^token = "(.*)"/m)[1];
  const r = await fetch(`http://127.0.0.1:18080${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  return [r.status, await r.json().catch(() => null)];
}
const agent = async (who, title) => (await api(who, 'GET', '/v1/agents'))[1].agents.find((a) => a.title === title);
// A member's sessions are listed by name (API-019), so this one comes after t626-b.
const LONG = 't626-c-session-name-long-enough-to-wrap-on-a-phone-0123456789';

as('alice', 'dev fake-session 62600000-aaaa-bbbb-cccc-00000000000a --title t626-a');
as('bob', 'dev fake-session 62600000-aaaa-bbbb-cccc-00000000000b --title t626-b');
as('bob', `dev fake-session 62600000-aaaa-bbbb-cccc-00000000000c --title ${LONG}`);
as('alice', 'group create t626 --sessions t626-a');
as('alice', `group invite t626 ${ids.bob}`);
as('bob', 'group join t626 --sessions t626-b');
const [a, b, long] = [await agent('alice', 't626-a'), await agent('bob', 't626-b'), await agent('bob', LONG)];
const gid = (await api('alice', 'GET', '/v1/groups'))[1].groups.find((g) => g.name === 't626').id;
const chat = (await api('alice', 'GET', '/v1/conversations'))[1].conversations.find((c) => c.group?.id === gid).id;

const codeLines = (email) => fs.readFileSync(`${L}/server.log`, 'utf8').split('\n').filter((l) => l.includes('mail-log-only code=') && l.endsWith(`email=${email}`));
async function codeFor(email, after) {
  for (let i = 0; i < 50; i++) {
    const lines = codeLines(email);
    if (lines.length > after) return lines.at(-1).match(/code=(\d+)/)[1];
    await wait(200);
  }
  throw new Error(`no code for ${email}`);
}

const browser = await chromium.launch();
const step = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    ok(name, false, e.message.split('\n')[0]);
  }
};

try {
  const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  // Expected: the 401 of /v1/me before signing in.
  page.on('console', (m) => m.type() === 'error' && !/status of 401 /.test(m.text()) && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');

  const details = () => page.getByRole('dialog', { name: 't626' });
  const member = (name) => details().locator('li', { has: page.locator('span', { hasText: new RegExp(`^${name}$`) }) });
  const text = async (name) => (await member(name).innerText()).replace(/\s+/g, ' ');
  const openDetails = async () => {
    await page.goto(`${base}/chats/${chat}`);
    await page.getByRole('button', { name: 't626', exact: true }).click();
    await member('bob').waitFor();
    await wait(300);
  };
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });

  await step("1 details: under bob his session t626-b and its short ID, under alice t626-a and its", async () => {
    await openDetails();
    const [tb, ta] = [await text('bob'), await text('alice')];
    await shot('01-details');
    ok("1 details: under bob his session t626-b and its short ID, under alice t626-a and its", tb.includes(`Sessions: t626-b ${b.short_id}`) && ta.includes(`Sessions: t626-a ${a.short_id}`), `bob: ${tb} | alice: ${ta}`);
  });
  await step("2 bob picks none: under bob, No sessions get this group's messages.", async () => {
    const [st] = await api('bob', 'PUT', `/v1/groups/${gid}/sessions`, { sessions: [] });
    await openDetails();
    const tb = await text('bob');
    await shot('02-none');
    ok("2 bob picks none: under bob, No sessions get this group's messages.", st === 200 && tb.includes("No sessions get this group's messages."), `PUT ${st}; bob: ${tb}`);
  });
  await step('3 dark, 390×844, bob picks t626-b and the long one: both under bob, wrapped inside the drawer', async () => {
    const [st] = await api('bob', 'PUT', `/v1/groups/${gid}/sessions`, { sessions: [b.id, long.id] });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 390, height: 844 });
    await openDetails();
    const tb = await text('bob');
    const fits = await details().evaluate((d) => {
      const li = [...d.querySelectorAll('li')].find((x) => x.textContent.includes('t626-b'));
      const [r, box] = [li?.getBoundingClientRect(), d.getBoundingClientRect()];
      return !!r && r.right <= box.right + 0.5 && d.scrollWidth <= d.clientWidth;
    });
    await member('bob').scrollIntoViewIfNeeded();
    await shot('03-dark-390');
    ok('3 dark, 390×844, bob picks t626-b and the long one: both under bob, wrapped inside the drawer', st === 200 && tb.includes(`Sessions: t626-b ${b.short_id}, ${LONG} ${long.short_id}`) && fits, `PUT ${st}; fits ${fits}; bob: ${tb}`);
  });
  await step('4 imbo group list for alice: alice with t626-a, bob with t626-b and the long one', async () => {
    const list = as('alice', 'group list');
    const block = list.split(/\n(?=\S)/).find((x) => x.startsWith('t626'));
    fs.writeFileSync(`${out}/04-group-list.txt`, list);
    const lines = (block ?? '').split('\n').map((l) => l.trim());
    const hasA = lines.some((l) => /^(sessions\s+)?alice: /.test(l) && l.endsWith(`t626-a ${a.short_id}`));
    const hasB = lines.some((l) => /^(sessions\s+)?bob: /.test(l) && l.endsWith(`t626-b ${b.short_id}, ${LONG} ${long.short_id}`));
    ok('4 imbo group list for alice: alice with t626-a, bob with t626-b and the long one', hasA && hasB, block);
  });
} finally {
  await browser.close();
}
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : '\nno console errors');
