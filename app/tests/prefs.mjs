// TC-567 (docs/TEST.md): pinning, marking unread and muting chats on the web against the local test server, started with
// `crates/scripts/local-env.sh up alice:bob,alice:carol`; the page must be http://localhost:5190 (`npm run dev`). Sets up
// the 前置 itself. Prints PASS/FAIL per step, then any unexpected console errors. Codes are read from $L/server.log and
// never printed.
// usage: node web/app/tests/prefs.mjs <screenshot dir>
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
const as = (who, args) => sh(`IMBO_HOME=$L/${who} "$IMBO" ${args}`);
const ids = Object.fromEntries(fs.readFileSync(`${L}/ids.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').slice(0, 2)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const token = (who) => fs.readFileSync(`${L}/${who}/credentials`, 'utf8').match(/^token = "(.*)"/m)[1];

const codeLines = (email) => fs.readFileSync(`${L}/server.log`, 'utf8').split('\n').filter((l) => l.includes('mail-log-only code=') && l.endsWith(`email=${email}`));
async function codeFor(email, after) {
  for (let i = 0; i < 50; i++) {
    const lines = codeLines(email);
    if (lines.length > after) return lines.at(-1).match(/code=(\d+)/)[1];
    await wait(200);
  }
  throw new Error(`no code for ${email}`);
}

// 前置: list from the top t567, carol, bob; carol and bob one unread each.
as('bob', `send ${ids.alice} 'T567 bob 一'`);
as('carol', `send ${ids.alice} 'T567 carol 一'`);
as('alice', 'group create t567');
as('alice', `group invite t567 ${ids.bob}`);
as('bob', 'group join t567');
const groups = await (await fetch('http://127.0.0.1:18080/v1/groups', { headers: { authorization: `Bearer ${token('bob')}` } })).json();
const g = groups.groups.find((x) => x.name === 't567').id;
as('bob', `send '#${g}' 'T567 群一'`);

const browser = await chromium.launch();
const step = async (id, fn) => {
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};

async function signIn(ctx) {
  const page = await ctx.newPage();
  // Expected: the 401 of /v1/me before signing in.
  page.on('console', (m) => m.type() === 'error' && !/status of 401 /.test(m.text()) && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');
  return page;
}

// A chat's row in the list, found by its title; the list from the top as titles.
const rowOf = (page, title) => page.getByRole('navigation', { name: 'Chats' }).locator('a', { has: page.locator('span.block.truncate.text-body', { hasText: new RegExp(`^${title}`) }) });
const order = (page) => page.getByRole('navigation', { name: 'Chats' }).locator('a span.block.truncate.text-body').evaluateAll((els) => els.map((e) => e.firstChild.textContent));
const menu = async (page, title) => {
  await rowOf(page, title).click({ button: 'right' });
  const items = await page.getByRole('menu').getByRole('menuitem').allInnerTexts();
  return items;
};
const pick = async (page, item) => {
  await page.getByRole('menu').getByRole('menuitem', { name: item, exact: true }).click();
  await wait(500);
};
// The count on the Chats tab; the tab's underline is rounded too, so the count is the one with figures.
const total = (page) => page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Chats/ }).locator('span.tabular-nums.rounded-full').allInnerTexts();
const bg = (loc) => loc.evaluate((el) => getComputedStyle(el).backgroundColor);
async function until(fn, ms = 10_000) {
  for (const end = Date.now() + ms; Date.now() < end; await wait(250)) if (await fn()) return true;
  return false;
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await signIn(ctx);
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
  // 前置: alice has read t567 up to T567 群一 (API-078), so only carol and bob have unread messages.
  await page.evaluate(async () => {
    const { conversations } = await (await fetch('/v1/conversations')).json();
    const c = conversations.find((x) => x.group?.name === 't567');
    await fetch(`/v1/conversations/${c.id}/read`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ up_to: c.last_message.id }) });
  });
  await page.reload();
  await rowOf(page, 'bob').waitFor();

  await step('1 right-click: Pin, Mark as read, Mute', async () => {
    const items = await menu(page, 'bob');
    await shot('01-menu');
    ok('1 right-click: Pin, Mark as read, Mute', items.join('|') === 'Pin|Mark as read|Mute', items.join(' | '));
  });
  await step('2 Pin: first, another background, pinned for screen readers, Unpin', async () => {
    await pick(page, 'Pin');
    const o = await order(page);
    const [mine, other] = [await bg(rowOf(page, 'bob')), await bg(rowOf(page, 'carol'))];
    const sr = await rowOf(page, 'bob').innerText();
    const items = await menu(page, 'bob');
    await page.keyboard.press('Escape');
    await shot('02-pinned');
    ok('2 Pin: first, another background, pinned for screen readers, Unpin', o[0] === 'bob' && mine !== other && /pinned/.test(sr) && items[0] === 'Unpin', `order ${o}; background ${mine} vs ${other}; menu ${items.join(' | ')}`);
  });
  await step('3 Mark as unread: a dot without a number', async () => {
    await menu(page, 't567');
    await pick(page, 'Mark as unread');
    const dot = await rowOf(page, 't567').getByText('Marked unread', { exact: true }).count();
    const badges = await rowOf(page, 't567').locator('span.tabular-nums.rounded-full').count();
    await shot('03-marked');
    ok('3 Mark as unread: a dot without a number', dot === 1 && badges === 0, `dot ${dot}; number badges ${badges}`);
  });
  await step('4 opening the chat takes the dot off', async () => {
    await rowOf(page, 't567').click();
    const gone = await until(async () => (await rowOf(page, 't567').getByText('Marked unread', { exact: true }).count()) === 0, 5_000);
    ok('4 opening the chat takes the dot off', gone, `dot gone ${gone}`);
  });
  await step('5 Mute: bell icon, grey count, left out of the total', async () => {
    const before = await total(page);
    const red = await bg(rowOf(page, 'carol').locator('span.tabular-nums.rounded-full'));
    await menu(page, 'carol');
    await pick(page, 'Mute');
    const icon = await rowOf(page, 'carol').locator('svg title', { hasText: 'Muted' }).count();
    const grey = await bg(rowOf(page, 'carol').locator('span.tabular-nums.rounded-full'));
    const after = await total(page);
    await shot('05-muted');
    ok('5 Mute: bell icon, grey count, left out of the total', icon === 1 && grey !== red && /^2/.test(before[0]) && /^1/.test(after[0]), `icon ${icon}; count ${red} → ${grey}; total ${before} → ${after}`);
  });
  await step('6 a second window sees the same, and its Unpin comes back here', async () => {
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const other = await signIn(ctx2);
    await rowOf(other, 'bob').waitFor();
    const o = await order(other);
    const icon = await rowOf(other, 'carol').locator('svg title', { hasText: 'Muted' }).count();
    await menu(other, 'bob');
    await pick(other, 'Unpin');
    const back = await until(async () => (await order(page)).at(-1) === 'bob');
    await ctx2.close();
    ok('6 a second window sees the same, and its Unpin comes back here', o[0] === 'bob' && icon === 1 && back, `there ${o}, muted icon ${icon}; here now ${await order(page)}`);
  });
  await step('7 Mark as read: the count and the total go', async () => {
    await menu(page, 'bob');
    await pick(page, 'Mark as read');
    const badges = await rowOf(page, 'bob').locator('span.tabular-nums.rounded-full').count();
    const t = await total(page);
    ok('7 Mark as read: the count and the total go', badges === 0 && t.length === 0, `badges ${badges}; total ${t}`);
  });
  await step('8 at 390×844 a touch held 0.8 s opens the same menu, on screen', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/chats');
    const row = rowOf(page, 't567');
    await row.waitFor();
    const b = await row.boundingBox();
    await row.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, button: 0, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 });
    await wait(800);
    const items = await page.getByRole('menu').getByRole('menuitem').allInnerTexts();
    const m = await page.getByRole('menu').boundingBox();
    await shot('08-phone');
    ok('8 at 390×844 a touch held 0.8 s opens the same menu, on screen', items.join('|') === 'Pin|Mark as unread|Mute' && m && m.x >= 0 && m.x + m.width <= 390 && m.y + m.height <= 844, `${items.join(' | ')}; menu ${m && [m.x, m.y, m.width, m.height].map(Math.round)}`);
  });
  await step('9 marked unread again after it was read here, opening it takes the dot off', async () => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(base + '/chats');
    await rowOf(page, 'carol').click();
    await menu(page, 't567');
    await pick(page, 'Mark as unread');
    const on = await rowOf(page, 't567').getByText('Marked unread', { exact: true }).count();
    await rowOf(page, 't567').click();
    const gone = await until(async () => (await rowOf(page, 't567').getByText('Marked unread', { exact: true }).count()) === 0, 5_000);
    ok('9 marked unread again after it was read here, opening it takes the dot off', on === 1 && gone, `dot before ${on}; gone ${gone}`);
  });
} finally {
  await browser.close();
}
console.log(checks.join('\n'));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : '\nno console errors');
