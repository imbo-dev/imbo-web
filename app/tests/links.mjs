// TC-556 and TC-558 (docs/TEST.md): addresses in messages as links, and the full-screen picture closed by a click on the
// space around it, against the local test server. Setup is the TCs' 前置; the page must be http://localhost:5190
// (`npm run dev`) and T531-small.png in ~/.cache/imbo-test/media. Requests to imbo.dev and en.wikipedia.org get a stub
// reply here, so nothing leaves the machine. Prints PASS/FAIL per step, then any console errors the steps don't expect.
// Codes are read from $L/server.log and never printed.
// usage: node web/app/tests/links.mjs <screenshot dir>
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const crates = new URL('../../../crates/', import.meta.url).pathname;
const base = 'http://localhost:5190';
const api = 'http://127.0.0.1:18080';
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
const token = (who) => fs.readFileSync(`${L}/${who}/credentials`, 'utf8').match(/^token = "(.*)"/m)[1];
const as = (who, ...args) =>
  execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; IMBO_HOME=$L/${who} "$IMBO" "$@"`, 'sh', ...args], { encoding: 'utf8' });

// 前置: bob's message with the addresses, from his terminal to alice's inbox; then his picture (API-026, API-015).
const T556 = 'T556 看 https://imbo.dev/docs。另见 (https://en.wikipedia.org/wiki/Foo_(bar)) javascript:alert(1) www.imbo.dev';
as('bob', 'send', 'alice', T556);
const png = fs.readFileSync(`${os.homedir()}/.cache/imbo-test/media/T531-small.png`);
const up = await fetch(`${api}/v1/files`, {
  method: 'POST',
  body: png,
  headers: {
    authorization: `Bearer ${token('bob')}`,
    'content-type': 'application/octet-stream',
    'imbo-file-name': 'T531-small.png',
    'imbo-file-sha256': createHash('sha256').update(png).digest('hex'),
  },
});
const picture = (await up.json()).file.id;
const sent = await fetch(`${api}/v1/messages`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token('bob')}`, 'content-type': 'application/json' },
  body: JSON.stringify({ to: 'alice', body: 'T558 picture', client_msg_id: 'T558 picture', files: [picture] }),
});
if (!sent.ok) throw new Error(`bob's picture: ${sent.status}`);

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
const browser = await chromium.launch();
const step = async (name, fn) => {
  current = name;
  try {
    await fn();
  } catch (e) {
    ok(name, false, e.message.split('\n')[0]);
  }
};

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
  await ctx.route(/^https:\/\/(imbo\.dev|en\.wikipedia\.org)\//, (r) => r.fulfill({ contentType: 'text/html', body: '<title>stub</title>' }));
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push([current, m.text()]));
  page.on('pageerror', (e) => consoleErrors.push([current, `pageerror: ${e.message}`]));
  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
  const t = (name) => page.getByTestId(name);
  const article = (text) => page.locator('main article', { hasText: text }).first();
  // The links in a message, as the page has them: text, address, target, rel, colour, underline.
  const linksIn = (text) =>
    article(text)
      .locator('a')
      .evaluateAll((as) =>
        as.map((a) => {
          const c = getComputedStyle(a);
          return { text: a.textContent, href: a.getAttribute('href'), target: a.target, rel: a.rel, color: c.color, line: c.textDecorationLine };
        })
      );
  // A token's colour as the page computes it.
  const tokenColor = (name) =>
    page.evaluate((v) => {
      const e = document.createElement('span');
      e.style.color = `var(${v})`;
      document.body.append(e);
      const c = getComputedStyle(e).color;
      e.remove();
      return c;
    }, name);
  const composer = () => page.locator('textarea.composer');

  await step('TC-556 #1', async () => {
    await page.getByRole('navigation', { name: /Chats|对话/ }).getByRole('link', { name: /^bob/ }).first().click();
    await article('T556').waitFor();
    const links = await linksIn('T556');
    await shot('tc556-1');
    const want = ['https://imbo.dev/docs', 'https://en.wikipedia.org/wiki/Foo_(bar)'];
    ok(
      'TC-556 #1 two links, the 。 and the outer ) left out; javascript: and www. stay text',
      links.length === 2 &&
        links.every((l, i) => l.text === want[i] && l.href === want[i] && l.target === '_blank' && l.rel === 'noopener noreferrer' && l.line === 'underline'),
      JSON.stringify(links.map(({ color, ...l }) => l))
    );
  });

  await step('TC-556 #2', async () => {
    const [link] = await linksIn('T556');
    const want = await tokenColor('--semantic-color-text-link');
    ok('TC-556 #2 the colour is --semantic-color-text-link', link.color === want, `${link.color}, token ${want}`);
  });

  await step('TC-556 #3', async () => {
    const [tab] = await Promise.all([ctx.waitForEvent('page'), article('T556').getByRole('link', { name: 'https://imbo.dev/docs' }).click()]);
    await tab.waitForLoadState();
    const at = tab.url();
    await tab.close();
    const still = await article('T556').isVisible();
    ok('TC-556 #3 a new tab opens the address; this page stays on the chat', at === 'https://imbo.dev/docs' && still, at);
  });

  await step('TC-556 #4', async () => {
    await composer().fill('T556 mine https://imbo.dev/pricing.');
    await composer().press('Enter');
    await article('T556 mine').waitFor();
    await page.waitForFunction(() => !document.body.innerText.includes('Sending…'), null, { timeout: 6000 });
    const links = await linksIn('T556 mine');
    const want = await tokenColor('--semantic-color-text-link-on-action');
    await shot('tc556-4');
    ok(
      'TC-556 #4 my own bubble: the link without the final ., in --semantic-color-text-link-on-action',
      links.length === 1 && links[0].href === 'https://imbo.dev/pricing' && links[0].text === 'https://imbo.dev/pricing' && links[0].color === want,
      `${JSON.stringify(links)}, token ${want}`
    );
  });

  await step('TC-556 #5', async () => {
    await page.getByRole('button', { name: 'Select messages' }).click();
    const box = await article('T556').getByRole('link', { name: 'https://imbo.dev/docs' }).boundingBox();
    let opened = false;
    const seen = () => (opened = true);
    ctx.on('page', seen);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await wait(1000);
    ctx.off('page', seen);
    const picked = await page.getByRole('checkbox', { checked: true }).count();
    const title = await page.getByText('1 selected').count();
    await shot('tc556-5');
    ok('TC-556 #5 picking: a click on the link picks the row, no new tab', picked === 1 && title === 1 && !opened, `checked ${picked}, "1 selected" ${title}, new tab ${opened}`);
    await page.keyboard.press('Escape');
  });

  // ── TC-558 ──
  const stage = () => t('file-viewer-stage');
  const img = () => t('file-viewer').locator('img');
  const open = async () => {
    await t(`file-thumb-${picture}`).click();
    await t('file-viewer').waitFor();
    await img().waitFor();
    await wait(300);
  };
  const isOpen = async () => (await t('file-viewer').count()) > 0;

  await step('TC-558 #1', async () => {
    await page.goto(base + '/chats');
    await page.getByRole('navigation', { name: /Chats|对话/ }).getByRole('link', { name: /^bob/ }).first().click();
    await article('T558 picture').waitFor();
    await t(`file-thumb-${picture}`).scrollIntoViewIfNeeded();
    await open();
    const b = await img().boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await wait(500);
    await shot('tc558-1');
    ok('TC-558 #1 a click on the picture keeps it open', await isOpen());
  });

  // At 1280×800 the 4:3 picture fills the stage's height: the blank space is beside it.
  await step('TC-558 #2', async () => {
    const b = await img().boundingBox();
    const s = await stage().boundingBox();
    await page.mouse.click((s.x + b.x) / 2, b.y + b.height / 2);
    await t('file-viewer').waitFor({ state: 'detached', timeout: 3000 });
    ok('TC-558 #2 a click left of the picture closes it', !(await isOpen()), `clicked at x=${Math.round((s.x + b.x) / 2)}, picture from x=${Math.round(b.x)}`);
  });

  await step('TC-558 #3', async () => {
    await open();
    const b = await img().boundingBox();
    const s = await stage().boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move((s.x + b.x) / 2, b.y + b.height / 2, { steps: 10 });
    await page.mouse.up();
    await wait(500);
    ok('TC-558 #3 a drag that ends off the picture keeps it open', await isOpen());
  });

  await step('TC-558 #4', async () => {
    const b = await img().boundingBox();
    await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
    await wait(600);
    const z = await img().boundingBox();
    await page.mouse.move(z.x + z.width / 2, 400);
    await page.mouse.down();
    await page.mouse.move(z.x + z.width / 2 - 200, 300, { steps: 10 });
    await page.mouse.up();
    await wait(500);
    await shot('tc558-4');
    ok('TC-558 #4 zoomed in and dragged: still open', z.width > b.width * 1.5 && (await isOpen()), `width ${Math.round(b.width)} -> ${Math.round(z.width)}`);
  });

  await step('TC-558 #5', async () => {
    await page.keyboard.press('Escape');
    await t('file-viewer').waitFor({ state: 'detached', timeout: 3000 });
    ok('TC-558 #5 Esc closes it', !(await isOpen()));
  });
} finally {
  await browser.close();
}
// Signing in asks for the account before there is one: 401 (as in bubbles.mjs).
const unexpected = consoleErrors.filter(([at, text]) => !(at === 'login' && /status of 401 /.test(text)));
for (const [at, text] of unexpected) console.log(`console error during ${at}: ${text}`);
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(`${failed} failed, ${unexpected.length} unexpected console errors`);
process.exit(failed || unexpected.length ? 1 : 0);
