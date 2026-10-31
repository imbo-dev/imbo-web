// TC-429~TC-435 (docs/TEST.md): picking messages in a chat and sharing them as one image, against the local test server.
// Setup is the TCs' 前置 (§3「网页分享图片」): after seed.sh, alice posts a 2,100-character message to release-team,
// bob's and carol's seeded group messages move back a day, and carol sends alice 53 messages (the first 29 moved back a
// day, which also keeps the chat under 30 messages a minute); before TC-430 alice's terminal sends bob one more. Days
// are moved in the server's embedded Postgres. The page must be http://localhost:5190 (`npm run dev`). The cases build
// on each other and run in order. Prints PASS/FAIL per step, then any console errors the steps don't expect. Codes are
// read from $L/server.log and never printed.
// usage: node web/app/tests/share.mjs <screenshot dir>
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
const sh = (cmd, env = {}) =>
  execFileSync('sh', ['-c', `. ${root}crates/scripts/local-env.sh; ${cmd}`], { encoding: 'utf8', env: { ...process.env, ...env } }).replace(/\x1b\[[0-9;]*m/g, '');
const as = (who, args, env) => sh(`IMBO_HOME=${L}/${who} "$IMBO" ${args}`, env);
// One statement on the server's embedded Postgres; its port is on line 4 of postmaster.pid.
const SQL = `import sys, psycopg
port = int(open("${L}/server/pg/pgdata/postmaster.pid").read().splitlines()[3])
db = psycopg.connect(host="127.0.0.1", port=port, user="postgres", dbname="postgres", autocommit=True)
cur = db.execute(sys.argv[1], sys.argv[2:])
print(cur.rowcount if cur.description is None else "\\n".join("\\t".join(map(str, r)) for r in cur.fetchall()))`;
const sql = (q, ...args) => execFileSync('uv', ['run', '-q', '--with', 'psycopg[binary]', 'python', '-c', SQL, q, ...args.map(String)], { encoding: 'utf8' }).trim();
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

// 前置
const G = as('alice', 'group list').match(/#(\d+)/)[1];
const LONG = `L431 ${'0123456789'.repeat(210)}`.slice(0, 2100);
as('alice', `send "#${G}" "$BODY"`, { BODY: LONG });
const GROUP_SEED = ['Deploy window starts at 10:00. Hold merges to main until I post here again.', 'Billing webhooks are paused for the 10:00 deploy window.'];
sql("UPDATE messages SET created_at = created_at - interval '1 day' WHERE body IN (%s, %s)", ...GROUP_SEED);
const n2 = (i) => String(i).padStart(2, '0');
for (let i = 1; i <= 29; i++) as('carol', `send alice "C432 ${n2(i)}"`);
sql("UPDATE messages SET created_at = created_at - interval '1 day' WHERE body LIKE %s", 'C432 %');
for (let i = 30; i <= 53; i++) as('carol', `send alice "C432 ${n2(i)}"`);
const conv = (body) => sql('SELECT conversation_id FROM messages WHERE body = %s', body);
const BOB = conv('What replaced user_id? /v2/orders has returned 400 since this morning.');
const GROUP = conv(GROUP_SEED[0]);
const CAROL = conv('C432 01');
const at = (body) => sql("SELECT to_char(created_at, 'YYYY-MM-DD\"T\"HH24:MI:SSOF') FROM messages WHERE body = %s", body);
const date = (iso, lang = 'en-US') => new Date(iso).toLocaleDateString(lang, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const DAY = date(at(GROUP_SEED[0]).replace(/([+-]\d\d)$/, '$1:00'));
const TODAY = date(at('C432 53').replace(/([+-]\d\d)$/, '$1:00'));
const BOB_DAY = at('What replaced user_id? /v2/orders has returned 400 since this morning.').replace(/([+-]\d\d)$/, '$1:00');

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
  const watch = (page, who) => {
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push([current, `${who}: ${m.text()}`]));
    page.on('pageerror', (e) => consoleErrors.push([current, `${who} pageerror: ${e.message}`]));
  };
  // Share… is offered only where the browser can share files: this context says it can't, whatever the headless build has.
  const noShare = () => {
    delete Navigator.prototype.share;
    delete Navigator.prototype.canShare;
  };
  // A browser that shares PNG files: each call is recorded; `__error` names the DOMException the next calls end in.
  const fakeShare = () => {
    window.__shared = [];
    window.__error = '';
    Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: (d) => !!d?.files?.length && d.files.every((f) => f.type === 'image/png') });
    Object.defineProperty(Navigator.prototype, 'share', {
      configurable: true,
      value: async (d) => {
        window.__shared.push(d.files.map((f) => [f.name, f.type, f.size]));
        if (window.__error) throw new DOMException('share failed', window.__error);
      },
    });
  };
  const context = async (opts, init, cookies) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US', ...opts, ...(cookies && { storageState: { cookies, origins: [] } }) });
    await ctx.addInitScript(init);
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
    const page = await ctx.newPage();
    watch(page, 'alice');
    return page;
  };

  const page = await context({}, noShare);
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
  const dialog = (p) => p.getByRole('dialog');
  const boxes = (p) => p.getByRole('checkbox');
  const states = (p) => boxes(p).evaluateAll((l) => l.map((b) => b.getAttribute('aria-checked')));
  const toasts = (p) => p.locator('[data-sonner-toast]').allInnerTexts();
  const heading = (p) => p.locator('main h1').innerText();
  const open = async (p, chat, title) => {
    await p.goto(`${base}/chats/${chat}`);
    await p.getByRole('heading', { name: title, level: 1 }).waitFor();
    await p.getByRole('article').first().waitFor();
  };
  const select = async (p, label = 'Select messages') => {
    await p.getByRole('button', { name: label }).click();
    await boxes(p).first().waitFor();
  };
  // Opens the dialog and waits for the picture; returns the requests the page sent meanwhile.
  const share = async (p, n, label = `Share as image (${n})`) => {
    const sent = [];
    const log = (r) => sent.push(`${r.method()} ${r.url()}`);
    p.on('request', log);
    const t0 = Date.now();
    await p.getByRole('button', { name: label }).click();
    await dialog(p).locator('img').waitFor({ timeout: 20_000 });
    p.off('request', log);
    return { sent, ms: Date.now() - t0 };
  };
  // The card drawn off screen, read the way the picture shows it.
  const card = (p) =>
    p.locator('body > div[inert] > div').first().evaluate((el) => {
      const c = el.getBoundingClientRect();
      const root = el.firstElementChild;
      const [top, ...rest] = root.children;
      const foot = rest.pop();
      const [title, count] = top.lastElementChild.children;
      const rgb = (e) => getComputedStyle(e).backgroundColor;
      return {
        width: c.width,
        height: c.height,
        background: rgb(root),
        title: title.textContent,
        count: [...count.childNodes].map((n) => n.textContent).filter(Boolean),
        foot: [foot.querySelector('img')?.alt, foot.textContent],
        text: root.textContent,
        items: rest.map((w) => {
          const row = w.lastElementChild;
          const kids = [...row.children];
          const col = kids.find((e) => e.tagName === 'DIV');
          // The sender's picture, before the message or after it: a photo, a first letter, a session's product mark, or a
          // session's or terminal's icon.
          const pic = kids.find((e) => e !== col);
          const icon = pic?.dataset.tool ? `mark ${pic.dataset.tool}` : pic?.querySelector('svg')?.getAttribute('class')?.match(/lucide-(bot|square-terminal)\b/)?.[1];
          const [label, ...more] = col.children;
          const bubble = more.find((e) => e.tagName === 'DIV');
          const r = (bubble ?? more[0]).getBoundingClientRect();
          const a = pic?.getBoundingClientRect();
          return {
            divider: w.children.length === 2 ? w.firstElementChild.textContent : null,
            avatar: pic ? (kids.indexOf(pic) === 0 ? 'left' : 'right') : null,
            pic: !pic ? null : pic.tagName === 'IMG' ? 'photo' : icon ?? `letter ${pic.textContent}`,
            gap: pic ? Math.round(kids.indexOf(pic) === 0 ? r.left - a.right : a.left - r.right) : null,
            tool: !!label.querySelector('svg'),
            label: label.innerText.replace(/\s+/g, ' ').trim(),
            body: bubble?.firstElementChild.textContent,
            note: bubble?.children[1]?.textContent ?? null,
            files: more.filter((e) => e.tagName === 'P').map((e) => e.textContent),
            left: Math.round(r.left - c.left),
            right: Math.round(c.right - r.right),
            top: Math.round(r.top - c.top),
            h: Math.round(r.height),
            color: bubble && rgb(bubble),
          };
        }),
      };
    });
  // Pixels of the picture in the dialog, at points given in the card's CSS pixels.
  const pixels = (p, points, width) =>
    dialog(p)
      .locator('img')
      .evaluate(
        async (img, [pts, w]) => {
          const bmp = await createImageBitmap(await (await fetch(img.src)).blob());
          const g = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d');
          g.drawImage(bmp, 0, 0);
          const k = bmp.width / w;
          return pts.map(([x, y]) => [...g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data.slice(0, 3)].join(','));
        },
        [points, width]
      );
  const rgbOf = (s) => s.match(/\d+/g).slice(0, 3).join(',');
  const png = (file) => {
    const b = fs.readFileSync(file);
    return { png: b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  };
  const download = async (p, label = 'Download PNG') => {
    const dl = p.waitForEvent('download');
    await dialog(p).getByRole('button', { name: label }).click();
    const d = await dl;
    // Named after the case too: TC-430 and TC-434 both download imbo-bob.png.
    const file = `${out}/${current.split(' ')[0].toLowerCase()}-${d.suggestedFilename()}`;
    await d.saveAs(file);
    return { name: d.suggestedFilename(), ...png(file) };
  };
  const box = async (loc) => {
    const b = await loc.boundingBox();
    return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.x + b.width), b: Math.round(b.y + b.height) };
  };
  const clock = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // ── TC-429 ──
  await step('TC-429 #1', async () => {
    await open(page, BOB, 'bob');
    const btn = page.getByRole('button', { name: 'Select messages' });
    await shot(page, 'tc429-1');
    ok('TC-429 #1 bob\'s chat: Select messages in the header', (await btn.count()) === 1 && (await btn.isVisible()));
  });
  await step('TC-429 #2', async () => {
    await select(page);
    const s = await states(page);
    const pickBtn = page.getByRole('button', { name: 'Pick messages to share' });
    const composer = await page.getByRole('textbox', { name: 'Message bob' }).count();
    const limit = await page.getByText('Up to 50 messages').isVisible();
    const cancel = await page.getByRole('button', { name: 'Cancel' }).isVisible();
    await shot(page, 'tc429-2');
    ok(
      'TC-429 #2 picking: Select messages, Up to 50 messages, Cancel; 4 unpicked; Pick messages to share, not usable; no composer',
      (await heading(page)) === 'Select messages' && limit && cancel && s.length === 4 && s.every((v) => v === 'false') && (await pickBtn.isDisabled()) && composer === 0,
      `${await heading(page)} ${JSON.stringify(s)} composer ${composer}`
    );
  });
  await step('TC-429 #3', async () => {
    const file = await box(page.getByText('orders-api-v2.3.md'));
    let downloaded = false;
    const onDl = () => (downloaded = true);
    page.on('download', onDl);
    await page.mouse.click(file.x + file.w / 2, file.y + file.h / 2);
    await wait(1500);
    page.off('download', onDl);
    const s = await states(page);
    await shot(page, 'tc429-3');
    ok(
      'TC-429 #3 a click on bob\'s file picks his message and downloads nothing; 1 selected, Share as image (1)',
      !downloaded && JSON.stringify(s) === '["false","true","false","false"]' && (await heading(page)) === '1 selected' && (await page.getByRole('button', { name: 'Share as image (1)' }).isEnabled()),
      `${JSON.stringify(s)} downloaded ${downloaded}`
    );
  });
  await step('TC-429 #4', async () => {
    const first = boxes(page).first();
    await first.focus();
    await page.keyboard.press('Space');
    const on = [await first.getAttribute('aria-checked'), await heading(page)];
    await page.keyboard.press('Space');
    const off = [await first.getAttribute('aria-checked'), await heading(page)];
    const name = await first.getAttribute('aria-label');
    ok('TC-429 #4 Space on the first message\'s box picks it and lets it go', on.join() === 'true,2 selected' && off.join() === 'false,1 selected' && /^alice checkout \d\d:\d\d$/.test(name), `${on} / ${off} / ${name}`);
  });
  await step('TC-429 #5', async () => {
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('textbox', { name: 'Message bob' }).waitFor();
    await shot(page, 'tc429-5');
    ok('TC-429 #5 Cancel: the chat\'s own header and the composer again, no boxes', (await heading(page)) === 'bob' && (await boxes(page).count()) === 0 && (await page.getByRole('button', { name: 'Select messages' }).isVisible()));
  });
  await step('TC-429 #6', async () => {
    await select(page);
    await boxes(page).first().click();
    await page.getByRole('link', { name: /^release-team/ }).click();
    await page.getByRole('textbox', { name: 'Message release-team' }).waitFor();
    const there = await boxes(page).count();
    await page.getByRole('link', { name: /^bob/ }).click();
    await page.getByRole('textbox', { name: 'Message bob' }).waitFor();
    const back = await boxes(page).count();
    ok('TC-429 #6 another chat opens with nothing picked, and so does bob\'s again', there === 0 && back === 0 && (await heading(page)) === 'bob', `boxes ${there}, ${back}`);
  });

  // ── TC-430 ──
  // 前置: alice's terminal sends bob one of her own, no session: the fifth message in the chat.
  const T430 = "T430 I'll take the 12:00 slot.";
  as('alice', 'send bob "$BODY"', { BODY: T430 });
  let bobCard;
  await step('TC-430 #1', async () => {
    await open(page, BOB, 'bob');
    await page.getByRole('article').filter({ hasText: 'T430' }).waitFor();
    await select(page);
    for (const b of await boxes(page).all()) await b.click();
    const { sent, ms } = await share(page, 5);
    const d = dialog(page);
    const desc = await d.getByText('Made in this browser, never uploaded.').isVisible();
    const out = sent.filter((r) => !r.startsWith(`GET ${base}/`) && !r.startsWith(`GET blob:${base}/`));
    await shot(page, 'tc430-1');
    ok('TC-430 #1 Share as image (5): the dialog shows the picture; the page sent nothing but GETs to itself meanwhile', (await d.getByRole('heading', { name: 'Share as image' }).isVisible()) && desc && !out.length, `${ms} ms, ${sent.length} requests ${out.join(' ')}`);
  });
  await step('TC-430 #2', async () => {
    bobCard = await card(page);
    const c = bobCard;
    ok('TC-430 #2 top: bob, 5 messages, the day; no dividers', c.title === 'bob' && JSON.stringify(c.count) === JSON.stringify(['5 messages', date(BOB_DAY)]) && c.items.every((i) => i.divider === null), `${c.title} ${JSON.stringify(c.count)}`);
  });
  await step('TC-430 #3', async () => {
    const [a1, b1, a2, b2, me] = bobCard.items;
    const t = clock(BOB_DAY);
    const mine = me.body === T430 && me.right === 52 && me.left > 52 && me.avatar === 'right' && me.pic === 'letter A' && me.gap === 8 && /^alice Terminal \d\d:\d\d$/.test(me.label);
    const sessions = [a1, a2].every((i) => i.left === 52 && i.avatar === 'left' && i.pic === 'mark claude-code' && /^alice checkout \d\d:\d\d$/.test(i.label));
    const theirs = [b1, b2].every((i) => i.left === 52 && i.avatar === 'left' && i.pic === 'square-terminal' && /^bob Terminal \d\d:\d\d$/.test(i.label));
    ok(
      'TC-430 #3 alice\'s own on the right with her picture after it; her checkout\'s on the left after the Claude Code mark, bob\'s after the terminal icon; no icon before a name; account names, never You',
      mine && sessions && theirs && bobCard.items.every((i) => !i.tool) && a1.label.endsWith(t) && !/\bYou\b/.test(bobCard.text) && b2.body === '午饭后我把 v2.3 部署到生产，你那边还有要改的吗？',
      bobCard.items.map((i) => `${i.label} L${i.left} R${i.right} ${i.avatar}:${i.pic}`).join(' | ')
    );
  });
  await step('TC-430 #4', async () => {
    const b1 = bobCard.items[1];
    ok('TC-430 #4 the file by name only: no size, no download', JSON.stringify(b1.files) === '["orders-api-v2.3.md"]' && !/51 B/.test(bobCard.text), JSON.stringify(b1.files));
  });
  await step('TC-430 #5', async () => {
    ok('TC-430 #5 bottom: the Imbo wordmark and imbo.dev', bobCard.foot[0] === 'Imbo' && bobCard.foot[1] === 'imbo.dev', JSON.stringify(bobCard.foot));
  });
  await step('TC-430 #6', async () => {
    const f = await download(page);
    const tall = Math.round(bobCard.height * 3);
    ok('TC-430 #6 Download PNG: imbo-bob.png, a PNG 1170 px wide (3 per CSS pixel)', f.name === 'imbo-bob.png' && f.png && f.width === 1170 && Math.abs(f.height - tall) <= 3, `${f.name} ${f.width}×${f.height}, card ${bobCard.width}×${bobCard.height}`);
  });
  await step('TC-430 #7', async () => {
    const [a1, b1, , , me] = bobCard.items;
    const mid = (i) => [i.left + 6, i.top + i.h / 2];
    const got = await pixels(page, [[6, 6], mid(me), mid(a1), mid(b1)], bobCard.width);
    const want = [rgbOf(bobCard.background), rgbOf(me.color), rgbOf(a1.color), rgbOf(b1.color)];
    const near = got.every((g, i) => g.split(',').every((v, k) => Math.abs(v - want[i].split(',')[k]) <= 3));
    ok(
      'TC-430 #7 the picture\'s colors: the page background; alice\'s own bubble in the main button color, her checkout\'s and bob\'s in the selected color',
      near && want[1] !== want[2] && want[2] === want[3],
      `got ${got.join(' | ')} want ${want.join(' | ')}`
    );
    await page.keyboard.press('Escape');
    await dialog(page).waitFor({ state: 'detached' });
  });

  // ── TC-431 ──
  await step('TC-431 #1', async () => {
    await open(page, GROUP, 'release-team');
    const you = await page.getByRole('article').filter({ hasText: 'L431' }).getByText('You', { exact: true }).count();
    await select(page);
    for (const b of await boxes(page).all()) await b.click();
    const n = (await states(page)).length;
    await share(page, n);
    await shot(page, 'tc431-1');
    ok('TC-431 #1 release-team: 3 picked, the picture made; the thread itself calls alice You', n === 3 && you === 1, `${n} boxes, You ${you}`);
  });
  await step('TC-431 #2', async () => {
    const c = await card(page);
    const [b, k, a] = c.items;
    ok(
      'TC-431 #2 two days: 3 messages without a date on top; a divider with each day',
      JSON.stringify(c.count) === '["3 messages"]' && b.divider === DAY && k.divider === null && a.divider === TODAY,
      `${JSON.stringify(c.count)} ${c.items.map((i) => i.divider).join(' | ')}`
    );
    ok(
      'TC-431 #3 bob and carol on the left after the terminal icon, alice on the right as alice with her picture after it',
      [b, k].every((i) => i.avatar === 'left' && i.pic === 'square-terminal' && i.left === 52) && a.avatar === 'right' && a.pic === 'letter A' && a.gap === 8 && a.right === 52 &&
        /^bob Terminal/.test(b.label) && /^carol Terminal/.test(k.label) && /^alice Terminal/.test(a.label) && !/\bYou\b/.test(c.text),
      c.items.map((i) => `${i.label} L${i.left} R${i.right} ${i.avatar}:${i.pic}`).join(' | ')
    );
    ok('TC-431 #4 the 2,100 characters cut at 2,000 with …, then 100 more characters not shown', a.body === LONG.slice(0, 2000) + '…' && a.note === '100 more characters not shown', `${a.body?.length} chars, ${a.note}`);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  // ── TC-432 ──
  await step('TC-432 #1', async () => {
    await open(page, CAROL, 'carol');
    await select(page);
    const all = await boxes(page).all();
    for (const b of all) await b.click();
    await shot(page, 'tc432-1');
    ok('TC-432 #1 the newest 50 picked: 50 selected', all.length === 50 && (await heading(page)) === '50 selected' && (await page.getByRole('button', { name: 'Share as image (50)' }).isVisible()), `${all.length} boxes`);
  });
  await step('TC-432 #2', async () => {
    await page.getByRole('button', { name: 'Show earlier messages' }).click();
    await page.waitForFunction(() => document.querySelectorAll('[role=checkbox]').length === 53);
    const oldest = boxes(page).first();
    await oldest.click();
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'You can share up to 50 messages at a time.' });
    await toast.waitFor();
    await shot(page, 'tc432-2');
    ok('TC-432 #2 a 51st: the notice, not picked, still 50 selected', (await oldest.getAttribute('aria-checked')) === 'false' && (await heading(page)) === '50 selected');
  });
  await step('TC-432 #3', async () => {
    await boxes(page).last().click();
    const h1 = await heading(page);
    await boxes(page).first().click();
    const h2 = await heading(page);
    ok('TC-432 #3 one let go, the older one picked: 49, then 50 selected', h1 === '49 selected' && h2 === '50 selected' && (await boxes(page).first().getAttribute('aria-checked')) === 'true', `${h1} / ${h2}`);
  });
  await step('TC-432 #4', async () => {
    await share(page, 50);
    const c = await card(page);
    const f = await download(page);
    const scale = Math.min(3, Math.sqrt(16_777_216 / (c.width * c.height)));
    await shot(page, 'tc432-4');
    ok(
      'TC-432 #4 the picture: 50 messages, C432 01 first, C432 52 last, a divider each day; PNG at the card\'s scale',
      JSON.stringify(c.count) === '["50 messages"]' && c.items.length === 50 && c.items[0].body === 'C432 01' && c.items.at(-1).body === 'C432 52' && c.items.filter((i) => i.divider).length === 2 && f.width === Math.floor(c.width * scale),
      `${c.items.length} items, ${c.width}×${c.height}, PNG ${f.width}×${f.height}`
    );
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  // ── TC-433 ──
  await step('TC-433 #1', async () => {
    await open(page, BOB, 'bob');
    await select(page);
    await boxes(page).nth(0).click();
    await boxes(page).nth(1).click();
    await share(page, 2);
    const d = dialog(page);
    const names = await d.getByRole('button').allInnerTexts();
    ok('TC-433 #1 a browser that can\'t share files: no Share…; Copy image and Download PNG', !names.some((n) => n.startsWith('Share…')) && names.includes('Copy image') && names.includes('Download PNG'), names.join(' | '));
  });
  await step('TC-433 #2', async () => {
    await dialog(page).getByRole('button', { name: 'Copy image' }).click();
    await page.locator('[data-sonner-toast]').filter({ hasText: 'Image copied' }).waitFor();
    const clip = await page.evaluate(async () => {
      const [item] = await navigator.clipboard.read();
      const b = await item.getType('image/png');
      const bmp = await createImageBitmap(b);
      return [item.types.join(), bmp.width, bmp.height];
    });
    const size = await dialog(page).locator('img').evaluate((i) => [i.naturalWidth, i.naturalHeight]);
    await shot(page, 'tc433-2');
    ok('TC-433 #2 Copy image: Image copied; the clipboard holds the same PNG', clip[0] === 'image/png' && clip[1] === size[0] && clip[2] === size[1], `${clip} vs ${size}`);
  });
  await step('TC-433 #3', async () => {
    await page.keyboard.press('Escape');
    await dialog(page).waitFor({ state: 'detached' });
    ok('TC-433 #3 the dialog closed, the two still picked', (await heading(page)) === '2 selected' && JSON.stringify((await states(page)).slice(0, 2)) === '["true","true"]');
  });
  const p2 = await context({}, fakeShare, cookies);
  await step('TC-433 #4', async () => {
    await open(p2, BOB, 'bob');
    await select(p2);
    await boxes(p2).nth(0).click();
    await boxes(p2).nth(1).click();
    await share(p2, 2);
    await dialog(p2).getByRole('button', { name: 'Share…' }).click();
    await wait(500);
    const shared = await p2.evaluate(() => window.__shared);
    await shot(p2, 'tc433-4');
    ok('TC-433 #4 a browser that shares files: Share… hands it one PNG, imbo-bob.png', shared.length === 1 && shared[0].length === 1 && shared[0][0][0] === 'imbo-bob.png' && shared[0][0][1] === 'image/png' && shared[0][0][2] > 0 && !(await toasts(p2)).length, JSON.stringify(shared));
  });
  await step('TC-433 #5', async () => {
    await p2.evaluate(() => (window.__error = 'AbortError'));
    await dialog(p2).getByRole('button', { name: 'Share…' }).click();
    await wait(1500);
    const quiet = await toasts(p2);
    await p2.evaluate(() => (window.__error = 'NotAllowedError'));
    await dialog(p2).getByRole('button', { name: 'Share…' }).click();
    const notice = p2.locator('[data-sonner-toast]').filter({ hasText: "Couldn't share the image. Download it instead." });
    await notice.waitFor();
    ok('TC-433 #5 sharing cancelled: no notice; sharing refused: the notice', !quiet.length && (await notice.count()) === 1, JSON.stringify(quiet));
    await p2.context().close();
  });

  // ── TC-434 ──
  await step('TC-434 #1', async () => {
    await page.evaluate(() => {
      window.__failCanvas = true;
      const { toBlob, toDataURL } = HTMLCanvasElement.prototype;
      HTMLCanvasElement.prototype.toBlob = function (cb, ...a) {
        return window.__failCanvas ? cb(null) : toBlob.call(this, cb, ...a);
      };
      HTMLCanvasElement.prototype.toDataURL = function (...a) {
        return window.__failCanvas ? 'data:,' : toDataURL.apply(this, a);
      };
    });
    await page.getByRole('button', { name: 'Share as image (2)' }).click();
    const d = dialog(page);
    await d.getByRole('alert').waitFor();
    const alert = await d.getByRole('alert').innerText();
    await shot(page, 'tc434-1');
    ok(
      'TC-434 #1 a canvas the browser won\'t encode: Couldn\'t make the image. Try again.; Copy image and Download PNG not usable',
      alert.includes("Couldn't make the image. Try again.") && (await d.getByRole('button', { name: 'Try again' }).isVisible()) && (await d.getByRole('button', { name: 'Copy image' }).isDisabled()) && (await d.getByRole('button', { name: 'Download PNG' }).isDisabled()),
      alert
    );
  });
  await step('TC-434 #2', async () => {
    await page.evaluate(() => (window.__failCanvas = false));
    const d = dialog(page);
    await d.getByRole('button', { name: 'Try again' }).click();
    await d.locator('img').waitFor({ timeout: 20_000 });
    const f = await download(page);
    ok('TC-434 #2 Try again: the picture, and Download PNG works', f.png && f.width === 1170, `${f.width}×${f.height}`);
    await page.keyboard.press('Escape');
  });

  // ── TC-435 ──
  const zh = await context({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' }, noShare, cookies);
  await step('TC-435 #1', async () => {
    await open(zh, BOB, 'bob');
    await select(zh, '选择消息');
    const limit = await zh.getByText('最多 50 条').isVisible();
    const h0 = await heading(zh);
    await boxes(zh).nth(0).click();
    await boxes(zh).nth(1).click();
    await shot(zh, 'tc435-1');
    ok('TC-435 #1 Chinese, 390 wide: 选择消息, 最多 50 条, 取消; two picked: 已选 2 条, 分享为图片（2）', h0 === '选择消息' && limit && (await heading(zh)) === '已选 2 条' && (await zh.getByRole('button', { name: '取消' }).isVisible()) && (await zh.getByRole('button', { name: '分享为图片（2）' }).isVisible()), h0);
  });
  await step('TC-435 #2', async () => {
    await share(zh, 2, '分享为图片（2）');
    const d = dialog(zh);
    await d.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))));
    const rect = await box(d);
    const img = await box(d.locator('img'));
    const dl = await box(d.getByRole('button', { name: '下载 PNG' }));
    const cp = await box(d.getByRole('button', { name: '复制图片' }));
    const desc = await d.getByText('图片在这个浏览器里生成，不会上传。').isVisible();
    await shot(zh, 'tc435-2');
    ok(
      'TC-435 #2 the dialog rises from the bottom, full width; the picture fits; 下载 PNG above 复制图片, both full width',
      (await d.getByRole('heading', { name: '分享为图片' }).isVisible()) && desc && rect.x === 0 && rect.w === 390 && rect.b === 844 && img.x >= 0 && img.r <= 390 && dl.w === cp.w && dl.x === cp.x && dl.y < cp.y,
      `dialog ${JSON.stringify(rect)} img ${JSON.stringify(img)} buttons ${dl.y}/${cp.y} w ${dl.w}`
    );
  });
  await step('TC-435 #3', async () => {
    const c = await card(zh);
    ok('TC-435 #3 the picture in Chinese: 2 条消息 and the day; 终端 for bob\'s terminal', JSON.stringify(c.count) === JSON.stringify(['2 条消息', date(BOB_DAY, 'zh-CN')]) && c.items[1].label.startsWith('bob 终端'), `${JSON.stringify(c.count)} ${c.items.map((i) => i.label).join(' | ')}`);
    await zh.context().close();
  });
} catch (e) {
  ok(current, false, e.stack.split('\n').slice(0, 3).join(' '));
} finally {
  await browser.close();
}

const surprises = consoleErrors.filter(([s, m]) => !expected[s]?.test(m));
for (const [s, m] of surprises) console.log(`console error in ${s}: ${m}`);
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(`${checks.length - failed}/${checks.length} PASS, ${surprises.length} unexpected console errors`);
process.exit(failed || surprises.length ? 1 : 0);
