// TC-104 (docs/TEST.md): signs in to https://app.imbo.dev as the online smoke account and walks the pages without sending.
// The code is read from the smoke mailbox with mail-read (subject "Imbo code: NNNNNN"); it is never printed.
// usage: node web/app/tests/prod.mjs <screenshot dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const base = 'https://app.imbo.dev';
const api = 'https://api.imbo.dev';
const email = 'imbo-smoke-a@laizhenglin.com';
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const errors = [];
const checks = [];
const ok = (name, cond, detail = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);

// Codes come from login@imbo.dev; poll every 5 s so the mailbox isn't hammered with logins.
const today = new Date().toISOString().slice(0, 10);
// mail-read now and then fails on a fetch that comes back empty; three tries.
function mailRead(args) {
  for (let i = 1; ; i++) {
    try {
      return execFileSync('mail-read', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      if (i === 3) throw e;
    }
  }
}
const inbox = () => JSON.parse(mailRead(['list', '--to', 'imbo-smoke-a@', '--since', today, '--json']));
const lastUid = () => Math.max(0, ...inbox().map((m) => Number(m.uid)));
async function codeAfter(uid) {
  for (let i = 0; i < 18; i++) {
    const m = inbox().find((m) => Number(m.uid) > uid && m.from.includes('login@imbo.dev') && /Imbo code: \d{6}/.test(m.subject));
    if (m) return m.subject.match(/\d{6}/)[0];
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('no code in the smoke mailbox within 90 s');
}

// Expected: 401 from /v1/me before sign-in and after sign-out.
const watch = (p) => {
  p.on('console', (m) => m.type() === 'error' && !/status of 401 /.test(m.text()) && errors.push(`console: ${m.text()}`));
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
};

const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  watch(page);
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });

  // 1. Signed out: the app goes to sign-in
  await page.goto(base + '/chats');
  await page.getByLabel('Email').waitFor();
  ok('1 signed out → sign-in page', new URL(page.url()).pathname === '/login', page.url());

  // 2. Ask for a code
  const before = lastUid();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  const code = await codeAfter(before);
  ok('2 code sent and received from login@imbo.dev', true);

  // 3. Sign in: chats, with smoke-b
  await page.keyboard.type(code);
  await page.waitForURL('**/chats');
  await page.getByRole('navigation', { name: 'Chats' }).waitFor();
  const rows = await page.getByRole('navigation', { name: 'Chats' }).getByRole('link').allTextContents();
  ok('3 chat list has smoke-b', rows.some((r) => r.includes('smoke-b')), rows.join(' | ').slice(0, 200));
  await shot('03-chats');

  // 4. The chat with smoke-b
  await page.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: /smoke-b/ }).click();
  await page.waitForURL(/\/chats\/\d+$/);
  const thread = page.locator('[aria-label="Messages with smoke-b"]');
  await thread.getByText('ping-42').first().waitFor();
  const text = await thread.textContent();
  ok('4 messages show with their receiving session', text.includes('to smoke-b smoke'));
  ok('4 message box addressed to smoke-b\'s inbox', (await page.getByRole('textbox', { name: "Message smoke-b's inbox" }).count()) === 1);
  await shot('04-chat-smoke-b');

  // 5. Contacts
  await page.getByRole('link', { name: 'Contacts' }).click();
  const contacts = await page.getByRole('navigation', { name: 'Contacts' }).getByRole('link').allTextContents();
  ok('5 contacts list smoke-b', contacts.some((c) => c.includes('smoke-b')), contacts.join(' | ').slice(0, 200));
  await shot('05-contacts');

  // 6. Sign out, and the cookie is gone
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.waitForURL(base + '/login');
  const me = await page.evaluate((u) => fetch(u + '/v1/me', { credentials: 'include' }).then((r) => r.status), api);
  await page.goto(base + '/chats');
  await page.getByLabel('Email').waitFor();
  ok('6 sign out → /login, and /chats goes back to sign-in', me === 401 && new URL(page.url()).pathname === '/login', `GET /v1/me → ${me}`);

  // 7. Phone width
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/login');
  await page.getByLabel('Email').waitFor();
  ok('7 no sideways scroll at 390', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await shot('07-login-390');
} catch (e) {
  checks.push(`FAIL stopped: ${e.message.split('\n')[0]}`);
} finally {
  await browser.close();
}
ok('8 no console errors besides the signed-out 401', errors.length === 0);
console.log([...checks, '', ...(errors.length ? errors : ['no console errors'])].join('\n'));
