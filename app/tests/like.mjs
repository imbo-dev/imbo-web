// TC-652 (docs/TEST.md): the web page has no 👍 — no Thumbs up button beside Reply, none in the right-click menu — and a 👍
// an older App gives through the API (API-091) shows nowhere, while new messages still arrive without a reload
// (FLOW-LIVE, ADR-070), against the local test server started with `crates/scripts/local-env.sh up alice:bob,alice:carol`;
// the page must be http://localhost:5190 (`npm run dev`). Sets up the 前置 itself: t652 with bob and carol in it and
// bob's T652 群一. Prints PASS/FAIL per step, then any unexpected console errors. Codes are read from $L/server.log and
// never printed.
// usage: node web/app/tests/like.mjs <screenshot dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const crates = new URL('../../../crates/', import.meta.url).pathname;
const base = 'http://localhost:5190';
const api = 'http://127.0.0.1:18080';
const L = '/tmp/imbo-t';
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const errors = [];
const checks = [];
const ok = (name, cond, detail = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, ' ')}` : ''}`);
const sh = (cmd) => execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8' });
const as = (home, args) => sh(`IMBO_HOME=$L/${home} "$IMBO" ${args} 2>&1`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** `home`'s computer sign-in calling the API; `home` is a directory under $L, such as alice. */
async function computer(home, method, path) {
  const token = fs.readFileSync(`${L}/${home}/credentials`, 'utf8').match(/^token = "(.*)"/m)[1];
  const r = await fetch(api + path, { method, headers: { authorization: `Bearer ${token}` } });
  return [r.status, await r.json().catch(() => null)];
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
/** Signed in the way the App does: a bearer token. */
async function appToken(email) {
  const before = codeLines(email).length;
  await fetch(`${api}/v1/auth/code`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
  const code = await codeFor(email, before);
  const r = await fetch(`${api}/v1/app/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code, platform: 'ios' }) });
  return (await r.json()).token;
}
/** "carol 用接口点": API-091 with her App token, as an older App does. */
const likeAs = (token, id) => fetch(`${api}/v1/messages/${id}/like`, { method: 'PUT', headers: { authorization: `Bearer ${token}` } }).then((r) => r.status);

// 前置: t652 with bob and carol; bob's T652 群一.
const ids = Object.fromEntries(fs.readFileSync(`${L}/ids.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').slice(0, 2)));
as('alice', 'group create t652');
for (const who of ['bob', 'carol']) {
  as('alice', `group invite t652 ${ids[who]}`);
  as(who, 'group join t652');
}
const gid = (await computer('alice', 'GET', '/v1/groups'))[1].groups.find((g) => g.name === 't652').id;
as('bob', `send '#${gid}' 'T652 群一'`);
const chat = (await computer('alice', 'GET', '/v1/conversations'))[1].conversations.find((c) => c.group?.id === gid).id;
const carol = await appToken('carol@imbo.test');
const stored = async () => (await (await fetch(`${api}/v1/conversations/${chat}/messages`, { headers: { authorization: `Bearer ${carol}` } })).json()).messages.find((m) => m.body === 'T652 群一');
const mid = (await stored()).id;

const browser = await chromium.launch();
const step = async (id, fn) => {
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};

try {
  const watch = (who, page) => {
    // Expected: the 401 of /v1/me before signing in.
    page.on('console', (m) => m.type() === 'error' && !/status of 401 /.test(m.text()) && errors.push(`${who} console: ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`${who} pageerror: ${e.message}`));
  };
  const signIn = async (who) => {
    const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    watch(who, page);
    await page.goto(base + '/login');
    const before = codeLines(`${who}@imbo.test`).length;
    await page.getByLabel('Email').fill(`${who}@imbo.test`);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText('Check your email').waitFor();
    await page.keyboard.type(await codeFor(`${who}@imbo.test`, before));
    await page.waitForURL('**/chats');
    return page;
  };
  const row = (p) => p.locator(`article[data-message="${mid}"]`);
  const thumbs = (p) => row(p).getByRole('button', { name: /thumbs up/i }).count();
  const openChat = async (p) => {
    await p.goto(`${base}/chats/${chat}`);
    await row(p).waitFor();
  };
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });

  const alice = await signIn('alice');
  await openChat(alice);

  await step('1 hover: Reply, and no Thumbs up button', async () => {
    await row(alice).getByText('T652 群一').hover();
    await wait(300);
    const reply = row(alice).getByRole('button', { name: 'Reply' });
    const shown = await reply.evaluate((el) => getComputedStyle(el).opacity);
    const n = await thumbs(alice);
    await shot(alice, '01-hover');
    ok('1 hover: Reply, and no Thumbs up button', shown === '1' && n === 0, `Reply opacity ${shown}; Thumbs up buttons ${n}`);
  });
  await step('2 right-click: Reply and Copy, no Thumbs up', async () => {
    await row(alice).getByText('T652 群一').click({ button: 'right' });
    await alice.getByRole('menuitem', { name: 'Copy' }).waitFor({ timeout: 3000 });
    const items = (await alice.getByRole('menuitem').allInnerTexts()).map((x) => x.trim());
    await shot(alice, '02-menu');
    await alice.keyboard.press('Escape');
    ok('2 right-click: Reply and Copy, no Thumbs up', items.includes('Reply') && items.includes('Copy') && !items.some((x) => /thumbs up/i.test(x)), `menu ${JSON.stringify(items)}`);
  });
  await step("3 carol's 👍 through the API: stored, and nothing on alice's page 3 s later", async () => {
    const got = await likeAs(carol, mid);
    const names = ((await stored()).likes ?? []).map((l) => l.name);
    await wait(3000);
    const text = await row(alice).innerText();
    await shot(alice, '03-liked-elsewhere');
    ok("3 carol's 👍 through the API: stored, and nothing on alice's page 3 s later", got === 200 && names.includes('carol') && !text.includes('👍') && !errors.length, `PUT ${got}; stored ${JSON.stringify(names)}; the message reads ${JSON.stringify(text)}; console errors ${errors.length}`);
  });
  await step("4 bob's next message arrives within 3 s, no reload", async () => {
    as('bob', `send '#${gid}' 'T652 群二'`);
    await alice.locator('article[data-message]').getByText('T652 群二').waitFor({ timeout: 3000 });
    ok("4 bob's next message arrives within 3 s, no reload", true);
  });
  await step('5 after a reload: both messages, no 👍', async () => {
    await alice.reload();
    await row(alice).waitFor();
    await alice.locator('article[data-message]').getByText('T652 群二').waitFor();
    const text = await row(alice).innerText();
    await shot(alice, '05-reloaded');
    ok('5 after a reload: both messages, no 👍', !text.includes('👍') && !errors.length, `the message reads ${JSON.stringify(text)}; console errors ${errors.length}`);
  });
  await step('6 390×844, touch, dark: Reply shows, no Thumbs up, no sideways scroll', async () => {
    const { cookies } = await alice.context().storageState();
    const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark', storageState: { cookies, origins: [] } });
    const phone = await ctx.newPage();
    watch('alice phone', phone);
    await openChat(phone);
    await wait(400);
    const reply = row(phone).getByRole('button', { name: 'Reply' });
    const shown = await reply.evaluate((el) => getComputedStyle(el).opacity);
    const b = await reply.boundingBox();
    const inside = !!b && b.x >= 0 && b.x + b.width <= 390;
    const n = await thumbs(phone);
    const sideways = await phone.evaluate(() => document.scrollingElement.scrollWidth > innerWidth);
    await shot(phone, '06-phone-dark');
    await ctx.close();
    ok('6 390×844, touch, dark: Reply shows, no Thumbs up, no sideways scroll', shown === '1' && inside && n === 0 && !sideways, `Reply opacity ${shown}; inside ${inside}; Thumbs up buttons ${n}; sideways ${sideways}`);
  });
} finally {
  await browser.close();
}
console.log(checks.join('\n'));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : '\nno console errors');
