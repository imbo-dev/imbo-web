// TC-428, TC-162, TC-163 (docs/TEST.md): sending from the web against the local test server. Setup is the TCs' 前置; the page
// must be http://localhost:5190 (`npm run dev`). Prints PASS/FAIL per step, then any unexpected console errors.
// usage: node web/app/tests/send.mjs <screenshot dir>
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
const ok = (name, cond, detail = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
const sh = (cmd) => execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8' });
const as = (who, args) => sh(`IMBO_HOME=$L/${who} "$IMBO" ${args}`);
const ids = Object.fromEntries(fs.readFileSync(`${L}/ids.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').slice(0, 2)));
const checkout = 'claude-code:55555555-aaaa-bbbb-cccc-0000000a0001';
const asCheckout = (tool, args) => sh(`python3 $M $L/alice ${tool} '${JSON.stringify(args)}' --session ${checkout}`);
// A Codex session of alice's, offline: it can't be opened from here (TC-428 #7).
const nightly = '55555555-aaaa-bbbb-cccc-0000000a0428';
// API-014 as alice's terminal sees it.
const myAgents = () => JSON.parse(sh(`curl -s --noproxy '*' -H "authorization: Bearer $(sed -n 's/^token = \"\\(.*\\)\"/\\1/p' $L/alice/credentials)" http://127.0.0.1:18080/v1/agents`)).agents;
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

// Expected: 401 after the forced sign-out (TC-163 #8), 429 for the refused sends (TC-163 #6), ERR_FAILED for the answer
// TC-163 #1 drops on purpose.
const expected = /status of (401|429) |net::ERR_FAILED/;
const browser = await chromium.launch();
// Runs one numbered step; a thrown error (a wait that timed out) fails that step and the walk goes on.
const step = async (id, fn) => {
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};
const tabs = () => document.querySelector('nav[aria-label="Sections"]').innerText;

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && !expected.test(m.text()) && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
  const composer = () => page.locator('textarea.composer');
  const send = async (text) => {
    await composer().fill(text);
    await composer().press('Enter');
  };
  const rows = (text) => page.locator('article', { hasText: text });
  const session = (name) => page.getByRole('navigation', { name: 'Sessions' }).getByRole('link', { name });
  const chat = (name) => page.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name });
  const sessionsTab = () => page.evaluate(tabs);

  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');

  // TC-428: my own sessions
  await step('TC-428 #1 sessions listed, no unread', async () => {
    await page.goto(base + '/sessions');
    await session(/docs-site/).waitFor();
    const names = await page.getByRole('navigation', { name: 'Sessions' }).getByRole('link').allTextContents();
    const t = await sessionsTab();
    ok('TC-428 #1 sessions listed, no unread', names.some((n) => n.includes('checkout')) && /Sessions(?!\s*\d)/.test(t), `${names.join(' | ')} / ${t.replace(/\n/g, ' ')}`);
  });
  await step('TC-428 #2 docs-site composer takes a file', async () => {
    await session(/docs-site/).click();
    await composer().waitFor();
    const ph = await composer().getAttribute('placeholder');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Attach files', exact: true }).click();
    await (await chooser).setFiles(`${L}/orders-api-v2.3.md`);
    const listed = page.getByRole('list', { name: 'Attached files' }).getByText('orders-api-v2.3.md');
    await listed.waitFor({ timeout: 6000 });
    await shot('428-02');
    await page.getByRole('button', { name: 'Remove orders-api-v2.3.md' }).click();
    await listed.waitFor({ state: 'detached', timeout: 6000 });
    ok('TC-428 #2 docs-site composer takes a file', ph === 'Message docs-site', ph);
  });
  await step('TC-428 #3 sending to an online session', async () => {
    await send('T428 status?');
    await rows('T428 status?').getByText('Sending…').waitFor({ timeout: 6000 });
    ok('TC-428 #3 sending to an online session', (await rows('T428 status?').count()) === 1);
    await shot('428-03');
  });
  await step('TC-428 #4 checkout goes offline as 0a0001', async () => {
    asCheckout('inbox', {});
    await session(/0a0001/).getByText(/Seen/).waitFor({ timeout: 15000 });
    ok('TC-428 #4 checkout goes offline as 0a0001', true);
  });
  // Its computer is online, so sending opens it in the background there (FLOW-WAKE); the test computer has no Claude Code
  // record of this session, so the try fails and says so.
  const device = myAgents().find((a) => a.short_id === '0a0001')?.device_name;
  await step('TC-428 #5 an offline Claude Code session opens on its computer', async () => {
    await session(/0a0001/).click();
    await page.getByText(`0a0001 is offline. Sending opens it in the background on ${device}.`, { exact: true }).waitFor({ timeout: 6000 });
    ok('TC-428 #5 an offline Claude Code session opens on its computer', true, device);
    await shot('428-05');
  });
  await step('TC-428 #6 waiting for it, and why it did not open', async () => {
    await send('T428 switch done?');
    await rows('T428 switch done?').getByText('Waiting for 0a0001 to come online').waitFor({ timeout: 6000 });
    await page.getByText(`Couldn't open 0a0001 on ${device}: No record of this session on this computer. It gets your message when it comes back online.`, { exact: true }).waitFor({ timeout: 15000 });
    ok('TC-428 #6 waiting for it, and why it did not open', true);
    await shot('428-06');
  });
  await step('TC-428 #7 an offline Codex session waits to come online', async () => {
    as('alice', `dev fake-session ${nightly} --title nightly --tool codex`);
    as('alice', `dev fake-session ${nightly} --title nightly --tool codex --remove`);
    await session(/nightly/).getByText(/Seen/).waitFor({ timeout: 15000 });
    await session(/nightly/).click();
    const note = 'nightly is offline. It gets your message when it comes back online.';
    await page.getByText(note, { exact: true }).waitFor({ timeout: 6000 });
    await send('T428 later?');
    await rows('T428 later?').getByText('Waiting for nightly to come online').waitFor({ timeout: 6000 });
    await wait(5000);
    const still = await page.getByText(note, { exact: true }).count();
    ok('TC-428 #7 an offline Codex session waits to come online', still === 1, `note shown ${still}`);
    await shot('428-07');
  });
  await step('TC-428 #8 unread count for a reply', async () => {
    await session(/docs-site/).click();
    await composer().waitFor();
    asCheckout('send', { to: ids.alice, body: 'T428 412 tests pass' });
    await page.waitForFunction((f) => /Sessions\s*1/.test(eval(f)()), tabs.toString(), { timeout: 15000 });
    const row = await session(/0a0001/).innerText();
    ok('TC-428 #8 unread count for a reply', /\b1\b/.test(row), row.replace(/\n/g, ' '));
    await shot('428-08');
  });
  await step('TC-428 #9 opening it marks it read', async () => {
    await session(/0a0001/).click();
    await page.getByText('T428 412 tests pass').waitFor({ timeout: 6000 });
    await page.waitForFunction((f) => !/Sessions\s*\d/.test(eval(f)()), tabs.toString(), { timeout: 15000 });
    ok('TC-428 #9 opening it marks it read', true);
    await shot('428-09');
  });
  await step('TC-428 #10 terminal inbox no longer lists it', async () => {
    const inbox = as('alice', 'inbox');
    ok('TC-428 #10 terminal inbox no longer lists it', !inbox.includes('T428 412 tests pass'), inbox.split('\n')[0]);
  });

  // TC-162: chats
  await step('TC-162 #1 direct chat defaults to the inbox', async () => {
    await page.goto(base + '/chats');
    await chat(/bob/).click();
    await composer().waitFor();
    const ph = await composer().getAttribute('placeholder');
    const btn = await page.getByRole('button', { name: /^Sending to/ }).innerText();
    ok('TC-162 #1 direct chat defaults to the inbox', ph === "Message bob's inbox" && btn.trim() === 'Inbox', `${ph} / ${btn}`);
  });
  await step("TC-162 #2 sent to bob's inbox", async () => {
    await send('T162 lunch is fine');
    await rows('T162 lunch is fine').getByText("to bob's inbox").waitFor({ timeout: 6000 });
    await page.waitForFunction(() => !document.body.innerText.includes('Sending…'), null, { timeout: 6000 });
    ok("TC-162 #2 sent to bob's inbox", (await rows('T162 lunch is fine').count()) === 1);
  });
  await step('TC-162 #3 bob reads it in his terminal', async () => {
    const inbox = as('bob', 'inbox');
    ok('TC-162 #3 bob reads it in his terminal', inbox.includes('T162 lunch is fine') && inbox.includes('alice'), inbox.split('\n').slice(0, 2).join(' / '));
  });
  await step("TC-162 #4 picker lists bob's sessions", async () => {
    await page.getByRole('button', { name: /^Sending to/ }).click();
    const items = await page.getByRole('menuitemradio').allInnerTexts();
    ok("TC-162 #4 picker lists bob's sessions", items.some((i) => i.includes("bob's inbox") && i.includes('bob reads it in a terminal')) && items.some((i) => i.includes('orders-api') && i.includes('Online')), items.map((i) => i.replace(/\n/g, ' ')).join(' | '));
    await shot('162-04');
  });
  await step('TC-162 #5 sent to orders-api', async () => {
    await page.getByRole('menuitemradio', { name: /orders-api/ }).click();
    await send('T162 keep user_id until Friday?');
    await rows('T162 keep user_id').getByText('to bob orders-api').waitFor({ timeout: 6000 });
    const btn = await page.getByRole('button', { name: /^Sending to/ }).innerText();
    ok('TC-162 #5 sent to orders-api', btn.trim() === 'orders-api', btn);
  });
  await step('TC-162 #6 group has no picker', async () => {
    await chat(/release-team/).click();
    await composer().waitFor();
    const ph = await composer().getAttribute('placeholder');
    ok('TC-162 #6 group has no picker', ph === 'Message release-team' && !(await page.getByRole('button', { name: /^Sending to/ }).count()), ph);
  });
  await step('TC-162 #7 group message goes to the group', async () => {
    await send('T162 checkout is ready for 10:00');
    await rows('T162 checkout is ready').waitFor({ timeout: 6000 });
    await page.waitForFunction(() => !document.body.innerText.includes('Sending…'), null, { timeout: 6000 });
    const n = await rows('T162 checkout is ready').count();
    const token = fs.readFileSync(`${L}/bob/credentials`, 'utf8').match(/^token = "(.*)"/m)[1];
    const list = JSON.parse(sh(`curl -s --noproxy '*' http://127.0.0.1:18080/v1/conversations -H "Authorization: Bearer ${token}"`));
    const group = list.conversations.find((c) => c.group?.name === 'release-team');
    ok('TC-162 #7 group message goes to the group', n === 1 && group?.last_message?.preview === 'T162 checkout is ready for 10:00', `rows ${n}, release-team: ${group?.last_message?.preview}`);
    await shot('162-07');
  });

  // TC-163: refusals, retries, slow answers, signed out
  await step('TC-163 #1 lost answer shows Not sent', async () => {
    await chat(/bob/).click();
    await composer().waitFor();
    await page.getByRole('button', { name: /^Sending to/ }).click();
    await page.getByRole('menuitemradio', { name: /bob's inbox/ }).click();
    await page.route('**/v1/messages', async (route) => {
      await route.fetch();
      await route.abort('failed');
    }, { times: 1 });
    await send('T163 answer lost on the way back');
    await page.getByText('Not sent. Check your connection, then try again.').waitFor({ timeout: 6000 });
    ok('TC-163 #1 lost answer shows Not sent', await page.getByRole('button', { name: 'Try again' }).isVisible());
  });
  await step('TC-163 #2 the stored copy shows next to it', async () => {
    await page.waitForFunction((x) => [...document.querySelectorAll('article')].filter((a) => a.innerText.includes(x)).length === 2, 'T163 answer lost', { timeout: 15000 });
    ok('TC-163 #2 the stored copy shows next to it', true);
    await shot('163-02');
  });
  await step('TC-163 #3 retry leaves one', async () => {
    await page.getByRole('button', { name: 'Try again' }).click();
    await wait(1500);
    const n = await rows('T163 answer lost').count();
    const stuck = await page.getByText(/Sending…|Not sent/).count();
    ok('TC-163 #3 retry leaves one', n === 1 && stuck === 0, `rows ${n}, stuck ${stuck}`);
  });
  await step('TC-163 #4 stored once', async () => {
    const all = as('bob', 'inbox --all');
    ok('TC-163 #4 stored once', all.split('T163 answer lost').length - 1 === 1);
  });
  await step('TC-163 #5 slow answers still show the reply', async () => {
    await page.goto(base + '/sessions');
    await session(/0a0001/).click();
    await composer().waitFor();
    await page.route(/\/v1\/agents\/[^/]+\/messages\?/, async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      // A request still waiting here when the step ends is dropped with the page's routes.
      try {
        const r = await route.fetch();
        await wait(4000);
        await route.fulfill({ response: r });
      } catch {}
    });
    asCheckout('send', { to: ids.alice, body: 'T163 slow network reply' });
    await page.getByText('T163 slow network reply').waitFor({ timeout: 20000 });
    ok('TC-163 #5 slow answers still show the reply', true);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });
  let refused;
  await step('TC-163 #6 too fast', async () => {
    await session(/docs-site/).click();
    await composer().waitFor();
    for (let i = 1; i <= 35; i++) await send(`T163 burst ${i}`);
    refused = page.locator('article', { hasText: /Not sent\. Sending too fast\. Try again in \d+ s\./ }).first();
    await refused.waitFor({ timeout: 10000 });
    await shot('163-06');
    ok('TC-163 #6 too fast', await refused.getByRole('button', { name: 'Try again' }).isVisible(), (await refused.innerText()).replace(/\n/g, ' '));
  });
  await step('TC-163 #7 retry after the wait', async () => {
    const text = await refused.innerText();
    const body = text.match(/T163 burst \d+/)[0];
    const secs = Number(text.match(/Try again in (\d+) s\./)[1]);
    await wait((secs + 1) * 1000);
    await refused.getByRole('button', { name: 'Try again' }).click();
    await page.waitForFunction((b) => [...document.querySelectorAll('article')].some((a) => a.innerText.includes(b) && !a.innerText.includes('Not sent')), body, { timeout: 10000 });
    ok('TC-163 #7 retry after the wait', true, `${body}, waited ${secs + 1} s`);
  });
  await step('TC-163 #8 signed out elsewhere goes to sign-in', async () => {
    const at = new URL(page.url()).pathname;
    await ctx.clearCookies();
    await page.waitForURL('**/login**', { timeout: 15000 });
    ok('TC-163 #8 signed out elsewhere goes to sign-in', page.url().endsWith(`next=${encodeURIComponent(at)}`), page.url());
  });
} finally {
  await browser.close();
}
console.log(checks.join('\n'));
console.log(errors.length ? `\nconsole errors:\n${errors.join('\n')}` : '\nno console errors');
