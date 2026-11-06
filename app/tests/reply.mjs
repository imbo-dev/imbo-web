// TC-564 (docs/TEST.md): replying on the web against the local test server, started with
// `crates/scripts/local-env.sh up alice:bob`; the page must be http://localhost:5190 (`npm run dev`). Sets up the 前置 itself:
// bob sends T564 第一条 and 60 fillers, 29 a minute under the rate limit (about 2 minutes). Prints PASS/FAIL per step,
// then any unexpected console errors. Codes are read from $L/server.log and never printed.
// usage: node web/app/tests/reply.mjs <screenshot dir>
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
const ok = (name, cond, detail = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, ' ')}` : ''}`);
const sh = (cmd) => execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8' });
// The CLI writes "✓ Sent #N …" to stderr.
const as = (who, args) => sh(`IMBO_HOME=$L/${who} "$IMBO" ${args} 2>&1`);
const ids = Object.fromEntries(fs.readFileSync(`${L}/ids.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').slice(0, 2)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sentId = (line) => Number(/Sent #(\d+)/.exec(line)[1]);
// API-015 as alice's terminal.
const aliceSends = (req) =>
  JSON.parse(
    sh(
      `curl -s --noproxy '*' -X POST -H "authorization: Bearer $(sed -n 's/^token = \"\\(.*\\)\"/\\1/p' $L/alice/credentials)" -H 'content-type: application/json' -d '${JSON.stringify(req)}' http://127.0.0.1:18080/v1/messages`
    )
  );

const codeLines = (email) => fs.readFileSync(`${L}/server.log`, 'utf8').split('\n').filter((l) => l.includes('mail-log-only code=') && l.endsWith(`email=${email}`));
async function codeFor(email, after) {
  for (let i = 0; i < 50; i++) {
    const lines = codeLines(email);
    if (lines.length > after) return lines.at(-1).match(/code=(\d+)/)[1];
    await wait(200);
  }
  throw new Error(`no code for ${email}`);
}

// 前置: bob's first message, then 60 more, so the first isn't on the newest page.
const first = sentId(as('bob', `send ${ids.alice} 'T564 第一条'`));
for (let n = 1; n <= 60; n++) {
  if (n % 29 === 0) await wait(61_000);
  as('bob', `send ${ids.alice} 'T564 填充 ${n}'`);
}

const browser = await chromium.launch();
const step = async (id, fn) => {
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const page = await ctx.newPage();
  // Expected: the 401 of /v1/me before signing in.
  page.on('console', (m) => m.type() === 'error' && !/status of 401 /.test(m.text()) && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
  const composer = () => page.locator('textarea.composer');
  const row = (text) => page.locator('article', { has: page.locator('p', { hasText: new RegExp(`^${text}$`) }) });
  const replyButton = (text) => row(text).getByRole('button', { name: 'Reply', exact: true });
  const bar = () => page.getByText(/^Replying to /);
  const opacity = (loc) => loc.evaluate((el) => Number(getComputedStyle(el).opacity));

  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');

  await step('1 hover shows Reply, leaving hides it', async () => {
    await page.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: /bob/ }).click();
    await row('T564 填充 60').waitFor();
    await row('T564 填充 60').locator('p').hover();
    await wait(300);
    const on = await opacity(replyButton('T564 填充 60'));
    await composer().hover();
    await wait(300);
    const off = await opacity(replyButton('T564 填充 60'));
    ok('1 hover shows Reply, leaving hides it', on === 1 && off === 0, `opacity ${on} on hover, ${off} after`);
  });
  await step('2 right-click: Reply and Copy', async () => {
    await row('T564 填充 60').locator('header').click({ button: 'right' });
    const items = await page.getByRole('menu').getByRole('menuitem').allInnerTexts();
    await shot('02-menu');
    ok('2 right-click: Reply and Copy', items.join('|') === 'Reply|Copy', items.join(' | '));
  });
  await step('3 Reply: the line above the box, focus in the box', async () => {
    await page.getByRole('menu').getByRole('menuitem', { name: 'Reply' }).click();
    await bar().waitFor();
    const text = await bar().innerText();
    const close = await page.getByRole('button', { name: 'Stop replying' }).isVisible();
    const focused = await composer().evaluate((el) => document.activeElement === el);
    await shot('03-replying');
    ok('3 Reply: the line above the box, focus in the box', text === 'Replying to bob: T564 填充 60' && close && focused, `${text}; close ${close}; focused ${focused}`);
  });
  await step('4 Esc lets go, the text stays', async () => {
    await composer().pressSequentially('T564 草稿');
    await composer().press('Escape');
    await wait(200);
    const gone = (await bar().count()) === 0;
    const value = await composer().inputValue();
    ok('4 Esc lets go, the text stays', gone && value === 'T564 草稿', `bar gone ${gone}; box "${value}"`);
  });
  await step('5 a reply goes out with its quoted line', async () => {
    await composer().fill('');
    await row('T564 填充 60').locator('p').hover();
    await replyButton('T564 填充 60').click();
    await bar().waitFor();
    await composer().fill('T564 回复');
    await composer().press('Enter');
    await row('T564 回复').waitFor();
    const quote = await row('T564 回复').locator('[data-testid^="quote-"]').innerText();
    const gone = (await bar().count()) === 0;
    ok('5 a reply goes out with its quoted line', gone && quote === 'bob: T564 填充 60', `bar gone ${gone}; quoted "${quote}"`);
  });
  await step('6 replying to my own message', async () => {
    await row('T564 回复').locator('p').hover();
    await replyButton('T564 回复').click();
    await composer().fill('T564 回自己');
    await composer().press('Enter');
    await row('T564 回自己').waitFor();
    const quote = await row('T564 回自己').locator('[data-testid^="quote-"]').innerText();
    await shot('06-replies');
    ok('6 replying to my own message', quote === 'alice: T564 回复', `quoted "${quote}"`);
  });
  await step('7 the quoted line jumps back to the first message', async () => {
    const r = aliceSends({ to: ids.bob, body: 'T564 跳回', client_msg_id: `t564-7-${Date.now()}`, quote: first });
    await row('T564 跳回').waitFor({ timeout: 20_000 });
    const loaded = await row('T564 第一条').count();
    await row('T564 跳回').locator('[data-testid^="quote-"]').click();
    await row('T564 第一条').waitFor();
    await wait(400);
    const flash = await row('T564 第一条').evaluate((el) => el.classList.contains('reply-flash'));
    await wait(800);
    const inView = await row('T564 第一条').evaluate((el) => {
      const b = el.getBoundingClientRect();
      const pane = el.closest('.scroll-pane').getBoundingClientRect();
      return b.top >= pane.top && b.bottom <= pane.bottom;
    });
    await shot('07-jumped');
    ok('7 the quoted line jumps back to the first message', r.message_id && loaded === 0 && flash && inView, `#${r.message_id}; loaded before ${loaded}; flash ${flash}; in view ${inView}`);
  });
  await step('8 no Reply while picking messages to share', async () => {
    await page.getByRole('button', { name: 'Select messages' }).click();
    await page.getByText('Pick messages to share').waitFor();
    // While picking, the row is inert: the pointer lands on the picking row around it, as a person's would.
    await row('T564 填充 59').hover({ force: true });
    const buttons = await row('T564 填充 59').getByRole('button', { name: 'Reply', exact: true }).count();
    await row('T564 填充 59').click({ button: 'right', force: true });
    await wait(300);
    const menus = await page.getByRole('menu').count();
    await page.keyboard.press('Escape');
    ok('8 no Reply while picking messages to share', buttons === 0 && menus === 0, `${buttons} Reply buttons; ${menus} menus`);
  });
  await step('9 at 390×844 the line and its close fit, no sideways scroll', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(page.url());
    await row('T564 填充 60').waitFor();
    await row('T564 填充 60').locator('header').click({ button: 'right' });
    await page.getByRole('menu').getByRole('menuitem', { name: 'Reply' }).click();
    await bar().waitFor();
    const fits = async (loc) => {
      const b = await loc.boundingBox();
      return b && b.x >= 0 && b.x + b.width <= 390;
    };
    const barFits = await fits(bar());
    const closeFits = await fits(page.getByRole('button', { name: 'Stop replying' }));
    const sideways = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth);
    await shot('09-phone');
    ok('9 at 390×844 the line and its close fit, no sideways scroll', barFits && closeFits && !sideways, `line ${barFits}; close ${closeFits}; sideways ${sideways}`);
  });
} finally {
  await browser.close();
}
console.log(checks.join('\n'));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : '\nno console errors');
