// TC-464 (docs/TEST.md): the web page shows a new session and new messages without a reload, as the server tells it what
// changed (FLOW-LIVE, API-079), against the local test server. Setup is the TC's 前置 (§3「网页和 App 实时更新」); the page
// must be http://localhost:5190 (`npm run dev`). Step 5 stops the server and starts it again on the same data; step 6
// sends the tab to the background by setting document.hidden and firing visibilitychange, as a headless browser has no
// other tab to switch to. Prints PASS/FAIL per step with how long each change took to show, then any console errors the
// steps don't expect. Codes are read from $L/server.log and never printed.
// usage: node web/app/tests/realtime.mjs <screenshot dir>
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
const sh = (cmd, env = {}) =>
  execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8', env: { ...process.env, ...env } }).replace(/\x1b\[[0-9;]*m/g, '');
const as = (who, args, env) => sh(`IMBO_HOME=$L/${who} "$IMBO" ${args}`, env);
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

let current = 'login';
const consoleErrors = [];
// While the server is down, polls and the live connection fail on purpose.
const expected = { 'login alice': /status of 401 /, 'TC-464 #5': /status of 50\d|WebSocket connection|ERR_|Failed to load resource/ };
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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push([current, `alice: ${m.text()}`]));
  page.on('pageerror', (e) => consoleErrors.push([current, `alice pageerror: ${e.message}`]));
  // Every GET /v1/conversations the page makes, any GET under it (the list or a chat's messages), and every live
  // connection it opens.
  const listFetches = [];
  const chatFetches = [];
  page.on('request', (r) => {
    if (r.method() !== 'GET') return;
    const path = new URL(r.url()).pathname;
    if (path === '/v1/conversations') listFetches.push(Date.now());
    if (path.startsWith('/v1/conversations')) chatFetches.push(Date.now());
  });
  const sockets = [];
  page.on('websocket', (ws) => sockets.push(ws.url()));

  current = 'login alice';
  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');

  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
  const chats = page.getByRole('navigation', { name: 'Chats' });
  const article = (text) => page.locator('main article', { hasText: text });
  /** Runs `act`, then waits up to `ms` for `shown` to hold; the time it took counts from the start of `act`. */
  const timed = async (act, shown, ms = 2000) => {
    const t0 = Date.now();
    act();
    await shown(Math.max(t0 + ms - Date.now(), 1));
    return Date.now() - t0;
  };

  await step('TC-464 #1', async () => {
    await page.goto(base + '/sessions');
    const list = page.getByRole('navigation', { name: 'My sessions' });
    await list.getByRole('link').first().waitFor();
    const took = await timed(
      () => as('alice', 'dev fake-session 55555555-aaaa-bbbb-cccc-000000464001 --title t464'),
      (ms) => list.getByRole('link').filter({ hasText: 't464' }).waitFor({ timeout: ms })
    );
    await shot('tc464-1');
    ok('TC-464 #1 Sessions: t464 shows without a reload, within 2 s', took <= 2000, `${took} ms`);
  });
  await step('TC-464 #2', async () => {
    await page.goto(base + '/chats');
    const bob = chats.getByRole('link', { name: /^bob/ });
    await bob.waitFor();
    const count = async () => Number((await bob.innerText()).match(/(\d+)\s*unread/)?.[1] ?? 0);
    const was = await count();
    const took = await timed(
      () => as('bob', "send alice 'T464-1'"),
      async (ms) => {
        const until = Date.now() + ms;
        while (!((await bob.innerText()).includes('T464-1') && (await count()) === was + 1)) {
          if (Date.now() > until) throw new Error(`not within 2 s: ${(await bob.innerText()).replace(/\s+/g, ' ')}`);
          await wait(50);
        }
      }
    );
    const first = (await chats.getByRole('link').first().innerText()).replace(/\s+/g, ' ');
    await shot('tc464-2');
    ok("TC-464 #2 Chats: bob's chat first, showing T464-1, red dot one more, within 2 s", first.startsWith('B bob') && took <= 2000, `${took} ms; red dot ${was} → ${await count()}; first row: ${first}`);
  });
  await step('TC-464 #3', async () => {
    await chats.getByRole('link', { name: /^bob/ }).click();
    await page.getByRole('textbox', { name: /^Message bob/ }).waitFor();
    await article('T464-1').waitFor();
    const took = await timed(() => as('bob', "send alice 'T464-2'"), (ms) => article('T464-2').waitFor({ timeout: ms }));
    await shot('tc464-3');
    ok("TC-464 #3 bob's chat: T464-2 shows within 2 s", took <= 2000, `${took} ms`);
  });
  await step('TC-464 #4', async () => {
    await wait(1500); // what step 3 set off settles first
    const t0 = Date.now();
    sh('for x in a b c d e; do IMBO_HOME=$L/bob "$IMBO" send alice "T464-3$x" > /dev/null; done');
    const sent = Date.now() - t0;
    const until = t0 + sent + 2000;
    for (const x of 'abcde') await article(`T464-3${x}`).waitFor({ timeout: Math.max(until - Date.now(), 1) });
    const took = Date.now() - t0;
    await wait(Math.max(until - Date.now(), 0));
    const fetches = listFetches.filter((at) => at >= t0 && at <= until).length;
    await shot('tc464-4');
    ok(
      'TC-464 #4 five within a second: all five show within 2 s of the last; at most 3 GET /v1/conversations meanwhile',
      took - sent <= 2000 && fetches <= 3,
      `sent in ${sent} ms, all shown ${took} ms after the first; ${fetches} list fetches from the first send to 2 s after the last`
    );
  });
  await step('TC-464 #5', async () => {
    const opened = sockets.length;
    const pid = fs.readFileSync(`${L}/server.pid`, 'utf8').trim();
    sh(`kill ${pid}; while kill -0 ${pid} 2>/dev/null; do sleep 0.2; done`);
    await wait(5000);
    // Started again with the same data and the web origin, the way `local-env.sh server` does.
    sh(`sh ${crates}scripts/local-env.sh server 2>/dev/null`, { IMBO_WEB_ORIGIN: 'http://localhost:5190' });
    const took = await timed(() => as('bob', "send alice 'T464-4'"), (ms) => article('T464-4').waitFor({ timeout: ms }), 20_000);
    await shot('tc464-5');
    ok('TC-464 #5 server stopped for 5 s and back: T464-4 shows within 20 s, no reload', took <= 20_000, `${took} ms after the server was back; live connections opened since the stop: ${sockets.length - opened}`);
  });
  await step('TC-464 #6', async () => {
    await wait(1500); // what step 5 set off settles first
    const hide = (hidden) =>
      page.evaluate((hidden) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
    await hide(true);
    const t0 = Date.now();
    as('bob', "send alice 'T464-5'");
    await wait(Math.max(t0 + 10_000 - Date.now(), 0));
    const lists = listFetches.filter((at) => at >= t0).length;
    const gets = chatFetches.filter((at) => at >= t0).length;
    const shownHidden = await article('T464-5').count();
    const took = await timed(() => hide(false), (ms) => article('T464-5').waitFor({ timeout: ms }));
    await shot('tc464-6');
    ok(
      'TC-464 #6 in the background for 10 s: no GET /v1/conversations nor its messages, T464-5 not shown; back in front, T464-5 shows within 2 s',
      lists === 0 && gets === 0 && shownHidden === 0 && took <= 2000,
      `while hidden: ${lists} list fetches, ${gets} GETs under /v1/conversations, T464-5 shown ${shownHidden}; ${took} ms after coming back`
    );
  });
} finally {
  await browser.close();
}
const unexpected = consoleErrors.filter(([at, text]) => !expected[at]?.test(text));
for (const [at, text] of unexpected) console.log(`console error during ${at}: ${text}`);
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(`${failed} failed, ${unexpected.length} unexpected console errors`);
process.exit(failed || unexpected.length ? 1 : 0);
