// TC-221~TC-237 (docs/TEST.md): pictures, blocking, reporting and the admin pages in the web app, against the local test
// server started as §3「网页举报、屏蔽、封禁与头像」says. The page must be http://localhost:5190 (`npm run dev`). The cases
// build on each other and run in order on one set of data. Prints PASS/FAIL per step, the report IDs it made, then any
// unexpected console errors.
// usage: node web/app/tests/safety.mjs <screenshot dir>
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
const ok = (name, cond, detail = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).replace(/\n/g, ' ')}` : ''}`);
const sh = (cmd) => execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8' });
const ids = Object.fromEntries(fs.readFileSync(`${L}/ids.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').slice(0, 2)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = () => fs.readFileSync(`${L}/server.log`, 'utf8');

const codeLines = (email) => log().split('\n').filter((l) => l.includes('mail-log-only code=') && l.endsWith(`email=${email}`));
async function codeFor(email, after) {
  for (let i = 0; i < 50; i++) {
    const lines = codeLines(email);
    if (lines.length > after) return lines.at(-1).match(/code=(\d+)/)[1];
    await wait(200);
  }
  throw new Error(`no code for ${email}`);
}
/** The report mail lines (`mail-log-only report=<id> to=… link=…`), oldest first. */
const mails = () => [...log().matchAll(/mail-log-only report=(\d+) to=(\S+) link=(\S+)/g)].map((m) => ({ id: Number(m[1]), to: m[2], link: m[3] }));
async function nextMail(before) {
  for (let i = 0; i < 50; i++) {
    const m = mails();
    if (m.length > before) return m.at(-1);
    await wait(200);
  }
  throw new Error('no report mail');
}

/** Width and height of a JPEG, from its first SOF marker. */
function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return undefined;
  for (let i = 2; i + 9 < buf.length; ) {
    if (buf[i] !== 0xff) return undefined;
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return undefined;
}

// Expected: 401 for signed-out pages and the banned account's polling, 403 for the refused send to someone who blocked
// alice, 404 for /admin as a non-admin and the removed picture, 409 for the second report and the stale Dismiss,
// 422 for name-required when a new email signs in, 429 for the 21st picture, 502 for deleting while Waffo refuses.
const expected = /status of (401|403|404|409|422|429|502) /;
const watch = (p) => {
  p.on('console', (m) => m.type() === 'error' && !expected.test(m.text()) && errors.push(`console: ${m.text()}`));
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
};
// Runs one numbered step; a thrown error (a wait that timed out) fails that step and the walk goes on.
/** Polls `cond` until it holds, up to `ms`. */
async function until(cond, ms = 10000) {
  for (const end = Date.now() + ms; Date.now() < end; await wait(200)) if (await cond()) return;
  throw new Error('condition not met in time');
}
const step = async (id, fn) => {
  try {
    await fn();
  } catch (e) {
    ok(id, false, e.message.split('\n')[0]);
  }
};

const browser = await chromium.launch();
const made = {};
try {
  const desktop = { viewport: { width: 1440, height: 900 } };
  const A = await browser.newContext(desktop);
  const B = await browser.newContext(desktop);
  const C = await browser.newContext(desktop);
  const ADM = await browser.newContext({ ...desktop, permissions: ['clipboard-read', 'clipboard-write'] });
  // Keeps the start of the last picture the page sends, for its JPEG size (Playwright doesn't hand over Blob bodies).
  await A.addInitScript(() => {
    const send = window.fetch;
    window.fetch = async (input, init) => {
      if (init?.method === 'PUT' && String(input).endsWith('/v1/me/avatar') && init.body instanceof Blob)
        window.__picture = { type: init.body.type, head: [...new Uint8Array(await init.body.slice(0, 4096).arrayBuffer())] };
      return send(input, init);
    };
  });
  const a = await A.newPage();
  const b = await B.newPage();
  const c = await C.newPage();
  const adm = await ADM.newPage();
  for (const p of [a, b, c, adm]) watch(p);
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  const toast = (p, text) => p.locator('[data-sonner-toast]', { hasText: text }).first().waitFor({ timeout: 8000 });

  async function signIn(p, email, name) {
    const before = codeLines(email).length;
    await p.getByLabel('Email').fill(email);
    await p.getByRole('button', { name: 'Continue' }).click();
    await p.getByText('Check your email').waitFor();
    await p.keyboard.type(await codeFor(email, before));
    if (name) {
      await p.getByLabel('Name').fill(name);
      await p.getByRole('button', { name: 'Create account' }).click();
    }
  }
  /** A PNG drawn in the page: left half red, right half blue. */
  const png = async (p, w, h) =>
    Buffer.from(
      await p.evaluate(async ([w, h]) => {
        const cv = new OffscreenCanvas(w, h);
        const x = cv.getContext('2d');
        x.fillStyle = '#c33';
        x.fillRect(0, 0, w / 2, h);
        x.fillStyle = '#33c';
        x.fillRect(w / 2, 0, w - w / 2, h);
        const bytes = new Uint8Array(await (await cv.convertToBlob({ type: 'image/png' })).arrayBuffer());
        let s = '';
        for (const v of bytes) s += String.fromCharCode(v);
        return btoa(s);
      }, [w, h]),
      'base64'
    );
  const pictureButton = (p) => p.getByRole('button', { name: /^(Add a picture|Change picture)$/ });
  async function upload(p, file) {
    await pictureButton(p).click();
    const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.getByRole('menuitem', { name: 'Upload a picture…' }).click()]);
    await chooser.setFiles(file);
  }
  // A row's name starts with the chat's or contact's name; the last message's preview follows it.
  const first = (name) => (name instanceof RegExp ? new RegExp(`^(${name.source})`) : name);
  const chat = (p, name) => p.getByRole('navigation', { name: 'Chats' }).getByRole('link', { name: first(name) });
  const contact = (p, name) => p.getByRole('navigation', { name: 'Contacts' }).getByRole('link', { name: first(name) });
  const article = (p, text) => p.locator('article', { hasText: text });
  const composer = (p) => p.locator('textarea.composer');
  async function openChat(p, name) {
    await p.goto(base + '/chats');
    await chat(p, name).click();
    await composer(p).or(p.getByText(/^You blocked /)).first().waitFor();
  }
  const menu = async (p, who, item) => {
    await p.getByRole('button', { name: `More for ${who}` }).click();
    await p.getByRole('menuitem', { name: item }).click();
  };
  const avatarSrc = (loc) => loc.locator('img').first().getAttribute('src', { timeout: 3000 }).catch(() => null);
  async function report(p, who, reason, note) {
    const d = p.getByRole('dialog', { name: `Report ${who}` });
    await d.waitFor();
    await d.getByRole('radio', { name: new RegExp(`^${reason}`) }).click();
    if (note) await d.getByLabel('Details (optional)').fill(note);
    await d.getByRole('button', { name: 'Send report' }).click();
    return p.getByRole('dialog', { name: 'Report sent' });
  }

  // Setup: alice, bob and carol signed in, each in their own browser
  for (const [p, who] of [[a, 'alice'], [b, 'bob'], [c, 'carol']]) {
    await p.goto(base + '/login');
    await signIn(p, `${who}@imbo.test`);
    await p.waitForURL('**/chats');
  }
  const A_ID = ids.alice, B_ID = ids.bob, C_ID = ids.carol;

  // ── TC-221: alice's picture ──
  let src221;
  await step('TC-221 #1 no picture yet', async () => {
    await a.goto(base + '/account');
    await pictureButton(a).waitFor();
    const label = await pictureButton(a).getAttribute('aria-label');
    const hint = await a.getByText('JPEG or PNG, up to 5 MB. Imbo crops it to a square. Your contacts and group members see it.').isVisible();
    ok('TC-221 #1 no picture yet', label === 'Add a picture' && hint && !(await avatarSrc(pictureButton(a))), label);
  });
  await step('TC-221 #2 menu has upload only', async () => {
    await pictureButton(a).click();
    const items = await a.getByRole('menuitem').allInnerTexts();
    await a.keyboard.press('Escape');
    ok('TC-221 #2 menu has upload only', items.length === 1 && items[0].trim() === 'Upload a picture…', items.join(' | '));
  });
  await step('TC-221 #3 a 3000×1500 PNG goes up as a JPEG up to 2048', async () => {
    const big = await png(a, 3000, 1500);
    const req = a.waitForRequest((r) => r.method() === 'PUT' && r.url().endsWith('/v1/me/avatar'));
    await upload(a, { name: 'wide.png', mimeType: 'image/png', buffer: big });
    const r = await req;
    await a.getByRole('button', { name: 'Change picture' }).waitFor();
    const sent = await a.evaluate(() => window.__picture);
    const size = jpegSize(Buffer.from(sent?.head ?? []));
    src221 = await avatarSrc(pictureButton(a));
    ok('TC-221 #3 a 3000×1500 PNG goes up as a JPEG up to 2048', r.headers()['content-type'] === 'image/jpeg' && sent?.type === 'image/jpeg' && size?.w === 2048 && size?.h === 1024 && /^\/v1\/avatars\/[0-9a-f-]{36}\.jpg$/.test(src221 ?? ''), `${r.headers()['content-type']} ${size?.w}×${size?.h}, src ${src221}`);
    await shot(a, '221-03');
  });
  await step('TC-221 #4 stored as a 512×512 JPEG, no sign-in needed', async () => {
    const r = await fetch(base + src221);
    const size = jpegSize(Buffer.from(await r.arrayBuffer()));
    ok('TC-221 #4 stored as a 512×512 JPEG, no sign-in needed', r.status === 200 && r.headers.get('content-type') === 'image/jpeg' && size?.w === 512 && size?.h === 512, `${r.status} ${r.headers.get('content-type')} ${size?.w}×${size?.h}`);
  });
  await step('TC-221 #5 bob sees it in contacts and chats', async () => {
    await b.goto(base + '/contacts');
    await contact(b, /alice/).waitFor();
    const inContacts = await avatarSrc(contact(b, /alice/));
    await b.goto(base + '/chats');
    const inChats = await avatarSrc(chat(b, /alice/));
    ok('TC-221 #5 bob sees it in contacts and chats', inContacts === src221 && inChats === src221, `${inContacts} / ${inChats}`);
    await shot(b, '221-05');
  });
  await step('TC-221 #6 remove picture', async () => {
    await pictureButton(a).click();
    await a.getByRole('menuitem', { name: 'Remove picture' }).click();
    await a.getByRole('button', { name: 'Add a picture' }).waitFor();
    const gone = await fetch(base + src221);
    ok('TC-221 #6 remove picture', !(await avatarSrc(pictureButton(a))) && gone.status === 404, `old address ${gone.status}`);
  });
  await step("TC-221 #7 bob sees alice's initial again", async () => {
    await b.goto(base + '/contacts');
    await contact(b, /alice/).waitFor();
    const img = await avatarSrc(contact(b, /alice/));
    const letter = (await contact(b, /alice/).locator('span[aria-hidden="true"]').first().innerText()).trim();
    ok("TC-221 #7 bob sees alice's initial again", !img && letter === 'A', `img ${img}, letter ${letter}`);
  });

  // ── TC-222: pictures that don't go up ──
  const puts = [];
  a.on('request', (r) => r.method() === 'PUT' && r.url().endsWith('/v1/me/avatar') && puts.push(r));
  const fileInput = () => a.locator('input[type=file]');
  const refusal = () => a.getByRole('alert');
  await step('TC-222 #1 a GIF is refused in the page', async () => {
    const n = puts.length;
    await fileInput().setInputFiles({ name: 'cat.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;') });
    await refusal().getByText("Imbo can't read that image. Pick a JPEG or PNG.").waitFor({ timeout: 5000 });
    ok('TC-222 #1 a GIF is refused in the page', puts.length === n, `requests ${puts.length - n}`);
    await shot(a, '222-01');
  });
  await step('TC-222 #2 a broken PNG is refused in the page', async () => {
    const n = puts.length;
    await fileInput().setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not really a png') });
    await wait(500);
    await refusal().getByText("Imbo can't read that image. Pick a JPEG or PNG.").waitFor({ timeout: 5000 });
    ok('TC-222 #2 a broken PNG is refused in the page', puts.length === n, `requests ${puts.length - n}`);
  });
  await step('TC-222 #3 the 21st change today', async () => {
    const codes = await a.evaluate(async () => {
      const cv = new OffscreenCanvas(40, 40);
      cv.getContext('2d').fillRect(0, 0, 40, 40);
      const blob = await cv.convertToBlob({ type: 'image/jpeg' });
      const got = [];
      for (let i = 0; i < 25; i++) {
        const r = await fetch('/v1/me/avatar', { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: blob });
        got.push(r.status);
        if (r.status === 429) break;
      }
      return got;
    });
    await a.reload();
    await pictureButton(a).waitFor();
    const resp = a.waitForResponse((r) => r.request().method() === 'PUT' && r.url().endsWith('/v1/me/avatar'));
    await upload(a, { name: 'small.png', mimeType: 'image/png', buffer: await png(a, 200, 200) });
    const status = (await resp).status();
    await refusal().getByText("You've changed your picture 20 times today. Try again tomorrow.").waitFor({ timeout: 5000 });
    const twenties = codes.filter((x) => x === 200).length;
    ok('TC-222 #3 the 21st change today', twenties === 19 && codes.at(-1) === 429 && status === 429, `after TC-221's one: ${twenties}×200 then ${codes.at(-1)}; page upload ${status}`);
    await shot(a, '222-03');
    await pictureButton(a).click();
    await a.getByRole('menuitem', { name: 'Remove picture' }).click();
    await a.getByRole('button', { name: 'Add a picture' }).waitFor();
  });

  // ── TC-223: alice blocks bob from their chat ──
  await step('TC-223 #1 the … menu in a direct chat', async () => {
    await openChat(a, /bob/);
    await a.getByRole('button', { name: 'More for bob' }).click();
    const items = (await a.getByRole('menuitem').allInnerTexts()).map((x) => x.trim());
    await a.keyboard.press('Escape');
    ok('TC-223 #1 the … menu in a direct chat', items.join('|') === 'Report bob…|Block bob…|Remove contact…', items.join(' | '));
  });
  await step('TC-223 #2 block dialog, focus on Cancel', async () => {
    await menu(a, 'bob', 'Block bob…');
    const d = a.getByRole('dialog', { name: 'Block bob?' });
    await d.waitFor();
    const text = await d.innerText();
    const focused = await a.evaluate(() => document.activeElement?.textContent?.trim());
    ok(
      'TC-223 #2 block dialog, focus on Cancel',
      focused === 'Cancel' &&
        text.includes("bob can't send you direct messages, contact requests or group invites.") &&
        text.includes('Their messages in groups you share are hidden from you.') &&
        text.includes("Messages between you that haven't been delivered yet are taken back") &&
        text.includes('bob stays in your contacts, and you can unblock them any time.'),
      `focus ${focused}`
    );
    await shot(a, '223-02');
    await d.getByRole('button', { name: 'Cancel' }).click();
    await d.waitFor({ state: 'hidden' });
  });
  await step('TC-223 #3 blocked: no text box, Unblock instead', async () => {
    await menu(a, 'bob', 'Block bob…');
    await a.getByRole('dialog', { name: 'Block bob?' }).getByRole('button', { name: 'Block', exact: true }).click();
    await toast(a, 'bob is blocked.');
    await a.getByText('You blocked bob. Unblock bob to send messages.').waitFor();
    const picker = await a.getByRole('button', { name: /^Sending to/ }).count();
    const box = await composer(a).count();
    await a.getByRole('button', { name: 'More for bob' }).click();
    const items = (await a.getByRole('menuitem').allInnerTexts()).map((x) => x.trim());
    await a.keyboard.press('Escape');
    ok('TC-223 #3 blocked: no text box, Unblock instead', picker === 0 && box === 0 && items.includes('Unblock bob'), `picker ${picker}, text box ${box}, menu ${items.join(' | ')}`);
    await shot(a, '223-03');
  });
  await step('TC-223 #4 contacts mark bob blocked', async () => {
    await a.goto(base + '/contacts');
    const row = await contact(a, /bob/).innerText();
    await contact(a, /bob/).click();
    await a.getByText(/^You blocked bob\. They can't send you direct messages/).waitFor();
    const unblock = await a.locator('main').getByRole('button', { name: 'Unblock', exact: true }).isVisible();
    ok('TC-223 #4 contacts mark bob blocked', /Blocked/.test(row) && unblock, row);
    await shot(a, '223-04');
  });
  await step('TC-223 #5 account and the blocked list', async () => {
    await a.goto(base + '/account');
    await a.getByText('1 account', { exact: true }).waitFor();
    await a.getByRole('link', { name: 'Manage' }).click();
    await a.waitForURL('**/account/blocks');
    const row = a.locator('main li', { hasText: 'bob' });
    await row.waitFor();
    const text = await row.innerText();
    ok('TC-223 #5 account and the blocked list', text.includes(`ID ${B_ID}`) && /Blocked \w+ \d+/.test(text), text);
    await shot(a, '223-05');
  });
  await step('TC-223 #6 unblock at once, the list empties', async () => {
    await a.getByRole('button', { name: 'Unblock bob' }).click();
    await toast(a, 'bob is unblocked.');
    await a.getByText('No blocked accounts').waitFor();
    const dialogs = await a.getByRole('dialog').count();
    const intro = await a.getByText(/^They can't send you direct messages, contact requests or group invites/).isVisible();
    ok('TC-223 #6 unblock at once, the list empties', dialogs === 0 && intro, `dialogs ${dialogs}`);
    await shot(a, '223-06');
  });

  // ── TC-224: bob blocks alice ──
  await step("TC-224 #1 bob blocks alice from their chat", async () => {
    await openChat(b, /alice/);
    await menu(b, 'alice', 'Block alice…');
    await b.getByRole('dialog', { name: 'Block alice?' }).getByRole('button', { name: 'Block', exact: true }).click();
    await toast(b, 'alice is blocked.');
    await b.getByText('You blocked alice. Unblock alice to send messages.').waitFor();
    ok('TC-224 #1 bob blocks alice from their chat', (await b.getByRole('button', { name: /^Sending to/ }).count()) === 0);
  });
  await step("TC-224 #2 alice's message is refused, Discard only", async () => {
    await openChat(a, /bob/);
    await composer(a).fill('T224 are you there?');
    await composer(a).press('Enter');
    const row = article(a, 'T224 are you there?');
    await row.getByText("Not sent. bob doesn't accept your messages.").waitFor({ timeout: 8000 });
    const buttons = (await row.getByRole('button').allInnerTexts()).map((x) => x.trim());
    ok("TC-224 #2 alice's message is refused, Discard only", buttons.join('|') === 'Discard', buttons.join(' | '));
    await shot(a, '224-02');
  });
  await step('TC-224 #3 Discard removes it', async () => {
    await article(a, 'T224 are you there?').getByRole('button', { name: 'Discard' }).click();
    await article(a, 'T224 are you there?').waitFor({ state: 'detached' });
    ok('TC-224 #3 Discard removes it', true);
  });
  await step('TC-224 #4 bob unblocks from the chat', async () => {
    await b.getByRole('button', { name: 'Unblock', exact: true }).click();
    await toast(b, 'alice is unblocked.');
    await composer(b).waitFor();
    ok('TC-224 #4 bob unblocks from the chat', await b.getByRole('button', { name: /^Sending to/ }).isVisible());
  });

  // ── TC-225: bob in release-team ──
  const carolLine = 'Billing webhooks are paused for the 10:00 deploy window.';
  const bobLine = 'Deploy window starts at 10:00. Hold merges to main until I post here again.';
  await step('TC-225 #1 the members in the header', async () => {
    await openChat(b, /release-team/);
    await article(b, carolLine).waitFor();
    const stack = await b.getByRole('button', { name: '3 members of release-team' }).isVisible();
    ok('TC-225 #1 the members in the header', stack && (await b.getByRole('button', { name: '3 members', exact: true }).isVisible()), `stack ${stack}`);
  });
  await step('TC-225 #2 the members list', async () => {
    await b.getByRole('button', { name: '3 members', exact: true }).click();
    const list = b.getByRole('dialog', { name: '3 members' });
    await list.waitFor();
    const text = await list.innerText();
    const buttons = await list.getByRole('button').count();
    ok('TC-225 #2 the members list', /alice[\s\S]*Contact/.test(text) && /bob[\s\S]*You/.test(text) && /carol[\s\S]*Not a contact/.test(text) && text.includes(`ID ${C_ID}`) && buttons === 2, `${text.replace(/\n/g, ' ')} · buttons ${buttons}`);
    await shot(b, '225-02');
  });
  await step("TC-225 #3 carol's card", async () => {
    await b.getByRole('dialog', { name: '3 members' }).getByRole('button', { name: /carol/ }).click();
    const card = b.getByRole('dialog', { name: "carol's profile" });
    await card.waitFor();
    const text = await card.innerText();
    const has = async (name) => (await card.getByRole('button', { name, exact: true }).count()) === 1;
    const shown = { report: await has('Report'), block: await has('Block'), open: await has('Open contact'), unblock: await has('Unblock'), copy: await has(`Copy carol's account ID ${C_ID}`) };
    ok("TC-225 #3 carol's card", text.includes('Not a contact. You share release-team.') && shown.report && shown.block && shown.copy && !shown.open && !shown.unblock, JSON.stringify(shown));
    await shot(b, '225-03');
  });
  await step("TC-225 #4 blocking hides carol's group messages", async () => {
    await b.getByRole('dialog', { name: "carol's profile" }).getByRole('button', { name: 'Block' }).click();
    const d = b.getByRole('dialog', { name: 'Block carol?' });
    await d.waitFor();
    const last = (await d.innerText()).includes('You can unblock carol any time in Account.');
    await d.getByRole('button', { name: 'Block', exact: true }).click();
    await toast(b, 'carol is blocked.');
    await article(b, carolLine).waitFor({ state: 'detached', timeout: 15000 });
    ok("TC-225 #4 blocking hides carol's group messages", last && (await article(b, bobLine).isVisible()), `dialog last line ${last}`);
    await shot(b, '225-04');
  });
  await step('TC-225 #5 the list marks carol blocked', async () => {
    await b.getByRole('button', { name: '3 members', exact: true }).click();
    const row = b.getByRole('dialog', { name: '3 members' }).getByRole('button', { name: /carol/ });
    const text = await row.innerText();
    await row.click();
    const card = b.getByRole('dialog', { name: "carol's profile" });
    const unblock = await card.getByRole('button', { name: 'Unblock' }).isVisible();
    ok('TC-225 #5 the list marks carol blocked', /Blocked/.test(text) && unblock, text);
  });
  await step('TC-225 #6 unblocking shows them again', async () => {
    await b.getByRole('dialog', { name: "carol's profile" }).getByRole('button', { name: 'Unblock' }).click();
    await toast(b, 'carol is unblocked.');
    await article(b, carolLine).waitFor({ timeout: 15000 });
    ok('TC-225 #6 unblocking shows them again', true);
  });

  // ── TC-226: alice reports bob ──
  const reportPosts = [];
  a.on('request', (r) => r.method() === 'POST' && r.url().endsWith('/v1/reports') && reportPosts.push(r));
  await step('TC-226 #1 the report dialog', async () => {
    await openChat(a, /bob/);
    await menu(a, 'bob', 'Report bob…');
    const d = a.getByRole('dialog', { name: 'Report bob' });
    await d.waitFor();
    const radios = (await d.getByRole('radio').allInnerTexts()).map((x) => x.split('\n')[0]);
    const text = await d.innerText();
    ok(
      'TC-226 #1 the report dialog',
      radios.join('|') === 'Spam|Harassment|Inappropriate picture|Something else' && text.includes('0 / 500') && text.includes("Imbo attaches the last 20 messages between you and bob. Only Imbo's admins see them, and bob isn't told."),
      radios.join(' | ')
    );
    await shot(a, '226-01');
  });
  await step('TC-226 #2 a reason is needed', async () => {
    const d = a.getByRole('dialog', { name: 'Report bob' });
    await d.getByRole('button', { name: 'Send report' }).click();
    await d.getByText('Pick a reason first.').waitFor();
    const focused = await a.evaluate(() => document.activeElement?.getAttribute('role'));
    ok('TC-226 #2 a reason is needed', reportPosts.length === 0 && focused === 'radio', `focus ${focused}, requests ${reportPosts.length}`);
  });
  await step('TC-226 #3 details up to 500 characters', async () => {
    const d = a.getByRole('dialog', { name: 'Report bob' });
    await d.getByRole('radio', { name: /^Harassment/ }).click();
    await d.getByLabel('Details (optional)').fill('x'.repeat(501));
    await d.getByText('Details can be up to 500 characters.').waitFor();
    const sendButton = d.getByRole('button', { name: 'Send report' });
    const off = await sendButton.getAttribute('aria-disabled');
    await sendButton.click({ force: true });
    await wait(500);
    ok('TC-226 #3 details up to 500 characters', off === 'true' && reportPosts.length === 0 && (await d.getByText('501 / 500').isVisible()), `aria-disabled ${off}, requests ${reportPosts.length}`);
    await shot(a, '226-03');
  });
  await step('TC-226 #4 sent, with the offer to block', async () => {
    const before = mails().length;
    const d = a.getByRole('dialog', { name: 'Report bob' });
    await d.getByLabel('Details (optional)').fill('T226 keeps pinging me at night');
    await d.getByRole('button', { name: 'Send report' }).click();
    const sent = a.getByRole('dialog', { name: 'Report sent' });
    await sent.getByText('Thanks. We review reports within 24 hours.').waitFor();
    const text = await sent.innerText();
    const m = await nextMail(before);
    made.R1 = m.id;
    ok('TC-226 #4 sent, with the offer to block', text.includes('Block bob too?') && (await sent.getByRole('button', { name: 'Block bob' }).isVisible()) && (await sent.getByRole('button', { name: 'Not now' }).isVisible()), `report ${m.id}`);
    await shot(a, '226-04');
  });
  await step('TC-226 #5 the report mail', async () => {
    const m = mails().find((x) => x.id === made.R1);
    ok('TC-226 #5 the report mail', m?.to === 'reports@imbo.test' && m?.link === `${base}/admin?report=${made.R1}`, `to=${m?.to} link=${m?.link}`);
  });
  await step('TC-226 #6 Not now leaves bob unblocked', async () => {
    await a.getByRole('dialog', { name: 'Report sent' }).getByRole('button', { name: 'Not now' }).click();
    await a.getByRole('dialog').waitFor({ state: 'detached' });
    await a.getByRole('button', { name: 'More for bob' }).click();
    const items = (await a.getByRole('menuitem').allInnerTexts()).map((x) => x.trim());
    await a.keyboard.press('Escape');
    ok('TC-226 #6 Not now leaves bob unblocked', items.includes('Block bob…') && (await composer(a).isVisible()), items.join(' | '));
  });

  // ── TC-227: reporting bob again, and blocking from there ──
  await step('TC-227 #1 already reported counts as sent', async () => {
    const before = mails().length;
    await menu(a, 'bob', 'Report bob…');
    const sent = await report(a, 'bob', 'Spam');
    await sent.getByText("You've already reported bob. We'll review it within 24 hours.").waitFor();
    await wait(1500);
    ok('TC-227 #1 already reported counts as sent', mails().length === before, `mails ${mails().length - before}`);
    await shot(a, '227-01');
  });
  await step('TC-227 #2 Block bob from there', async () => {
    await a.getByRole('dialog', { name: 'Report sent' }).getByRole('button', { name: 'Block bob' }).click();
    await toast(a, 'bob is blocked.');
    await a.getByText('You blocked bob. Unblock bob to send messages.').waitFor();
    ok('TC-227 #2 Block bob from there', (await a.getByRole('dialog').count()) === 0);
  });
  await step('TC-227 #3 Unblock from the menu, no confirmation', async () => {
    await menu(a, 'bob', 'Unblock bob');
    await toast(a, 'bob is unblocked.');
    await composer(a).waitFor();
    ok('TC-227 #3 Unblock from the menu, no confirmation', (await a.getByRole('dialog').count()) === 0);
  });

  // ── TC-228: bob reports carol in release-team ──
  await step("TC-228 #1 carol's card from her name", async () => {
    await openChat(b, /release-team/);
    await b.getByRole('button', { name: "carol's profile" }).first().click();
    const card = b.getByRole('dialog').filter({ hasText: 'You share release-team.' });
    await card.waitFor();
    await card.getByRole('button', { name: 'Report' }).click();
    const d = b.getByRole('dialog', { name: 'Report carol' });
    await d.waitFor();
    ok("TC-228 #1 carol's card from her name", (await d.innerText()).includes('Imbo attaches the last 20 messages carol sent in release-team.'));
    await shot(b, '228-01');
  });
  await step('TC-228 #2 sent', async () => {
    const before = mails().length;
    const d = b.getByRole('dialog', { name: 'Report carol' });
    await d.getByRole('radio', { name: /^Spam/ }).click();
    await d.getByRole('button', { name: 'Send report' }).click();
    await b.getByRole('dialog', { name: 'Report sent' }).getByText('Thanks. We review reports within 24 hours.').waitFor();
    made.R2 = (await nextMail(before)).id;
    await b.getByRole('button', { name: 'Not now' }).click();
    ok('TC-228 #2 sent', made.R2 > made.R1, `report ${made.R2}`);
  });

  // ── TC-229: who gets into the admin pages ──
  await step('TC-229 #1 not an admin: not here', async () => {
    const statuses = [];
    b.on('response', (r) => r.url().includes('/v1/admin/') && statuses.push(r.status()));
    const seen = [];
    for (const path of ['/admin', '/admin/users', `/admin?report=${made.R1}`]) {
      await b.goto(base + path);
      await b.getByText("This page isn't here").waitFor();
      seen.push(path);
    }
    ok('TC-229 #1 not an admin: not here', seen.length === 3 && statuses.every((x) => x === 404), `admin API answers: ${statuses.join(',') || 'none asked'}`);
    await shot(b, '229-01');
  });
  await step('TC-229 #2 no Admin row for bob', async () => {
    await b.goto(base + '/account');
    await b.getByRole('heading', { name: 'Blocked', exact: true }).waitFor();
    ok('TC-229 #2 no Admin row for bob', (await b.getByRole('heading', { name: 'Admin', exact: true }).count()) === 0);
  });
  await step('TC-229 #3 signed out: sign in, keeping the link', async () => {
    await adm.goto(`${base}/admin?report=${made.R2}`);
    await adm.waitForURL(`**/login?next=${encodeURIComponent(`/admin?report=${made.R2}`)}`);
    ok('TC-229 #3 signed out: sign in, keeping the link', true, new URL(adm.url()).search);
  });
  await step('TC-229 #4 the admin signs up', async () => {
    await signIn(adm, 'admin@imbo.test', 'Imbo Admin');
    await adm.waitForURL('**/welcome');
    ok('TC-229 #4 the admin signs up', true);
  });
  await step('TC-229 #5 Admin row on the account page', async () => {
    await adm.goto(base + '/account');
    await adm.getByText("You're an Imbo admin.").waitFor();
    await adm.getByRole('link', { name: 'Open admin' }).click();
    await adm.waitForURL(base + '/admin');
    const tab = adm.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: /Reports/ });
    await until(async () => /Reports\s*2\s*open/.test(await tab.textContent()));
    ok('TC-229 #5 Admin row on the account page', (await tab.getAttribute('aria-current')) === 'page', (await tab.innerText()).replace(/\n/g, ' '));
    await shot(adm, '229-05');
  });
  await step('TC-229 #6 the mail link opens that report', async () => {
    await adm.goto(mails().find((x) => x.id === made.R2).link);
    await adm.getByRole('heading', { name: new RegExp(`^Report #${made.R2}`) }).waitFor();
    ok('TC-229 #6 the mail link opens that report', true);
  });

  // ── TC-230: reading reports ──
  const rows = () => adm.getByRole('navigation', { name: 'Reports', exact: true }).getByRole('link');
  await step('TC-230 #1 open reports, newest first', async () => {
    await adm.goto(base + '/admin');
    await rows().first().waitFor();
    const list = (await rows().allInnerTexts()).map((x) => x.replace(/\n/g, ' '));
    const filter = await adm.getByRole('navigation', { name: 'Which reports' }).innerText();
    ok('TC-230 #1 open reports, newest first', list.length === 2 && /carol.*Spam.*by bob, in release-team/.test(list[0]) && /bob.*Harassment.*by alice, direct chat/.test(list[1]) && /Open\s*2/.test(filter), list.join(' | '));
  });
  await step('TC-230 #2 one report', async () => {
    await rows().nth(1).click();
    await adm.waitForURL(`**/admin?report=${made.R1}`);
    const main = adm.locator('main');
    await main.getByText('Messages between bob and alice').waitFor();
    const text = await main.innerText();
    const file = await main.locator('li', { hasText: 'orders-api-v2.3.md' }).innerText();
    ok(
      'TC-230 #2 one report',
      text.includes(`Report #${made.R1}`) && /Harassment, direct chat, /.test(text) && text.includes(`ID ${B_ID}`) && text.includes('bob@imbo.test') && text.includes(`ID ${A_ID}`) && text.includes('Details from alice') && text.includes('T226 keeps pinging me at night') && text.includes('Last 20, copied when reported') && /orders-api-v2\.3\.md\s*\S*\s*\d+ B/.test(file),
      file.replace(/\n/g, ' ')
    );
    await shot(adm, '230-02');
  });
  await step('TC-230 #3 Copy link', async () => {
    await adm.getByRole('button', { name: 'Copy link' }).click();
    await adm.getByRole('button', { name: /Copied/ }).waitFor();
    const copied = await adm.evaluate(() => navigator.clipboard.readText());
    ok('TC-230 #3 Copy link', copied === `${base}/admin?report=${made.R1}`, copied);
  });
  await step('TC-230 #4 All', async () => {
    // The Open rows stay on screen until the list reloads; count only after the All list has come back.
    const all = adm.waitForResponse((r) => r.url().includes('/v1/admin/reports?status=all'));
    await adm.getByRole('navigation', { name: 'Which reports' }).getByRole('link', { name: 'All' }).click();
    await adm.waitForURL(/status=all/);
    await all;
    await rows().first().waitFor();
    const current = await adm.getByRole('navigation', { name: 'Reports', exact: true }).locator('a[aria-current=page]').innerText();
    const n = await rows().count();
    ok('TC-230 #4 All', n === 2 && /bob/.test(current) && new URL(adm.url()).searchParams.get('report') === String(made.R1), `${adm.url()}; ${n} rows, current ${current.replace(/\s+/g, ' ')}`);
  });

  // ── TC-231: banning carol from her report ──
  await step('TC-231 #1 actions on an open report', async () => {
    await adm.goto(`${base}/admin?report=${made.R2}`);
    await adm.getByRole('button', { name: 'Ban carol' }).waitFor();
    const remove = adm.getByRole('button', { name: 'Remove picture' });
    ok('TC-231 #1 actions on an open report', (await remove.isDisabled()) && (await adm.getByText("carol has no picture, so there's nothing to remove.").isVisible()) && (await adm.getByRole('button', { name: 'Dismiss' }).isVisible()));
  });
  await step('TC-231 #2 the ban dialog', async () => {
    await adm.getByRole('button', { name: 'Ban carol' }).click();
    const d = adm.getByRole('dialog', { name: 'Ban carol?' });
    await d.waitFor();
    const text = await d.innerText();
    const focused = await adm.evaluate(() => document.activeElement?.textContent?.trim());
    ok(
      'TC-231 #2 the ban dialog',
      focused === 'Cancel' && ['Signs carol out on every computer, browser and phone.', 'Takes back undelivered messages', "Cancels carol's subscription on Waffo.", "Closes carol's other open reports."].every((x) => text.includes(x)),
      `focus ${focused}`
    );
    await shot(adm, '231-02');
    await d.getByRole('button', { name: 'Cancel' }).click();
    await d.waitFor({ state: 'detached' });
  });
  await step('TC-231 #3 banned', async () => {
    await adm.getByRole('button', { name: 'Ban carol' }).click();
    await adm.getByRole('dialog', { name: 'Ban carol?' }).getByRole('button', { name: 'Ban carol' }).click();
    await toast(adm, 'carol is banned.');
    const h = adm.getByRole('heading', { name: new RegExp(`^Report #${made.R2}`) });
    await h.getByText('Banned').waitFor();
    await adm.getByText(/^Resolved /).waitFor();
    const actions = await adm.getByRole('button', { name: 'Dismiss' }).count();
    const filterNav = adm.getByRole('navigation', { name: 'Which reports' });
    await until(async () => /Open\s*1/.test(await filterNav.textContent())).catch(() => {});
    const filter = await filterNav.innerText();
    ok('TC-231 #3 banned', actions === 0 && /Open\s*1/.test(filter), filter.replace(/\n/g, ' '));
    await shot(adm, '231-03');
  });
  await step("TC-231 #4 carol's page signs out", async () => {
    await c.waitForURL('**/login**', { timeout: 30000 });
    ok("TC-231 #4 carol's page signs out", true, new URL(c.url()).pathname);
  });
  await step("TC-231 #5 carol's terminal is signed out", async () => {
    let code = 0, text = '';
    try {
      text = sh('IMBO_HOME=$L/carol "$IMBO" inbox 2>&1');
    } catch (e) {
      code = e.status;
      text = `${e.stdout}`;
    }
    ok("TC-231 #5 carol's terminal is signed out", code !== 0, `exit ${code}: ${text.trim().split('\n')[0]}`);
  });
  await step("TC-231 #6 alice sees carol inactive", async () => {
    await a.goto(base + '/contacts');
    const row = await contact(a, /carol/).innerText();
    ok('TC-231 #6 alice sees carol inactive', /Inactive/.test(row), row.replace(/\n/g, ' '));
  });

  // ── TC-232: carol tries to sign in ──
  await step('TC-232 #1 the banned message, with a mail link', async () => {
    const before = codeLines('carol@imbo.test').length;
    await c.goto(base + '/login');
    await c.getByLabel('Email').fill('carol@imbo.test');
    await c.getByRole('button', { name: 'Continue' }).click();
    const alert = c.getByRole('alert').filter({ hasText: 'This account has been banned.' });
    await alert.waitFor();
    const text = await alert.innerText();
    const href = await alert.getByRole('link').getAttribute('href');
    ok('TC-232 #1 the banned message, with a mail link', text.trim() === 'This account has been banned. If you think this is a mistake, write to reports@imbo.test.' && href === 'mailto:reports@imbo.test' && codeLines('carol@imbo.test').length === before, `${text} · ${href}`);
    await shot(c, '232-01');
  });

  // ── TC-233: removing a picture, dismissing, a report already handled ──
  await step('TC-233 #1 bob has a picture now; bob reports alice', async () => {
    await b.goto(base + '/account');
    await upload(b, { name: 'bob.png', mimeType: 'image/png', buffer: await png(b, 300, 300) });
    await b.getByRole('button', { name: 'Change picture' }).waitFor();
    const before = mails().length;
    await openChat(b, /alice/);
    await menu(b, 'alice', 'Report alice…');
    const sent = await report(b, 'alice', 'Something else', 'T233 test report');
    await sent.waitFor();
    made.R3 = (await nextMail(before)).id;
    await sent.getByRole('button', { name: 'Not now' }).click();
    await adm.goto(`${base}/admin?report=${made.R1}`);
    await adm.getByText('Picture changed since the report').waitFor();
    const img = await adm.locator('main').locator('img').count();
    ok('TC-233 #1 bob has a picture now; bob reports alice', img >= 1, `report ${made.R3}`);
    await shot(adm, '233-01');
  });
  await step("TC-233 #2 Remove picture", async () => {
    await adm.getByRole('button', { name: 'Remove picture' }).click();
    await toast(adm, "bob's picture is removed.");
    await adm.getByRole('heading', { name: new RegExp(`^Report #${made.R1}`) }).getByText('Picture removed').waitFor();
    await b.goto(base + '/account');
    await b.getByRole('button', { name: 'Add a picture' }).waitFor();
    ok('TC-233 #2 Remove picture', true);
  });
  const stale = await ADM.newPage();
  watch(stale);
  await step('TC-233 #3 Dismiss', async () => {
    await stale.goto(`${base}/admin?report=${made.R3}`);
    await stale.getByRole('button', { name: 'Dismiss' }).waitFor();
    await adm.goto(`${base}/admin?report=${made.R3}`);
    await adm.getByRole('button', { name: 'Dismiss' }).click();
    await toast(adm, `Report #${made.R3} is dismissed.`);
    await adm.getByRole('heading', { name: new RegExp(`^Report #${made.R3}`) }).getByText('Dismissed').waitFor();
    ok('TC-233 #3 Dismiss', true);
  });
  await step('TC-233 #4 a tab left open on it', async () => {
    await stale.getByRole('button', { name: 'Dismiss' }).click();
    await stale.getByText('This report was already resolved.').waitFor();
    await stale.getByRole('heading', { name: new RegExp(`^Report #${made.R3}`) }).getByText('Dismissed').waitFor();
    ok('TC-233 #4 a tab left open on it', (await stale.getByRole('button', { name: 'Dismiss' }).count()) === 0);
    await shot(stale, '233-04');
  });
  await step('TC-233 #5 All marks what was done', async () => {
    await adm.goto(`${base}/admin?status=all`);
    const list = adm.getByRole('navigation', { name: 'Reports', exact: true });
    await list.getByRole('link').nth(2).waitFor();
    const rows = (await list.getByRole('link').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim());
    const tag = (text) => rows.find((x) => x.includes(text)) ?? '';
    ok('TC-233 #5 All marks what was done', rows.length === 3 && tag('Something else').includes('Dismissed') && tag('Spam').includes('Banned') && tag('Harassment').includes('Resolved'), rows.join(' | '));
    await shot(adm, '233-05');
  });
  await stale.close();

  // ── TC-234: users ──
  const userRow = (name) => adm.locator('tbody tr', { hasText: name });
  await step('TC-234 #1 all accounts', async () => {
    await adm.goto(base + '/admin/users');
    await adm.getByText(/accounts, newest first$/).waitFor();
    const me = await userRow('admin@imbo.test').innerText();
    ok('TC-234 #1 all accounts', /Admin/.test(me) && me.includes("Admins can't be banned"), me.replace(/\n/g, ' '));
  });
  await step('TC-234 #2 search by email', async () => {
    await adm.getByLabel('Search by account ID or email').fill('carol@imbo.test');
    await adm.waitForURL(/q=carol%40imbo\.test/);
    await adm.getByText('1 match', { exact: true }).waitFor();
    const row = await userRow('carol@imbo.test').innerText();
    ok('TC-234 #2 search by email', /Banned/.test(row) && /Unban/.test(row) && /Delete…/.test(row), row.replace(/\n/g, ' '));
  });
  await step('TC-234 #3 Unban', async () => {
    await userRow('carol@imbo.test').getByRole('button', { name: 'Unban' }).click();
    await toast(adm, 'carol is unbanned.');
    await userRow('carol@imbo.test').getByRole('button', { name: 'Ban…' }).waitFor();
    ok('TC-234 #3 Unban', /Active/.test(await userRow('carol@imbo.test').innerText()));
  });
  await step('TC-234 #4 Ban from Users', async () => {
    await userRow('carol@imbo.test').getByRole('button', { name: 'Ban…' }).click();
    await adm.getByRole('dialog', { name: 'Ban carol?' }).getByRole('button', { name: 'Ban carol' }).click();
    await toast(adm, 'carol is banned.');
    await userRow('carol@imbo.test').getByRole('button', { name: 'Delete…' }).waitFor();
    ok('TC-234 #4 Ban from Users', /Banned/.test(await userRow('carol@imbo.test').innerText()));
  });
  await step('TC-234 #5 Delete, typing DELETE', async () => {
    await userRow('carol@imbo.test').getByRole('button', { name: 'Delete…' }).click();
    const d = adm.getByRole('dialog', { name: "Delete carol's account?" });
    await d.waitFor();
    const text = await d.innerText();
    const go = d.getByRole('button', { name: 'Delete account' });
    const off1 = await go.isDisabled();
    await d.getByLabel('Type DELETE to confirm').fill('delete');
    const off2 = await go.isDisabled();
    await d.getByLabel('Type DELETE to confirm').fill('DELETE');
    const on = await go.isEnabled();
    await shot(adm, '234-05');
    await go.click();
    await toast(adm, "carol's account is deleted.");
    await adm.getByText('No account matches').waitFor();
    ok('TC-234 #5 Delete, typing DELETE', off1 && off2 && on && text.includes('groups carol owns are dissolved') && text.includes('carol@imbo.test can sign up again as a new account'), `disabled ${off1}/${off2}, then enabled ${on}`);
  });
  await step('TC-234 #6 carol signs up again as a new account', async () => {
    await c.goto(base + '/login');
    await signIn(c, 'carol@imbo.test', 'carol');
    await c.waitForURL('**/welcome');
    const me = await (await C.request.get(base + '/v1/me')).json();
    ok('TC-234 #6 carol signs up again as a new account', me.account.id !== Number(C_ID) && String(me.account.id).length === 8, `${C_ID} → ${me.account.id}`);
  });

  // ── TC-235: Waffo doesn't cancel the subscription ──
  await step('TC-235 #1 ban from a report; the subscription stays', async () => {
    const paid = sh(`python3 ${crates}scripts/waffo-event.py subscription.activated --order ORD_t235 --account ${B_ID} --period-end +30d`);
    if (!paid.includes('\n200')) throw new Error(`paid event: ${paid.trim().split('\n').at(-2)}`);
    const before = mails().length;
    await openChat(a, /bob/);
    await menu(a, 'bob', 'Report bob…');
    const sent = await report(a, 'bob', 'Spam');
    await sent.getByText('Thanks. We review reports within 24 hours.').waitFor();
    made.R4 = (await nextMail(before)).id;
    await sent.getByRole('button', { name: 'Not now' }).click();
    const refused = log().split('waffo refused').length;
    await adm.goto(`${base}/admin?report=${made.R4}`);
    await adm.getByRole('button', { name: 'Ban bob' }).click();
    await adm.getByRole('dialog', { name: 'Ban bob?' }).getByRole('button', { name: 'Ban bob' }).click();
    await toast(adm, 'bob is banned.');
    await adm.getByText("bob is banned, but the subscription isn't canceled yet.").waitFor();
    ok('TC-235 #1 ban from a report; the subscription stays', log().split('waffo refused').length - refused === 1 && (await adm.getByRole('button', { name: 'Retry' }).isVisible()), `report ${made.R4}`);
    await shot(adm, '235-01');
  });
  await step('TC-235 #2 Retry, refused again', async () => {
    const refused = log().split('waffo refused').length;
    await adm.getByRole('button', { name: 'Retry' }).click();
    await adm.getByRole('button', { name: 'Retrying…' }).waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    await adm.getByRole('button', { name: 'Retry', exact: true }).waitFor({ timeout: 20000 });
    ok('TC-235 #2 Retry, refused again', log().split('waffo refused').length - refused === 1 && (await adm.getByText("bob is banned, but the subscription isn't canceled yet.").isVisible()));
  });
  await step('TC-235 #3 Users marks it; Retry cancel', async () => {
    await adm.goto(`${base}/admin/users?q=bob%40imbo.test`);
    const row = userRow('bob@imbo.test');
    await row.getByText('Subscription not canceled').waitFor();
    await row.getByRole('button', { name: 'Retry cancel' }).click();
    await toast(adm, "Waffo still didn't confirm the cancel. Try again later.");
    ok('TC-235 #3 Users marks it; Retry cancel', await row.getByText('Subscription not canceled').isVisible());
    await shot(adm, '235-03');
  });
  await step("TC-235 #4 Delete can't go through", async () => {
    await userRow('bob@imbo.test').getByRole('button', { name: 'Delete…' }).click();
    const d = adm.getByRole('dialog', { name: "Delete bob's account?" });
    await d.getByLabel('Type DELETE to confirm').fill('DELETE');
    await d.getByRole('button', { name: 'Delete account' }).click();
    await d.getByText("Couldn't cancel bob's subscription, so nothing was deleted. Try again later.").waitFor({ timeout: 20000 });
    await shot(adm, '235-04');
    await d.getByRole('button', { name: 'Cancel' }).click();
    ok("TC-235 #4 Delete can't go through", await userRow('bob@imbo.test').isVisible());
  });

  // ── TC-236: dashboard ──
  let stats;
  await step('TC-236 #1 the four numbers', async () => {
    await adm.goto(base + '/admin/dashboard');
    await adm.getByText(/^Counted when you open this page, /).waitFor();
    stats = await (await ADM.request.get(base + '/v1/admin/stats')).json();
    const tile = async (label) => (await adm.locator('dl > div', { has: adm.locator('dt', { hasText: new RegExp(`^${label}$`) }) }).locator('dd').first().innerText()).replace(/,/g, '');
    const got = [await tile('Accounts'), await tile('Active in the last 7 days'), await tile('Paying now'), await tile('Messages today')].map(Number);
    const want = [stats.accounts, stats.active_7d, stats.paid, stats.messages_today];
    ok('TC-236 #1 the four numbers', got.join() === want.join() && stats.days.length === 30, `page ${got.join(',')} · API ${want.join(',')}`);
    await shot(adm, '236-01');
  });
  await step('TC-236 #2 a chart read with the arrow keys', async () => {
    const charts = await adm.getByRole('img').evaluateAll((xs) => xs.map((x) => x.getAttribute('aria-labelledby') && document.getElementById(x.getAttribute('aria-labelledby'))?.textContent).filter(Boolean));
    const chart = adm.getByRole('img', { name: 'Messages per day' });
    await chart.focus();
    await adm.keyboard.press('ArrowLeft');
    const tip = await chart.locator('div.absolute').innerText();
    const d = stats.days[28];
    ok('TC-236 #2 a chart read with the arrow keys', charts.join('|') === 'Accounts|Active in the last 7 days|Messages per day' && tip.includes(`${d.messages.toLocaleString('en-US')} messages`), `${charts.join(' | ')} · ${tip.replace(/\n/g, ' ')} · API ${d.date} ${d.messages}`);
    await shot(adm, '236-02');
  });
  await step('TC-236 #3 as a table', async () => {
    await adm.getByRole('link', { name: 'Show as table' }).click();
    await adm.waitForURL(/view=table/);
    const body = adm.locator('table tbody tr');
    await body.first().waitFor();
    const first = (await body.first().locator('td').allInnerTexts()).map((x) => Number(x.replace(/,/g, '')));
    const d = stats.days[29];
    ok('TC-236 #3 as a table', (await body.count()) === 30 && first.join() === [d.accounts, d.active_7d, d.messages].join(), `rows ${await body.count()}, newest ${first.join(',')}`);
    await shot(adm, '236-03');
  });

  // ── TC-237: a 390 px wide phone ──
  const phone = { viewport: { width: 390, height: 844 } };
  const PA = await browser.newContext({ ...phone, storageState: await ADM.storageState() });
  const PL = await browser.newContext({ ...phone, storageState: await A.storageState() });
  const pa = await PA.newPage();
  const pl = await PL.newPage();
  watch(pa);
  watch(pl);
  // Nothing sticks out past the right edge (fixed layers and screen-reader-only text aside), and the page doesn't scroll sideways.
  const fits = async (p) => {
    const r = await p.evaluate(() => ({
      wide: document.scrollingElement.scrollWidth,
      out: [...document.querySelectorAll('body *')]
        .filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5 && getComputedStyle(e).position !== 'fixed' && !e.closest('.sr-only'))
        .slice(0, 3)
        .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}`),
    }));
    if (r.out.length || r.wide > 390) checks.push(`  (overflow on ${new URL(p.url()).pathname}: width ${r.wide}, ${r.out.join(', ')})`);
    return !r.out.length && r.wide <= 390;
  };
  await step('TC-237 #1 reports: the list, then one report', async () => {
    await pa.goto(base + '/admin?status=all');
    const list = pa.getByRole('navigation', { name: 'Reports', exact: true });
    await list.getByRole('link').first().waitFor();
    const navBelow = await pa.evaluate(() => document.querySelector('nav[aria-label="Admin sections"]').getBoundingClientRect().top >= document.querySelector('header a').getBoundingClientRect().bottom - 1);
    const fit1 = await fits(pa);
    await shot(pa, '237-01');
    await list.getByRole('link').first().click();
    await pa.getByRole('link', { name: 'Back to reports' }).waitFor();
    const listHidden = !(await list.isVisible());
    const fit2 = await fits(pa);
    await shot(pa, '237-02');
    await pa.getByRole('link', { name: 'Back to reports' }).click();
    await list.waitFor();
    ok('TC-237 #1 reports: the list, then one report', navBelow && fit1 && fit2 && listHidden, `tabs under the logo ${navBelow}, fits ${fit1}/${fit2}, list hidden ${listHidden}`);
  });
  await step('TC-237 #2 users and dashboard fit', async () => {
    await pa.goto(base + '/admin/users');
    await pa.getByText(/accounts, newest first$/).waitFor();
    const u = await fits(pa);
    await shot(pa, '237-03');
    await pa.goto(base + '/admin/dashboard');
    await pa.getByRole('img', { name: 'Accounts' }).waitFor();
    const d = await fits(pa);
    await shot(pa, '237-04');
    ok('TC-237 #2 users and dashboard fit', u && d, `users ${u}, dashboard ${d}`);
  });
  await step('TC-237 #3 account, blocked list and the block sheet', async () => {
    await pl.goto(base + '/account');
    await pl.getByRole('heading', { name: 'Blocked', exact: true }).waitFor();
    const acc = await fits(pl);
    await pl.goto(base + '/account/blocks');
    await pl.getByText('No blocked accounts').waitFor();
    const blocks = await fits(pl);
    await pl.goto(base + '/chats');
    await chat(pl, /bob/).click();
    await menu(pl, 'bob', 'Block bob…');
    const d = pl.getByRole('dialog', { name: 'Block bob?' });
    await d.waitFor();
    await wait(600);
    const box = await d.boundingBox();
    await shot(pl, '237-05');
    await d.getByRole('button', { name: 'Cancel' }).click();
    ok('TC-237 #3 account, blocked list and the block sheet', acc && blocks && Math.round(box.y + box.height) === 844 && Math.round(box.width) === 390, `fits ${acc}/${blocks}, sheet ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}×${Math.round(box.height)}`);
  });
  await PA.close();
  await PL.close();
} finally {
  await browser.close();
}
console.log(checks.join('\n'));
console.log(`\nreports: ${Object.entries(made).map(([k, v]) => `${k}=${v}`).join(' ')}`);
console.log(errors.length ? `\nconsole errors:\n${errors.join('\n')}` : '\nno console errors');
