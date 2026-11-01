// TC-482 (docs/TEST.md): the Account page with a gift (ADR-060), against the local test server with billing on (§3「开计费」,
// seeded). The page must be http://localhost:5190 (`npm run dev`). It records alice's gift itself, then prints PASS/FAIL per
// step and any console errors. Codes are read from $L/server.log and never printed.
// usage: node web/app/tests/gift.mjs <screenshot dir>
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
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, ' ')}` : ''}`;
  checks.push(line);
  console.log(line);
};
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
    return page;
  };
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

  // The Plan row as it shows: its words, its buttons with where they sit, and whether Manage subscription is there.
  const plan = async (p, label, button) => {
    await p.goto(base + '/account');
    const row = p.locator('div', { has: p.getByRole('heading', { name: label, exact: true }) }).last();
    await row.getByRole('button', { name: button }).waitFor();
    await wait(300);
    const buttons = await row.getByRole('button').evaluateAll((list) =>
      list.map((b) => {
        const r = b.getBoundingClientRect();
        return { name: b.textContent.trim(), l: Math.round(r.left), r: Math.round(r.right) };
      }),
    );
    return { text: (await row.innerText()).replace(/\s+/g, ' '), buttons };
  };

  await step('TC-482 #1', async () => {
    const gifted = execFileSync('uv', ['run', '-q', `${root}mobile/tests/app-db.py`, 'gift', 'alice@imbo.test'], { encoding: 'utf8' }).trim();
    const b = await page.evaluate(() => fetch('/v1/billing').then((r) => r.json()));
    ok(
      'TC-482 #1 alice gets a gift; her web sign-in reads access paid until 2036-11-01T15:59:59Z, the subscription a gift',
      gifted === 'gifted 1' && b.access?.state === 'paid' && b.access?.until === '2036-11-01T15:59:59Z' && b.subscription?.provider === 'gift' && b.subscription?.paid_until === '2036-11-01T15:59:59Z',
      `${gifted}; ${JSON.stringify({ access: b.access, subscription: b.subscription })}`,
    );
  });
  await step('TC-482 #2', async () => {
    const a = await plan(page, 'Plan', '$20 a year');
    await page.screenshot({ path: `${out}/tc482-2.png` });
    const names = a.buttons.map((b) => b.name);
    ok(
      'TC-482 #2 the Account page at 1440: "Gifted until Nov 1, 2036", the $20 a year and $2 a month buttons and the Test mode note; no Manage subscription, no Won\'t renew',
      a.text.includes('Gifted until Nov 1, 2036') && names.includes('$20 a year') && names.includes('$2 a month') && a.text.includes('Test mode') && !a.text.includes('Manage subscription') && !a.text.includes("Won't renew"),
      `${a.text} | buttons: ${names.join(', ')}`,
    );
  });
  await step('TC-482 #3', async () => {
    const p = await context({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' }, cookies);
    const a = await plan(p, 'Plan', '$20 a year');
    await p.getByRole('heading', { name: 'Plan', exact: true }).scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${out}/tc482-3.png` });
    const outside = a.buttons.filter((b) => b.l < 0 || b.r > 390);
    ok(
      'TC-482 #3 dark, 390 wide: the same words and buttons, every button inside the window',
      a.text.includes('Gifted until Nov 1, 2036') && a.buttons.length >= 2 && !outside.length && !a.text.includes('Manage subscription'),
      `${a.text} | buttons: ${a.buttons.map((b) => `${b.name} ${b.l}–${b.r}`).join(', ')}`,
    );
    await p.context().close();
  });
  await step('TC-482 #4', async () => {
    const p = await context({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' }, cookies);
    const a = await plan(p, '套餐', '每年 $20');
    await p.screenshot({ path: `${out}/tc482-4.png` });
    ok('TC-482 #4 in Chinese: "赠送到 2036年11月1日" and the two buttons', a.text.includes('赠送到 2036年11月1日') && a.buttons.length >= 2 && !a.text.includes('管理订阅'), `${a.text} | buttons: ${a.buttons.map((b) => b.name).join(', ')}`);
    await p.context().close();
  });
  await step('TC-482 #5', async () => {
    // The server makes a real Waffo test checkout; the page it leads to is stubbed, as in live.mjs.
    await plan(page, 'Plan', '$2 a month');
    await page.route(/pancake\.waffo\.ai/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>waffo checkout stand-in</p>' }));
    const [nav] = await Promise.all([page.waitForRequest(/pancake\.waffo\.ai/, { timeout: 20000 }), page.getByRole('button', { name: '$2 a month' }).click()]);
    ok('TC-482 #5 $2 a month opens a Waffo checkout page', /pancake\.waffo\.ai\/store\/[^/]+\/checkout\/cs_/.test(nav.url()), nav.url().replace(/#.*/, ''));
  });
} finally {
  await browser.close();
}
const unexpected = consoleErrors.filter(([at, text]) => !expected[at]?.test(text));
for (const [at, text] of unexpected) console.log(`console error during ${at}: ${text}`);
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(`${failed} failed, ${unexpected.length} unexpected console errors`);
process.exit(failed || unexpected.length ? 1 : 0);
