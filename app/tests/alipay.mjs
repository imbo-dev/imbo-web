// TC-485 (docs/TEST.md): the Account page selling an Alipay time pack (FLOW-ALIPAY-PACK), against the local test server
// with billing on and the fake Watcha (§3「支付宝时长包」, seeded). The page must be http://localhost:5190 (`npm run dev`).
// It ends alice's trial itself and makes the fake take her payment, then prints PASS/FAIL per step and any console errors.
// Codes are read from $L/server.log and never printed; so is the ticket in a purchase link.
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
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, ' ').replace(/ticket=[^\s&]+/g, 'ticket=<ticket>')}` : ''}`;
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
const fake = (args) => execFileSync(`${root}crates/scripts/watcha-fake.py`, args, { encoding: 'utf8', env: { ...process.env, WATCHA_DIR: `${L}/watcha` } });
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
const expected = { 'login alice': /status of 401 / };
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
    // The purchase page is Watcha's, so it stands in for one, as the Waffo checkout does in gift.mjs.
    await page.route(/127\.0\.0\.1:18092/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>watcha purchase stand-in</p>' }));
    return page;
  };

  // alice's trial is over, so the page offers both ways to pay.
  serverCmd(['dev', 'age-account', ids.alice, '--days', '31']);

  const page = await context({ viewport: { width: 1440, height: 900 } });
  current = 'login alice';
  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');
  const { cookies } = await page.context().storageState();

  /** The Plan row as it shows: its words, and its buttons with where they sit. */
  const plan = async (p, label, waitFor, path = '/account') => {
    await p.goto(base + path);
    const row = p.locator('div', { has: p.getByRole('heading', { name: label, exact: true }) }).last();
    await (waitFor instanceof RegExp ? row.getByText(waitFor).waitFor() : row.getByRole('button', { name: waitFor }).waitFor());
    await wait(300);
    const buttons = await row.getByRole('button').evaluateAll((list) =>
      list.map((b) => {
        const r = b.getBoundingClientRect();
        return { name: b.textContent.trim(), l: Math.round(r.left), r: Math.round(r.right) };
      }),
    );
    return { text: (await row.innerText()).replace(/\s+/g, ' '), buttons };
  };

  await step('TC-485 #1', async () => {
    const a = await plan(page, 'Plan', 'Buy with Alipay');
    await page.screenshot({ path: `${out}/tc485-1.png` });
    const names = a.buttons.map((b) => b.name);
    ok(
      'TC-485 #1 inactive at 1440: a Buy with Alipay button, ¥15 a month or ¥150 a year under it, and Waffo\'s two buttons',
      names.includes('Buy with Alipay') &&
        a.text.includes("¥15 a month or ¥150 a year, paid with Alipay. It doesn't renew.") &&
        names.includes('$20 a year') &&
        names.includes('$2 a month'),
      `${a.text} | buttons: ${names.join(', ')}`,
    );
  });

  await step('TC-485 #2', async () => {
    const p = await context({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' }, cookies);
    const a = await plan(p, '套餐', '用支付宝购买');
    await p.screenshot({ path: `${out}/tc485-2.png` });
    ok('TC-485 #2 in Chinese: the button reads 用支付宝购买 and the line under it is Chinese too', a.text.includes('用支付宝购买') && a.text.includes('一个月 ¥15，一年 ¥150，用支付宝付。不自动续费。'), a.text);
    await p.context().close();
  });

  await step('TC-485 #3', async () => {
    await plan(page, 'Plan', 'Buy with Alipay');
    const [req] = await Promise.all([page.waitForRequest(/127\.0\.0\.1:18092/, { timeout: 20000 }), page.getByRole('button', { name: 'Buy with Alipay' }).click()]);
    ok('TC-485 #3 Buy with Alipay opens Watcha\'s purchase page', /127\.0\.0\.1:18092\/purchase\?ticket=/.test(req.url()), req.url());
  });

  let paidUntil;
  await step('TC-485 #4', async () => {
    fake(['pay', ids.alice, '--plan', 'monthly']);
    // Paying takes a person longer than this; the wait is for the server's one-ask-per-5-s per account (§15).
    await wait(6000);
    const a = await plan(page, 'Plan', /Alipay time pack/, '/account?paid=alipay');
    await page.screenshot({ path: `${out}/tc485-4.png` });
    const b = await page.evaluate(() => fetch('/v1/billing').then((r) => r.json()));
    paidUntil = b.subscription?.paid_until;
    ok(
      'TC-485 #4 back on /account?paid=alipay: Won\'t renew, Alipay time pack ending on the pack\'s date, and no buttons at all',
      b.subscription?.provider === 'alipay' && a.text.includes("Won't renew") && a.text.includes(`Alipay time pack, ends ${asPage(paidUntil, 'en-US')}`) && !a.buttons.length,
      `${a.text} | buttons: ${a.buttons.map((b2) => b2.name).join(', ') || 'none'} | paid_until ${paidUntil}`,
    );
  });

  await step('TC-485 #5', async () => {
    const a = await plan(page, 'Plan', /Alipay time pack/);
    ok('TC-485 #5 plain /account says the same, so the pack is recorded and not read off the address', a.text.includes(`Alipay time pack, ends ${asPage(paidUntil, 'en-US')}`) && !a.buttons.length, a.text);
  });

  await step('TC-485 #6', async () => {
    const p = await context({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' }, cookies);
    const a = await plan(p, 'Plan', /Alipay time pack/);
    await p.getByRole('heading', { name: 'Plan', exact: true }).scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${out}/tc485-6.png` });
    const box = await p.getByText(/Alipay time pack/).boundingBox();
    ok(
      'TC-485 #6 dark, 390 wide: the same words, the line inside the window',
      a.text.includes(`Alipay time pack, ends ${asPage(paidUntil, 'en-US')}`) && box.x >= 0 && box.x + box.width <= 390,
      `${a.text} | line ${Math.round(box.x)}–${Math.round(box.x + box.width)}`,
    );
    await p.context().close();
  });

  await step('TC-485 #7', async () => {
    const p = await context({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' }, cookies);
    const a = await plan(p, '套餐', /支付宝时长包/);
    await p.screenshot({ path: `${out}/tc485-7.png` });
    ok('TC-485 #7 in Chinese: 不再续订 and 支付宝时长包，<date> 结束 with the date written the Chinese way', a.text.includes('不再续订') && a.text.includes(`支付宝时长包，${asPage(paidUntil, 'zh-CN')} 结束`), a.text);
    await p.context().close();
  });
} finally {
  await browser.close();
}
const unexpected = consoleErrors.filter(([at, text]) => !expected[at]?.test(text));
for (const [at, text] of unexpected) console.log(`console error during ${at}: ${text}`);
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(`${failed} failed, ${unexpected.length} unexpected console errors`);
process.exit(failed || unexpected.length ? 1 : 0);
