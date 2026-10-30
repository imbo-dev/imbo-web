// TC-351 (docs/TEST.md): sessions in Kimi Code, pi, Hermes Agent and DeepSeek Harness show the tool's name, not its ID. Setup is
// §3「网页」, the page http://localhost:5190 (`npm run dev`). Prints PASS/FAIL per step. Codes are read from $L/server.log and
// never printed.
// usage: node web/app/tests/tool-names.mjs <screenshot dir>
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
const sh = (cmd) => execFileSync('sh', ['-c', `. ${crates}scripts/local-env.sh; ${cmd}`], { encoding: 'utf8' }).replace(/\x1b\[[0-9;]*m/g, '');
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

const sessions = [
  ['t351-kimi', 'kimi-code', 'Kimi Code'],
  ['t351-pi', 'pi', 'pi'],
  ['t351-hermes', 'hermes', 'Hermes Agent'],
  ['t351-dsh', 'deepseek-harness', 'DeepSeek Harness'],
];
const fake = (extra) =>
  sessions.forEach(([title, tool], i) =>
    sh(`IMBO_HOME=$L/alice "$IMBO" dev fake-session 55555555-aaaa-bbbb-cccc-00000035100${i + 1} --title ${title} --tool ${tool} ${extra}`));

fake('');
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' })).newPage();
  await page.goto(base + '/login');
  const before = codeLines('alice@imbo.test').length;
  await page.getByLabel('Email').fill('alice@imbo.test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your email').waitFor();
  await page.keyboard.type(await codeFor('alice@imbo.test', before));
  await page.waitForURL('**/chats');

  const row = (title) => page.getByRole('navigation', { name: 'My sessions' }).getByRole('link').filter({ hasText: title });

  await step('TC-351 #1', async () => {
    await page.goto(base + '/sessions');
    await row('t351-dsh').waitFor();
    const read = [];
    for (const [title, , name] of [...sessions, ['checkout', 'claude-code', 'Claude Code']]) {
      const text = (await row(title).innerText()).replace(/\s+/g, ' ');
      read.push([title, name, text]);
    }
    await page.screenshot({ path: `${out}/tc351-1.png` });
    const wrong = read.filter(([title, name, text]) => !text.includes(` ${name}`));
    ok('TC-351 #1 each row names its tool', !wrong.length, wrong.length ? wrong.map(([t, n, x]) => `${t}: wants ${n}, reads "${x}"`).join(' / ') : read.map(([, , x]) => x).join(' / '));
  });

  await step('TC-351 #2', async () => {
    await row('t351-hermes').click();
    await page.waitForURL(/\/sessions\/[^/]+$/);
    const head = page.getByRole('main').locator('header').first();
    await head.getByText('t351-hermes').waitFor();
    const text = (await head.innerText()).replace(/\s+/g, ' ');
    await page.screenshot({ path: `${out}/tc351-2.png` });
    ok('TC-351 #2 the session page names Hermes Agent', text.includes('Hermes Agent'), `header reads "${text}"`);
  });
} finally {
  await browser.close();
  fake('--remove');
}
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(`${failed} failed`);
process.exit(failed ? 1 : 0);
