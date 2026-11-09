// TC-632 (docs/TEST.md): in a group's details on the web, the owner makes an admin and lets anyone find the group, and
// the admin does what the owner does but hand it on and dissolve it: makes another admin, removes that admin, turns the
// switch off and renames the group (FLOW-GROUP-ADMIN, FLOW-GROUP-DISCOVER S1, FLOW-GROUP-REMOVE), against the local test
// server started with `crates/scripts/local-env.sh up alice:bob,alice:carol`; the page must be
// http://localhost:5190 (`npm run dev`). Sets up the 前置 itself: alice makes t632 with bob and carol in it. Prints
// PASS/FAIL per step, then any unexpected console errors. Codes are read from $L/server.log and never printed.
// usage: node web/app/tests/group-admin.mjs <screenshot dir>
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
const t632 = async () => (await api('alice', 'GET', '/v1/groups'))[1].groups.find((g) => g.id === gid);
const roleOf = async (name) => (await t632()).members.find((m) => m.name === name)?.role;

const codeLines = (email) => fs.readFileSync(`${L}/server.log`, 'utf8').split('\n').filter((l) => l.includes('mail-log-only code=') && l.endsWith(`email=${email}`));
async function codeFor(email, after) {
  for (let i = 0; i < 50; i++) {
    const lines = codeLines(email);
    if (lines.length > after) return lines.at(-1).match(/code=(\d+)/)[1];
    await wait(200);
  }
  throw new Error(`no code for ${email}`);
}

as('alice', 'group create t632');
for (const who of ['bob', 'carol']) {
  as('alice', `group invite t632 ${ids[who]}`);
  as(who, 'group join t632');
}
const gid = (await api('alice', 'GET', '/v1/groups'))[1].groups.find((g) => g.name === 't632').id;
// bob renames it at step 7.
let name = 't632';
const chat = (await api('alice', 'GET', '/v1/conversations'))[1].conversations.find((c) => c.group?.id === gid).id;

const browser = await chromium.launch();
const step = async (id, fn) => {
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};

try {
  const signIn = async (who) => {
    const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 900 } });
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
  const details = (p) => p.getByRole('dialog', { name });
  const member = (p, who) => details(p).locator('li', { has: p.locator('span', { hasText: new RegExp(`^${who}$`) }) });
  const findable = (p) => details(p).getByRole('switch', { name: 'Let people find this group' });
  const actions = (p, who) => member(p, who).getByRole('button', { name: `Actions for ${who}` });
  const tagged = async (p, who) => (await member(p, who).getByText('Admin', { exact: true }).count()) === 1;
  const openDetails = async (p) => {
    await p.goto(`${base}/chats/${chat}`);
    await p.getByRole('button', { name, exact: true }).click();
    // bob is in it from start to end; carol leaves at step 6.
    await member(p, 'bob').waitFor();
  };
  const menu = async (p, who, item) => {
    await actions(p, who).click();
    await p.getByRole('menuitem', { name: item }).click();
  };
  const alice = await signIn('alice');
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });

  await step('1 details: the switch is off, nobody marked Admin', async () => {
    await openDetails(alice);
    const state = await findable(alice).getAttribute('aria-checked');
    const admins = await details(alice).getByText('Admin', { exact: true }).count();
    await shot(alice, '01-details');
    ok('1 details: the switch is off, nobody marked Admin', state === 'false' && admins === 0, `switch ${state}; Admin tags ${admins}`);
  });
  await step('2 the switch on: discoverable is true', async () => {
    await findable(alice).click();
    await wait(800);
    const state = await findable(alice).getAttribute('aria-checked');
    const g = await t632();
    ok('2 the switch on: discoverable is true', state === 'true' && g.discoverable === true, `switch ${state}; discoverable ${g.discoverable}`);
  });
  await step('3 Make admin: bob marked Admin, role admin', async () => {
    await menu(alice, 'bob', 'Make admin');
    await member(alice, 'bob').getByText('Admin', { exact: true }).waitFor();
    const role = await roleOf('bob');
    await shot(alice, '03-admin');
    ok('3 Make admin: bob marked Admin, role admin', role === 'admin', `role ${role}`);
  });
  const bob = await signIn('bob');
  await step('4 bob: the switch, Rename group and the picture; Make admin and Remove on carol, nothing on alice', async () => {
    await openDetails(bob);
    const sw = await findable(bob).count();
    const rename = await details(bob).getByRole('button', { name: 'Rename group' }).count();
    const pic = await details(bob).getByRole('button', { name: 'Change group picture' }).count();
    const onAlice = await actions(bob, 'alice').count();
    await actions(bob, 'carol').click();
    const items = (await bob.getByRole('menuitem').allInnerTexts()).map((x) => x.trim());
    await shot(bob, '04-bob-menu');
    await bob.keyboard.press('Escape');
    ok('4 bob: the switch, Rename group and the picture; Make admin and Remove on carol, nothing on alice', sw === 1 && rename === 1 && pic === 1 && onAlice === 0 && items.length === 2 && items[0] === 'Make admin' && /^Remove carol/.test(items[1]), `switch ${sw}; rename ${rename}; picture ${pic}; alice actions ${onAlice}; carol menu ${JSON.stringify(items)}`);
  });
  await step('5 bob makes carol an admin: carol marked Admin, role admin', async () => {
    await menu(bob, 'carol', 'Make admin');
    await member(bob, 'carol').getByText('Admin', { exact: true }).waitFor();
    const role = await roleOf('carol');
    ok('5 bob makes carol an admin: carol marked Admin, role admin', role === 'admin', `role ${role}`);
  });
  await step('6 bob removes the admin carol: she leaves the members', async () => {
    await menu(bob, 'carol', /^Remove carol/);
    const confirm = bob.getByRole('dialog', { name: new RegExp(`Remove carol from ${name}`) });
    await confirm.getByText('You can invite them again later.', { exact: false }).waitFor();
    await shot(bob, '06-confirm');
    await confirm.getByRole('button', { name: 'Remove carol', exact: true }).click();
    // The question closes once the server has removed her; until then the details are hidden behind it and their rows
    // can't be found at all.
    await confirm.waitFor({ state: 'detached' });
    await member(bob, 'carol').waitFor({ state: 'detached' });
    const names = (await t632()).members.map((m) => m.name);
    ok('6 bob removes the admin carol: she leaves the members', !names.includes('carol'), names.join(', '));
  });
  await step('7 bob turns the switch off and renames it t632b', async () => {
    await findable(bob).click();
    await wait(800);
    const state = await findable(bob).getAttribute('aria-checked');
    await details(bob).getByRole('button', { name: 'Rename group' }).click();
    await details(bob).getByLabel('Group name').fill('t632b');
    await details(bob).getByLabel('Group name').press('Enter');
    name = 't632b';
    await details(bob).getByRole('heading', { name }).waitFor({ timeout: 8000 });
    const g = await t632();
    await shot(bob, '07-renamed');
    ok('7 bob turns the switch off and renames it t632b', state === 'false' && g.discoverable === false && g.name === 't632b', `switch ${state}; discoverable ${g.discoverable}; name ${g.name}`);
  });
  await bob.context().close();
  await step('8 Remove admin: bob no longer marked Admin', async () => {
    await openDetails(alice);
    await menu(alice, 'bob', 'Remove admin');
    await member(alice, 'bob').getByText('Admin', { exact: true }).waitFor({ state: 'detached' });
    const role = await roleOf('bob');
    ok('8 Remove admin: bob no longer marked Admin', !(await tagged(alice, 'bob')) && role === 'member', `role ${role}`);
  });
  await step('9 dark at 390×844 with bob an admin again: the switch, members and Admin on screen, no sideways scroll', async () => {
    await api('alice', 'PUT', `/v1/groups/${gid}/admins/${ids.bob}`);
    await alice.keyboard.press('Escape');
    await alice.emulateMedia({ colorScheme: 'dark' });
    await alice.setViewportSize({ width: 390, height: 844 });
    await openDetails(alice);
    await member(alice, 'bob').getByText('Admin', { exact: true }).waitFor();
    await wait(400);
    const inside = async (loc) => {
      const b = await loc.boundingBox();
      return !!b && b.x >= 0 && b.x + b.width <= 390;
    };
    const sw = await inside(findable(alice));
    const rows = (await Promise.all(['alice', 'bob'].map((n) => inside(member(alice, n))))).every(Boolean);
    const tag = await inside(member(alice, 'bob').getByText('Admin', { exact: true }));
    const sideways = await alice.evaluate(() => document.scrollingElement.scrollWidth > innerWidth);
    await shot(alice, '09-phone-dark');
    ok('9 dark at 390×844 with bob an admin again: the switch, members and Admin on screen, no sideways scroll', sw && rows && tag && !sideways, `switch ${sw}; members ${rows}; tag ${tag}; sideways ${sideways}`);
  });
} finally {
  await browser.close();
}
console.log(checks.join('\n'));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : '\nno console errors');
