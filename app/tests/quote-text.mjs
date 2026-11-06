// TC-596 (docs/TEST.md): replying to a passage selected in a message on the web, against the local test server started
// with `crates/scripts/local-env.sh up alice:bob`; the page must be http://localhost:5190 (`npm run dev`). Sets up the
// 前置 itself: bob sends T596 今天先发安卓,明天发 iPhone, T596 另一条 and T596 长 with 600 「字」. Prints PASS/FAIL per
// step, then any unexpected console errors. Codes are read from $L/server.log and never printed.
// usage: node web/app/tests/quote-text.mjs <screenshot dir>
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
const as = (who, args) => sh(`IMBO_HOME=$L/${who} "$IMBO" ${args} 2>&1`);
const ids = Object.fromEntries(fs.readFileSync(`${L}/ids.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').slice(0, 2)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// API-024 as alice's terminal.
const message = (id) =>
  JSON.parse(sh(`curl -s --noproxy '*' -H "authorization: Bearer $(sed -n 's/^token = \"\\(.*\\)\"/\\1/p' $L/alice/credentials)" http://127.0.0.1:18080/v1/messages/${id}`)).message;

const codeLines = (email) => fs.readFileSync(`${L}/server.log`, 'utf8').split('\n').filter((l) => l.includes('mail-log-only code=') && l.endsWith(`email=${email}`));
async function codeFor(email, after) {
  for (let i = 0; i < 50; i++) {
    const lines = codeLines(email);
    if (lines.length > after) return lines.at(-1).match(/code=(\d+)/)[1];
    await wait(200);
  }
  throw new Error(`no code for ${email}`);
}

const ORIGINAL = 'T596 今天先发安卓,明天发 iPhone';
const LONG = `T596 长${'字'.repeat(600)}`;
as('bob', `send ${ids.alice} '${ORIGINAL}'`);
as('bob', `send ${ids.alice} 'T596 另一条'`);
as('bob', `send ${ids.alice} '${LONG}'`);

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
  const page = await ctx.newPage();
  // Expected: the 401 of /v1/me before signing in.
  page.on('console', (m) => m.type() === 'error' && !/status of 401 /.test(m.text()) && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
  const composer = () => page.locator('textarea.composer');
  const row = (text) => page.locator('article', { has: page.locator('p[data-body]', { hasText: new RegExp(`^${text}$`) }) });
  const bar = () => page.getByText(/^Replying to /);
  // Hover first: the button shows on hover, as a person would reach it.
  const reply = async (text) => {
    await row(text).locator('header').hover();
    await row(text).getByRole('button', { name: 'Reply', exact: true }).click();
    await bar().waitFor();
  };
  // Selects from character `from` of the body of the message whose text is `text` to character `to` of it, or of the
  // body of the message whose text is `into`: a drag, which may run backwards.
  const select = (text, from, to, into = text) =>
    page.evaluate(
      ([text, from, to, into]) => {
        const body = (t) => [...document.querySelectorAll('p[data-body]')].find((p) => p.textContent === t).firstChild;
        getSelection().setBaseAndExtent(body(text), from, body(into), to);
        return getSelection().toString();
      },
      [text, from, to, into]
    );
  const send = async (body) => {
    await composer().fill(body);
    await composer().press('Enter');
    await page.locator(`article[data-message]`, { has: page.locator('p[data-body]', { hasText: new RegExp(`^${body}$`) }) }).waitFor();
    return Number(await row(body).getAttribute('data-message'));
  };

  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');
  await page.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: /bob/ }).click();
  await row(ORIGINAL).waitFor();

  await step('1 a selected passage goes above the box, focus in the box', async () => {
    const picked = await select(ORIGINAL, ORIGINAL.indexOf('明天'), ORIGINAL.length);
    await reply(ORIGINAL);
    const text = await bar().innerText();
    const focused = await composer().evaluate((el) => document.activeElement === el);
    await shot('01-passage');
    ok('1 a selected passage goes above the box, focus in the box', picked === '明天发 iPhone' && text === 'Replying to bob: 明天发 iPhone' && focused, `selected "${picked}"; ${text}; focused ${focused}`);
  });
  await step('2 sent: the grey line is the passage, quote.text too', async () => {
    const id = await send('T596 好');
    const line = await row('T596 好').locator('[data-testid^="quote-"]').innerText();
    const q = message(id).quote;
    await shot('02-sent');
    ok('2 sent: the grey line is the passage, quote.text too', line === 'bob: 明天发 iPhone' && q.text === '明天发 iPhone', `"${line}"; ${JSON.stringify(q)}`);
  });
  await step('3 all of the body selected: the whole message, no text', async () => {
    await select(ORIGINAL, 0, ORIGINAL.length);
    await reply(ORIGINAL);
    const text = await bar().innerText();
    const id = await send('T596 整条');
    const q = message(id).quote;
    ok('3 all of the body selected: the whole message, no text', text === `Replying to bob: ${ORIGINAL}` && !('text' in q), `${text}; ${JSON.stringify(q)}`);
  });
  await step('4 a selection across messages: the whole message', async () => {
    await select('T596 另一条', 0, 4, ORIGINAL);
    await reply('T596 另一条');
    const text = await bar().innerText();
    ok('4 a selection across messages: the whole message', text === 'Replying to bob: T596 另一条', text);
    await composer().press('Escape');
  });
  await step('5 selected, then a click elsewhere: the whole message', async () => {
    await select('T596 另一条', 5, 7);
    // The blank beside the bubble, in the same row.
    const b = await row('T596 另一条').boundingBox();
    await page.mouse.click(b.x + b.width - 16, b.y + b.height - 8);
    const left = await page.evaluate(() => getSelection().toString());
    await reply('T596 另一条');
    const text = await bar().innerText();
    ok('5 selected, then a click elsewhere: the whole message', left === '' && text === 'Replying to bob: T596 另一条', `left selected "${left}"; ${text}`);
    await composer().press('Escape');
  });
  await step('6 520 characters selected: quote.text is the first 500', async () => {
    await row(LONG).scrollIntoViewIfNeeded();
    await select(LONG, 6, 6 + 520);
    await reply(LONG);
    const id = await send('T596 长的');
    const q = message(id).quote;
    ok('6 520 characters selected: quote.text is the first 500', q.text === '字'.repeat(500), `text has ${[...(q.text ?? '')].length} characters`);
  });
  await step('7 at 390×844 the line and its close fit, no sideways scroll', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(page.url());
    await row('T596 另一条').waitFor();
    await select('T596 另一条', 5, 7);
    await reply('T596 另一条');
    const text = await bar().innerText();
    const fits = async (loc) => {
      const b = await loc.boundingBox();
      return b && b.x >= 0 && b.x + b.width <= 390;
    };
    const barFits = await fits(bar());
    const closeFits = await fits(page.getByRole('button', { name: 'Stop replying' }));
    const sideways = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth);
    await shot('07-phone');
    ok('7 at 390×844 the line and its close fit, no sideways scroll', text === 'Replying to bob: 另一' && barFits && closeFits && !sideways, `${text}; line ${barFits}; close ${closeFits}; sideways ${sideways}`);
  });
} finally {
  await browser.close();
}
console.log(checks.join('\n'));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : '\nno console errors');
