// TC-300 and TC-301 (docs/TEST.md) on https://app.imbo.dev: a new email signs up; smoke-a and smoke-b change a picture,
// block, unblock and report; the admin opens the report from its email, dismisses it, then bans and deletes the TC-300
// account. Codes and the report email are read with mail-read (laizhenglin.com delivers every address to me@); codes are
// never printed. Prints PASS/FAIL per step, then any unexpected console errors.
// usage: node web/app/tests/prod-safety.mjs <screenshot dir> <RUN id>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const base = 'https://app.imbo.dev';
const api = 'https://api.imbo.dev';
const [out, run] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
const newEmail = `imbo-web-${stamp}@laizhenglin.com`;
const A = 'imbo-smoke-a@laizhenglin.com';
const B = 'imbo-smoke-b@laizhenglin.com';
const ADMIN = 'me@laizhenglin.com';
const errors = [];
const checks = [];
const ok = (name, cond, detail = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\n/g, ' ')}` : ''}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const step = async (id, fn) => {
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};

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
const list = (args) => JSON.parse(mailRead(['list', '--since', today, '--json', ...args]));
const lastUid = (to) => Math.max(0, ...list(['--to', to]).map((m) => Number(m.uid)));
async function codeAfter(to, uid) {
  for (let i = 0; i < 18; i++) {
    const m = list(['--to', to]).find((m) => Number(m.uid) > uid && m.from.includes('login@imbo.dev') && /Imbo code: \d{6}/.test(m.subject));
    if (m) return m.subject.match(/\d{6}/)[0];
    await wait(5000);
  }
  throw new Error(`no code for ${to} within 90 s`);
}

// Expected: 401 from /v1/me while signed out, 403 for smoke-b's message to smoke-a while blocked, 422 when a new email
// has to pick a name.
const expected = /status of (401|403|422) /;
const watch = (p) => {
  p.on('console', (m) => m.type() === 'error' && !expected.test(m.text()) && errors.push(`console: ${m.text()}`));
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
};

/** Width and height of a JPEG, from its first SOF marker. */
function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return undefined;
  for (let i = 2; i + 9 < buf.length; ) {
    if (buf[i] !== 0xff) return undefined;
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return undefined;
}

const browser = await chromium.launch();
const made = {};
try {
  const desktop = { viewport: { width: 1440, height: 900 } };
  const [n, a, b, adm] = await Promise.all([1, 2, 3, 4].map(async () => (await browser.newContext(desktop)).newPage()));
  for (const p of [n, a, b, adm]) watch(p);
  const shot = (p, name) => p.screenshot({ path: `${out}/${name}.png` });
  const toast = (p, text) => p.locator('[data-sonner-toast]', { hasText: text }).first().waitFor({ timeout: 10000 });
  const composer = (p) => p.locator('textarea.composer');
  const pictureButton = (p) => p.getByRole('button', { name: /^(Add a picture|Change picture)$/ });
  const avatarSrc = (loc) => loc.locator('img').first().getAttribute('src', { timeout: 3000 }).catch(() => null);
  const menu = async (p, who, item) => {
    await p.getByRole('button', { name: `More for ${who}` }).click();
    await p.getByRole('menuitem', { name: item }).click();
  };
  async function openChat(p, name) {
    await p.goto(base + '/chats');
    await p.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: new RegExp(`^${name}`) }).click();
    await composer(p).or(p.getByText(/^You blocked /)).first().waitFor();
  }
  /** Asks for a code and types it; returns true when the email had no account and asked for a name. */
  async function signIn(p, email) {
    const before = lastUid(email);
    await p.getByLabel('Email').fill(email);
    await p.getByRole('button', { name: 'Continue' }).click();
    await p.getByText('Check your email').waitFor();
    await p.keyboard.type(await codeAfter(email, before));
    const name = p.getByLabel('Name');
    await name.or(p.getByRole('navigation', { name: 'Chats' })).or(p.getByRole('heading', { name: /^Report #/ })).first().waitFor({ timeout: 20000 });
    return name.isVisible();
  }
  async function signOut(p) {
    await p.goto(base + '/chats');
    await p.getByRole('button', { name: 'Account menu' }).click();
    await p.getByRole('menuitem', { name: 'Sign out' }).click();
    await p.waitForURL(base + '/login');
  }

  // ── TC-300: a new email signs up ──
  await step('TC-300 #1 code sent', async () => {
    await n.goto(base + '/login');
    made.newFirst = await signIn(n, newEmail);
    ok('TC-300 #1 code sent', true, newEmail);
  });
  await step('TC-300 #2 asks for a name', async () => {
    ok('TC-300 #2 asks for a name', made.newFirst && (await n.getByRole('button', { name: 'Create account' }).isVisible()));
  });
  await step('TC-300 #3 welcome: trial and account ID', async () => {
    await n.getByLabel('Name').fill('web-check');
    await n.getByRole('button', { name: 'Create account' }).click();
    await n.waitForURL('**/welcome');
    await n.getByRole('heading', { name: "You're in, web-check." }).waitFor();
    // The trial line fills in once the billing request answers.
    const t0 = Date.now();
    await n.getByText('Your 30-day free trial has started.').waitFor({ timeout: 10000 }).catch(() => {});
    made.trialMs = Date.now() - t0;
    const text = await n.locator('body').innerText();
    made.newId = text.match(/Your account ID\D*?(\d+)/)?.[1];
    ok('TC-300 #3 welcome: trial and account ID', text.includes('Your 30-day free trial has started.') && /^\d{8}$/.test(made.newId ?? ''), `ID ${made.newId}, trial line after ${made.trialMs} ms`);
    await shot(n, '300-03-welcome');
  });
  await step('TC-300 #4 on to chats', async () => {
    await n.getByRole('button', { name: 'Open Imbo' }).click();
    await n.waitForURL('**/chats');
    ok('TC-300 #4 on to chats', true);
  });
  await step('TC-300 #5 account: trial and the two prices', async () => {
    await n.goto(base + '/account');
    await n.getByText(/Free trial,\s*30\s*days left/).waitFor();
    const yearly = await n.getByRole('button', { name: '$20 a year' }).isVisible();
    const monthly = await n.getByRole('button', { name: '$2 a month' }).isVisible();
    ok('TC-300 #5 account: trial and the two prices', yearly && monthly, `$20 a year ${yearly}, $2 a month ${monthly}`);
    await shot(n, '300-05-account');
  });
  await step('TC-300 #6 sign out', async () => {
    await signOut(n);
    ok('TC-300 #6 sign out', true);
  });

  // ── TC-301: pictures, blocking, reporting, and the admin ──
  for (const [p, email] of [[a, A], [b, B]]) {
    await p.goto(base + '/login');
    await signIn(p, email);
  }
  await step('TC-301 #1 smoke-a adds a picture', async () => {
    await a.goto(base + '/account');
    await pictureButton(a).waitFor();
    if ((await pictureButton(a).getAttribute('aria-label')) !== 'Add a picture') throw new Error('smoke-a already has a picture');
    const png = Buffer.from(
      await a.evaluate(async () => {
        const cv = new OffscreenCanvas(600, 400);
        const x = cv.getContext('2d');
        x.fillStyle = '#c33';
        x.fillRect(0, 0, 300, 400);
        x.fillStyle = '#33c';
        x.fillRect(300, 0, 300, 400);
        const bytes = new Uint8Array(await (await cv.convertToBlob({ type: 'image/png' })).arrayBuffer());
        let s = '';
        for (const v of bytes) s += String.fromCharCode(v);
        return btoa(s);
      }),
      'base64'
    );
    await pictureButton(a).click();
    const [chooser] = await Promise.all([a.waitForEvent('filechooser'), a.getByRole('menuitem', { name: 'Upload a picture…' }).click()]);
    await chooser.setFiles({ name: 't301.png', mimeType: 'image/png', buffer: png });
    await a.getByRole('button', { name: 'Change picture' }).waitFor();
    made.src = await avatarSrc(pictureButton(a));
    const r = await fetch(new URL(made.src, api));
    const size = jpegSize(Buffer.from(await r.arrayBuffer()));
    ok('TC-301 #1 smoke-a adds a picture', /\/v1\/avatars\/[0-9a-f-]{36}\.jpg$/.test(made.src ?? '') && r.status === 200 && r.headers.get('content-type') === 'image/jpeg' && size?.w === 512 && size?.h === 512, `${made.src} → ${r.status} ${r.headers.get('content-type')} ${size?.w}×${size?.h}`);
    await shot(a, '301-01-picture');
  });
  await step("TC-301 #2 smoke-b sees it in contacts", async () => {
    await b.goto(base + '/contacts');
    const row = b.getByRole('navigation', { name: 'Contacts' }).getByRole('link', { name: /^smoke-a/ });
    await row.waitFor();
    const src = await avatarSrc(row);
    ok("TC-301 #2 smoke-b sees it in contacts", !!src && new URL(src, api).pathname === new URL(made.src, api).pathname, src);
  });
  await step('TC-301 #3 smoke-a blocks smoke-b', async () => {
    await openChat(a, 'smoke-b');
    await menu(a, 'smoke-b', 'Block smoke-b…');
    await a.getByRole('dialog', { name: 'Block smoke-b?' }).getByRole('button', { name: 'Block', exact: true }).click();
    await toast(a, 'smoke-b is blocked.');
    await a.getByText('You blocked smoke-b. Unblock smoke-b to send messages.').waitFor();
    ok('TC-301 #3 smoke-a blocks smoke-b', (await composer(a).count()) === 0);
    await shot(a, '301-03-blocked');
  });
  await step("TC-301 #4 smoke-b's message is refused", async () => {
    await openChat(b, 'smoke-a');
    await composer(b).fill('T301 blocked?');
    await composer(b).press('Enter');
    const row = b.locator('article', { hasText: 'T301 blocked?' });
    await row.getByText("Not sent. smoke-a doesn't accept your messages.").waitFor({ timeout: 10000 });
    const buttons = (await row.getByRole('button').allInnerTexts()).map((x) => x.trim());
    await shot(b, '301-04-refused');
    await row.getByRole('button', { name: 'Discard' }).click();
    await row.waitFor({ state: 'detached' });
    ok("TC-301 #4 smoke-b's message is refused", buttons.join('|') === 'Discard', buttons.join(' | '));
  });
  await step('TC-301 #5 smoke-a unblocks', async () => {
    await a.getByRole('button', { name: 'Unblock', exact: true }).click();
    await toast(a, 'smoke-b is unblocked.');
    await composer(a).waitFor();
    ok('TC-301 #5 smoke-a unblocks', true);
  });
  await step('TC-301 #6 smoke-a reports smoke-b', async () => {
    made.reportUid = lastUid('support@imbo.dev');
    await menu(a, 'smoke-b', 'Report smoke-b…');
    const d = a.getByRole('dialog', { name: 'Report smoke-b' });
    await d.getByRole('radio', { name: /^Spam/ }).click();
    await d.getByLabel('Details (optional)').fill(`${run} online check, dismiss`);
    await d.getByRole('button', { name: 'Send report' }).click();
    const sent = a.getByRole('dialog', { name: 'Report sent' });
    await sent.getByText('Thanks. We review reports within 24 hours.').waitFor();
    await shot(a, '301-06-reported');
    await sent.getByRole('button', { name: 'Not now' }).click();
    await sent.waitFor({ state: 'hidden' });
    ok('TC-301 #6 smoke-a reports smoke-b', true);
  });
  await step('TC-301 #7 the report email', async () => {
    let m;
    for (let i = 0; i < 18 && !m; i++) {
      m = list(['--to', 'support@imbo.dev']).find((x) => Number(x.uid) > made.reportUid && x.subject.includes('New Imbo report'));
      if (!m) await wait(5000);
    }
    if (!m) throw new Error('no New Imbo report mail within 90 s');
    const body = mailRead(['show', String(m.uid)]);
    made.link = body.match(/https:\/\/app\.imbo\.dev\/admin\?report=(\d+)/)?.[0];
    made.report = made.link?.split('=')[1];
    ok('TC-301 #7 the report email', !!made.link, `uid ${m.uid}, ${made.link}`);
  });
  await step('TC-301 #8 the admin opens it', async () => {
    await adm.goto(made.link);
    await adm.waitForURL(/\/login\?next=/);
    const viaLogin = new URL(adm.url()).search;
    if (await signIn(adm, ADMIN)) {
      made.adminSignedUp = true;
      await adm.getByLabel('Name').fill('Imbo Admin');
      await adm.getByRole('button', { name: 'Create account' }).click();
      await adm.waitForURL('**/welcome');
    }
    await adm.goto(made.link);
    await adm.getByRole('heading', { name: new RegExp(`^Report #${made.report}`) }).waitFor();
    const main = adm.locator('main');
    await main.getByText('Last 20, copied when reported').waitFor();
    const text = await main.innerText();
    ok('TC-301 #8 the admin opens it', viaLogin.startsWith('?next=') && /Spam, direct chat/.test(text) && text.includes(`${run} online check, dismiss`), `${viaLogin}${made.adminSignedUp ? ', admin signed up' : ''}`);
    await shot(adm, '301-08-report');
  });
  await step('TC-301 #9 Dismiss', async () => {
    await adm.getByRole('button', { name: 'Dismiss' }).click();
    await toast(adm, `Report #${made.report} is dismissed.`);
    await adm.locator('main').getByText('Dismissed', { exact: true }).first().waitFor();
    ok('TC-301 #9 Dismiss', (await adm.getByRole('button', { name: 'Dismiss' }).count()) === 0);
  });
  const userRow = () => adm.locator('tbody tr', { hasText: newEmail });
  await step('TC-301 #10 ban the TC-300 account', async () => {
    await adm.goto(base + '/admin/users');
    await adm.getByLabel('Search by account ID or email').fill(newEmail);
    await adm.getByText('1 match', { exact: true }).waitFor();
    await userRow().getByRole('button', { name: 'Ban…' }).click();
    await adm.getByRole('dialog', { name: 'Ban web-check?' }).getByRole('button', { name: 'Ban web-check' }).click();
    await toast(adm, 'web-check is banned.');
    await userRow().getByRole('button', { name: 'Delete…' }).waitFor();
    ok('TC-301 #10 ban the TC-300 account', /Banned/.test(await userRow().innerText()));
  });
  await step('TC-301 #11 delete it', async () => {
    await userRow().getByRole('button', { name: 'Delete…' }).click();
    const d = adm.getByRole('dialog', { name: "Delete web-check's account?" });
    await d.getByLabel('Type DELETE to confirm').fill('DELETE');
    await d.getByRole('button', { name: 'Delete account' }).click();
    await toast(adm, "web-check's account is deleted.");
    await adm.getByText('No account matches').waitFor();
    made.deleted = true;
    ok('TC-301 #11 delete it', true);
    await shot(adm, '301-11-deleted');
  });
  // Accounts an earlier, voided run of this script signed up and couldn't delete: LEFTOVER=<email>[,<email>…]
  for (const email of (process.env.LEFTOVER ?? '').split(',').filter(Boolean)) {
    await step(`cleanup ${email}`, async () => {
      const row = () => adm.locator('tbody tr', { hasText: email });
      await adm.goto(base + '/admin/users');
      await adm.getByLabel('Search by account ID or email').fill(email);
      await adm.getByText('1 match', { exact: true }).waitFor();
      await row().getByRole('button', { name: 'Ban…' }).click();
      await adm.getByRole('dialog', { name: 'Ban web-check?' }).getByRole('button', { name: 'Ban web-check' }).click();
      await row().getByRole('button', { name: 'Delete…' }).click();
      const d = adm.getByRole('dialog', { name: "Delete web-check's account?" });
      await d.getByLabel('Type DELETE to confirm').fill('DELETE');
      await d.getByRole('button', { name: 'Delete account' }).click();
      await adm.getByText('No account matches').waitFor();
      ok(`cleanup ${email}`, true, 'banned and deleted');
    });
  }
  await step('TC-301 #12 smoke-a removes the picture', async () => {
    await a.goto(base + '/account');
    await pictureButton(a).click();
    await a.getByRole('menuitem', { name: 'Remove picture' }).click();
    await a.getByRole('button', { name: 'Add a picture' }).waitFor();
    ok('TC-301 #12 smoke-a removes the picture', true);
  });
  await step('TC-301 #13 everyone signs out', async () => {
    for (const p of [a, b, adm]) await signOut(p);
    ok('TC-301 #13 everyone signs out', true);
  });
} catch (e) {
  checks.push(`FAIL stopped: ${e.message.split('\n')[0]}`);
} finally {
  await browser.close();
}
ok('TC-300 #7 / TC-301 #13 no unexpected console errors', errors.length === 0);
console.log(
  [
    ...checks,
    '',
    `new account ${newEmail} ID ${made.newId ?? '?'}${made.deleted ? ', deleted' : ', still on the server'}; report #${made.report ?? '?'}`,
    ...(errors.length ? errors : ['no console errors']),
  ].join('\n')
);
