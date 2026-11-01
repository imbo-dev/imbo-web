// TC-437, TC-438 (docs/TEST.md): the chat page's bubbles, mine on the right and everyone else's on the left, and sessions'
// product marks, against the local test server. Setup is the TCs' 前置 (§3「网页对话页的气泡与会话图标」); the page must be
// http://localhost:5190 (`npm run dev`). TC-437 runs first, then TC-438 adds its sessions and removes them when done.
// Prints PASS/FAIL per step, then any console errors the steps don't expect. Codes are read from $L/server.log and never
// printed.
// usage: node web/app/tests/bubbles.mjs <screenshot dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const crates = new URL('../../../crates/', import.meta.url).pathname;
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
const sh = (cmd, env = {}) =>
  execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8', env: { ...process.env, ...env } }).replace(/\x1b\[[0-9;]*m/g, '');
const as = (who, args, env) => sh(`IMBO_HOME=$L/${who} "$IMBO" ${args}`, env);
const ids = Object.fromEntries(fs.readFileSync(`${L}/ids.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').slice(0, 2)));
const CHECKOUT = '55555555-aaaa-bbbb-cccc-0000000a0001';
const asCheckout = (tool, args) => sh(`python3 $M $L/alice ${tool} "$ARGS" --session claude-code:${CHECKOUT}`, { ARGS: JSON.stringify(args) });
// A process speaking as checkout takes it offline when it ends: register it again, online, as the seed left it.
const checkoutBack = () => as('alice', `dev fake-session ${CHECKOUT} --title checkout`);
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

// TC-437 前置
as('bob', 'send alice "$BODY"', { BODY: "T437 bob's terminal" });
as('alice', 'send bob "$BODY"', { BODY: 'T437 my terminal' });
asCheckout('send', { to: ids.bob, body: 'T437 my checkout' });
asCheckout('send', { to: ids.alice, body: 'T437 checkout to me' });
checkoutBack();

// TC-438 前置: one session of alice's per tool with a mark, one without (Kimi Code), and one of bob's in Cursor.
const SESSIONS = [
  ['t438-codex', 'codex', 'mark codex'],
  ['t438-cursor', 'cursor', 'mark cursor'],
  ['t438-opencode', 'opencode', 'mark opencode'],
  ['t438-minimax', 'minimax-code', 'mark minimax-code'],
  ['t438-zcode', 'zcode', 'mark zcode'],
  ['t438-kimi', 'kimi-code', 'bot'],
];
const BOB_SESSION = '55555555-aaaa-bbbb-cccc-000000043807';
const fake = (extra) => {
  SESSIONS.forEach(([title, tool], i) => as('alice', `dev fake-session 55555555-aaaa-bbbb-cccc-00000004380${i + 1} --title ${title} --tool ${tool} ${extra}`));
  as('bob', `dev fake-session ${BOB_SESSION} --title t438-bob --tool cursor ${extra}`);
};

let current = 'login';
const consoleErrors = [];
// TC-437 #4 blocks one send on purpose.
const expected = { 'login alice': /status of 401 /, 'TC-437 #4': /ERR_FAILED/ };
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
  const watch = (page, who) => {
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push([current, `${who}: ${m.text()}`]));
    page.on('pageerror', (e) => consoleErrors.push([current, `${who} pageerror: ${e.message}`]));
  };
  const context = async (viewport, cookies) => {
    const ctx = await browser.newContext({ viewport, locale: 'en-US', ...(cookies && { storageState: { cookies, origins: [] } }) });
    const page = await ctx.newPage();
    watch(page, `alice ${viewport.width}`);
    return page;
  };
  const page = await context({ width: 1280, height: 800 });
  current = 'login alice';
  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');
  const { cookies } = await page.context().storageState();

  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  const article = (p, text) => p.locator('main article', { hasText: text });
  const openChat = async (p, name) => {
    await p.goto(base + '/chats');
    await p.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: new RegExp(`^${name}`) }).first().click();
    await p.getByRole('textbox', { name: `Message ${name}` }).waitFor();
    await p.locator('main article').first().waitFor();
  };
  const openSession = async (p, title) => {
    await p.goto(base + '/sessions');
    await p.getByRole('navigation', { name: 'My sessions' }).getByRole('link').filter({ hasText: title }).first().click();
    await p.getByRole('textbox', { name: `Message ${title}` }).waitFor();
  };
  const send = async (p, to, body) => {
    const box = p.getByRole('textbox', { name: `Message ${to}` });
    await box.fill(body);
    await box.press('Enter');
  };
  // An avatar read the way it shows: a photo, a first letter, a product mark, or the session or terminal icon.
  const PIC = `(e) => !e ? null : e.tagName === 'IMG' ? 'photo' : e.dataset.tool ? 'mark ' + e.dataset.tool
    : (e.querySelector('svg')?.getAttribute('class')?.match(/lucide-(bot|square-terminal)\\b/)?.[1] ?? 'letter ' + e.textContent)`;
  // The avatar inside a list row or a header: the round box Avatar draws.
  const IN = `(el) => el.querySelector('[data-tool]') ?? el.querySelector('.inline-grid.rounded-full')`;
  // Every message on the page: its side (where its picture is), the picture, the bubble and what sits under it, all as
  // the window shows them.
  const messages = (p) =>
    p.locator('main article').evaluateAll((list, PIC) => {
      const pic = eval(PIC);
      const r = (e) => {
        const b = e.getBoundingClientRect();
        return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom) };
      };
      return list.map((a) => {
        const kids = [...a.children];
        const col = kids.find((e) => e.tagName === 'DIV');
        const picture = kids.find((e) => e !== col);
        const bubble = [...col.children].find((e) => e.tagName === 'DIV' && e.children.length === 1 && e.firstElementChild.tagName === 'P');
        const under = bubble ? [...col.children].slice([...col.children].indexOf(bubble) + 1) : [];
        const css = bubble && getComputedStyle(bubble);
        return {
          body: bubble?.textContent ?? '',
          side: picture ? (kids.indexOf(picture) === 0 ? 'left' : 'right') : null,
          pic: pic(picture),
          row: r(a),
          bubble: bubble && r(bubble),
          avatar: picture && r(picture),
          under: under.map((e) => ({ text: e.innerText.replace(/\s+/g, ' ').trim(), ...r(e) })),
          bg: css?.backgroundColor,
          fg: css && getComputedStyle(bubble.firstElementChild).color,
        };
      });
    }, PIC);
  const find = (list, body) => list.find((m) => m.body === body);
  // 12 px between a bubble and its picture, and the picture at the row's edge on its side.
  const placed = (m, side, pic) =>
    !!m && m.side === side && m.pic === pic && (side === 'left' ? m.bubble.l - m.avatar.r === 12 && m.avatar.l === m.row.l : m.avatar.l - m.bubble.r === 12 && m.avatar.r === m.row.r);
  const say = (m) => (m ? `${m.body} ${m.side}:${m.pic} bubble ${m.bubble.l}–${m.bubble.r} picture ${m.avatar.l}–${m.avatar.r} row ${m.row.l}–${m.row.r}` : 'missing');
  // The gap from a bubble to the far side of its row.
  const far = (m) => (m.side === 'left' ? m.row.r - m.bubble.r : m.bubble.l - m.row.l);
  const ME = 'letter A';

  // ── TC-437 ──
  let wide;
  await step('TC-437 #1', async () => {
    await openChat(page, 'bob');
    await article(page, 'T437 my terminal').waitFor();
    wide = await messages(page);
    await article(page, 'T437 my terminal').scrollIntoViewIfNeeded();
    await shot(page, 'tc437-1');
    const mine = find(wide, 'T437 my terminal');
    const bobs = find(wide, "T437 bob's terminal");
    const checkout = find(wide, 'T437 my checkout');
    const rest = wide.filter((m) => m !== mine);
    ok(
      "TC-437 #1 bob's chat: my terminal's on the right with my picture after it; bob's and my checkout's on the left after bob's picture and the Claude Code mark; nothing else of mine on the right",
      placed(mine, 'right', ME) && placed(bobs, 'left', 'letter B') && placed(checkout, 'left', 'mark claude-code') && rest.every((m) => m.side === 'left'),
      [mine, bobs, checkout].map(say).join(' | ') + ` | ${wide.length} messages, ${wide.filter((m) => m.side === 'right').length} on the right`
    );
  });
  await step('TC-437 #2', async () => {
    await send(page, 'bob', 'T437 from the web');
    await article(page, 'T437 from the web').locator('time').waitFor();
    const m = find(await messages(page), 'T437 from the web');
    await shot(page, 'tc437-2');
    ok('TC-437 #2 sent from this page: on the right with my picture', placed(m, 'right', ME), say(m));
  });
  await step('TC-437 #3', async () => {
    await openSession(page, 'checkout');
    await article(page, 'T437 checkout to me').waitFor();
    const list = await messages(page);
    const theirs = list.filter((m) => /^T437 (my checkout|checkout to me)$/.test(m.body));
    await send(page, 'checkout', 'T437 to checkout');
    const row = article(page, 'T437 to checkout');
    await row.locator('time').waitFor();
    await row.getByText('Sending…').waitFor();
    const sending = find(await messages(page), 'T437 to checkout');
    await shot(page, 'tc437-3a');
    asCheckout('inbox', {});
    checkoutBack();
    await row.getByText('Delivered').waitFor({ timeout: 15_000 });
    const done = find(await messages(page), 'T437 to checkout');
    await shot(page, 'tc437-3b');
    // The line under the bubble ends where the bubble does.
    const under = (m, text) => m.under.find((u) => u.text === text);
    const s = under(sending, 'Sending…');
    const d = under(done, 'Delivered');
    ok(
      "TC-437 #3 checkout's thread: what checkout wrote on the left after the Claude Code mark; T437 to checkout on the right, Sending… and then Delivered under it, ending where the bubble ends",
      theirs.length === 2 && theirs.every((m) => placed(m, 'left', 'mark claude-code')) && placed(done, 'right', ME) && !!s && !!d && s.r === sending.bubble.r && s.t >= sending.bubble.b && d.r === done.bubble.r && d.t >= done.bubble.b,
      `${theirs.map(say).join(' | ')} | ${say(done)}; Sending… ${s?.l}–${s?.r} top ${s?.t} (bubble bottom ${sending.bubble.b}), Delivered ${d?.l}–${d?.r} top ${d?.t}`
    );
  });
  await step('TC-437 #4', async () => {
    const post = /\/v1\/agents\/[^/]+\/messages$/;
    const block = (route) => (route.request().method() === 'POST' ? route.abort('failed') : route.continue());
    await page.route(post, block);
    await send(page, 'checkout', 'T437 not sent');
    const row = article(page, 'T437 not sent');
    await row.getByText('Not sent. Check your connection, then try again.').waitFor({ timeout: 10_000 });
    await page.unroute(post, block);
    const m = find(await messages(page), 'T437 not sent');
    const rect = async (loc) => {
      const b = await loc.boundingBox();
      return { l: Math.round(b.x), r: Math.round(b.x + b.width), t: Math.round(b.y), b: Math.round(b.y + b.height) };
    };
    const again = await rect(row.getByRole('button', { name: 'Try again' }));
    const discard = await rect(row.getByRole('button', { name: 'Discard' }));
    const note = await rect(row.getByText('Not sent. Check your connection, then try again.'));
    await row.scrollIntoViewIfNeeded();
    await shot(page, 'tc437-4');
    await row.getByRole('button', { name: 'Discard' }).click();
    await row.waitFor({ state: 'detached' });
    // The buttons' text lines up with the bubble: a ghost button's own 8 px of padding hangs past its edge.
    ok(
      'TC-437 #4 a refused send: on the right with my picture; Not sent, then Try again and Discard under the bubble, ending where it ends; Discard takes it away',
      placed(m, 'right', ME) && note.r === m.bubble.r && note.t >= m.bubble.b && again.t >= note.b && discard.t === again.t && again.r < discard.l && discard.r - m.bubble.r === 8,
      `${say(m)} bottom ${m.bubble.b}; Not sent ${note.l}–${note.r} ${note.t}–${note.b}; Try again ${again.l}–${again.r}, Discard ${discard.l}–${discard.r} top ${discard.t}`
    );
  });
  await step('TC-437 #5', async () => {
    const phone = await context({ width: 390, height: 844 }, cookies);
    current = 'TC-437 #5';
    await openChat(phone, 'bob');
    await article(phone, 'T437 from the web').waitFor();
    const list = await messages(phone);
    await article(phone, 'T437 my terminal').scrollIntoViewIfNeeded();
    await shot(phone, 'tc437-5');
    await phone.context().close();
    const gaps = list.map(far);
    const right = list.filter((m) => m.side === 'right').map((m) => m.body);
    ok(
      "TC-437 #5 390 px wide: the same sides and pictures; every bubble at least 48 px from the far side, a long one exactly 48",
      placed(find(list, 'T437 my terminal'), 'right', ME) && placed(find(list, 'T437 from the web'), 'right', ME) && placed(find(list, "T437 bob's terminal"), 'left', 'letter B') &&
        placed(find(list, 'T437 my checkout'), 'left', 'mark claude-code') && right.length === 2 && Math.min(...gaps) === 48,
      `right: ${right.join(', ')}; far-side gaps ${gaps.join(', ')}`
    );
  });
  await step('TC-437 #6', async () => {
    const lum = (c) => {
      const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map((v) => {
        const s = Number(v) / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const rgb = (c) => c.match(/\d+/g).slice(0, 3).join(',');
    const mine = find(wide, 'T437 my terminal');
    const bobs = find(wide, "T437 bob's terminal");
    const [cm, cb] = [contrast(mine.bg, mine.fg), contrast(bobs.bg, bobs.fg)];
    ok(
      "TC-437 #6 colors: my bubble in the primary color 237,234,226, the others in the selected color 49,47,43; text at least 4.5:1 on both",
      rgb(mine.bg) === '237,234,226' && wide.filter((m) => m.side === 'left').every((m) => rgb(m.bg) === '49,47,43') && cm >= 4.5 && cb >= 4.5,
      `mine ${rgb(mine.bg)} text ${rgb(mine.fg)} ${cm.toFixed(1)}:1; bob's ${rgb(bobs.bg)} text ${rgb(bobs.fg)} ${cb.toFixed(1)}:1`
    );
  });

  // ── TC-438 ──
  fake('');
  // The pictures in a list of sessions, by title; a mark's drawing size too.
  const avatars = (rows) =>
    rows.evaluateAll((list, [PIC, IN]) => {
      const pic = eval(PIC);
      return list.map((row) => {
        const e = eval(IN)(row);
        const svg = e?.dataset.tool ? e.querySelector('svg')?.getBoundingClientRect() : null;
        const box = e?.getBoundingClientRect();
        return {
          title: row.innerText.split('\n')[0].trim(),
          pic: pic(e),
          size: svg ? `${Math.round(svg.width)}×${Math.round(svg.height)} in ${Math.round(box.width)}×${Math.round(box.height)}` : null,
          color: e && getComputedStyle(e).color,
          fill: svg ? getComputedStyle(e.querySelector('svg path')).fill : null,
        };
      });
    }, [PIC, IN]);
  const want = [...SESSIONS.map(([title, , pic]) => [title, pic]), ['checkout', 'mark claude-code']];
  const wrong = (seen, list = want) => list.filter(([title, pic]) => seen.find((a) => a.title === title)?.pic !== pic).map(([title, pic]) => `${title}: wants ${pic}, ${seen.find((a) => a.title === title)?.pic ?? 'missing'}`);
  await step('TC-438 #1', async () => {
    await page.goto(base + '/sessions');
    const nav = page.getByRole('navigation', { name: 'My sessions' });
    await nav.getByRole('link').filter({ hasText: 't438-kimi' }).waitFor();
    const seen = await avatars(nav.getByRole('link'));
    await shot(page, 'tc438-1');
    const marks = seen.filter((a) => a.pic.startsWith('mark '));
    const codex = seen.find((a) => a.title === 't438-codex');
    const bad = wrong(seen);
    ok(
      'TC-438 #1 Sessions: each session shows its product mark, 16×16 in its 32×32 circle; Kimi Code the session icon; Codex drawn in the text color',
      !bad.length && marks.every((a) => a.size === '16×16 in 32×32') && codex.fill === codex.color,
      bad.length ? bad.join(' / ') : seen.map((a) => `${a.title} ${a.pic}${a.size ? ` ${a.size}` : ''}`).join(' / ') + ` / codex fill ${codex.fill} on text ${codex.color}`
    );
  });
  await step('TC-438 #2', async () => {
    await page.getByRole('navigation', { name: 'My sessions' }).getByRole('link').filter({ hasText: 't438-zcode' }).click();
    const head = page.locator('main header').first();
    await head.getByText('t438-zcode').waitFor();
    const read = () => head.evaluate((h, [PIC, IN]) => eval(PIC)(eval(IN)(h)), [PIC, IN]);
    const shown = await read();
    await page.getByRole('button', { name: 'Rename t438-zcode' }).click();
    await head.getByRole('textbox', { name: 'Session name' }).waitFor();
    const renaming = await read();
    await shot(page, 'tc438-2');
    await head.getByRole('button', { name: 'Cancel' }).click();
    ok('TC-438 #2 the session page and its rename box show the Z.ai mark', shown === 'mark zcode' && renaming === 'mark zcode', `${shown}, renaming ${renaming}`);
  });
  await step('TC-438 #3', async () => {
    await page.goto(`${base}/contacts/${ids.bob}`);
    const list = page.locator('section[aria-labelledby="contact-sessions"] li');
    await list.filter({ hasText: 't438-bob' }).waitFor();
    const seen = await avatars(list);
    await shot(page, 'tc438-3');
    const bad = wrong(seen, [['t438-bob', 'mark cursor']]);
    ok("TC-438 #3 bob's page: his Cursor session shows the Cursor mark", !bad.length, seen.map((a) => `${a.title} ${a.pic}`).join(' / '));
  });
  const picks = (d) => d.locator('section').filter({ has: page.getByRole('heading', { name: /^Your sessions/ }) }).locator('li');
  await step('TC-438 #4', async () => {
    await page.goto(base + '/chats');
    await page.getByRole('button', { name: 'New group' }).click();
    const d = page.getByRole('dialog').last();
    await picks(d).filter({ hasText: 't438-kimi' }).waitFor();
    const seen = await avatars(picks(d));
    await wait(500);
    await shot(page, 'tc438-4');
    await page.keyboard.press('Escape');
    await d.waitFor({ state: 'detached' });
    const bad = wrong(seen);
    ok('TC-438 #4 New group: the same marks by each session', !bad.length, bad.length ? bad.join(' / ') : seen.map((a) => `${a.title} ${a.pic}`).join(' / '));
  });
  await step('TC-438 #5', async () => {
    await openChat(page, 'release-team');
    await page.getByRole('button', { name: 'release-team' }).first().click();
    const d = page.getByRole('dialog').last();
    await picks(d).filter({ hasText: 't438-kimi' }).waitFor();
    const seen = await avatars(picks(d));
    await wait(500);
    await shot(page, 'tc438-5');
    await page.keyboard.press('Escape');
    await d.waitFor({ state: 'detached' });
    const bad = wrong(seen);
    ok('TC-438 #5 release-team\'s details: the same marks by each session', !bad.length, bad.length ? bad.join(' / ') : seen.map((a) => `${a.title} ${a.pic}`).join(' / '));
  });
} finally {
  await browser.close();
  fake('--remove');
}
const unexpected = consoleErrors.filter(([at, text]) => !expected[at]?.test(text));
for (const [at, text] of unexpected) console.log(`console error during ${at}: ${text}`);
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(`${failed} failed, ${unexpected.length} unexpected console errors`);
process.exit(failed || unexpected.length ? 1 : 0);
