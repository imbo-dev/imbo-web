// TC-270, TC-283, TC-284, TC-294 and TC-299 (docs/TEST.md, 应用内购买): App Store subscriptions on the web app's
// Account page and admin pages, against the local test server started as §3「应用内购买」says for the web. The page
// must be http://localhost:5190 (`npm run dev`). It signs up dave and erin in the App, takes the App tokens, makes
// the subscriptions and alice's report itself, then prints PASS/FAIL per step and any unexpected console errors.
// Numbers after the directory run only those cases.
// usage: node web/app/tests/iap.mjs <screenshot dir> [270 283 284 294 299]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const crates = new URL('../../../crates/', import.meta.url).pathname;
const base = 'http://localhost:5190';
const api = 'http://127.0.0.1:18080';
const L = '/tmp/imbo-t';
const out = process.argv[2];
const only = new Set(process.argv.slice(3));
const runs = (tc) => only.size === 0 || only.has(tc);
fs.mkdirSync(out, { recursive: true });
const errors = [];
const checks = [];
const ok = (name, cond, detail = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\n/g, ' ')}` : ''}`);
const sh = (cmd) => execFileSync('bash', ['-c', `. ${crates}scripts/local-env.sh; . ${crates}scripts/apple-env.sh; ${cmd}`], { encoding: 'utf8' });
const ids = Object.fromEntries(fs.readFileSync(`${L}/ids.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').slice(0, 2)));
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

// Expected: 401 before sign-in, 404 for the customer page, 409 for checkout with an App Store subscription and 422
// name-required when the admin's new email signs in.
const expected = /status of (401|404|409|422) /;
const watch = (p) => {
  p.on('console', (m) => m.type() === 'error' && !expected.test(m.text()) && errors.push(`console: ${m.text()}`));
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
};
const step = async (id, fn) => {
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};
/** Fetch from the page, so the cookie and Origin are the web app's. */
const call = (p, method, path, body) =>
  p.evaluate(
    async ([method, path, body]) => {
      const r = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
      const text = await r.text();
      return { status: r.status, body: text ? JSON.parse(text) : null };
    },
    [method, path, body]
  );
/** Elements whose right edge is past the viewport. */
const pastRight = (p) =>
  p.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const hits = [...document.querySelectorAll('body *')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.right > w + 1;
    });
    return { scroll: document.documentElement.scrollWidth, width: w, out: hits.slice(0, 5).map((e) => `${e.tagName}.${e.className}`.slice(0, 80)) };
  });
const toast = (p, text) => p.locator('[data-sonner-toast]', { hasText: text }).first().waitFor({ timeout: 8000 });

// App tokens, dave signing up in the App, then the App Store subscriptions: alice's from Xcode (TC-270), bob's and
// carol's from the sandbox (TC-299), and dave's that expired yesterday (TC-284).
const A = ids.alice, B = ids.bob, C = ids.carol;
const token = (n) => `${crates}scripts/app-login.sh ${n}@imbo.test | head -1 | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])' > $L/${n}.app`;
sh(`for n in alice bob carol; do ${token('$n')}; done; ${token('dave').replace('dave@imbo.test', 'dave@imbo.test Dave')}`);
const appLoginAt = Date.now();
const me = await fetch(`${api}/v1/me`, { headers: { authorization: `Bearer ${fs.readFileSync(`${L}/dave.app`, 'utf8').trim()}` } });
const D = (await me.json()).account?.id;
if (!D) throw new Error(`dave's account: ${me.status}`);
const made = [
  sh(`"$AE" transaction --account ${A} --original 2000000351 --product monthly --env Xcode --expires +30d --submit alice`),
  sh(`"$AE" status 2000000371 --account ${B} --env Sandbox --state active --auto-renew on --expires +30d; "$AE" transaction --account ${B} --original 2000000371 --product monthly --env Sandbox --expires +30d --submit bob`),
  sh(`"$AE" status 2000000372 --account ${C} --env Sandbox --state active --auto-renew on --expires +30d; "$AE" transaction --account ${C} --original 2000000372 --product monthly --env Sandbox --expires +30d --submit carol`),
  sh(`"$AE" status 2000000381 --account ${D} --env Sandbox --state expired --auto-renew off --expires=-1d; "$AE" transaction --account ${D} --original 2000000381 --product monthly --env Sandbox --expires=-1d --submit dave`),
];
if (!made.every((o) => /^200\b/m.test(o))) throw new Error(`App Store subscriptions not made: ${made.join(' | ')}`);
const reported = await fetch(`${api}/v1/reports`, {
  method: 'POST',
  headers: { authorization: `Bearer ${fs.readFileSync(`${L}/alice.app`, 'utf8').trim()}`, 'content-type': 'application/json' },
  body: JSON.stringify({ account_id: Number(C), reason: 'spam' }),
});
const R = (await reported.json()).report?.id;
if (reported.status !== 201 || !R) throw new Error(`alice's report on carol: ${reported.status}`);
// TC-294: erin signs up in the App, pays on the web, then subscribes in the App Store.
if (runs('294')) {
  sh(token('erin').replace('erin@imbo.test', 'erin@imbo.test Erin'));
  const r = await fetch(`${api}/v1/me`, { headers: { authorization: `Bearer ${fs.readFileSync(`${L}/erin.app`, 'utf8').trim()}` } });
  const E = (await r.json()).account?.id;
  if (!E) throw new Error(`erin's account: ${r.status}`);
  const paid = sh(`python3 ${crates}scripts/waffo-event.py subscription.activated --order ORD_t294 --account ${E} --period-end +30d`);
  if (!paid.includes('\n200')) throw new Error(`erin's web subscription: ${paid.trim().split('\n').at(-2)}`);
  const apple = sh(`"$AE" status 2000000491 --account ${E} --env Sandbox --state active --auto-renew on --expires +30d; "$AE" transaction --account ${E} --original 2000000491 --product monthly --env Sandbox --expires +30d --submit erin`);
  if (!/^200\b/m.test(apple)) throw new Error(`erin's App Store subscription: ${apple}`);
}

const browser = await chromium.launch();
try {
  async function signIn(p, email, name) {
    await p.goto(base + '/login');
    const before = codeLines(email).length;
    await p.getByLabel('Email').fill(email);
    await p.getByRole('button', { name: 'Continue' }).click();
    await p.getByText('Check your email').waitFor();
    await p.keyboard.type(await codeFor(email, before));
    if (name) {
      await p.getByLabel('Name').fill(name);
      await p.getByRole('button', { name: 'Create account' }).click();
    }
    await p.waitForURL((u) => !u.pathname.startsWith('/login') && !u.pathname.startsWith('/register'));
  }

  const admCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adm = await admCtx.newPage();
  watch(adm);
  await signIn(adm, 'admin@imbo.test', 'Imbo Admin');
  const userRow = (email) => adm.locator('tbody tr', { hasText: email });
  const search = async (email) => {
    await adm.goto(base + '/admin/users');
    await adm.getByLabel('Search by account ID or email').fill(email);
    await adm.getByText('1 match', { exact: true }).waitFor();
    return userRow(email);
  };
  const appStoreNote = (name) => `Only ${name} can cancel their App Store subscription. We emailed them how.`;

  if (runs('294')) {
    await step('TC-294 #1', async () => {
      const r = await call(adm, 'GET', '/v1/admin/accounts?q=erin%40imbo.test');
      const s = r.body?.accounts?.[0]?.subscription;
      ok('TC-294 #1 erin in API-065: subscription {status: active, provider: apple}', r.status === 200 && s?.status === 'active' && s?.provider === 'apple', JSON.stringify(s));
    });
    await step('TC-294 #2', async () => {
      const row = await search('erin@imbo.test');
      await row.getByRole('button', { name: 'Ban…' }).click();
      await adm.getByRole('dialog', { name: 'Ban erin?' }).getByRole('button', { name: 'Ban erin' }).click();
      await toast(adm, "erin is banned, but the subscription isn't canceled yet.");
      await row.getByRole('button', { name: 'Delete…' }).waitFor();
      const text = await row.innerText();
      const retry = await row.getByRole('button', { name: 'Retry cancel' }).count();
      await adm.screenshot({ path: `${out}/tc294-users-erin-1440.png` });
      ok("TC-294 #2 ban erin from Users: the toast says the subscription isn't canceled; the row says App Store: only they can cancel and has Retry cancel", text.includes('App Store: only they can cancel') && retry === 1, text);
    });
    await step('TC-294 #3', async () => {
      const row = userRow('erin@imbo.test');
      await row.getByRole('button', { name: 'Retry cancel' }).click({ timeout: 5000 });
      await toast(adm, "Waffo still didn't confirm the cancel. Try again later.");
      const retry = await row.getByRole('button', { name: 'Retry cancel' }).count();
      ok("TC-294 #3 Retry cancel on erin: Waffo still didn't confirm; Retry cancel stays", retry === 1, await row.innerText());
    });
  }

  if (runs('299')) {
    await step('TC-299 #1', async () => {
      const r = await call(adm, 'GET', '/v1/admin/accounts?q=bob%40imbo.test');
      const s = r.body?.accounts?.[0]?.subscription;
      ok('TC-299 #1 bob in API-065: subscription {status: active, provider: apple}', r.status === 200 && s?.status === 'active' && s?.provider === 'apple', JSON.stringify(s));
    });
    await step('TC-299 #2', async () => {
      const row = await search('bob@imbo.test');
      await row.getByRole('button', { name: 'Ban…' }).click();
      await adm.getByRole('dialog', { name: 'Ban bob?' }).getByRole('button', { name: 'Ban bob' }).click();
      await toast(adm, `bob is banned. ${appStoreNote('bob')}`);
      await row.getByRole('button', { name: 'Delete…' }).waitFor();
      const text = await row.innerText();
      const retry = await row.getByRole('button', { name: 'Retry cancel' }).count();
      await adm.screenshot({ path: `${out}/tc299-users-bob-1440.png` });
      ok('TC-299 #2 ban bob from Users: the toast says only bob can cancel; the row says App Store: only they can cancel and has Retry cancel, no Subscription not canceled', text.includes('App Store: only they can cancel') && !text.includes('Subscription not canceled') && retry === 1, text);
    });
    await step('TC-299 #3', async () => {
      const row = userRow('bob@imbo.test');
      await row.getByRole('button', { name: 'Retry cancel' }).click({ timeout: 5000 });
      await toast(adm, `Nothing left to cancel on the web. ${appStoreNote('bob')}`);
      const text = await row.innerText();
      ok('TC-299 #3 Retry cancel on bob: nothing left to cancel on the web, only bob can cancel; the row still says App Store: only they can cancel', text.includes('App Store: only they can cancel'), text);
    });
    await step('TC-299 #4', async () => {
      await adm.goto(`${base}/admin?report=${R}`);
      await adm.getByRole('button', { name: 'Ban carol' }).click();
      const answer = adm.waitForResponse((r) => r.url().endsWith(`/v1/admin/reports/${R}/resolve`));
      await adm.getByRole('dialog', { name: 'Ban carol?' }).getByRole('button', { name: 'Ban carol' }).click();
      const res = await answer;
      const body = await res.json();
      await adm.getByText(appStoreNote('carol')).waitFor();
      await adm.screenshot({ path: `${out}/tc299-report-carol-1440.png` });
      ok('TC-299 #4 ban carol from her report: 200, subscription_canceled true, app_store_subscription true; the report says only carol can cancel', res.status() === 200 && body.subscription_canceled === true && body.app_store_subscription === true, JSON.stringify({ status: res.status(), subscription_canceled: body.subscription_canceled, app_store_subscription: body.app_store_subscription }));
    });
    await step('TC-299 #5', async () => {
      const row = await search('carol@imbo.test');
      const text = await row.innerText();
      const retry = await row.getByRole('button', { name: 'Retry cancel' }).count();
      ok('TC-299 #5 carol in Users: App Store: only they can cancel and Retry cancel, no Subscription not canceled', text.includes('App Store: only they can cancel') && !text.includes('Subscription not canceled') && retry === 1, text);
    });
    await step('TC-299 #6', async () => {
      await adm.setViewportSize({ width: 390, height: 844 });
      const row = await search('bob@imbo.test');
      const tag = row.getByText('App Store: only they can cancel');
      const box = await tag.boundingBox();
      const button = await row.getByRole('button', { name: 'Retry cancel' }).boundingBox();
      const edge = await pastRight(adm);
      await adm.screenshot({ path: `${out}/tc299-users-bob-390.png` });
      const inside = (b) => !!b && b.x >= 0 && b.x + b.width <= 390;
      ok('TC-299 #6 at 390: the tag and Retry cancel are whole and nothing is past the right edge', inside(box) && inside(button) && edge.scroll <= edge.width && edge.out.length === 0, JSON.stringify({ box, button, ...edge }));
      await adm.setViewportSize({ width: 1440, height: 900 });
    });
  }

  if (runs('270') || runs('283') || runs('284')) {
    // alice asked for a code when her App signed in; the same email gets one code a minute.
    await wait(Math.max(0, appLoginAt + 62000 - Date.now()));
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    watch(page);
    await signIn(page, 'alice@imbo.test');
    const plan = () => page.locator('div', { has: page.getByRole('heading', { name: 'Plan', exact: true }) }).last();
    const account = async () => {
      await page.goto(base + '/account');
      await page.getByText('Billed through the App Store').waitFor();
      const p = plan();
      return {
        text: await p.innerText(),
        manage: await page.getByRole('button', { name: 'Manage subscription' }).count(),
        subscribe: await p.getByRole('button', { name: /^\$\d+ a (year|month)$/ }).count(),
        testMode: await page.getByText('Test mode', { exact: false }).count(),
      };
    };
    const appStoreShown = (a) => a.text.includes('Monthly') && /renews \w+ \d+, \d{4}/.test(a.text) && a.text.includes('Billed through the App Store') && a.text.includes('Settings on your iPhone') && a.manage === 0 && a.subscribe === 0;
    let wide;
    if (runs('270')) {
      await step('TC-270 #1', async () => {
        const r = await call(page, 'GET', '/v1/billing');
        ok('TC-270 #1 billing: subscription provider apple, status active', r.status === 200 && r.body?.subscription?.provider === 'apple' && r.body?.subscription?.status === 'active', JSON.stringify(r.body?.subscription));
      });
      await step('TC-270 #2', async () => {
        const portal = await call(page, 'POST', '/v1/billing/portal');
        const checkout = await call(page, 'POST', '/v1/billing/checkout', { plan: 'monthly' });
        ok('TC-270 #2 portal 404 not-found; checkout 409 already-subscribed', portal.status === 404 && portal.body?.type === '/errors/not-found' && checkout.status === 409 && checkout.body?.type === '/errors/already-subscribed', JSON.stringify([portal.status, portal.body?.type, checkout.status, checkout.body?.type]));
      });
    }
    await step('Account page at 1440', async () => {
      wide = await account();
      await page.screenshot({ path: `${out}/account-alice-1440.png` });
      if (runs('270')) ok('TC-270 #3 Account page at 1440: Monthly, renewal date, "Billed through the App Store", Settings on the iPhone; no Manage subscription, $20 a year or $2 a month button', appStoreShown(wide), wide.text);
      if (runs('283')) ok('TC-283 #1 alice\'s Account page at 1440: "Billed through the App Store", no "Test mode" anywhere', wide.text.includes('Billed through the App Store') && wide.testMode === 0, `Test mode shown ${wide.testMode} time(s); plan: ${wide.text}`);
    });
    if (runs('270')) {
      await step('TC-270 #4', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        const narrow = await account();
        const edge = await pastRight(page);
        await page.screenshot({ path: `${out}/account-alice-390.png` });
        ok('TC-270 #4 Account page at 390: as at 1440, the text whole, nothing past the right edge', appStoreShown(narrow) && edge.scroll <= edge.width && edge.out.length === 0, JSON.stringify({ plan: narrow.text, ...edge }));
      });
    }
    if (runs('284')) {
      const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const dp = await dctx.newPage();
      watch(dp);
      const plan284 = async () => {
        await dp.goto(base + '/account');
        await dp.getByRole('heading', { name: 'Plan', exact: true }).waitFor();
        await dp.getByRole('button', { name: '$20 a year' }).or(dp.getByText('Billed through the App Store')).first().waitFor();
        const row = dp.locator('div', { has: dp.getByRole('heading', { name: 'Plan', exact: true }) }).last();
        return {
          text: await row.innerText(),
          subscribe: await row.getByRole('button', { name: /^\$\d+ a (year|month)$/ }).count(),
          testMode: await dp.getByText('Test mode: checkout takes test card numbers and never charges.').count(),
          appStore: await dp.getByText('Billed through the App Store').count(),
        };
      };
      await step('TC-284 #1', async () => {
        const r = await fetch(`${api}/v1/billing`, { headers: { authorization: `Bearer ${fs.readFileSync(`${L}/dave.app`, 'utf8').trim()}` } });
        const b = await r.json();
        ok('TC-284 #1 dave in the App: access trial; subscription {status: canceled, provider: apple}', r.status === 200 && b.access?.state === 'trial' && b.subscription?.status === 'canceled' && b.subscription?.provider === 'apple', JSON.stringify({ access: b.access, subscription: b.subscription }));
      });
      await signIn(dp, 'dave@imbo.test');
      await step('TC-284 #2', async () => {
        const a = await plan284();
        await dp.screenshot({ path: `${out}/tc284-dave-trial-1440.png` });
        ok('TC-284 #2 dave\'s Account page in the trial: days left, the $20 a year and $2 a month buttons and the Test mode note; no "Billed through the App Store"', /Free trial, \d+ days left/.test(a.text) && a.subscribe === 2 && a.testMode === 1 && a.appStore === 0, JSON.stringify(a));
      });
      await step('TC-284 #3', async () => {
        sh(`IMBO_DATA_DIR=$L/server "$S" dev age-account ${D} --days 31`);
        const a = await plan284();
        await dp.screenshot({ path: `${out}/tc284-dave-expired-1440.png` });
        ok('TC-284 #3 dave 31 days old: "Your sessions can\'t send messages until you subscribe." and the $20 a year and $2 a month buttons; no "Billed through the App Store"', a.text.includes("Your sessions can't send messages until you subscribe.") && a.subscribe === 2 && a.appStore === 0, JSON.stringify(a));
      });
    }
    if (runs('283')) {
      await step('TC-283 #2', async () => {
        await adm.setViewportSize({ width: 1440, height: 900 });
        await adm.goto(base + '/account');
        await adm.getByRole('heading', { name: 'Plan', exact: true }).waitFor();
        const note = await adm.getByText('Test mode: checkout takes test card numbers and never charges.').count();
        await adm.screenshot({ path: `${out}/account-admin-1440.png` });
        ok('TC-283 #2 the admin, with no subscription: the Account page still says "Test mode: checkout takes test card numbers and never charges."', note === 1, `shown ${note} time(s)`);
      });
    }
  }
} finally {
  await browser.close();
}
console.log(`report on carol: ${R}`);
console.log(checks.join('\n'));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'console errors: none');
process.exit(checks.some((c) => c.startsWith('FAIL')) ? 1 : 0);
