// TC-636 (docs/TEST.md): a 👍 on a message in a chat on the web — the button beside Reply, the line under the message, the
// right-click menu — seen by another account without a reload, and none in a session's pane (FLOW-LIKE, FLOW-LIVE S5),
// against the local test server started with `crates/scripts/local-env.sh up alice:bob,alice:carol`; the page must be
// http://localhost:5190 (`npm run dev`). Sets up the 前置 itself: dave, t636 with bob, carol and dave in it, bob's
// T636 群一, alice's session a636 and T636 给会话. Prints PASS/FAIL per step, then any unexpected console errors. Codes are
// read from $L/server.log and never printed.
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

/** `home`'s computer sign-in calling the API; `home` is a directory under $L, such as alice or extra/dave. */
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
/** "X 用接口点" and "用接口取消": API-091, API-092 with X's App token. */
const likeAs = (token, id, on) => fetch(`${api}/v1/messages/${id}/like`, { method: on ? 'PUT' : 'DELETE', headers: { authorization: `Bearer ${token}` } }).then((r) => r.status);

// 前置: dave, alice's contact; t636 with bob, carol and dave; bob's T636 群一; alice's session a636.
sh(`IMBO_DATA_DIR=$L/server "$S" dev seed --homes $L/extra --names alice,dave --contacts alice:dave`);
const ids = Object.fromEntries(fs.readFileSync(`${L}/ids.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').slice(0, 2)));
const dave = (await computer('extra/dave', 'GET', '/v1/me'))[1].account.id;
as('alice', 'group create t636');
for (const [home, id] of [['bob', ids.bob], ['carol', ids.carol], ['extra/dave', dave]]) {
  as('alice', `group invite t636 ${id}`);
  as(home, 'group join t636');
}
const gid = (await computer('alice', 'GET', '/v1/groups'))[1].groups.find((g) => g.name === 't636').id;
as('bob', `send '#${gid}' 'T636 群一'`);
as('alice', 'dev fake-session 55555555-aaaa-bbbb-cccc-000000636001 --title a636');
const agentId = (await computer('alice', 'GET', '/v1/agents'))[1].agents.find((a) => a.title === 'a636').id;
const chat = (await computer('alice', 'GET', '/v1/conversations'))[1].conversations.find((c) => c.group?.id === gid).id;
const carol = await appToken('carol@imbo.test');
const daveToken = await appToken('dave@imbo.test');
const mid = (await (await fetch(`${api}/v1/conversations/${chat}/messages`, { headers: { authorization: `Bearer ${carol}` } })).json()).messages.find((m) => m.body === 'T636 群一').id;

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
  const button = (p) => row(p).getByTestId(`like-${mid}`);
  const line = (p) => row(p).getByTestId(`likes-${mid}`);
  const opacity = (loc) => loc.evaluate((el) => getComputedStyle(el).opacity);
  /** The line's text and pressed state once `text` shows, or as they are after 3 s. */
  const lineIs = async (p, text) => {
    for (let i = 0; i < 30; i++) {
      const n = await line(p).count();
      const now = n ? (await line(p).innerText()).trim() : null;
      if (now === text) return [now, await line(p).getAttribute('aria-pressed')];
      await wait(100);
    }
    return [(await line(p).count()) ? (await line(p).innerText()).trim() : null, null];
  };
  const openChat = async (p) => {
    await p.goto(`${base}/chats/${chat}`);
    await row(p).waitFor();
  };
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });

  const alice = await signIn('alice');
  // 前置: T636 给会话, alice to her session a636 from this page (API-043).
  await alice.evaluate(
    ([id, cid]) => fetch(`/v1/agents/${encodeURIComponent(id)}/messages`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: 'T636 给会话', client_msg_id: cid }) }),
    [agentId, crypto.randomUUID()]
  );
  const bob = await signIn('bob');
  await openChat(alice);
  await openChat(bob);

  await step('1 hover: a Thumbs up button beside Reply', async () => {
    await row(alice).getByText('T636 群一').hover();
    await wait(300);
    const name = await button(alice).getAttribute('aria-label');
    const shown = await opacity(button(alice));
    ok('1 hover: a Thumbs up button beside Reply', name === 'Thumbs up' && shown === '1' && (await row(alice).getByRole('button', { name: 'Reply' }).count()) === 1, `name ${name}; opacity ${shown}`);
  });
  await step('2 press it: 👍 You, pressed; the button says Remove thumbs up', async () => {
    await button(alice).click();
    const [text, pressed] = await lineIs(alice, '👍 You');
    const name = await button(alice).getAttribute('aria-label');
    await shot(alice, '02-alice-liked');
    ok('2 press it: 👍 You, pressed; the button says Remove thumbs up', text === '👍 You' && pressed === 'true' && name === 'Remove thumbs up', `line ${text}; pressed ${pressed}; button ${name}`);
  });
  await step('3 bob, no reload: 👍 alice within 3 s, not pressed', async () => {
    const [text, pressed] = await lineIs(bob, '👍 alice');
    ok('3 bob, no reload: 👍 alice within 3 s, not pressed', text === '👍 alice' && pressed === 'false', `line ${text}; pressed ${pressed}`);
  });
  await step('4 bob presses the line: 👍 alice, You, pressed; alice sees 👍 You, bob', async () => {
    await line(bob).click();
    const [text, pressed] = await lineIs(bob, '👍 alice, You');
    const [seen] = await lineIs(alice, '👍 You, bob');
    await shot(bob, '04-bob-liked');
    ok('4 bob presses the line: 👍 alice, You, pressed; alice sees 👍 You, bob', text === '👍 alice, You' && pressed === 'true' && seen === '👍 You, bob', `bob ${text} (${pressed}); alice ${seen}`);
  });
  await step('5 carol and dave too: 👍 You, bob, carol +1; the hint names all four', async () => {
    const got = [await likeAs(carol, mid, true), await likeAs(daveToken, mid, true)];
    const [text] = await lineIs(alice, '👍 You, bob, carol +1');
    await line(alice).hover();
    const hint = await line(alice).getAttribute('title');
    await shot(alice, '05-four');
    ok('5 carol and dave too: 👍 You, bob, carol +1; the hint names all four', got.every((s) => s === 200) && text === '👍 You, bob, carol +1' && hint === '👍 You, bob, carol, dave', `PUT ${got}; line ${text}; hint ${hint}`);
  });
  await step('6 right-click: Remove thumbs up; then 👍 bob, carol, dave, not pressed', async () => {
    await row(alice).getByText('T636 群一').click({ button: 'right' });
    const item = alice.getByRole('menuitem', { name: 'Remove thumbs up' });
    await item.waitFor({ timeout: 3000 });
    await shot(alice, '06-menu');
    await item.click();
    const [text, pressed] = await lineIs(alice, '👍 bob, carol, dave');
    ok('6 right-click: Remove thumbs up; then 👍 bob, carol, dave, not pressed', text === '👍 bob, carol, dave' && pressed === 'false', `line ${text}; pressed ${pressed}`);
  });
  await step('7 bob presses again, carol and dave take theirs back: the line goes on both', async () => {
    await line(bob).click();
    const got = [await likeAs(carol, mid, false), await likeAs(daveToken, mid, false)];
    let left = [];
    for (let i = 0; i < 30; i++) {
      left = [await line(alice).count(), await line(bob).count()];
      if (!left[0] && !left[1]) break;
      await wait(100);
    }
    ok('7 bob presses again, carol and dave take theirs back: the line goes on both', got.every((s) => s === 200) && !left[0] && !left[1], `DELETE ${got}; lines left alice ${left[0]}, bob ${left[1]}`);
  });
  await bob.context().close();
  await step('8 390×844, touch, dark: Thumbs up shows without hover, on screen, no sideways scroll', async () => {
    const { cookies } = await alice.context().storageState();
    const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark', storageState: { cookies, origins: [] } });
    const phone = await ctx.newPage();
    watch('alice phone', phone);
    await openChat(phone);
    await wait(400);
    const shown = await opacity(button(phone));
    const b = await button(phone).boundingBox();
    const inside = !!b && b.x >= 0 && b.x + b.width <= 390;
    const sideways = await phone.evaluate(() => document.scrollingElement.scrollWidth > innerWidth);
    await shot(phone, '08-phone-dark');
    await ctx.close();
    ok('8 390×844, touch, dark: Thumbs up shows without hover, on screen, no sideways scroll', shown === '1' && inside && !sideways, `opacity ${shown}; inside ${inside}; sideways ${sideways}`);
  });
  await step('9 a session pane: no Thumbs up button, none in the menu', async () => {
    await alice.goto(`${base}/sessions/${encodeURIComponent(agentId)}`);
    const msg = alice.locator('article', { hasText: 'T636 给会话' });
    await msg.waitFor();
    await msg.getByText('T636 给会话').hover();
    const buttons = await msg.getByRole('button', { name: /thumbs up/i }).count();
    await msg.getByText('T636 给会话').click({ button: 'right' });
    await alice.getByRole('menuitem', { name: 'Copy' }).waitFor({ timeout: 3000 });
    const items = (await alice.getByRole('menuitem').allInnerTexts()).map((x) => x.trim());
    await shot(alice, '09-session');
    await alice.keyboard.press('Escape');
    ok('9 a session pane: no Thumbs up button, none in the menu', buttons === 0 && !items.some((x) => /thumbs up/i.test(x)), `buttons ${buttons}; menu ${JSON.stringify(items)}`);
  });
} finally {
  await browser.close();
}
console.log(checks.join('\n'));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : '\nno console errors');
