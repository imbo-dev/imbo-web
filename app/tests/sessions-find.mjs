// TC-648 (docs/TEST.md): the web session list puts the session talked to last on top and finds sessions by session, tool
// or computer name, against the local test server, started with `crates/scripts/local-env.sh up alice:bob,alice:carol` and
// seeded with `sh web/app/tests/seed.sh`; the page must be http://localhost:5190 (`npm run dev`). Registers t648-agy and
// t648-codex itself. Prints PASS/FAIL per step, then any unexpected console errors. Codes are read from $L/server.log and
// never printed.
// usage: node web/app/tests/sessions-find.mjs <screenshot dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const crates = new URL('../../../crates/', import.meta.url).pathname;
const logos = new URL('../src/assets/logos/', import.meta.url).pathname;
const base = 'http://localhost:5190';
const L = '/tmp/imbo-t';
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const errors = [];
const checks = [];
const ok = (name, cond, detail = '') => {
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, ' ')}` : ''}`;
  checks.push(line);
  console.log(line);
};
const sh = (cmd) => execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8' });
const as = (who, args) => sh(`IMBO_HOME=$L/${who} "$IMBO" ${args} 2>&1`);
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
const step = async (id, fn) => {
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};
// The first path of a mark as the page's source has it.
const pathOf = (file) => fs.readFileSync(logos + file, 'utf8').match(/<path d="([^"]+)"/)[1];

// 前置: the two online sessions of this case.
as('alice', 'dev fake-session 64800000-0000-0000-0000-000000648001 --title t648-agy --tool antigravity');
as('alice', 'dev fake-session 64800000-0000-0000-0000-000000648002 --title t648-codex --tool codex');

// A tool open on this machine adds its sessions to alice's (her daemon lists every running Antigravity CLI): those are
// kept out of the checks and named at the end.
const mine = ['checkout', 'docs-site', 't648-agy', 't648-codex'];
const others = new Set();

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
  const page = await ctx.newPage();
  // What the page asks the server for from step 4 on that carries what was typed. Only /v1: the dev server hands out the
  // page's own files by name, antigravity-color.svg among them.
  const asked = [];
  let typing = false;
  const typed = ['CODEX', 'antigravity', 'zzz'];
  const watch = (p) => {
    // Expected: the 401 of /v1/me before signing in.
    p.on('console', (m) => m.type() === 'error' && !/status of 401 /.test(m.text()) && errors.push(`console: ${m.text()}`));
    p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    p.on('request', (r) => {
      const u = decodeURIComponent(r.url());
      if (typing && new URL(r.url()).pathname.startsWith('/v1/') && typed.some((x) => u.includes(x))) asked.push(u);
    });
  };
  watch(page);
  const shot = (n, p = page) => p.screenshot({ path: `${out}/${n}.png` });
  const list = (p = page) => p.locator('nav:has(a[href^="/sessions/"])');
  // The rows of this case on screen from the top: name and the time at the end.
  const rows = async (p = page) => {
    const all = await p.locator('nav a[href^="/sessions/"]').evaluateAll((as) =>
      as
        .filter((a) => a.checkVisibility())
        .map((a) => ({
          title: a.querySelector('span.block.truncate.text-body').textContent,
          time: a.querySelector('time')?.textContent ?? '',
        })));
    all.filter((r) => !mine.includes(r.title)).forEach((r) => others.add(r.title));
    return all.filter((r) => mine.includes(r.title));
  };
  const titles = async (p = page) => (await rows(p)).map((r) => r.title);
  const box = () => page.getByRole('searchbox', { name: 'Search sessions' });
  const rowOf = (title) => page.locator('nav a[href^="/sessions/"]', { has: page.locator('span.block.truncate.text-body', { hasText: new RegExp(`^${title}$`) }) });
  const empty = () => page.getByRole('status').filter({ hasText: /^No sessions match/ });

  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');
  let order = [];
  let device = '';

  await step('1 the box is above the list; checkout on top with a time, the other three under it without one', async () => {
    await page.goto(base + '/sessions');
    await rowOf('t648-codex').waitFor();
    const [b, first] = [await box().boundingBox(), await list().locator('a').first().boundingBox()];
    const r = await rows();
    await shot('01-sessions');
    const under = r.slice(1);
    ok(
      '1 the box is above the list; checkout on top with a time, the other three under it without one',
      b.y + b.height <= first.y && r[0].title === 'checkout' && !!r[0].time && under.map((x) => x.title).sort().join() === 'docs-site,t648-agy,t648-codex' && under.every((x) => !x.time),
      `box bottom ${Math.round(b.y + b.height)}, first row top ${Math.round(first.y)}; ${r.map((x) => `${x.title} [${x.time}]`).join(', ')}`,
    );
  });
  await step('2 t648-agy shows the Antigravity mark in color, t648-codex the OpenAI mark', async () => {
    const mark = (title) =>
      rowOf(title).evaluate((a) => {
        const svg = a.firstElementChild.querySelector('svg');
        return {
          bot: !!svg?.matches('[class*="lucide"]'),
          d: svg?.querySelector('path')?.getAttribute('d') ?? '',
          colors: [...new Set([...(svg?.querySelectorAll('path[fill^="#"]') ?? [])].map((p) => p.getAttribute('fill').toLowerCase()))].filter((c) => c !== '#fff'),
        };
      });
    const [agy, codex] = [await mark('t648-agy'), await mark('t648-codex')];
    await rowOf('t648-agy').screenshot({ path: `${out}/02-agy-row.png` });
    ok(
      '2 t648-agy shows the Antigravity mark in color, t648-codex the OpenAI mark',
      !agy.bot && agy.d === pathOf('antigravity-color.svg') && agy.colors.length > 1 && !codex.bot && codex.d === pathOf('openai.svg'),
      `t648-agy: bot icon ${agy.bot}, Antigravity path ${agy.d === pathOf('antigravity-color.svg')}, path colors ${agy.colors.join(' ')}; t648-codex: bot icon ${codex.bot}, OpenAI path ${codex.d === pathOf('openai.svg')}`,
    );
  });
  await step('3 a message to docs-site moves it to the top within 12 s, with a time; checkout second', async () => {
    as('bob', "send alice/docs-site 'T648 one'");
    await wait(12_000);
    const r = await rows();
    order = r.map((x) => x.title);
    await shot('03-docs-first');
    ok('3 a message to docs-site moves it to the top within 12 s, with a time; checkout second', r[0].title === 'docs-site' && !!r[0].time && r[1].title === 'checkout', r.map((x) => `${x.title} [${x.time}]`).join(', '));
  });
  typing = true;
  await step('4 CODEX leaves t648-codex', async () => {
    await box().fill('CODEX');
    const t = await titles();
    await shot('04-codex');
    ok('4 CODEX leaves t648-codex', t.join() === 't648-codex', t);
  });
  await step('5 antigravity leaves t648-agy; the computer name leaves all four in the order of step 3', async () => {
    await box().fill('antigravity');
    const a = await titles();
    device = (await page.evaluate(() => fetch('/v1/agents').then((r) => r.json()))).agents.find((x) => x.title === 't648-agy').device_name;
    await box().fill(device);
    const d = await titles();
    await shot('05-computer');
    ok(
      '5 antigravity leaves t648-agy; the computer name leaves all four in the order of step 3',
      a.join() === 't648-agy' && d.length === 4 && d.join() === order.join(),
      `antigravity → ${a}; "${device}" → ${d} vs ${order}`,
    );
  });
  await step('6 nothing matches: the list goes, a line says so', async () => {
    await box().fill('zzz');
    const shown = await page.getByRole('navigation', { name: 'My sessions', includeHidden: true }).isVisible();
    const line = await empty().innerText();
    await shot('06-none');
    ok('6 nothing matches: the list goes, a line says so', !shown && line === 'No sessions match “zzz”', `list visible ${shown}; "${line}"`);
  });
  await step('7 Esc empties the box, the four back in the order of step 3', async () => {
    await box().press('Escape');
    const v = await box().inputValue();
    const t = await titles();
    ok('7 Esc empties the box, the four back in the order of step 3', v === '' && t.length === 4 && t.join() === order.join(), `box "${v}"; ${t} vs ${order}`);
  });
  await step('8 opening a session found keeps the box and the narrowed list', async () => {
    await box().fill('docs');
    await rowOf('docs-site').click();
    await page.waitForURL(/\/sessions\/[^/]+$/);
    await page.getByRole('main').locator('header').first().getByText('docs-site').waitFor();
    const v = await box().inputValue();
    const t = await titles();
    await shot('08-open');
    ok('8 opening a session found keeps the box and the narrowed list', v === 'docs' && t.join() === 'docs-site', `${new URL(page.url()).pathname}; box "${v}"; ${t}`);
  });
  await step('9 at 390×844, dark, in Chinese: the box says 查找会话, agy leaves t648-agy, nothing runs off the side', async () => {
    const { cookies } = await ctx.storageState();
    const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', locale: 'zh-CN', storageState: { cookies, origins: [] } })).newPage();
    watch(phone);
    await phone.goto(base + '/sessions');
    const zh = phone.getByRole('searchbox', { name: '查找会话' });
    await zh.waitFor();
    const hint = await zh.getAttribute('placeholder');
    await zh.fill('agy');
    const t = await titles(phone);
    const b = await zh.boundingBox();
    // The page, and whatever around the list clips or scrolls what runs over its side.
    const wide = await list(phone).evaluate((nav) => {
      let over = 0;
      for (let el = nav.parentElement; el; el = el.parentElement) if (getComputedStyle(el).overflowX !== 'visible') over = Math.max(over, el.scrollWidth - el.clientWidth);
      return { page: document.documentElement.scrollWidth, over };
    });
    await shot('09-phone-zh', phone);
    ok(
      '9 at 390×844, dark, in Chinese: the box says 查找会话, agy leaves t648-agy, nothing runs off the side',
      hint === '查找会话' && t.join() === 't648-agy' && b.x >= 0 && b.x + b.width <= 390 && wide.page <= 390 && wide.over <= 0,
      `hint "${hint}"; ${t}; box ${Math.round(b.x)}–${Math.round(b.x + b.width)}; page ${wide.page} wide, ${wide.over} px run over the side`,
    );
  });
  ok('10 nothing typed in steps 4–9 was sent to the server', asked.length === 0, asked.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
if (others.size) console.log(`\nnot of this case, left out of the checks: ${[...others].join(', ')}`);
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : '\nno console errors');
process.exit(checks.some((c) => c.startsWith('FAIL')) ? 1 : 0);
