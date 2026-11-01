// TC-495~TC-500 (docs/TEST.md): which of alice's sessions a contact can see, set on the contact's page (FLOW-CONTACT-SHARE),
// against the local test server (§3「联系人能看到的会话(网页)」, seeded). The page must be http://localhost:5190 (`npm run dev`).
// Each case sets its own 前置 through the API first, so any of them can run alone. TC-497 stops the server and starts it
// again on the same data. Prints PASS/FAIL per step, then any console errors the steps don't expect. Codes are read from
// $L/server.log and never printed.
// usage: node web/app/tests/contact-share.mjs <screenshot dir> [495 496 …]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const crates = new URL('../../../crates/', import.meta.url).pathname;
const base = 'http://localhost:5190';
const L = '/tmp/imbo-t';
const out = process.argv[2];
const only = process.argv.slice(3).map((n) => `TC-${n}`);
fs.mkdirSync(out, { recursive: true });
const checks = [];
const ok = (name, cond, detail = '') => {
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, ' ')}` : ''}`;
  checks.push(line);
  console.log(line);
};
const sh = (cmd, env = {}) =>
  execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8', env: { ...process.env, ...env } }).replace(/\x1b\[[0-9;]*m/g, '');
const as = (who, args) => sh(`IMBO_HOME=$L/${who} "$IMBO" ${args}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ids = () => Object.fromEntries(fs.readFileSync(`${L}/ids.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').slice(0, 2).map((x, i) => (i ? Number(x) : x))));
const { alice, bob } = ids();

/** A computer sign-in's API call; `home` is a directory under $L, such as alice or extra/dave. */
async function api(home, method, path, body) {
  const token = fs.readFileSync(`${L}/${home}/credentials`, 'utf8').match(/^token = "(.*)"/m)[1];
  const r = await fetch(`http://127.0.0.1:18080${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  return [r.status, await r.json().catch(() => null)];
}
const shareOf = async (peer) => (await api('alice', 'GET', `/v1/contacts/${peer}/share`))[1];
const setShareOf = (peer, body) => api('alice', 'PUT', `/v1/contacts/${peer}/share`, body);
/** The titles of alice's sessions as `home` sees them in its contacts, those seen in the last 7 days too. */
const seenBy = async (home) => ((await api(home, 'GET', '/v1/contacts?offline=true'))[1].contacts.find((p) => p.id === alice)?.sessions ?? []).map((x) => x.title).sort();
const agentId = async (title) => (await api('alice', 'GET', '/v1/agents'))[1].agents.find((a) => a.title === title).id;
const titles = (share) => ({ share: share.share, devices: share.devices.map((d) => d.name), sessions: share.sessions.map((x) => x.title) });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const codeLines = (email) => fs.readFileSync(`${L}/server.log`, 'utf8').split('\n').filter((l) => l.includes('mail-log-only code=') && l.endsWith(`email=${email}`));
async function codeFor(email, after) {
  for (let i = 0; i < 50; i++) {
    const lines = codeLines(email);
    if (lines.length > after) return lines.at(-1).match(/code=(\d+)/)[1];
    await wait(200);
  }
  throw new Error(`no code for ${email}`);
}
const stopServer = () => {
  const pid = fs.readFileSync(`${L}/server.pid`, 'utf8').trim();
  sh(`kill ${pid}; while kill -0 ${pid} 2>/dev/null; do sleep 0.2; done`);
};
// Started again with the same data and the web origin, the way `local-env.sh server` does.
const startServer = () => sh(`sh ${crates}scripts/local-env.sh server 2>/dev/null`, { IMBO_WEB_ORIGIN: 'http://localhost:5190' });

let current = 'login';
const consoleErrors = [];
// While the server is down, saving and the live connection fail on purpose.
const down = /status of 50\d|WebSocket connection|ERR_|Failed to load resource/;
const expected = { 'login alice': /status of 401 /, 'TC-497 #1': down, 'TC-497 #2': down, 'TC-497 #3': down, 'TC-497 #4': down };
const browser = await chromium.launch();
const step = async (id, fn) => {
  current = id;
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};
const run = (tc) => !only.length || only.includes(tc);

try {
  const context = async (opts, cookies) => {
    const ctx = await browser.newContext({ locale: 'en-US', timezoneId: 'Asia/Shanghai', viewport: { width: 1440, height: 900 }, ...opts, ...(cookies && { storageState: { cookies, origins: [] } }) });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push([current, m.text()]));
    page.on('pageerror', (e) => consoleErrors.push([current, `pageerror: ${e.message}`]));
    return page;
  };
  const page = await context();
  current = 'login alice';
  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');
  const { cookies } = await page.context().storageState();

  /** The section on a contact's page, after it has loaded. */
  const section = async (p, name = 'bob', heading = `Your sessions ${name} can see`) => {
    const s = p.getByRole('region', { name: heading });
    await s.getByRole('radio').first().waitFor();
    return s;
  };
  const open = async (p, id = bob, name = 'bob', heading) => {
    await p.goto(`${base}/contacts/${id}`);
    return section(p, name, heading);
  };
  const picked = (s) => s.getByRole('radio', { checked: true });
  const pickedName = async (s) => (await picked(s).innerText()).split('\n')[0].trim();
  const chips = async (s) => (await s.getByRole('list', { name: 'Picked' }).count()) ? (await s.getByRole('list', { name: 'Picked' }).getByRole('listitem').allInnerTexts()).map((x) => x.trim()) : [];
  const drawer = (p, name = 'bob') => p.getByRole('dialog', { name: `What ${name} can see` });
  const row = (d, text) => d.locator('li', { hasText: text }).getByRole('checkbox');
  const isChecked = async (box) => (await box.getAttribute('data-state')) === 'checked';
  /** Waits up to `ms` for `cond` to hold, polling; the time it took. */
  const within = async (cond, ms, what) => {
    const t0 = Date.now();
    while (!(await cond())) {
      if (Date.now() - t0 > ms) throw new Error(`not within ${ms / 1000} s: ${what}`);
      await wait(100);
    }
    return Date.now() - t0;
  };

  if (run('TC-495')) {
    await setShareOf(bob, { share: 'all' });
    let s;
    await step('TC-495 #1', async () => {
      s = await open(page);
      const text = (await s.innerText()).replace(/\s+/g, ' ');
      const radios = (await s.getByRole('radio').allInnerTexts()).map((x) => x.split('\n')[0].trim());
      await page.screenshot({ path: `${out}/tc495-1.png` });
      ok(
        'TC-495 #1 the section: three levels, All your sessions picked, the shared-group line',
        same(radios, ['All your sessions', 'Only the ones you pick', 'None']) && (await pickedName(s)) === 'All your sessions' && text.includes('Sessions you put in a group you share with bob show to bob in that group too.'),
        `${radios.join(' | ')}; picked ${await pickedName(s)}`,
      );
    });
    await step('TC-495 #2', async () => {
      await s.getByRole('radio', { name: 'None' }).click();
      await within(async () => (await shareOf(bob)).share === 'none' && !(await s.getByText('Saving…').count()), 5000, 'saved none');
      const text = (await s.innerText()).replace(/\s+/g, ' ');
      const sees = await seenBy('bob');
      ok("TC-495 #2 None: picked, says bob can only message the inbox; saved; bob sees none of alice's sessions", (await pickedName(s)) === 'None' && text.includes('bob can only message your inbox.') && !sees.length, `bob sees [${sees}]`);
    });
    await step('TC-495 #3', async () => {
      await s.getByRole('radio', { name: 'Only the ones you pick' }).click();
      const d = drawer(page);
      await d.waitFor();
      await row(d, 'checkout').waitFor();
      const text = (await d.innerText()).replace(/\s+/g, ' ');
      const ticked = await Promise.all(['Every session on it', 'checkout', 'docs-site'].map((x) => isChecked(row(d, x))));
      await page.screenshot({ path: `${out}/tc495-3.png` });
      ok('TC-495 #3 the drawer: seed for every session on it, with checkout and docs-site under it, none ticked', /seed Every session on it, ones you start later too/.test(text) && !ticked.some(Boolean), text.slice(0, 240));
    });
    await step('TC-495 #4', async () => {
      const d = drawer(page);
      await row(d, 'docs-site').click();
      await d.getByRole('button', { name: 'Save' }).click();
      await d.waitFor({ state: 'detached' });
      const c = await chips(s);
      const saved = titles(await shareOf(bob));
      const sees = await seenBy('bob');
      await page.screenshot({ path: `${out}/tc495-4.png` });
      ok(
        'TC-495 #4 saved: Only the ones you pick, the docs-site tag and Change…; the server has docs-site only; bob sees docs-site only',
        (await pickedName(s)) === 'Only the ones you pick' && same(c, ['docs-site']) && (await s.getByRole('button', { name: 'Change…' }).count()) === 1 && same(saved, { share: 'chosen', devices: [], sessions: ['docs-site'] }) && same(sees, ['docs-site']),
        `tags ${c}; ${JSON.stringify(saved)}; bob sees [${sees}]`,
      );
    });
    await step('TC-495 #5', async () => {
      await s.getByRole('button', { name: 'Change…' }).click();
      const d = drawer(page);
      await row(d, 'checkout').waitFor();
      const order = (await d.locator('li', { has: page.getByRole('checkbox') }).allInnerTexts()).map((x) => x.split('\n')[0].trim());
      const first = order.indexOf('docs-site') < order.indexOf('checkout') && (await isChecked(row(d, 'docs-site')));
      await row(d, 'docs-site').click();
      await row(d, 'checkout').click();
      await d.getByRole('button', { name: 'Save' }).click();
      await d.waitFor({ state: 'detached' });
      const c = await chips(s);
      ok('TC-495 #5 docs-site first and ticked when the drawer opens; after the change only checkout', first && same(c, ['checkout']), `rows ${order.join(' | ')}; tags ${c}`);
    });
    await step('TC-495 #6', async () => {
      const p = await context({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' }, cookies);
      const s6 = await open(p);
      await s6.scrollIntoViewIfNeeded();
      const c = await chips(s6);
      await p.screenshot({ path: `${out}/tc495-6a.png` });
      await s6.getByRole('button', { name: 'Change…' }).click();
      const save = drawer(p).getByRole('button', { name: 'Save' });
      await save.waitFor();
      await wait(400);
      const r = await save.boundingBox();
      await p.screenshot({ path: `${out}/tc495-6b.png` });
      ok('TC-495 #6 dark, 390 wide: the checkout tag; the drawer\'s Save inside the window', same(c, ['checkout']) && r.x >= 0 && r.x + r.width <= 390 && r.y >= 0 && r.y + r.height <= 844, `tags ${c}; Save at ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      await p.context().close();
    });
    await step('TC-495 #7', async () => {
      const p = await context({ locale: 'zh-CN' }, cookies);
      const s7 = await open(p, bob, 'bob', 'bob 能看到你的哪些会话');
      const radios = (await s7.getByRole('radio').allInnerTexts()).map((x) => x.split('\n')[0].trim());
      const change = await s7.getByRole('button', { name: '修改…' }).count();
      await p.screenshot({ path: `${out}/tc495-7.png` });
      ok('TC-495 #7 in Chinese: the heading, the three levels and 修改…', same(radios, ['你的全部会话', '只看我选的', '一个都不给看']) && change === 1, radios.join(' | '));
      await p.context().close();
    });
    await step('TC-495 #8', async () => {
      await s.getByRole('radio', { name: 'All your sessions' }).click();
      await within(async () => (await shareOf(bob)).share === 'all', 5000, 'saved all');
      await within(async () => !(await chips(s)).length, 2000, 'the tags gone');
      const sees = await seenBy('bob');
      ok('TC-495 #8 All your sessions: picked, the tags and Change… gone; bob sees checkout and docs-site', (await pickedName(s)) === 'All your sessions' && !(await s.getByRole('button', { name: 'Change…' }).count()) && same(sees, ['checkout', 'docs-site']), `bob sees [${sees}]`);
    });
  }

  if (run('TC-496')) {
    await setShareOf(bob, { share: 'chosen', sessions: [await agentId('docs-site')] });
    let s;
    const d = drawer(page);
    await step('TC-496 #1', async () => {
      s = await open(page);
      await s.getByRole('button', { name: 'Change…' }).click();
      await row(d, 'checkout').waitFor();
      ok('TC-496 #1 the drawer: docs-site ticked, seed not', (await isChecked(row(d, 'docs-site'))) && !(await isChecked(row(d, 'Every session on it'))));
    });
    await step('TC-496 #2', async () => {
      await row(d, 'Every session on it').click();
      await row(d, 'checkout').click({ force: true }).catch(() => {});
      const states = await Promise.all(['checkout', 'docs-site'].map(async (x) => [await isChecked(row(d, x)), await row(d, x).isDisabled()]));
      await page.screenshot({ path: `${out}/tc496-2.png` });
      ok('TC-496 #2 seed ticked: checkout and docs-site ticked and can\'t be changed', states.every(([c, dis]) => c && dis), JSON.stringify(states));
    });
    await step('TC-496 #3', async () => {
      await d.getByRole('button', { name: 'Save' }).click();
      await d.waitFor({ state: 'detached' });
      const c = await chips(s);
      const saved = titles(await shareOf(bob));
      ok('TC-496 #3 saved: one tag for seed; the server has the computer and no single sessions', same(c, ['seed, every session on it']) && same(saved, { share: 'chosen', devices: ['seed'], sessions: [] }), `tags ${c}; ${JSON.stringify(saved)}`);
    });
    await step('TC-496 #4', async () => {
      as('alice', 'dev fake-session 55555555-aaaa-bbbb-cccc-0000000a0496 --title t496');
      const sees = await seenBy('bob');
      ok('TC-496 #4 a session started later on seed: bob sees checkout, docs-site and t496', same(sees, ['checkout', 'docs-site', 't496']), `bob sees [${sees}]`);
    });
    await step('TC-496 #5', async () => {
      await s.getByRole('button', { name: 'Change…' }).click();
      await row(d, 't496').waitFor();
      await row(d, 'Every session on it').click();
      const states = await Promise.all(['checkout', 'docs-site', 't496'].map(async (x) => [await isChecked(row(d, x)), await row(d, x).isDisabled()]));
      ok('TC-496 #5 seed unticked: the three sessions can be ticked, none is', states.every(([c, dis]) => !c && !dis), JSON.stringify(states));
    });
    await step('TC-496 #6', async () => {
      await row(d, 't496').click();
      await d.getByRole('button', { name: 'Save' }).click();
      await d.waitFor({ state: 'detached' });
      const c = await chips(s);
      const saved = titles(await shareOf(bob));
      const sees = await seenBy('bob');
      ok('TC-496 #6 t496 alone: its tag; the server has t496 only; bob sees t496 only', same(c, ['t496']) && same(saved, { share: 'chosen', devices: [], sessions: ['t496'] }) && same(sees, ['t496']), `tags ${c}; ${JSON.stringify(saved)}; bob sees [${sees}]`);
    });
    await step('TC-496 #7', async () => {
      const before = codeLines('alice@imbo.test').length;
      await fetch('http://127.0.0.1:18080/v1/auth/code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'alice@imbo.test' }) });
      const code = await codeFor('alice@imbo.test', before);
      const r = await fetch('http://127.0.0.1:18080/v1/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'alice@imbo.test', code, device_name: 't496-old', platform: 'macos', client_version: '0.2.17' }),
      });
      if (r.status !== 200) throw new Error(`auth/verify ${r.status}`);
      // The drawer shows the computers it had while it fetches them again: read it once that answer is in.
      const fetched = page.waitForResponse((r) => new URL(r.url()).pathname === '/v1/devices');
      await s.getByRole('button', { name: 'Change…' }).click();
      await fetched;
      await wait(200);
      await row(d, 'checkout').waitFor();
      const computers = (await d.locator('li', { hasText: 'Every session on it' }).allInnerTexts()).map((x) => x.split('\n')[0].trim());
      const text = (await d.innerText()).replace(/\s+/g, ' ');
      await page.screenshot({ path: `${out}/tc496-7.png` });
      ok('TC-496 #7 a second computer signed in: seed and t496-old, t496-old with no sessions', same(computers, ['seed', 't496-old']) && text.includes('t496-old Every session on it, ones you start later too No sessions on it online or seen in the last 7 days.'), computers.join(' | '));
    });
    await step('TC-496 #8', async () => {
      await page.keyboard.press('Escape');
      await d.waitFor({ state: 'detached' });
      const old = (await api('alice', 'GET', '/v1/devices'))[1].devices.find((x) => x.name === 't496-old');
      const [st] = await api('alice', 'DELETE', `/v1/devices/${old.id}`);
      // The drawer shows the computers it had while it fetches them again: read it once that answer is in.
      const fetched = page.waitForResponse((r) => new URL(r.url()).pathname === '/v1/devices');
      await s.getByRole('button', { name: 'Change…' }).click();
      await fetched;
      await wait(200);
      await row(d, 'checkout').waitFor();
      const computers = (await d.locator('li', { hasText: 'Every session on it' }).allInnerTexts()).map((x) => x.split('\n')[0].trim());
      ok('TC-496 #8 t496-old signed out: the drawer lists seed only', st < 300 && same(computers, ['seed']), `DELETE ${st}; ${computers.join(' | ')}`);
      await page.keyboard.press('Escape');
    });
    as('alice', 'dev fake-session 55555555-aaaa-bbbb-cccc-0000000a0496 --title t496 --remove');
  }

  if (run('TC-497')) {
    await setShareOf(bob, { share: 'all' });
    let s;
    const noAnswer = "Imbo didn't answer. Check your connection and try again.";
    await step('TC-497 #1', async () => {
      s = await open(page);
      stopServer();
      // With the server down the save fails at once; held back 1.5 s, Saving… stays long enough to be read.
      const held = async (r) => {
        if (r.request().method() === 'PUT') await wait(1500);
        await r.continue();
      };
      await page.route('**/v1/contacts/*/share', held);
      await s.getByRole('radio', { name: 'None' }).click();
      await s.getByText('Saving…').waitFor({ timeout: 1000 });
      const disabled = await s.getByRole('radio').evaluateAll((list) => list.map((r) => r.disabled));
      await page.screenshot({ path: `${out}/tc497-1a.png` });
      const alert = s.getByRole('alert');
      await alert.waitFor({ timeout: 15000 });
      await page.unroute('**/v1/contacts/*/share', held);
      const text = (await alert.innerText()).replace(/\s+/g, ' ');
      await page.screenshot({ path: `${out}/tc497-1.png` });
      ok(
        "TC-497 #1 server down: Saving… with the levels disabled, then Couldn't save with why and Try again; All your sessions still picked",
        disabled.every(Boolean) && text.startsWith(`Couldn't save. ${noAnswer}`) && text.includes('Try again') && (await pickedName(s)) === 'All your sessions',
        `while saving, disabled: ${disabled}; ${text}`,
      );
    });
    await step('TC-497 #2', async () => {
      startServer();
      await s.getByRole('button', { name: 'Try again' }).click();
      await within(async () => !(await s.getByRole('alert').count()) && (await pickedName(s)) === 'None', 10000, 'saved after Try again');
      const saved = await shareOf(bob);
      ok('TC-497 #2 server back, Try again: the error gone, None picked and saved', saved.share === 'none', saved.share);
    });
    await step('TC-497 #3', async () => {
      await s.getByRole('radio', { name: 'Only the ones you pick' }).click();
      const d = drawer(page);
      await row(d, 'checkout').click();
      stopServer();
      await d.getByRole('button', { name: 'Save' }).click();
      await d.getByText(noAnswer).waitFor({ timeout: 15000 });
      await page.screenshot({ path: `${out}/tc497-3.png` });
      ok("TC-497 #3 server down, Save: the drawer stays with why, checkout still ticked", (await d.isVisible()) && (await isChecked(row(d, 'checkout'))));
    });
    await step('TC-497 #4', async () => {
      startServer();
      const d = drawer(page);
      await d.getByRole('button', { name: 'Save' }).click();
      await d.waitFor({ state: 'detached', timeout: 10000 });
      const c = await chips(s);
      const saved = titles(await shareOf(bob));
      ok('TC-497 #4 server back, Save: the drawer closes, the checkout tag; saved', same(c, ['checkout']) && same(saved, { share: 'chosen', devices: [], sessions: ['checkout'] }), `tags ${c}; ${JSON.stringify(saved)}`);
    });
  }

  if (run('TC-498')) {
    as('bob', 'contact share alice all');
    const sessions = page.getByRole('region', { name: 'Sessions', exact: true });
    const none = "bob has no sessions online or seen in the last 7 days. Messages go to bob's inbox.";
    await step('TC-498 #1', async () => {
      await open(page);
      await sessions.getByText('orders-api').waitFor();
      ok('TC-498 #1 bob\'s page lists orders-api', true);
    });
    await step('TC-498 #2', async () => {
      const t0 = Date.now();
      as('bob', 'contact share alice none');
      await sessions.getByText(none).waitFor({ timeout: 5000 });
      await page.screenshot({ path: `${out}/tc498-2.png` });
      ok('TC-498 #2 bob shows alice none: within 5 s, no reload, no sessions and messages go to the inbox', true, `${Date.now() - t0} ms`);
    });
    await step('TC-498 #3', async () => {
      const t0 = Date.now();
      as('bob', 'contact share alice all');
      await sessions.getByText('orders-api').waitFor({ timeout: 5000 });
      ok('TC-498 #3 bob shows alice all: orders-api back within 5 s', true, `${Date.now() - t0} ms`);
    });
    const recipient = page.getByRole('button', { name: /^Sending to bob's/ });
    await step('TC-498 #4', async () => {
      await page.goto(`${base}/chats`);
      await page.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: /^bob/ }).click();
      await recipient.click();
      await page.getByRole('menuitemradio', { name: /orders-api/ }).click();
      await page.getByRole('button', { name: "Sending to bob's session orders-api. Change" }).waitFor();
      ok("TC-498 #4 orders-api picked: the button says so", (await recipient.innerText()).includes('orders-api'));
    });
    await step('TC-498 #5', async () => {
      const t0 = Date.now();
      as('bob', 'contact share alice none');
      await page.getByRole('button', { name: "Sending to bob's inbox. Change" }).waitFor({ timeout: 5000 });
      const took = Date.now() - t0;
      const label = (await recipient.innerText()).trim();
      await recipient.click();
      const items = (await page.getByRole('menuitemradio').allInnerTexts()).map((x) => x.split('\n')[0].trim());
      await page.screenshot({ path: `${out}/tc498-5.png` });
      await page.keyboard.press('Escape');
      ok("TC-498 #5 bob shows alice none: within 5 s the button goes back to Inbox; the list has bob's inbox only", label === 'Inbox' && same(items, ["bob's inbox"]), `${took} ms; button ${label}; list ${items.join(' | ')}`);
    });
    await step('TC-498 #6', async () => {
      const box = page.getByRole('textbox', { name: /^Message bob/ });
      await box.fill('T498 to inbox');
      await box.press('Enter');
      await page.locator('main article', { hasText: 'T498 to inbox' }).waitFor();
      const inbox = await within(async () => as('bob', 'inbox').includes('T498 to inbox'), 5000, "T498 in bob's inbox");
      ok("TC-498 #6 sent: it's in bob's inbox", true, `${inbox} ms`);
    });
    as('bob', 'contact share alice all');
  }

  if (run('TC-499')) {
    await setShareOf(bob, { share: 'all' });
    const b = await context({}, cookies);
    let sa, sb;
    await step('TC-499 #1', async () => {
      sa = await open(page);
      sb = await open(b);
      const t0 = Date.now();
      as('alice', 'contact share bob none');
      await within(async () => (await pickedName(sa)) === 'None' && (await pickedName(sb)) === 'None', 5000, 'both on None');
      ok('TC-499 #1 alice saves none in a terminal: both windows on None within 5 s', true, `${Date.now() - t0} ms`);
    });
    await step('TC-499 #2', async () => {
      await sa.getByRole('radio', { name: 'Only the ones you pick' }).click();
      const d = drawer(page);
      await row(d, 'checkout').click();
      await sb.getByRole('radio', { name: 'All your sessions' }).click();
      await within(async () => (await pickedName(sb)) === 'All your sessions' && !(await sb.getByText('Saving…').count()), 5000, 'B on All');
      await wait(1000);
      ok('TC-499 #2 B saves all; A\'s drawer stays open with checkout ticked', (await d.isVisible()) && (await isChecked(row(d, 'checkout'))));
    });
    await step('TC-499 #3', async () => {
      const d = drawer(page);
      await d.getByRole('button', { name: 'Save' }).click();
      await d.waitFor({ state: 'detached' });
      const t0 = Date.now();
      await within(async () => (await pickedName(sb)) === 'Only the ones you pick' && same(await chips(sb), ['checkout']), 5000, 'B follows');
      const took = Date.now() - t0;
      const saved = titles(await shareOf(bob));
      await b.screenshot({ path: `${out}/tc499-3.png` });
      ok('TC-499 #3 A saves after: A shows checkout, B follows within 5 s, the server has A\'s', same(await chips(sa), ['checkout']) && same(saved, { share: 'chosen', devices: [], sessions: ['checkout'] }), `${took} ms; ${JSON.stringify(saved)}`);
    });
    await b.context().close();
  }

  if (run('TC-500')) {
    const out500 = sh(`IMBO_DATA_DIR=$L/server "$S" dev seed --homes $L/extra --names dave`);
    const dave = Number(out500.split('\n').find((l) => l.startsWith('dave\t')).split('\t')[1]);
    await api('extra/dave', 'POST', '/v1/contacts/requests', { account_id: alice });
    const req = (await api('alice', 'GET', '/v1/requests'))[1].requests.find((r) => r.from.id === dave).id;
    await api('alice', 'POST', `/v1/requests/${req}/accept`);
    let s;
    await step('TC-500 #1', async () => {
      s = await open(page, dave, 'dave');
      const text = (await s.innerText()).replace(/\s+/g, ' ');
      await page.screenshot({ path: `${out}/tc500-1.png` });
      ok(
        'TC-500 #1 a new contact: Only the ones you pick, nothing picked so only the inbox, Pick…; no shared-group line',
        (await pickedName(s)) === 'Only the ones you pick' && text.includes('Nothing picked yet, so dave can only message your inbox.') && (await s.getByRole('button', { name: 'Pick…' }).count()) === 1 && !text.includes('in that group too'),
        text,
      );
    });
    await step('TC-500 #2', async () => {
      const sees = await seenBy('extra/dave');
      ok("TC-500 #2 dave sees none of alice's sessions", !sees.length, `[${sees}]`);
    });
    await step('TC-500 #3', async () => {
      await s.getByRole('button', { name: 'Pick…' }).click();
      const d = drawer(page, 'dave');
      await row(d, 'checkout').click();
      await d.getByRole('button', { name: 'Save' }).click();
      await d.waitFor({ state: 'detached' });
      const c = await chips(s);
      const sees = await seenBy('extra/dave');
      ok('TC-500 #3 checkout picked: its tag and Change…; dave sees checkout only', same(c, ['checkout']) && (await s.getByRole('button', { name: 'Change…' }).count()) === 1 && same(sees, ['checkout']), `tags ${c}; dave sees [${sees}]`);
    });
  }
} finally {
  await browser.close();
}
const unexpected = consoleErrors.filter(([at, text]) => !expected[at]?.test(text));
for (const [at, text] of unexpected) console.log(`console error during ${at}: ${text}`);
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(`${failed} failed, ${unexpected.length} unexpected console errors`);
process.exit(failed || unexpected.length ? 1 : 0);
