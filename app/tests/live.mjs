// TC-102 (docs/TEST.md): walks the web app against the local test server. Setup is the TC's 前置; the page must be
// http://localhost:5190 (`npm run dev`). Prints PASS/FAIL per check, then any unexpected console errors.
// usage: node web/app/tests/live.mjs <screenshot dir>
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
const stamp = Date.now().toString(36);

const codeLines = (email) => fs.readFileSync(`${L}/server.log`, 'utf8').split('\n').filter((l) => l.includes('mail-log-only code=') && l.endsWith(`email=${email}`));
async function codeFor(email, after) {
  for (let i = 0; i < 50; i++) {
    const lines = codeLines(email);
    if (lines.length > after) return lines.at(-1).match(/code=(\d+)/)[1];
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no code for ${email}`);
}

// Expected: 401 before sign-in and after the forced sign-out, 400 for the wrong code, 422 for name-required,
// ERR_FAILED for the list request this walk aborts on purpose.
const expected = /status of (400|401|422) |net::ERR_FAILED/;
const watch = (p) => {
  p.on('console', (m) => m.type() === 'error' && !expected.test(m.text()) && errors.push(`console: ${m.text()}`));
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
};

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  watch(page);
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });

  async function signIn(p, email, name) {
    const before = codeLines(email).length;
    await p.getByLabel('Email').fill(email);
    await p.getByRole('button', { name: 'Continue' }).click();
    await p.getByText('Check your email').waitFor();
    await p.keyboard.type(await codeFor(email, before));
    if (name) {
      await p.getByLabel('Name').fill(name);
      await p.getByRole('button', { name: 'Create account' }).click();
    }
  }

  // 1. Signed out: any page goes to sign-in, and remembers where it was going
  await page.goto(base + '/chats/1');
  await page.waitForURL('**/login?next=%2Fchats%2F1');
  ok('signed out /chats/1 → /login?next=/chats/1', true);

  // 2. Sign-up: new email → wrong code → right code → name → welcome with ID and trial
  const newEmail = `web-${stamp}@imbo.test`;
  await page.goto(base + '/register');
  await page.getByLabel('Email').fill(newEmail);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type('000000');
  await page.getByText(/Wrong code\. \d tries left\./).waitFor();
  ok('wrong code shows the server message', true, await page.getByRole('alert').first().textContent());
  await page.keyboard.type(await codeFor(newEmail, 0));
  await page.getByLabel('Name').waitFor();
  ok('new email asks for a name (422 name-required)', true);
  await page.getByLabel('Name').fill('12345');
  await page.getByRole('button', { name: 'Create account' }).click();
  ok('name rule checked before sending', await page.getByText("A name can't be only digits.").isVisible());
  await page.getByLabel('Name').fill('Wren');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/welcome');
  await page.getByText(/Your \d+-day free trial has started\./).waitFor();
  const newId = (await page.locator('section', { hasText: 'Your account ID' }).textContent()).match(/\d{8}/)?.[0];
  ok('welcome shows the 8-digit ID and the trial', !!newId, `ID ${newId}`);
  await shot('02-welcome');
  await page.getByRole('button', { name: 'Open Imbo' }).click();
  await page.waitForURL('**/chats');
  await page.getByText('No chats yet').waitFor();
  ok('new account: empty chats', true);

  // 3. Sign out from the account menu
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.waitForURL(base + '/login');
  ok('sign out → /login (DELETE /v1/web/session)', true);
  const me = await page.evaluate(() => fetch('/v1/me').then((r) => r.status));
  ok('cookie is gone after sign-out', me === 401, `GET /v1/me → ${me}`);

  // 4. Sign in as alice, an existing account: no name step, straight to chats
  await signIn(page, 'alice@imbo.test');
  await page.waitForURL('**/chats');
  await page.getByRole('navigation', { name: 'Chats' }).waitFor();
  const rows = await page.getByRole('navigation', { name: 'Chats' }).getByRole('link').allTextContents();
  ok('chat list has bob and release-team', rows.some((r) => r.includes('bob')) && rows.some((r) => r.includes('release-team')), rows.join(' | '));
  await shot('04-chats');

  // 5. The chat with bob: messages, who they went to, the attachment link
  await page.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: /bob/ }).click();
  await page.waitForURL(/\/chats\/\d+$/);
  const bobThread = page.locator('[aria-label="Messages with bob"]');
  await bobThread.getByText('What replaced user_id?').waitFor();
  const text = await bobThread.textContent();
  ok('direct messages show the receiving session', text.includes('to bob orders-api') && text.includes('to alice checkout') && text.includes("to alice's inbox"));
  const href = await page.getByRole('link', { name: 'Download orders-api-v2.3.md' }).getAttribute('href');
  const dl = await page.evaluate((h) => fetch(h).then(async (r) => ({ s: r.status, cd: r.headers.get('content-disposition'), body: await r.text() })), href);
  ok('attachment link downloads the file', dl.s === 200 && /attachment/.test(dl.cd ?? '') && dl.body.includes('customer_id'), `${href} → ${dl.s} ${dl.cd}`);
  await shot('05-chat-bob');

  // 6. Polling: bob sends from his terminal; it shows up within one 10 s round, no reload
  sh(`IMBO_HOME=$L/bob $IMBO send alice/checkout "Polling check ${stamp}"`);
  const t0 = Date.now();
  await bobThread.getByText(`Polling check ${stamp}`).waitFor({ timeout: 15000 });
  ok('new message appears by polling', true, `${((Date.now() - t0) / 1000).toFixed(1)} s`);

  // 7. Group chat
  await page.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: /release-team/ }).click();
  await page.locator('[aria-label="Messages with release-team"]').getByText('Deploy window starts at 10:00').waitFor();
  ok("group chat shows members' messages", true);
  await shot('06-group');

  // 8. Sessions
  await page.getByRole('link', { name: 'Sessions' }).click();
  await page.getByRole('navigation', { name: 'My sessions' }).getByRole('link', { name: /checkout/ }).click();
  await page.locator('[aria-label="Messages sent and received by checkout"]').getByText('Switched to customer_id').waitFor();
  const st = await page.locator('main').textContent();
  ok('session pane: tool, computer, short ID', st.includes('Claude Code') && st.includes('seed') && st.includes('0a0001'));
  await shot('07-session');

  // 9. Contacts
  await page.getByRole('link', { name: 'Contacts' }).click();
  await page.getByRole('navigation', { name: 'Contacts' }).getByRole('link', { name: /bob/ }).click();
  await page.locator('main').getByText('orders-api').waitFor();
  ok('contact pane lists their sessions with presence', (await page.locator('main').textContent()).includes('Online'));
  await page.getByRole('link', { name: 'Open chat' }).click();
  await page.waitForURL(/\/chats\/\d+$/);
  ok('Open chat goes to that chat', true);

  // 10. Account: trial, test mode, subscribe goes to Waffo (the page itself is stubbed, nothing is paid)
  await page.goto(base + '/account');
  await page.getByText(/Free trial, \d+ days left/).waitFor();
  ok('account shows trial and test mode', await page.getByText('Test mode: checkout takes test card numbers').isVisible());
  ok('account says the first payment comes 30 days later', await page.getByText('Subscribe now and your first payment is taken 30 days later.').isVisible());
  await shot('09-account-trial');
  await page.route(/pancake\.waffo\.ai/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>waffo checkout stand-in</p>' }));
  const [nav] = await Promise.all([page.waitForRequest(/pancake\.waffo\.ai/, { timeout: 20000 }), page.getByRole('button', { name: '$20 a year' }).click()]);
  ok('subscribe opens a Waffo checkout page', /pancake\.waffo\.ai\/store\/[^/]+\/checkout\/cs_/.test(nav.url()), nav.url().replace(/#.*/, ''));

  // 11. Back from checkout: the payment notice (signed like Waffo's) arrives, the page picks it up
  const aliceId = sh("awk '$1==\"alice\"{print $2}' $L/ids.tsv").trim();
  await page.goto(base + '/account?checkout=done');
  await page.getByText('Confirming your payment…').waitFor();
  ok('back from checkout: confirming', true);
  sh(`. ${crates}scripts/billing-env.sh; python3 ${crates}scripts/waffo-event.py subscription.activated --order ORD_web_${stamp} --account ${aliceId} --plan yearly --period-end +365d >/dev/null`);
  await page.getByText(/Subscribed/).waitFor({ timeout: 15000 });
  ok('subscription shows after the notice', (await page.locator('main').textContent()).includes('Yearly, renews'));
  await shot('10-account-subscribed');

  // 12. Load failure: the chat list request fails once → error state → Try again
  await page.route('**/v1/conversations', (r) => r.abort(), { times: 1 });
  await page.goto(base + '/chats');
  await page.getByText("Couldn't load chats").waitFor();
  await shot('11-chats-error');
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByRole('navigation', { name: 'Chats' }).waitFor();
  ok('chat list error → Try again loads it', true);

  // 13. Sign-in expires while reading: next poll → sign-in → back to the same chat
  const chatUrl = await page.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: /bob/ }).getAttribute('href');
  await page.goto(base + chatUrl);
  await bobThread.waitFor();
  await ctx.clearCookies();
  await page.waitForURL(/\/login\?next=/, { timeout: 15000 });
  ok('401 on a poll → sign-in page with next', page.url().includes(encodeURIComponent(chatUrl)), page.url());

  // 14. Meanwhile, in another browser: back from checkout, but no payment notice comes within 60 s
  const lateCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const late = await lateCtx.newPage();
  watch(late);
  await late.goto(base + '/register');
  await signIn(late, `late-${stamp}@imbo.test`, 'Late');
  await late.waitForURL('**/welcome');
  await late.goto(base + '/account?checkout=done');
  await late.getByText('Confirming your payment…').waitFor();
  const lateFrom = Date.now();

  await new Promise((r) => setTimeout(r, 61000)); // alice: one code per email a minute
  await signIn(page, 'alice@imbo.test');
  await page.waitForURL(`**${chatUrl}`);
  ok('after sign-in, back on the interrupted chat', true);

  await late.getByText('Payment received. Your plan will update here shortly.').waitFor({ timeout: 20000 });
  const lateText = await late.locator('main').textContent();
  ok('no payment notice in 60 s → "Payment received", plan unchanged', lateText.includes('Free trial'), `${Math.round((Date.now() - lateFrom) / 1000)} s`);
  await late.screenshot({ path: `${out}/12-checkout-late.png` });
  await lateCtx.close();

  // 15. Phone width
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + chatUrl);
  await bobThread.waitFor();
  await shot('m1-chat');
  await page.goto(base + '/account');
  await page.getByText(/Subscribed/).waitFor();
  await shot('m2-account');
  ok('no sideways scroll at 390', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
} finally {
  await browser.close();
}
console.log(checks.join('\n'));
console.log(errors.length ? `\nconsole errors:\n${errors.join('\n')}` : '\nno console errors');
