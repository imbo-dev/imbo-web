// TC-440 (docs/TEST.md): the group details drawer fetches the group again each time it opens, so a rename and a session picked
// from the terminal show without reloading the page. Against the local test server, setup as TC-440's 前置; the page must be
// http://localhost:5190 (`npm run dev`). Prints PASS/FAIL per step, then any console errors. Codes are read from
// $L/server.log and never printed.
// usage: node web/app/tests/group-refresh.mjs <screenshot dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const crates = new URL('../../../crates/', import.meta.url).pathname;
const base = 'http://localhost:5190';
const L = '/tmp/imbo-t';
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const ok = (name, cond, detail = '') => console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, ' ')}` : ''}`);
const sh = (cmd, env = {}) =>
  execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8', env: { ...process.env, ...env } }).replace(/\x1b\[[0-9;]*m/g, '');
const as = (who, args, env) => sh(`IMBO_HOME=$L/${who} "$IMBO" ${args}`, env);
const token = (who) => fs.readFileSync(`${L}/${who}/credentials`, 'utf8').match(/^token = "(.*)"/m)[1];
const api = async (method, path, body) => {
  const r = await fetch(`http://127.0.0.1:18080${path}`, {
    method,
    headers: { authorization: `Bearer ${token('alice')}`, 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  return [r.status, r.status === 204 ? null : await r.json()];
};
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

// 前置
const CHECKOUT = '55555555-aaaa-bbbb-cccc-0000000a0001';
as('alice', `dev fake-session ${CHECKOUT} --title checkout`);
const [, convs] = await api('GET', '/v1/conversations');
const G = convs.conversations.find((c) => c.kind === 'group').group.id;
await api('PUT', `/v1/groups/${G}/sessions`, { sessions: [] });

const errors = [];
let current = 'login alice';
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
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' })).newPage();
  // Before signing in, the page asks who is signed in and gets 401: expected.
  page.on('console', (m) => m.type() === 'error' && !(current === 'login alice' && /status of 401 /.test(m.text())) && errors.push(`${current}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${current} pageerror: ${e.message}`));
  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');

  const dialog = page.getByRole('dialog');
  const checkout = dialog.getByRole('checkbox', { name: /^checkout/ });
  const open = async () => {
    await page.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: /release-team|t440-team/ }).first().click();
    await page.getByRole('button', { name: /release-team|t440-team/ }).first().click();
    await dialog.getByRole('heading', { name: 'Members' }).waitFor();
    // Screenshots wait for the drawer to stop sliding in: mid-slide, its right part is still past the window's edge.
    await page.waitForFunction(() => document.querySelector('[role=dialog]').getAnimations().every((a) => a.playState !== 'running'));
  };
  await step('TC-440 #1', async () => {
    await open();
    await checkout.waitFor();
    const name = await dialog.getByRole('heading').first().textContent();
    const state = await checkout.getAttribute('aria-checked');
    await page.screenshot({ path: `${out}/tc-440-01.png` });
    ok('TC-440 #1 release-team as it was', name.includes('release-team') && state === 'false', `heading ${name}, checkout aria-checked ${state}`);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
  });
  await step('TC-440 #2', async () => {
    as('alice', `group rename "#${G}" t440-team`);
    as('alice', `group sessions "#${G}" --sessions 0a0001`);
    ok('TC-440 #2 renamed and checkout picked from the terminal', true);
  });
  await step('TC-440 #3', async () => {
    await open();
    await dialog.getByRole('heading', { name: 't440-team' }).waitFor({ timeout: 5000 });
    await page.waitForFunction(() => document.querySelector('[role=dialog] [role=checkbox]')?.getAttribute('aria-checked') === 'true', null, { timeout: 5000 }).catch(() => {});
    const first = await checkout.evaluate((el) => el === el.closest('[role=dialog]').querySelector('[role=checkbox]'));
    const state = await checkout.getAttribute('aria-checked');
    const save = await dialog.getByRole('button', { name: 'Save' }).count();
    await page.screenshot({ path: `${out}/tc-440-03.png` });
    ok('TC-440 #3 opened again: the new name and pick, no Save', first && state === 'true' && save === 0,
      `checkout ${first ? 'is' : 'is not'} the first row, aria-checked ${state}, Save buttons ${save}`);
  });
} finally {
  await browser.close();
}
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
