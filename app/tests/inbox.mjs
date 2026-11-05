// TC-451~TC-455 (docs/TEST.md): pasting files into the text box, the chat list's red dot read on opening a chat, the
// waiting line under what reached my offline sessions, where an in-person message was sent from, and the inbox wording,
// against the local test server. Setup is §3「网页红点、消息来源与粘贴附件」; the page must be http://localhost:5190
// (`npm run dev`). TC-452~TC-455 run in order on the same data, then TC-451; give TC numbers to run only those (in this
// order). Prints PASS/FAIL per step, then any console errors the steps don't expect. Codes are read from
// $L/server.log and never printed.
// usage: node web/app/tests/inbox.mjs <screenshot dir> [452 453 454 455 451]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import zlib from 'node:zlib';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const crates = new URL('../../../crates/', import.meta.url).pathname;
const base = 'http://localhost:5190';
const api = 'http://127.0.0.1:18080';
const L = '/tmp/imbo-t';
const [out, ...only] = process.argv.slice(2);
const runs = (tc) => !only.length || only.includes(String(tc));
fs.mkdirSync(out, { recursive: true });
const ok = (name, cond, detail = '') => console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, ' ')}` : ''}`);
const sh = (cmd, env = {}) =>
  execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8', env: { ...process.env, ...env } }).replace(/\x1b\[[0-9;]*m/g, '');
const as = (who, args, env) => sh(`IMBO_HOME=$L/${who} "$IMBO" ${args}`, env);
const ids = Object.fromEntries(fs.readFileSync(`${L}/ids.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').slice(0, 2)));
const CHECKOUT = '55555555-aaaa-bbbb-cccc-0000000a0001';
const DOCS = '55555555-aaaa-bbbb-cccc-0000000a0002';
const ORDERS = '55555555-aaaa-bbbb-cccc-0000000b0001';
const asSession = (who, id, tool, args) => sh(`python3 $M $L/${who} ${tool} "$ARGS" --session claude-code:${id}`, { ARGS: JSON.stringify(args) });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, good, ms = 15_000) {
  const end = Date.now() + ms;
  let v;
  do {
    v = await fn();
    if (good(v)) return v;
    await wait(500);
  } while (Date.now() < end);
  return v;
}

// One code per email per minute (API-001): when each email last asked for one.
const asked = {};
const codeLines = (email) => fs.readFileSync(`${L}/server.log`, 'utf8').split('\n').filter((l) => l.includes('mail-log-only code=') && l.endsWith(`email=${email}`));
async function codeFor(email, after) {
  for (let i = 0; i < 50; i++) {
    const lines = codeLines(email);
    if (lines.length > after) return lines.at(-1).match(/code=(\d+)/)[1];
    await wait(200);
  }
  throw new Error(`no code for ${email}`);
}
async function askCode(email) {
  const since = Date.now() - (asked[email] ?? 0);
  if (since < 61_000) await wait(61_000 - since);
  asked[email] = Date.now();
  const before = codeLines(email).length;
  for (;;) {
    const r = await fetch(`${api}/v1/auth/code`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
    if (r.status !== 429) break;
    await wait(((await r.json()).retry_after_s ?? 5) * 1000 + 500);
  }
  return codeFor(email, before);
}
/** Signed in the way the App does: a bearer token. */
async function appToken(email) {
  const code = await askCode(email);
  const r = await fetch(`${api}/v1/app/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code, platform: 'ios' }) });
  return (await r.json()).token;
}
/** Signed in the way this page does: the session cookie, and writes carry the page's Origin. */
async function webCookie(email) {
  const code = await askCode(email);
  const r = await fetch(`${api}/v1/web/session`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ email, code }) });
  return r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}
async function post(path, body, auth) {
  const headers = { 'content-type': 'application/json', ...(auth.bearer ? { authorization: `Bearer ${auth.bearer}` } : { cookie: auth.cookie, origin: base }) };
  const r = await fetch(`${api}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return [r.status, await r.json().catch(() => null)];
}

// A 400×300 PNG, a few KB of text and a few KB of PDF, as TC-451 names them.
function png(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([x % 256, y % 256, 160], y * (w * 3 + 1) + 1 + x * 3);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const FILES = {
  't451.png': { type: 'image/png', data: png(400, 300) },
  't451-a.txt': { type: 'text/plain', data: Buffer.from('T451 text file\n'.repeat(200)) },
  't451-b.pdf': { type: 'application/pdf', data: Buffer.concat([Buffer.from('%PDF-1.4\n%T451\n'), Buffer.alloc(3000, 32), Buffer.from('\n%%EOF\n')]) },
};
const file = (name) => ({ name, type: FILES[name]?.type ?? 'text/plain', b64: (FILES[name]?.data ?? Buffer.from(`${name}\n`)).toString('base64') });

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
  // bob's App sign-in goes first, so his web sign-in in TC-454 is a minute later.
  const bobApp = runs(454) ? { bearer: await appToken('bob@imbo.test') } : null;

  const watch = (page, who) => {
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push([current, `${who}: ${m.text()}`]));
    page.on('pageerror', (e) => consoleErrors.push([current, `${who} pageerror: ${e.message}`]));
  };
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' })).newPage();
  watch(page, 'alice');
  current = 'login alice';
  await page.goto(base + '/login');
  asked['alice@imbo.test'] = Date.now();
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');
  const { cookies } = await page.context().storageState();
  let zh;
  const zhPage = async () => {
    if (zh) return zh;
    zh = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'zh-CN', storageState: { cookies, origins: [] } })).newPage();
    watch(zh, 'alice zh-CN');
    return zh;
  };

  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  const list = (p) => p.getByRole('navigation', { name: /^(Chats|对话)$/ });
  const chatRow = (p, name) => list(p).getByRole('link', { name: new RegExp(`^${name}`) }).first();
  const chatsTab = (p) => p.getByRole('navigation', { name: /^(Sections|分区)$/ }).getByRole('link').first();
  const article = (p, text) => p.locator('main article', { hasText: text });
  const box = (p) => p.locator('main textarea');
  const openChat = async (p, name, reload = true) => {
    if (reload) await p.goto(base + '/chats');
    await chatRow(p, name).click();
    await box(p).waitFor();
    await p.locator('main article').first().waitFor();
  };
  const conversations = async () => (await page.evaluate(() => fetch('/v1/conversations').then((r) => r.json()))).conversations;
  const pendingWith = async (peer) => (await conversations()).find((c) => c.peer?.name === peer)?.pending;
  // A message's heading as it reads, and how its parts sit: the sender's name, the hairline after it, the source.
  const heading = (p, text) =>
    article(p, text).first().evaluate((a) => {
      const h = a.querySelector('header');
      const sep = [...h.querySelectorAll('span[aria-hidden="true"]')].find((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.width <= 1.5 && Math.round(r.height) === 10;
      });
      const picture = [...a.children].find((e) => e.tagName !== 'DIV');
      return {
        text: h.innerText.replace(/\s+/g, ' ').trim(),
        sep: !!sep && sep.previousElementSibling?.textContent !== '' && sep.nextElementSibling?.textContent !== '',
        pic: picture?.dataset.tool ? `mark ${picture.dataset.tool}` : picture?.querySelector('svg')?.getAttribute('class')?.match(/lucide-([a-z-]+)/)?.[1] ?? (picture ? `letter ${picture.textContent}` : null),
        under: [...h.parentElement.children].slice(-1)[0].innerText.replace(/\s+/g, ' ').trim(),
      };
    });
  const say = (h) => `${h.text} [${h.pic}${h.sep ? ', hairline' : ''}] under: ${h.under}`;
  const WAITING_DOCS = 'Waiting for docs-site to come online';
  const WAITING_GROUP = 'Waiting for your session docs-site to come online';
  const G = as('alice', 'group list').match(/#(\d+)/)[1];

  // ── TC-452 ──
  if (runs(452)) {
    as('alice', `dev fake-session ${DOCS} --title docs-site --remove`);
    asSession('bob', ORDERS, 'send', { to: 'alice/docs-site', body: 'T452 to docs-site' });
    as('bob', `dev fake-session ${ORDERS} --title orders-api`);
    as('alice', `dev fake-session ${CHECKOUT} --title checkout`);
    await step('TC-452 #1', async () => {
      await page.goto(base + '/chats');
      await chatRow(page, 'bob').waitFor();
      await wait(1000);
      const bob = await chatRow(page, 'bob').textContent();
      const team = await chatRow(page, 'release-team').textContent();
      const tab = await chatsTab(page).textContent();
      await shot(page, 'tc452-1');
      ok('TC-452 #1 bob has the red dot 1 (1 unread), release-team none, the Chats tab 1', /1 unread$/.test(bob) && !/unread/.test(team) && /^Chats1 unread$/.test(tab), `${bob} | ${team} | ${tab}`);
    });
    await step('TC-452 #2', async () => {
      await openChat(page, 'bob', false);
      await wait(2000);
      const bob = await chatRow(page, 'bob').textContent();
      const tab = await chatsTab(page).textContent();
      const pending = await pendingWith('bob');
      await shot(page, 'tc452-2');
      ok('TC-452 #2 opened: no red dot on bob or the Chats tab; pending 0', !/unread/.test(bob) && tab === 'Chats' && pending === 0, `${bob} | ${tab} | pending ${pending}`);
    });
    await step('TC-452 #3', async () => {
      const inbox = as('alice', 'inbox');
      ok('TC-452 #3 imbo inbox: no Inbox part, not the lunch message', !inbox.split('\n').some((l) => l.startsWith('Inbox')) && !inbox.includes('午饭后'), inbox.split('\n')[0]);
    });
    await step('TC-452 #4', async () => {
      as('bob', `send ${ids.alice} "T452 while open"`);
      await article(page, 'T452 while open').waitFor({ timeout: 15_000 });
      await wait(3000);
      const bob = await chatRow(page, 'bob').textContent();
      const pending = await pendingWith('bob');
      ok('TC-452 #4 arrived while open: still no red dot; pending 0', !/unread/.test(bob) && pending === 0, `${bob} | pending ${pending}`);
    });
  }

  // ── TC-453 ──
  if (runs(453)) {
    as('alice', `group sessions release-team --sessions 0a0002`);
    as('carol', `send "#${G}" "T453 to the group"`);
    await step('TC-453 #1', async () => {
      await openChat(page, 'bob');
      const docs = await heading(page, 'T452 to docs-site');
      const checkout = await heading(page, 'customer_id. user_id was dropped');
      await shot(page, 'tc453-1');
      ok('TC-453 #1 T452 to docs-site waits for docs-site; the one to checkout, online, has no such line', docs.under === WAITING_DOCS && !checkout.under.startsWith('Waiting'), `${say(docs)} | ${say(checkout)}`);
    });
    await step('TC-453 #2', async () => {
      await openChat(page, 'release-team', false);
      await article(page, 'T453 to the group').waitFor();
      const mine = await heading(page, 'T453 to the group');
      const old = await heading(page, 'Deploy window starts');
      const team = await chatRow(page, 'release-team').textContent();
      await shot(page, 'tc453-2');
      ok('TC-453 #2 T453 to the group waits for my session docs-site; Deploy window… doesn\'t; no red dot', mine.under === WAITING_GROUP && !old.under.startsWith('Waiting') && !/unread/.test(team), `${say(mine)} | ${say(old)} | ${team}`);
    });
    await step('TC-453 #3', async () => {
      const z = await zhPage();
      await z.goto(base + '/chats');
      await openChat(z, 'release-team', false);
      const group = (await heading(z, 'T453 to the group')).under;
      await openChat(z, 'bob', false);
      const docs = (await heading(z, 'T452 to docs-site')).under;
      await shot(z, 'tc453-3');
      ok('TC-453 #3 in Chinese: 等你的会话 docs-site 上线, 等 docs-site 上线', group === '等你的会话 docs-site 上线' && docs === '等 docs-site 上线', `${group} | ${docs}`);
    });
    await step('TC-453 #4', async () => {
      as('alice', `dev fake-session ${DOCS} --title docs-site`);
      await openChat(page, 'release-team');
      const group = (await heading(page, 'T453 to the group')).under;
      await openChat(page, 'bob', false);
      const docs = (await heading(page, 'T452 to docs-site')).under;
      ok('TC-453 #4 docs-site online: neither waits any more', !group.startsWith('Waiting') && !docs.startsWith('Waiting'), `${group} | ${docs}`);
    });
  }

  // ── TC-454 ──
  if (runs(454)) {
    const bobWeb = { cookie: await webCookie('bob@imbo.test') };
    const sent = [
      await post('/v1/messages', { to: ids.alice, body: "T454 from bob's App", client_msg_id: 't454-app' }, bobApp),
      await post('/v1/messages', { to: ids.alice, body: "T454 from bob's web", client_msg_id: 't454-web' }, bobWeb),
      await post('/v1/messages', { to: `#${G}`, body: 'T454 group from the App', client_msg_id: 't454-group' }, bobApp),
    ];
    console.log(`TC-454 前置: ${sent.map(([s]) => s).join(' ')}`);
    await step('TC-454 #1', async () => {
      await page.goto(base + '/chats');
      const row = await until(() => chatRow(page, 'bob').textContent(), (t) => t.includes("T454 from bob's web"));
      ok("TC-454 #1 bob's preview: Web: T454 from bob's web", row.includes("Web: T454 from bob's web"), row);
    });
    await step('TC-454 #2', async () => {
      await openChat(page, 'bob', false);
      await article(page, "T454 from bob's web").waitFor();
      const term = await heading(page, '午饭后');
      const app = await heading(page, "T454 from bob's App");
      const web = await heading(page, "T454 from bob's web");
      const checkout = await heading(page, 'customer_id. user_id was dropped');
      await shot(page, 'tc454-2');
      const okay = (h, src, pic) => h.text.startsWith(`bob ${src} to alice's inbox`) && h.sep && h.pic === pic;
      ok(
        "TC-454 #2 bob | terminal, bob | App, bob | Web, all with bob's picture, all to alice's inbox; the one to checkout says to alice checkout",
        okay(term, 'terminal', 'letter B') && okay(app, 'App', 'letter B') && okay(web, 'Web', 'letter B') && /^bob terminal to alice checkout/.test(checkout.text),
        [term, app, web, checkout].map(say).join(' | ')
      );
    });
    await step('TC-454 #3', async () => {
      await box(page).fill('T454 from my web');
      await box(page).press('Enter');
      await article(page, 'T454 from my web').locator('time').waitFor();
      const h = await heading(page, 'T454 from my web');
      const inbox = await until(() => as('bob', 'inbox'), (t) => t.includes('T454 from my web'));
      const line = inbox.split('\n').filter((l) => l.includes('alice · Web')).map((l) => l.trim());
      await shot(page, 'tc454-3');
      ok("TC-454 #3 mine on the right: alice | Web to bob's inbox; bob's imbo inbox has it from alice · Web", h.text.startsWith("alice Web to bob's inbox") && h.sep && h.pic === 'letter A' && inbox.includes('T454 from my web') && line.length > 0, `${say(h)} | ${line[0] ?? 'no alice · Web line'}`);
    });
    await step('TC-454 #4', async () => {
      await openChat(page, 'release-team', false);
      await article(page, 'T454 group from the App').waitFor();
      const app = await heading(page, 'T454 group from the App');
      const bob = await heading(page, 'Deploy window starts');
      const carol = await heading(page, 'Billing webhooks');
      await shot(page, 'tc454-4');
      ok("TC-454 #4 group: App #bob, Terminal #bob, Terminal #carol, each with its sender's picture", /^App #bob/.test(app.text) && app.pic === 'letter B' && /^Terminal #bob/.test(bob.text) && bob.pic === 'letter B' && /^Terminal #carol/.test(carol.text) && carol.pic === 'letter C', [app, bob, carol].map(say).join(' | '));
    });
    await step('TC-454 #5', async () => {
      await openChat(page, 'bob', false);
      await page.getByRole('button', { name: 'Select messages' }).click();
      for (const text of ['午饭后', "T454 from bob's App", "T454 from bob's web"]) await page.locator('main div.state-layer', { hasText: text }).last().getByRole('checkbox').click();
      await page.getByRole('button', { name: 'Share as image (3)' }).click();
      await page.getByRole('dialog').locator('img').waitFor({ timeout: 20_000 });
      // Each message in the picture: its heading line (the name, then the session or the source) and its picture.
      const items = await page.locator('body > div[inert] > div').first().evaluate((el) =>
        [...el.querySelectorAll('span.text-label')].map((name) => {
          const label = name.closest('p').firstElementChild;
          const row = name.closest('p').parentElement.parentElement;
          const sep = [...label.querySelectorAll('span[aria-hidden="true"]')].some((e) => Math.round(e.getBoundingClientRect().height) === 10);
          const pic = row.querySelector(':scope > span, :scope > img');
          const shown = pic?.tagName === 'IMG' ? 'photo' : pic?.querySelector('svg')?.getAttribute('class')?.match(/lucide-([a-z-]+)/)?.[1] ?? `letter ${pic?.textContent}`;
          return `${label.innerText.replace(/\s+/g, ' ').trim()}${sep ? ' [hairline]' : ''} ${shown}`;
        })
      );
      await shot(page, 'tc454-5');
      const want = [/^bob terminal \[hairline\] letter B$/, /^bob App \[hairline\] letter B$/, /^bob Web \[hairline\] letter B$/];
      ok("TC-454 #5 the picture: bob | terminal, bob | App, bob | Web, all with bob's picture", items.length === 3 && want.every((re, i) => re.test(items[i])), items.join(' | '));
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Cancel' }).click();
    });
  }

  // ── TC-455 ──
  if (runs(455)) {
    await step('TC-455 #1', async () => {
      await openChat(page, 'bob');
      const picker = page.getByRole('button', { name: /^Sending to/ });
      const label = await picker.getAttribute('aria-label');
      await picker.click();
      const menu = await page.getByRole('menu').innerText();
      await shot(page, 'tc455-1');
      await page.keyboard.press('Escape');
      ok("TC-455 #1 Sending to bob's inbox. Change; You send as yourself, from your inbox.", label === "Sending to bob's inbox. Change" && menu.includes('You send as yourself, from your inbox. Replies show up here.'), `${label} | ${menu.split('\n').slice(0, 3).join(' / ')}`);
    });
    await step('TC-455 #2', async () => {
      await page.goto(`${base}/contacts/${ids.carol}`);
      await page.getByRole('link', { name: 'Message' }).click();
      await page.getByText('No messages with carol yet').waitFor();
      const text = await page.locator('main').innerText();
      ok("TC-455 #2 Your first message goes to carol's inbox.", text.includes("Your first message goes to carol's inbox. The chat shows up in Chats once it's sent."), text.split('\n').slice(-3).join(' / '));
    });
    await step('TC-455 #3', async () => {
      await openChat(page, 'release-team');
      await page.getByRole('button', { name: /release-team/ }).first().click();
      const d = page.getByRole('dialog');
      await d.getByRole('heading', { name: 'Members' }).waitFor();
      await d.getByRole('button', { name: 'Actions for carol' }).click();
      await page.getByRole('menuitem', { name: 'Remove carol…' }).click();
      await d.getByRole('heading', { name: 'Remove carol from release-team?' }).waitFor();
      const text = await d.innerText();
      await shot(page, 'tc455-3');
      await d.getByRole('button', { name: 'Cancel' }).click();
      await page.keyboard.press('Escape');
      ok('TC-455 #3 carol sees a notice in their inbox.', text.includes('carol sees a notice in their inbox. You can invite them again later.'), text.split('\n').filter((l) => l.includes('notice')).join(' / '));
    });
    await step('TC-455 #4', async () => {
      const z = await zhPage();
      await z.goto(base + '/chats');
      await openChat(z, 'bob', false);
      await article(z, "T454 from bob's web").waitFor();
      const term = await heading(z, '午饭后');
      const web = await heading(z, "T454 from bob's web");
      const label = await z.getByRole('button', { name: /^发给/ }).getAttribute('aria-label');
      await shot(z, 'tc455-4');
      ok('TC-455 #4 in Chinese: bob | 终端 发给 alice 本人, bob | 网页, 发给 bob 的收件箱，点按更改', term.text.startsWith('bob 终端 发给 alice 本人') && term.sep && web.text.startsWith('bob 网页 发给 alice 本人') && label === '发给 bob 的收件箱，点按更改', `${say(term)} | ${say(web)} | ${label}`);
    });
    await step('TC-455 #5', async () => {
      const z = await zhPage();
      await openChat(z, 'release-team', false);
      await article(z, 'T454 group from the App').waitFor();
      const bob = await heading(z, 'Deploy window starts');
      const app = await heading(z, 'T454 group from the App');
      ok('TC-455 #5 in Chinese: 终端 #bob, App #bob', /^终端 #bob/.test(bob.text) && /^App #bob/.test(app.text), `${say(bob)} | ${say(app)}`);
    });
  }

  // ── TC-451 ──
  if (runs(451)) {
    // A paste event on the focused text box, with these files and this text on the clipboard.
    const paste = (p, files, text) =>
      box(p).evaluate(
        (el, [files, text]) => {
          const dt = new DataTransfer();
          for (const f of files) dt.items.add(new File([Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0))], f.name, { type: f.type }));
          if (text !== undefined) dt.setData('text/plain', text);
          el.focus();
          const e = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
          el.dispatchEvent(e);
          // The browser pastes text by itself only for a real paste: for text alone, put it in the way it would.
          if (!e.defaultPrevented && text !== undefined) document.execCommand('insertText', false, text);
          return e.defaultPrevented;
        },
        [files, text]
      );
    const chips = (p) => p.getByRole('list', { name: 'Attached files' }).getByRole('listitem');
    const chipText = async (p) => ((await chips(p).count()) ? (await chips(p).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()) : []);
    const uploaded = (p) => until(() => chipText(p), (l) => l.length > 0 && l.every((t) => !t.includes('Uploading')), 20_000);
    await step('TC-451 #1', async () => {
      await openChat(page, 'bob');
      await paste(page, [file('t451.png')]);
      const c = await until(() => chipText(page), (l) => l.length === 1);
      ok('TC-451 #1 t451.png waits to go, the box stays empty', c.length === 1 && c[0].startsWith('t451.png') && (await box(page).inputValue()) === '', `${c.join(' | ')} | box "${await box(page).inputValue()}"`);
    });
    await step('TC-451 #2', async () => {
      await uploaded(page);
      await box(page).press('Enter');
      const row = article(page, 't451.png').last();
      await row.locator('time').waitFor({ timeout: 15_000 });
      const h = await heading(page, 't451.png');
      const inbox = await until(() => as('bob', 'inbox'), (t) => t.includes('t451.png'));
      const line = inbox.split('\n').find((l) => l.includes('file') && l.includes('t451.png'));
      ok('TC-451 #2 sent on the right with t451.png; bob\'s imbo inbox lists it with file t451.png', h.pic === 'letter A' && !!line, `${say(h)} | ${line?.trim()}`);
    });
    await step('TC-451 #3', async () => {
      const prevented = await paste(page, [file('t451-a.txt'), file('t451-b.pdf')], 't451-a.txt t451-b.pdf');
      const c = await until(() => chipText(page), (l) => l.length === 2);
      ok('TC-451 #3 two files, no text', prevented && c.length === 2 && (await box(page).inputValue()) === '', `${c.join(' | ')} | box "${await box(page).inputValue()}"`);
    });
    await step('TC-451 #4', async () => {
      const prevented = await paste(page, [], 'T451 text');
      const c = await chipText(page);
      ok('TC-451 #4 text only goes in the box; still two files', !prevented && (await box(page).inputValue()) === 'T451 text' && c.length === 2, `${c.length} files | box "${await box(page).inputValue()}"`);
    });
    await step('TC-451 #5', async () => {
      await uploaded(page);
      await box(page).press('Enter');
      const row = article(page, 'T451 text').last();
      await row.locator('time').waitFor({ timeout: 15_000 });
      const files = await row.getByRole('link', { name: /^Download / }).evaluateAll((l) => l.map((a) => a.getAttribute('aria-label')));
      await shot(page, 'tc451-5');
      ok('TC-451 #5 sent: T451 text with the two files', files.length === 2 && files.includes('Download t451-a.txt') && files.includes('Download t451-b.pdf'), files.join(' | '));
    });
    await step('TC-451 #6', async () => {
      await page.goto(base + '/sessions');
      await page.getByRole('navigation', { name: 'My sessions' }).getByRole('link').filter({ hasText: 'checkout' }).first().click();
      await box(page).waitFor();
      await paste(page, [file('t451.png')]);
      await uploaded(page);
      await box(page).press('Enter');
      const row = article(page, 't451.png').last();
      await row.locator('time').waitFor({ timeout: 15_000 });
      const got = asSession('alice', CHECKOUT, 'inbox', {});
      as('alice', `dev fake-session ${CHECKOUT} --title checkout`);
      ok('TC-451 #6 to checkout with t451.png; checkout\'s inbox lists it with 1 file', got.includes('t451.png') && got.includes('Attachments (1)'), got.split('\n').filter((l) => /t451|Attachments/.test(l)).join(' / '));
    });
    await step('TC-451 #7', async () => {
      await openChat(page, 'bob');
      await paste(page, Array.from({ length: 21 }, (_, i) => file(`t451-${String(i + 1).padStart(2, '0')}.txt`)));
      const c = await until(() => chipText(page), (l) => l.length === 21);
      const send = await page.locator('main form button[type=submit]').getAttribute('aria-disabled');
      await shot(page, 'tc451-7');
      const over = c.map((t, i) => [i + 1, t]).filter(([, t]) => t.includes('Over 20 files'));
      ok('TC-451 #7 21 files: from the 21st on marked over the limit, Send disabled', c.length === 21 && over.length >= 1 && over[0][0] === 21 && send === 'true', `${c.length} files, over ${over.map(([i]) => i).join(',')}, Send aria-disabled ${send}`);
      // 后置: remove them.
      while (await chips(page).count()) await chips(page).first().getByRole('button').click();
    });
  }

  // The chat page at both widths, light and dark, for the report.
  if (runs(454)) {
    await openChat(page, 'bob');
    await article(page, 'T454 from my web').last().scrollIntoViewIfNeeded();
    for (const scheme of ['dark', 'light']) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 1280, height: 800 });
      await shot(page, `chat-1280-${scheme}`);
      await page.setViewportSize({ width: 390, height: 844 });
      await wait(300);
      await article(page, 'T454 from my web').last().scrollIntoViewIfNeeded();
      await shot(page, `chat-390-${scheme}`);
    }
  }
} finally {
  await browser.close();
}
const unexpected = consoleErrors.filter(([at, text]) => !(expected[at] && expected[at].test(text)));
console.log(unexpected.length ? `console errors:\n${unexpected.map(([at, t]) => `  [${at}] ${t}`).join('\n')}` : 'no unexpected console errors');
