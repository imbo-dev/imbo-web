// TC-518 (docs/TEST.md): the Account page selling Alipay time packs (FLOW-ALIPAY-PACK), against the local test server
// with billing on and the fake Alipay (§3「支付宝时长包」, seeded). The page must be http://localhost:5190 (`npm run dev`).
// It ends alice's and bob's trials itself and pays on the fake cashier, then prints PASS/FAIL per step and any console
// errors. Codes are read from $L/server.log and never printed; neither are the signatures of orders.
// usage: node web/app/tests/alipay.mjs <screenshot dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const root = new URL('../../../', import.meta.url).pathname;
const base = 'http://localhost:5190';
const L = '/tmp/imbo-t';
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const checks = [];
const ok = (name, cond, detail = '') => {
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, ' ').replace(/sign=[^\s&]+/g, 'sign=<sign>')}` : ''}`;
  checks.push(line);
  console.log(line);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ids = Object.fromEntries(
  fs
    .readFileSync(`${L}/ids.tsv`, 'utf8')
    .trim()
    .split('\n')
    .map((l) => l.split(/\s+/)),
);
const serverCmd = (args) => execFileSync(`${root}crates/target/debug/imbo-server`, args, { encoding: 'utf8', env: { ...process.env, IMBO_DATA_DIR: `${L}/server` } });
const fake = (args) => JSON.parse(execFileSync(`${root}crates/scripts/alipay-fake.py`, args, { encoding: 'utf8', env: { ...process.env, ALIPAY_DIR: `${L}/alipay` } }));
/** The order number in a cashier address. */
const orderOf = (url) => JSON.parse(new URL(url).searchParams.get('biz_content') ?? '{}').out_trade_no;
/** A calendar month or year on from `at`, counted in Beijing time as the server does. */
const plus = (at, months) => {
  const d = new Date(new Date(at).getTime() + 8 * 3600e3);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  return new Date(d.getTime() - 8 * 3600e3);
};
/** The date as the page writes it: the browser's time zone, the page's language. */
const asPage = (at, locale) => new Date(at).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Shanghai' });

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
// bob's check is refused on purpose at step 8 (Alipay erring), which the page reports as a failed request.
const expected = { 'login alice': /status of 401 /, 'login bob': /status of 401 /, 'TC-518 #8': /status of 502 / };
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
  const context = async (opts, cookies) => {
    const ctx = await browser.newContext({ locale: 'en-US', timezoneId: 'Asia/Shanghai', ...opts, ...(cookies && { storageState: { cookies, origins: [] } }) });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push([current, m.text()]));
    page.on('pageerror', (e) => consoleErrors.push([current, `pageerror: ${e.message}`]));
    return page;
  };
  const login = async (page, name) => {
    current = `login ${name}`;
    const email = `${name}@imbo.test`;
    await page.goto(base + '/login');
    const before = codeLines(email).length;
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText('Check your email').waitFor();
    await page.keyboard.type(await codeFor(email, before));
    await page.waitForURL('**/chats');
    return (await page.context().storageState()).cookies;
  };

  // Both trials are over, so the page offers both ways to pay.
  serverCmd(['dev', 'age-account', ids.alice, '--days', '31']);
  serverCmd(['dev', 'age-account', ids.bob, '--days', '31']);
  fake(['fail', 'off']);
  fake(['notifications', 'on']);

  const page = await context({ viewport: { width: 1440, height: 900 } });
  const cookies = await login(page, 'alice');

  /** The Plan row as it shows: its words, and its buttons with where they sit. */
  const plan = async (p, label, waitFor, path = '/account') => {
    if (path) await p.goto(base + path);
    const row = p.locator('div', { has: p.getByRole('heading', { name: label, exact: true }) }).last();
    await (waitFor instanceof RegExp ? row.getByText(waitFor).waitFor({ timeout: 20000 }) : row.getByRole('button', { name: waitFor }).waitFor());
    await wait(300);
    const buttons = await row.getByRole('button').evaluateAll((list) =>
      list.map((b) => {
        const r = b.getBoundingClientRect();
        return { name: b.textContent.trim(), l: Math.round(r.left), r: Math.round(r.right) };
      }),
    );
    return { text: (await row.innerText()).replace(/\s+/g, ' '), buttons };
  };

  await step('TC-518 #1', async () => {
    const a = await plan(page, 'Plan', 'Alipay · 1 month ¥15');
    await page.screenshot({ path: `${out}/tc518-1.png` });
    const names = a.buttons.map((b) => b.name);
    ok(
      "TC-518 #1 inactive at 1440: Alipay · 1 month ¥15 and Alipay · 1 year ¥150, the no-renew line under them, and Waffo's two buttons",
      names.includes('Alipay · 1 month ¥15') &&
        names.includes('Alipay · 1 year ¥150') &&
        a.text.includes("Paid once with Alipay. It doesn't renew.") &&
        names.includes('$20 a year') &&
        names.includes('$2 a month'),
      `${a.text} | buttons: ${names.join(', ')}`,
    );
  });

  await step('TC-518 #2', async () => {
    const p = await context({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' }, cookies);
    const a = await plan(p, '套餐', '支付宝月卡 ¥15');
    await p.screenshot({ path: `${out}/tc518-2.png` });
    const names = a.buttons.map((b) => b.name);
    ok('TC-518 #2 in Chinese: 支付宝月卡 ¥15 and 支付宝年卡 ¥150, the line under them in Chinese', names.includes('支付宝月卡 ¥15') && names.includes('支付宝年卡 ¥150') && a.text.includes('用支付宝付一次，不自动续费。'), `${a.text} | buttons: ${names.join(', ')}`);
    await p.context().close();
  });

  let aliceOrder;
  await step('TC-518 #3', async () => {
    await plan(page, 'Plan', 'Alipay · 1 month ¥15');
    await page.getByRole('button', { name: 'Alipay · 1 month ¥15' }).click();
    await page.waitForURL(/127\.0\.0\.1:18093\/gateway\.do\?/, { timeout: 20000 });
    await page.getByRole('button', { name: '确认付款' }).waitFor();
    aliceOrder = orderOf(page.url());
    const text = (await page.innerText('body')).replace(/\s+/g, ' ');
    await page.screenshot({ path: `${out}/tc518-3.png` });
    ok('TC-518 #3 the month button opens the (fake) Alipay cashier for Imbo 月卡, 15.00', text.includes('Imbo 月卡') && text.includes('15.00') && /^ALIPAY_\d+_\d{13}$/.test(aliceOrder ?? ''), `${text} | ${aliceOrder}`);
  });

  let paidUntil;
  await step('TC-518 #4', async () => {
    fake(['notifications', 'off']);
    const t0 = Date.now();
    await page.getByRole('button', { name: '确认付款' }).click();
    await page.waitForURL(`${base}/account`, { timeout: 20000 });
    const a = await plan(page, 'Plan', /Alipay time pack/, null);
    await page.screenshot({ path: `${out}/tc518-4.png` });
    const b = await page.evaluate(() => fetch('/v1/billing').then((r) => r.json()));
    paidUntil = b.subscription?.paid_until;
    const due = plus(t0, 1);
    ok(
      "TC-518 #4 back from paying, before the payment notice: the address is plain /account; Won't renew, the pack ending a month from payment; no buy buttons",
      new URL(page.url()).search === '' &&
        b.subscription?.provider === 'alipay' &&
        Math.abs(new Date(paidUntil) - due) < 60e3 &&
        a.text.includes("Won't renew") &&
        a.text.includes(`Alipay time pack, ends ${asPage(paidUntil, 'en-US')}`) &&
        !a.buttons.length,
      `${page.url()} | ${a.text} | buttons: ${a.buttons.map((x) => x.name).join(', ') || 'none'} | paid_until ${paidUntil}`,
    );
  });

  await step('TC-518 #5', async () => {
    const a = await plan(page, 'Plan', /Alipay time pack/);
    ok('TC-518 #5 plain /account says the same, so the pack is recorded and not read off the address', a.text.includes(`Alipay time pack, ends ${asPage(paidUntil, 'en-US')}`) && !a.buttons.length, a.text);
  });

  await step('TC-518 #6', async () => {
    const p = await context({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' }, cookies);
    const a = await plan(p, 'Plan', /Alipay time pack/);
    await p.getByRole('heading', { name: 'Plan', exact: true }).scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${out}/tc518-6.png` });
    const box = await p.getByText(/Alipay time pack/).boundingBox();
    ok(
      'TC-518 #6 dark, 390 wide: the same words, the line inside the window',
      a.text.includes(`Alipay time pack, ends ${asPage(paidUntil, 'en-US')}`) && box.x >= 0 && box.x + box.width <= 390,
      `${a.text} | line ${Math.round(box.x)}–${Math.round(box.x + box.width)}`,
    );
    await p.context().close();
  });

  await step('TC-518 #7', async () => {
    const p = await context({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' }, cookies);
    const a = await plan(p, '套餐', /支付宝时长包/);
    await p.screenshot({ path: `${out}/tc518-7.png` });
    ok('TC-518 #7 in Chinese: 不再续订 and 支付宝时长包，<date> 结束 with the date written the Chinese way', a.text.includes('不再续订') && a.text.includes(`支付宝时长包，${asPage(paidUntil, 'zh-CN')} 结束`), a.text);
    await p.context().close();
  });

  const bp = await context({ viewport: { width: 1440, height: 900 } });
  let bobOrder;
  let bobPaid;
  await step('TC-518 #8', async () => {
    await login(bp, 'bob');
    current = 'TC-518 #8';
    await plan(bp, 'Plan', 'Alipay · 1 year ¥150');
    await bp.getByRole('button', { name: 'Alipay · 1 year ¥150' }).click();
    await bp.waitForURL(/127\.0\.0\.1:18093\/gateway\.do\?/, { timeout: 20000 });
    bobOrder = orderOf(bp.url());
    fake(['fail', 'error']);
    bobPaid = Date.now();
    await bp.getByRole('button', { name: '确认付款' }).click();
    await bp.waitForURL(`${base}/account`, { timeout: 20000 });
    await bp.getByText('Confirming your payment…').waitFor({ timeout: 10000 });
    const a = await plan(bp, 'Plan', /Confirming your payment/, null);
    await bp.screenshot({ path: `${out}/tc518-8.png` });
    const names = a.buttons.map((x) => x.name);
    ok(
      'TC-518 #8 Alipay erring on the check: Confirming your payment… above the plan, the buy buttons put away',
      a.text.includes('Confirming your payment…') && !names.some((n) => n.startsWith('Alipay') || n.includes('$')),
      `${a.text} | buttons: ${names.join(', ') || 'none'} | order ${bobOrder}`,
    );
  });

  await step('TC-518 #9', async () => {
    current = 'TC-518 #9';
    const n = fake(['notify', bobOrder]);
    const a = await plan(bp, 'Plan', /Alipay time pack/, null);
    await bp.screenshot({ path: `${out}/tc518-9.png` });
    const b = await bp.evaluate(() => fetch('/v1/billing').then((r) => r.json()));
    const until = b.subscription?.paid_until;
    ok(
      'TC-518 #9 the payment notice arrives: the plan turns into the yearly pack and Confirming your payment… goes away',
      n.body === 'success' &&
        b.subscription?.plan === 'yearly' &&
        Math.abs(new Date(until) - plus(bobPaid, 12)) < 60e3 &&
        a.text.includes(`Alipay time pack, ends ${asPage(until, 'en-US')}`) &&
        !(await bp.getByText('Confirming your payment…').count()),
      `${n.status} ${n.body} | ${a.text} | paid_until ${until}`,
    );
  });
} finally {
  fake(['fail', 'off']);
  fake(['notifications', 'on']);
  await browser.close();
}
const unexpected = consoleErrors.filter(([at, text]) => !expected[at]?.test(text));
for (const [at, text] of unexpected) console.log(`console error during ${at}: ${text}`);
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(`${failed} failed, ${unexpected.length} unexpected console errors`);
process.exit(failed || unexpected.length ? 1 : 0);
