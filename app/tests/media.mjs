// TC-533 (docs/TEST.md): pictures and videos in a chat on the web page, against the local test server. Setup is the TC's
// 前置; the page must be http://localhost:5190 (`npm run dev`) and the files in ~/.cache/imbo-test/media. Runs in
// Playwright's own Chromium: it plays the webm and the H.264 mp4, not the ProRes mov.
// Prints PASS/FAIL per step, then any console errors the steps don't expect. Codes are read from $L/server.log and never
// printed.
// usage: node web/app/tests/media.mjs <screenshot dir>
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

const { chromium } = await import(`${execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()}/playwright/index.mjs`);
const base = 'http://localhost:5190';
const api = 'http://127.0.0.1:18080';
const L = '/tmp/imbo-t';
const MEDIA = `${os.homedir()}/.cache/imbo-test/media`;
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

// 前置: bob sends alice one message with the six files, uploaded from his computer (API-026, API-015).
const NAMES = ['T531-small.png', 'T531-anim.gif', 'T531-big.jpg', 'T531-broken.webp', 'T532-clip.mp4', 'T532-clip.webm', 'T533-prores.mov'];
const id = {};
for (const name of NAMES) {
  const data = fs.readFileSync(`${MEDIA}/${name}`);
  const r = await fetch(`${api}/v1/files`, {
    method: 'POST',
    body: data,
    headers: {
      authorization: `Bearer ${token('bob')}`,
      'content-type': 'application/octet-stream',
      'imbo-file-name': name,
      'imbo-file-sha256': createHash('sha256').update(data).digest('hex'),
    },
  });
  id[name] = (await r.json()).file.id;
}
const sent = await fetch(`${api}/v1/messages`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token('bob')}`, 'content-type': 'application/json' },
  body: JSON.stringify({ to: 'alice', body: 'T533 media', client_msg_id: 'T533 media', files: Object.values(id) }),
});
if (!sent.ok) throw new Error(`bob's message: ${sent.status}`);

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
  const { cookies } = await ctx.storageState();
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  const t = (p, name) => p.getByTestId(name);
  const openChat = async (p) => {
    await p.goto(base + '/chats');
    await p.getByRole('navigation', { name: /Chats|对话/ }).getByRole('link', { name: /^bob/ }).first().click();
    await p.locator('main article', { hasText: 'T533 media' }).first().waitFor();
  };
  const box = async (l) => {
    const b = await l.boundingBox();
    return `${Math.round(b.width)}x${Math.round(b.height)}`;
  };

  await step('TC-533 #1', async () => {
    await openChat(page);
    const png = t(page, `file-thumb-${id['T531-small.png']}`);
    const gif = t(page, `file-thumb-${id['T531-anim.gif']}`);
    await png.waitFor();
    await gif.waitFor();
    const sizes = [await box(png), await box(gif)];
    const square = sizes.every((s) => {
      const [w, h] = s.split('x').map(Number);
      return Math.abs(w / h - 4 / 3) < 0.03;
    });
    // The GIF cycles red, green and blue every 0.3 s: four screenshots of it 0.25 s apart aren't all the same.
    const frames = new Set();
    for (let i = 0; i < 4; i++) {
      frames.add((await gif.screenshot()).toString('base64'));
      await wait(250);
    }
    const load = t(page, `file-load-${id['T531-big.jpg']}`);
    await load.waitFor();
    const broken = await t(page, `file-thumb-${id['T531-broken.webp']}`).count();
    const brokenCard = await page.getByText('T531-broken.webp').count();
    await shot(page, 'tc533-1');
    ok(
      'TC-533 #1 two 4:3 thumbnails, the GIF moving, Load image on the big one, a card for the broken one',
      square && frames.size >= 2 && (await load.innerText()) === 'Load image' && broken === 0 && brokenCard > 0,
      `thumbnails ${sizes.join(', ')}, GIF frames ${frames.size}, broken thumbnail ${broken}, card ${brokenCard}`,
    );
  });

  await step('TC-533 #2', async () => {
    await t(page, `file-load-${id['T531-big.jpg']}`).click();
    await t(page, `file-thumb-${id['T531-big.jpg']}`).waitFor({ timeout: 30_000 });
    await shot(page, 'tc533-2');
    ok('TC-533 #2 Load image shows the big one', true);
  });

  await step('TC-533 #3', async () => {
    await t(page, `file-thumb-${id['T531-small.png']}`).click();
    const viewer = t(page, 'file-viewer');
    await viewer.waitFor();
    const named = await viewer.getByText('T531-small.png').count();
    const img = viewer.locator('img');
    const width = async () => (await img.boundingBox()).width;
    const w1 = await width();
    // The zoom layer above the picture takes the pointer, so the double click goes to the picture's middle.
    const b = await img.boundingBox();
    await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
    await wait(600);
    const w2 = await width();
    await shot(page, 'tc533-3');
    await page.keyboard.press('Escape');
    await viewer.waitFor({ state: 'detached' });
    ok('TC-533 #3 full screen, a double click zooms in, Esc closes', named > 0 && w2 > w1 * 1.5, `width ${Math.round(w1)} -> ${Math.round(w2)}`);
  });

  // Opens the video and closes it again after 1.5 s: how far it played by then, in seconds.
  const played = async (name, n) => {
    await t(page, `file-video-${id[name]}`).click();
    const video = t(page, 'file-viewer-video');
    await video.waitFor({ timeout: 20_000 });
    await wait(1500);
    const at = await video.evaluate((v) => v.currentTime);
    await shot(page, `tc533-${n}`);
    await t(page, 'file-viewer-close').click();
    await t(page, 'file-viewer').waitFor({ state: 'detached' });
    return at;
  };
  await step('TC-533 #4', async () => {
    const webm = await played('T532-clip.webm', '4-webm');
    const mp4 = await played('T532-clip.mp4', '4-mp4');
    ok('TC-533 #4 the webm and the mp4 download, then play', webm > 0.5 && mp4 > 0.5, `after 1.5 s: webm at ${webm.toFixed(2)} s, mp4 at ${mp4.toFixed(2)} s`);
  });

  await step('TC-533 #5', async () => {
    await t(page, `file-video-${id['T533-prores.mov']}`).click();
    const notice = page.getByText("This video can't play here. Download it to open it in another app.");
    await notice.waitFor({ timeout: 20_000 });
    const download = await t(page, 'file-viewer').getByRole('link', { name: 'Download' }).count();
    await shot(page, 'tc533-5');
    await page.keyboard.press('Escape');
    ok("TC-533 #5 the ProRes mov can't play here: the notice and Download", download > 0);
  });

  await step('TC-533 #6', async () => {
    const dark = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN', colorScheme: 'dark', storageState: { cookies, origins: [] } });
    const p = await dark.newPage();
    p.on('console', (m) => m.type() === 'error' && consoleErrors.push([current, m.text()]));
    await openChat(p);
    const load = t(p, `file-load-${id['T531-big.jpg']}`);
    await load.waitFor();
    const word = await load.innerText();
    const wide = await p.evaluate(() => document.documentElement.scrollWidth);
    await shot(p, 'tc533-6');
    await dark.close();
    ok('TC-533 #6 dark, 390 wide, in Chinese', word === '加载图片' && wide <= 390, `button "${word}", page ${wide} wide`);
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
