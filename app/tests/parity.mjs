// TC-380~TC-396 (docs/TEST.md): what the web can now do that only the terminal could, against the local test server.
// Setup is the TCs' 前置 (§3「网页补齐终端功能」); the page must be http://localhost:5190 (`npm run dev`). The cases build
// on each other and run in order. Prints PASS/FAIL per step, then any console errors the steps don't expect. Codes are
// read from $L/server.log and never printed.
// usage: node web/app/tests/parity.mjs <screenshot dir>
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
const sh = (cmd) => execFileSync('sh', ['-c', `. ${root}crates/scripts/local-env.sh; ${cmd}`], { encoding: 'utf8' }).replace(/\x1b\[[0-9;]*m/g, '');
const home = (who) => (['dave', 'erin'].includes(who) ? `${L}/extra/${who}` : `${L}/${who}`);
const as = (who, args) => sh(`IMBO_HOME=${home(who)} "$IMBO" ${args}`);
const ids = Object.fromEntries(fs.readFileSync(`${L}/ids.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').slice(0, 2)));
const token = (who) => fs.readFileSync(`${home(who)}/credentials`, 'utf8').match(/^token = "(.*)"/m)[1];
const api = async (who, method, path, body) => {
  const r = await fetch(`http://127.0.0.1:18080${path}`, { method, headers: { authorization: `Bearer ${token(who)}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  return [r.status, await r.json().catch(() => null)];
};
const A = Number(ids.alice);
const B = Number(ids.bob);
const C = Number(ids.carol);
const D = (await api('dave', 'GET', '/v1/me'))[1].account.id;
const E = (await api('erin', 'GET', '/v1/me'))[1].account.id;
const ordersApi = '55555555-aaaa-bbbb-cccc-0000000b0001';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, done, ms = 15000) => {
  let v;
  for (const end = Date.now() + ms; ; await wait(500)) {
    v = await fn();
    if (done(v) || Date.now() > end) return v;
  }
};

const codeLines = (email) => fs.readFileSync(`${L}/server.log`, 'utf8').split('\n').filter((l) => l.includes('mail-log-only code=') && l.endsWith(`email=${email}`));
async function codeFor(email, after) {
  for (let i = 0; i < 50; i++) {
    const lines = codeLines(email);
    if (lines.length > after) return lines.at(-1).match(/code=(\d+)/)[1];
    await wait(200);
  }
  throw new Error(`no code for ${email}`);
}

// Contrast of an element's text against the first opaque background behind it, as the page renders it.
const contrast = (loc) =>
  loc.evaluate((el) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (c) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    };
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    let bg = [0, 0, 0, 0];
    for (let e = el; e && bg[3] < 255; e = e.parentElement) bg = rgba(getComputedStyle(e).backgroundColor);
    const [a, b] = [lum(rgba(getComputedStyle(el).color)), lum(bg)].sort((x, y) => y - x);
    return Math.round(((a + 0.05) / (b + 0.05)) * 10) / 10;
  });
// Elements that cut their text with an ellipsis.
const clipped = (loc) =>
  loc.evaluate((root) =>
    [root, ...root.querySelectorAll('*')].filter((e) => getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.slice(0, 40))
  );
const inWindow = (box, w, h) => !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= w + 0.5 && box.y + box.height <= h + 0.5;

// Each console error is kept with the step it came in; the refusals the steps provoke are expected.
let current = 'login';
const consoleErrors = [];
const expected = {
  'login alice': /status of 401 /,
  'login bob': /status of 401 /,
  'login dave': /status of 401 /,
  'TC-381 #4': /status of 409 /,
  'TC-385 #6': /status of 404 /,
  'TC-382 #2': /status of 404 /,
  'TC-382 #3': /status of 422 /,
  'TC-382 #4': /status of 409 /,
  'TC-394 #3': /status of 401 /,
  'TC-395 #3': /status of 401 /,
};
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
  const newPage = async (who, viewport = { width: 1280, height: 800 }) => {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push([current, `${who}: ${m.text()}`]));
    page.on('pageerror', (e) => consoleErrors.push([current, `${who} pageerror: ${e.message}`]));
    const was = current;
    current = `login ${who}`;
    await page.goto(base + '/login');
    const before = codeLines(`${who}@imbo.test`).length;
    await page.getByLabel('Email').fill(`${who}@imbo.test`);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText('Check your email').waitFor();
    await page.keyboard.type(await codeFor(`${who}@imbo.test`, before));
    await page.waitForURL('**/chats');
    current = was;
    return page;
  };
  const alice = await newPage('alice');
  const bob = await newPage('bob');
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  const dialog = (p) => p.getByRole('dialog');
  const toast = async (p, text) => {
    const t = p.locator('[data-sonner-toast]').filter({ hasText: text }).first();
    try {
      await t.waitFor({ timeout: 8000 });
      return (await t.innerText()).replace(/\s+/g, ' ');
    } catch {
      return `(none) ${(await p.locator('[data-sonner-toast]').allInnerTexts()).join(' | ')}`;
    }
  };
  const focused = (p) => p.evaluate(() => (document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '').trim());
  const composer = (p) => p.locator('textarea.composer');
  const chats = (p) => p.getByRole('navigation', { name: 'Chats' });
  const contacts = (p) => p.getByRole('navigation', { name: 'Contacts' });
  const openChat = async (p, name) => {
    await p.goto(base + '/chats');
    await chats(p).getByRole('link', { name }).first().click();
    await composer(p).waitFor();
  };
  const row = (p, text) => p.locator('article', { hasText: text }).last();
  // The page's own API calls go with its cookie and Origin.
  const pageApi = (p, method, path, body) =>
    p.evaluate(async ([method, path, body]) => {
      const r = await fetch(path, { method, credentials: 'include', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
      return [r.status, await r.json().catch(() => null)];
    }, [method, path, body]);
  const checkout = '55555555-aaaa-bbbb-cccc-0000000a0001';
  const picker = (p) => p.getByRole('button', { name: /^Sending to .*\. Change$/ });
  const pick = async (p, name) => {
    await picker(p).click();
    await p.getByRole('menuitemradio', { name }).click();
  };
  const groupId = async (who, name) => (await api(who, 'GET', '/v1/groups'))[1].groups.find((g) => g.name === name)?.id;
  const G = await groupId('alice', 'release-team');

  // TC-380: who wrote each group message
  await step('TC-380 #1', async () => {
    await openChat(alice, /release-team/);
    await row(alice, 'Deploy window starts').waitFor();
    const heads = await alice.locator('article header').allInnerTexts();
    const bobHead = await row(alice, 'Deploy window starts').locator('header').innerText();
    const carolHead = await row(alice, 'Billing webhooks').locator('header').innerText();
    await shot(alice, 'tc380-1');
    ok('TC-380 #1 Terminal #bob, Terminal #carol, no "to #"', /Terminal\s*#bob/.test(bobHead) && /Terminal\s*#carol/.test(carolHead) && !heads.some((t) => /\bto #/.test(t)), `${bobHead} | ${carolHead}`);
  });
  await step('TC-380 #2', async () => {
    sh(`python3 $M $L/bob send '{"to":"#${G}","body":"T380 from orders-api"}' --session claude-code:${ordersApi}`);
    as('bob', `dev fake-session ${ordersApi} --title orders-api`);
    await row(alice, 'T380 from orders-api').waitFor({ timeout: 15000 });
    const head = await row(alice, 'T380 from orders-api').locator('header').innerText();
    ok('TC-380 #2 session message reads orders-api #bob', /orders-api\s*#bob/.test(head), head);
  });
  await step('TC-380 #3', async () => {
    await composer(alice).fill('T380 from the web');
    await composer(alice).press('Enter');
    await row(alice, 'T380 from the web').waitFor();
    await wait(1500);
    const head = await row(alice, 'T380 from the web').locator('header').innerText();
    await shot(alice, 'tc380-3');
    ok('TC-380 #3 my own message reads You', /^You\b/.test(head.trim()) && !head.includes('#alice'), head);
  });
  await step('TC-380 #4', async () => {
    const head = row(alice, 'T380 from orders-api').locator('header');
    const owner = head.getByText('#bob', { exact: true });
    const title = head.getByText('orders-api', { exact: true });
    const [oc, tc] = [await owner.evaluate((e) => getComputedStyle(e).color), await title.evaluate((e) => getComputedStyle(e).color)];
    const ratio = await contrast(owner);
    ok('TC-380 #4 #bob muted, readable', oc !== tc && ratio >= 4.5, `#bob ${oc} vs title ${tc}, ${ratio}:1`);
  });

  await step('TC-380 #5', async () => {
    as('alice', `dev fake-session ${checkout} --title checkout`);
    const [, ag] = await pageApi(alice, 'GET', '/v1/agents');
    const id = ag.agents.find((a) => a.title === 'checkout').id;
    const [st] = await pageApi(alice, 'PUT', `/v1/agents/${id}/title`, { title: 'Terminal' });
    sh(`python3 $M $L/alice send '{"to":"#${G}","body":"T380 from a session named Terminal"}' --session claude-code:${checkout}`);
    as('alice', `dev fake-session ${checkout} --title checkout`);
    await row(alice, 'T380 from a session named Terminal').waitFor({ timeout: 15000 });
    const head = await row(alice, 'T380 from a session named Terminal').locator('header').innerText();
    const [back] = await pageApi(alice, 'PUT', `/v1/agents/${id}/title`, { title: '' });
    ok('TC-380 #5 my session named Terminal reads Terminal #alice, not You', st === 200 && back === 200 && /^Terminal\s*#alice/.test(head.trim()), `${st}/${back} ${head}`);
  });

  // TC-381: add a contact by account ID; Sent until they accept
  const addBox = (p) => dialog(p).getByLabel('Account ID or email');
  const ask = async (p, who, note) => {
    if (!(await dialog(p).count())) await p.getByRole('button', { name: 'Add contact' }).click();
    await addBox(p).fill(who);
    if (note) await dialog(p).getByLabel(/Note/).fill(note);
    await dialog(p).getByRole('button', { name: 'Send request' }).click();
  };
  const problem = async (p, text) => {
    await dialog(p).getByText(text).waitFor({ timeout: 5000 });
    return true;
  };
  await step('TC-381 #1', async () => {
    await bob.goto(base + '/contacts');
    await bob.getByRole('button', { name: 'Add contact' }).click();
    await dialog(bob).getByRole('heading', { name: 'Add a contact' }).waitFor();
    await shot(bob, 'tc381-1');
    ok('TC-381 #1 Add a contact dialog', await addBox(bob).isVisible());
  });
  await step('TC-381 #2', async () => {
    await ask(bob, String(C), 'T381 from bob');
    const t = await toast(bob, 'Request sent');
    await bob.getByText('Waiting for carol to accept').waitFor({ timeout: 5000 });
    await shot(bob, 'tc381-2');
    ok('TC-381 #2 sent, listed under Sent', t.includes(`Request sent to carol (ID ${C}).`) && (await bob.getByRole('heading', { name: 'Sent' }).isVisible()), t);
  });
  let reqC;
  await step('TC-381 #3', async () => {
    const [, rq] = await api('carol', 'GET', '/v1/requests');
    reqC = rq.requests.find((r) => r.kind === 'contact' && r.from.id === B && r.status === 'pending');
    ok('TC-381 #3 carol has the request with the note', reqC?.note === 'T381 from bob', JSON.stringify(reqC ?? {}).slice(0, 160));
  });
  await step('TC-381 #4', async () => {
    await ask(bob, String(C));
    await problem(bob, "You already asked carol. They haven't answered yet.");
    await bob.keyboard.press('Escape');
    ok('TC-381 #4 asking again refused by name', true);
  });
  await step('TC-381 #5', async () => {
    as('carol', `contact accept ${reqC.id}`);
    await bob.goto(base + '/contacts');
    await contacts(bob).getByRole('link', { name: /carol/ }).waitFor({ timeout: 8000 });
    ok('TC-381 #5 carol in contacts, gone from Sent', !(await bob.getByText('Waiting for carol to accept').count()));
  });

  // TC-382: by email, and the refusals
  await step('TC-382 #1', async () => {
    await ask(bob, ' Dave@IMBO.test ', 'T382 by email');
    const t = await toast(bob, 'Request sent');
    await bob.getByText('Waiting for dave to accept').waitFor({ timeout: 5000 });
    const [, rq] = await api('dave', 'GET', '/v1/requests');
    const r = rq.requests.find((x) => x.from.id === B && x.status === 'pending');
    ok('TC-382 #1 by email: sent to dave, he has it', t.includes(`Request sent to dave (ID ${D}).`) && r?.note === 'T382 by email', t);
  });
  await step('TC-382 #2', async () => {
    await ask(bob, 'nobody382@imbo.test');
    ok('TC-382 #2 unknown email', await problem(bob, 'No Imbo account uses nobody382@imbo.test. Check the spelling, or ask them for their account ID.'));
    await shot(bob, 'tc382-2');
  });
  await step('TC-382 #3', async () => {
    await ask(bob, 'BOB@imbo.test');
    ok('TC-382 #3 own email', await problem(bob, "That's your own account."));
  });
  await step('TC-382 #4', async () => {
    await ask(bob, 'alice@imbo.test');
    ok('TC-382 #4 already a contact', await problem(bob, 'alice is already your contact.'));
  });
  await step('TC-382 #5', async () => {
    await ask(bob, 'dave');
    ok('TC-382 #5 neither ID nor email, checked before sending', await problem(bob, "That isn't an 8-digit account ID or an email address."));
    await bob.keyboard.press('Escape');
  });
  await step('TC-382 #6', async () => {
    const [st] = await api('erin', 'POST', '/v1/contacts/requests', { account_id: B, note: 'T382 erin' });
    await bob.goto(base + '/contacts');
    await ask(bob, 'erin@imbo.test');
    const t = await toast(bob, 'already asked');
    await contacts(bob).getByRole('link', { name: /erin/ }).waitFor({ timeout: 5000 });
    ok("TC-382 #6 they'd asked first: contacts at once", st === 201 && t.includes("erin had already asked to add you. You're contacts now."), `${st} ${t}`);
  });

  // TC-383: remove a contact
  await step('TC-383 #1', async () => {
    await bob.goto(base + `/contacts/${E}`);
    await bob.getByRole('button', { name: 'More for erin' }).click();
    await bob.getByRole('menuitem', { name: 'Remove contact…' }).click();
    await dialog(bob).getByRole('heading', { name: 'Remove erin from your contacts?' }).waitFor();
    await wait(300);
    const text = await dialog(bob).innerText();
    await shot(bob, 'tc383-1');
    ok('TC-383 #1 confirm, focus on Cancel', (await focused(bob)) === 'Cancel' && text.includes("You and erin can't send each other direct messages") && text.includes('Your chat with erin stays'), text.slice(0, 160));
  });
  await step('TC-383 #2', async () => {
    await dialog(bob).getByRole('button', { name: 'Remove contact' }).click();
    const t = await toast(bob, 'removed');
    await bob.waitForURL('**/contacts');
    const [, bc] = await api('bob', 'GET', '/v1/contacts');
    const [, ec] = await api('erin', 'GET', '/v1/contacts');
    ok('TC-383 #2 removed on both sides', t.includes('erin was removed from your contacts.') && !(await contacts(bob).getByRole('link', { name: /erin/ }).count()) && !bc.contacts.some((c) => c.id === E) && !ec.contacts.some((c) => c.id === B), t);
  });

  // TC-384: message a contact you've never written to
  await step('TC-384 #1', async () => {
    await alice.goto(base + `/contacts/${C}`);
    await alice.getByRole('link', { name: 'Message' }).click();
    await alice.waitForURL(`**/contacts/${C}/chat`);
    await alice.getByText('No messages with carol yet').waitFor();
    await shot(alice, 'tc384-1');
    ok('TC-384 #1 empty new chat', await composer(alice).isVisible());
  });
  await step('TC-384 #2', async () => {
    await pick(alice, /billing/);
    await composer(alice).fill('T384 first message');
    await composer(alice).press('Enter');
    await alice.waitForURL(/\/chats\/\d+$/, { timeout: 8000 });
    await row(alice, 'T384 first message').waitFor();
    await chats(alice).getByRole('link', { name: /carol/ }).first().waitFor();
    const to = await picker(alice).getAttribute('aria-label');
    const got = await until(() => as('carol', 'inbox --all'), (t) => t.includes('T384 first message'));
    ok('TC-384 #2 sent to billing, the chat opens still sending to billing, carol has it', got.includes('T384 first message') && to === "Sending to carol's session billing. Change", `${alice.url()} / ${to}`);
  });

  // TC-385: files
  const fileInput = (p) => p.locator('input[type=file][multiple]');
  await step('TC-385 #1', async () => {
    await openChat(alice, /bob/);
    await fileInput(alice).setInputFiles([
      { name: 't385-trace.json', mimeType: 'application/json', buffer: Buffer.alloc(220 * 1024, 120) },
      { name: 't385-plan.md', mimeType: 'text/markdown', buffer: Buffer.from('# Plan\n'.repeat(600)) },
    ]);
    const chips = alice.getByRole('list', { name: 'Attached files' });
    await chips.getByText('220.0 KB').waitFor({ timeout: 8000 });
    await shot(alice, 'tc385-1');
    ok('TC-385 #1 chips with name and size', (await chips.getByText('t385-plan.md').isVisible()) && (await chips.getByText('t385-trace.json').isVisible()));
  });
  await step('TC-385 #2', async () => {
    await composer(alice).fill('T385 two files');
    await composer(alice).press('Enter');
    const msg = row(alice, 'T385 two files');
    await msg.getByRole('link', { name: 'Download t385-trace.json' }).waitFor({ timeout: 8000 });
    const got = await until(() => as('bob', 'inbox --all'), (t) => t.includes('T385 two files'));
    ok('TC-385 #2 sent with both files, box empty, bob has it', (await msg.getByRole('link', { name: 'Download t385-plan.md' }).count()) > 0 && !(await alice.getByRole('list', { name: 'Attached files' }).count()) && got.includes('T385 two files'));
  });
  await step('TC-385 #3', async () => {
    await fileInput(alice).setInputFiles(Array.from({ length: 21 }, (_, i) => ({ name: `t385-${i + 1}.txt`, mimeType: 'text/plain', buffer: Buffer.from('x') })));
    await alice.getByText('Over 20 files. A message can carry 20.').waitFor({ timeout: 8000 });
    await shot(alice, 'tc385-3');
    ok('TC-385 #3 21st refused, Send unavailable', (await alice.getByRole('button', { name: 'Send', exact: true }).getAttribute('aria-disabled')) === 'true');
  });
  await step('TC-385 #4', async () => {
    for (let i = 21; i >= 1; i--) await alice.getByRole('button', { name: `Remove t385-${i}.txt` }).click();
    ok('TC-385 #4 removing them empties the box', !(await alice.getByRole('list', { name: 'Attached files' }).count()));
  });
  await step('TC-385 #5', async () => {
    await alice.route('**/v1/files', async (r) => {
      await wait(3000);
      await r.continue();
    });
    await fileInput(alice).setInputFiles([{ name: 't385-slow.txt', mimeType: 'text/plain', buffer: Buffer.from('slow upload') }]);
    await composer(alice).fill('T385 sent after the upload');
    await composer(alice).press('Enter');
    const held = await alice.getByText('Sending when the files finish uploading…').isVisible();
    await shot(alice, 'tc385-5');
    await row(alice, 'T385 sent after the upload').getByRole('link', { name: 'Download t385-slow.txt' }).waitFor({ timeout: 10000 });
    await alice.unroute('**/v1/files');
    ok('TC-385 #5 Enter while uploading sends once it finishes', held);
  });

  await step('TC-385 #6', async () => {
    // The server keeps a session that went away and takes messages for it; it answers session-not-found only for an
    // address it never had, which the picker doesn't offer. So this one send to a session is answered here, as the server would.
    let answered = false;
    await alice.route('**/v1/messages', (r) => {
      const to = r.request().postDataJSON()?.to ?? '';
      if (answered || r.request().method() !== 'POST' || !to.includes('/')) return r.continue();
      answered = true;
      return r.fulfill({ status: 404, contentType: 'application/problem+json', body: JSON.stringify({ type: '/errors/session-not-found', title: 'Session not found', status: 404, detail: `bob has no session ${to.split('/')[1]}.` }) });
    });
    await pick(alice, /orders-api/);
    await composer(alice).fill('T385 to a gone session');
    await composer(alice).press('Enter');
    await alice.getByText("That session is gone. Send it to bob's inbox instead.").waitFor({ timeout: 8000 });
    await fileInput(alice).setInputFiles([{ name: 't385-keep.txt', mimeType: 'text/plain', buffer: Buffer.from('keep me') }]);
    const chips = alice.getByRole('list', { name: 'Attached files' });
    await chips.getByText('7 B').waitFor({ timeout: 8000 });
    await alice.getByRole('button', { name: 'Send to inbox' }).click();
    await until(() => alice.getByText("That session is gone.").count(), (n) => n === 0, 8000);
    const kept = await chips.getByText('t385-keep.txt').isVisible();
    const got = await until(() => as('bob', 'inbox --all'), (t) => t.includes('T385 to a gone session'));
    await shot(alice, 'tc385-6');
    ok("TC-385 #6 Send to inbox sends it; the file in the box stays", kept && !(await alice.getByText("That session is gone.").count()) && got.includes('T385 to a gone session'));
    await alice.getByRole('button', { name: 'Remove t385-keep.txt' }).click();
    await alice.unroute('**/v1/messages');
  });

  // TC-386: rename a session
  await step('TC-386 #1', async () => {
    // The seed's sends made the daemon drop checkout as a session without a process (§3); bring it back.
    as('alice', 'dev fake-session 55555555-aaaa-bbbb-cccc-0000000a0001 --title checkout');
    await alice.goto(base + '/sessions');
    await alice.getByRole('navigation', { name: 'Sessions' }).getByRole('link', { name: /checkout/ }).first().click();
    await alice.getByRole('button', { name: 'Rename checkout' }).click();
    await alice.getByLabel('Session name').waitFor();
    const hint = await alice.getByText(/The new name replaces the title from/).innerText();
    await shot(alice, 'tc386-1');
    ok('TC-386 #1 name box with who sees it', hint.includes('everywhere in Imbo. You see it, and so do the contacts and groups that can see this session. Leave it empty to go back to that title.'), hint);
  });
  await step('TC-386 #2', async () => {
    await alice.getByLabel('Session name').fill('x'.repeat(201));
    await alice.getByRole('button', { name: 'Save' }).click();
    await alice.getByText('A session name can be at most 200 characters.').waitFor({ timeout: 5000 });
    await alice.getByLabel('Session name').press('Escape');
    await alice.getByRole('heading', { name: 'checkout' }).waitFor();
    ok('TC-386 #2 over 200 refused; Esc keeps the name, focus on the pencil', (await focused(alice)) === 'Rename checkout', await focused(alice));
  });
  await step('TC-386 #3', async () => {
    await alice.getByRole('button', { name: 'Rename checkout' }).click();
    await alice.getByLabel('Session name').fill('checkout-web');
    await alice.getByLabel('Session name').press('Enter');
    await alice.getByRole('heading', { name: 'checkout-web' }).waitFor({ timeout: 8000 });
    const [, bc] = await api('bob', 'GET', '/v1/contacts');
    const titles = bc.contacts.find((c) => c.id === A).sessions.map((x) => x.title);
    ok('TC-386 #3 saved; bob sees checkout-web', titles.includes('checkout-web') && (await focused(alice)) === 'Rename checkout-web', titles.join(', '));
  });
  await step('TC-386 #4', async () => {
    await alice.getByRole('button', { name: 'Rename checkout-web' }).click();
    await alice.getByLabel('Session name').fill('');
    await alice.getByLabel('Session name').press('Enter');
    await alice.getByRole('heading', { name: 'checkout' }).waitFor({ timeout: 8000 });
    ok('TC-386 #4 empty goes back to the tool title', true);
  });

  // TC-387: the group picture (owner alice; bob is a member)
  const openDetails = async (p, name) => {
    await openChat(p, new RegExp(name));
    await p.getByRole('button', { name: new RegExp(name) }).first().click();
    await dialog(p).getByRole('heading', { name: 'Members' }).waitFor();
  };
  await step('TC-387 #1', async () => {
    await openDetails(alice, 'release-team');
    await dialog(alice).getByRole('button', { name: 'Change group picture' }).click();
    await alice.getByRole('menuitem', { name: 'Upload picture…' }).waitFor();
    await shot(alice, 'tc387-1');
    ok('TC-387 #1 menu: upload, the rule', (await alice.getByText('JPEG or PNG, up to 5 MB. Imbo crops it to a square.').isVisible()) && !(await alice.getByRole('menuitem', { name: 'Remove picture' }).count()));
  });
  await step('TC-387 #2', async () => {
    const chooser = alice.waitForEvent('filechooser');
    await alice.getByRole('menuitem', { name: 'Upload picture…' }).click();
    await (await chooser).setFiles(`${root}mobile/assets/images/icon.png`);
    const t = await toast(alice, 'Group picture');
    const [, gs] = await api('bob', 'GET', '/v1/groups');
    ok('TC-387 #2 updated; bob sees a picture', t.includes('Group picture updated.') && !!gs.groups.find((g) => g.id === G)?.avatar_url, t);
  });
  await step('TC-387 #3', async () => {
    await dialog(alice).getByRole('button', { name: 'Change group picture' }).click();
    await alice.getByRole('menuitem', { name: 'Remove picture' }).click();
    const t = await toast(alice, 'Group picture removed');
    const [, gs] = await api('bob', 'GET', '/v1/groups');
    ok('TC-387 #3 removed', t.includes('Group picture removed.') && !gs.groups.find((g) => g.id === G)?.avatar_url, t);
  });
  await step('TC-387 #4', async () => {
    await openDetails(bob, 'release-team');
    const text = await dialog(bob).innerText();
    await shot(bob, 'tc387-4');
    ok('TC-387 #4 member: no picture or rename button, Leave group…',
      !(await dialog(bob).getByRole('button', { name: 'Change group picture' }).count()) && !(await dialog(bob).getByRole('button', { name: 'Rename group' }).count()) && (await dialog(bob).getByRole('button', { name: 'Leave group…' }).isVisible()),
      text.slice(0, 120));
    await bob.keyboard.press('Escape');
  });

  // TC-388: rename the group
  await step('TC-388 #1', async () => {
    await dialog(alice).getByRole('button', { name: 'Rename group' }).click();
    await dialog(alice).getByLabel('Group name').fill('#release');
    await dialog(alice).getByRole('button', { name: 'Save' }).click();
    await dialog(alice).getByText("A group name can't start with #.").waitFor({ timeout: 5000 });
    await shot(alice, 'tc388-1');
    ok('TC-388 #1 leading # refused before sending', true);
  });
  await step('TC-388 #2', async () => {
    await alice.keyboard.press('Escape');
    await wait(300);
    ok('TC-388 #2 Esc cancels the rename, dialog stays', (await dialog(alice).count()) === 1 && (await dialog(alice).getByRole('heading', { name: 'release-team' }).count()) === 1 && (await focused(alice)) === 'Rename group');
  });
  await step('TC-388 #3', async () => {
    await dialog(alice).getByRole('button', { name: 'Rename group' }).click();
    await dialog(alice).getByLabel('Group name').fill('release-web');
    await dialog(alice).getByLabel('Group name').press('Enter');
    await dialog(alice).getByRole('heading', { name: 'release-web' }).waitFor({ timeout: 8000 });
    const [, gs] = await api('bob', 'GET', '/v1/groups');
    ok('TC-388 #3 renamed; bob sees release-web', gs.groups.find((g) => g.id === G)?.name === 'release-web');
  });

  // TC-389: remove a member
  await step('TC-389 #1', async () => {
    await dialog(alice).getByRole('button', { name: 'Actions for carol' }).click();
    await alice.getByRole('menuitem', { name: 'Remove carol…' }).click();
    await dialog(alice).getByRole('heading', { name: 'Remove carol from release-web?' }).waitFor();
    await wait(300);
    await shot(alice, 'tc389-1');
    ok('TC-389 #1 confirm, focus on Cancel', (await focused(alice)) === 'Cancel');
  });
  await step('TC-389 #2', async () => {
    await dialog(alice).getByRole('button', { name: 'Remove carol' }).click();
    const t = await toast(alice, 'was removed from release-web');
    await dialog(alice).getByRole('heading', { name: 'Members' }).waitFor();
    const [, cg] = await api('carol', 'GET', '/v1/groups');
    const notice = await until(() => as('carol', 'inbox --all'), (x) => x.includes('removed from group release-web'));
    ok('TC-389 #2 removed; carol out and told', t.includes('carol was removed from release-web.') && !cg.groups.some((g) => g.id === G) && !(await dialog(alice).getByRole('button', { name: 'Actions for carol' }).count()) && notice.includes('removed from group release-web'), t);
  });

  // TC-390: make bob the owner
  await step('TC-390 #1', async () => {
    await dialog(alice).getByRole('button', { name: 'Rename group' }).click();
    await dialog(alice).getByLabel('Group name').waitFor();
    await dialog(alice).getByRole('button', { name: 'Actions for bob' }).click();
    await alice.getByRole('menuitem', { name: 'Make bob the owner…' }).click();
    await dialog(alice).getByRole('heading', { name: 'Make bob the owner of release-web?' }).waitFor();
    await shot(alice, 'tc390-1');
    await dialog(alice).getByRole('button', { name: 'Make bob the owner' }).click();
    const t = await toast(alice, 'owner');
    await dialog(alice).getByRole('button', { name: 'Leave group…' }).waitFor({ timeout: 5000 });
    const [, gs] = await api('bob', 'GET', '/v1/groups');
    ok('TC-390 #1 bob owns it; alice gets Leave group…, no rename',
      t.includes('bob is now the owner of release-web.') && gs.groups.find((g) => g.id === G)?.owner?.id === B && !(await dialog(alice).getByRole('button', { name: 'Rename group' }).count()) && !(await dialog(alice).getByLabel('Group name').count()), t);
  });
  await step('TC-390 #2', async () => {
    await alice.keyboard.press('Escape');
    await wait(500);
    ok('TC-390 #2 one Esc closes the details', !(await dialog(alice).count()));
  });

  // TC-391: leave
  await step('TC-391 #1', async () => {
    await alice.getByRole('button', { name: /release-web/ }).first().click();
    await dialog(alice).getByRole('heading', { name: 'Members' }).waitFor();
    await dialog(alice).getByRole('button', { name: 'Leave group…' }).click();
    await dialog(alice).getByRole('heading', { name: 'Leave release-web?' }).waitFor();
    await wait(300);
    await shot(alice, 'tc391-1');
    ok('TC-391 #1 confirm, focus on Cancel', (await focused(alice)) === 'Cancel');
  });
  await step('TC-391 #2', async () => {
    await dialog(alice).getByRole('button', { name: 'Leave group' }).click();
    const t = await toast(alice, 'You left');
    await alice.waitForURL('**/chats', { timeout: 5000 });
    const [, gs] = await api('alice', 'GET', '/v1/groups');
    const open = await dialog(alice).count();
    // Exact: the removal notice in alice's chat with carol names release-web too.
    const listed = await chats(alice).getByText('release-web', { exact: true }).count();
    const kept = gs.groups.some((g) => g.id === G);
    await shot(alice, 'tc391-2');
    ok('TC-391 #2 left; back in chats, the group gone', t.includes('You left release-web.') && !open && !listed && !kept, `${t} / dialog ${open}, listed ${listed}, server ${kept}`);
  });

  // TC-392: dissolve
  await step('TC-392 #1', async () => {
    as('alice', `group create t392`);
    const g = await groupId('alice', 't392');
    as('alice', `group invite '#${g}' ${B}`);
    as('alice', `group invite '#${g}' ${C}`);
    as('bob', `group join '#${g}'`);
    as('carol', `group join '#${g}'`);
    as('bob', `send '#${g}' 'T392 hello'`);
    await openDetails(alice, 't392');
    await dialog(alice).getByRole('button', { name: 'Dissolve group…' }).click();
    await dialog(alice).getByRole('heading', { name: 'Dissolve t392?' }).waitFor();
    await wait(300);
    const text = await dialog(alice).innerText();
    await shot(alice, 'tc392-1');
    ok('TC-392 #1 confirm says all 3 leave, focus on Cancel', text.includes('All 3 members leave the group, you included.') && (await focused(alice)) === 'Cancel', text.slice(0, 160));
    await dialog(alice).getByRole('button', { name: 'Dissolve group' }).click();
    const t = await toast(alice, 'dissolved');
    await alice.waitForURL('**/chats', { timeout: 5000 });
    const [, bg] = await api('bob', 'GET', '/v1/groups');
    ok('TC-392 #2 dissolved; gone for bob', t.includes('t392 was dissolved.') && !bg.groups.some((x) => x.id === g), t);
  });

  // TC-393: my name
  await step('TC-393 #1', async () => {
    await alice.goto(base + '/account');
    await alice.getByRole('button', { name: 'Edit name' }).click();
    await alice.getByLabel('Name', { exact: true }).fill('a'.repeat(33));
    await alice.getByRole('button', { name: 'Save' }).click();
    await alice.getByText('Use 32 characters or fewer.').waitFor({ timeout: 5000 });
    await shot(alice, 'tc393-1');
    await alice.getByLabel('Name', { exact: true }).press('Escape');
    await alice.getByRole('button', { name: 'Edit name' }).waitFor();
    ok('TC-393 #1 33 characters refused; Esc keeps alice, focus on Edit', (await focused(alice)) === 'Edit name' && (await alice.getByText('alice', { exact: true }).count()) > 0, await focused(alice));
  });
  await step('TC-393 #2', async () => {
    await alice.getByRole('button', { name: 'Edit name' }).click();
    await alice.getByLabel('Name', { exact: true }).fill('Alice 393');
    await alice.getByRole('button', { name: 'Save' }).click();
    await alice.getByText('Alice 393').first().waitFor({ timeout: 5000 });
    const [, bc] = await api('bob', 'GET', '/v1/contacts');
    ok('TC-393 #2 saved; bob sees Alice 393', bc.contacts.find((c) => c.id === A)?.name === 'Alice 393' && (await focused(alice)) === 'Edit name');
  });

  // TC-394: computers
  let dev;
  await step('TC-394 #1', async () => {
    const r = await alice.evaluate(() => fetch('/v1/devices', { credentials: 'include' }).then((x) => x.json()));
    dev = r.devices[0];
    await alice.getByRole('button', { name: `Sign out ${dev.name}` }).scrollIntoViewIfNeeded();
    const text = await alice.locator('main').innerText();
    await shot(alice, 'tc394-1');
    ok('TC-394 #1 the computer listed with when it was seen', r.devices.length === 1 && text.includes(dev.name) && /Seen |Not seen since signing in/.test(text) && text.includes('Each computer you ran imbo login on.'), `${r.devices.length} ${dev.name}`);
  });
  await step('TC-394 #2', async () => {
    await alice.getByRole('button', { name: `Sign out ${dev.name}` }).click();
    await dialog(alice).getByRole('heading', { name: `Sign out ${dev.name}?` }).waitFor();
    await wait(300);
    await shot(alice, 'tc394-2');
    ok('TC-394 #2 confirm, focus on Cancel', (await focused(alice)) === 'Cancel');
  });
  await step('TC-394 #3', async () => {
    await dialog(alice).getByRole('button', { name: 'Sign out', exact: true }).click();
    const t = await toast(alice, 'signed out');
    const [st] = await api('alice', 'GET', '/v1/me');
    ok('TC-394 #3 signed out; its token gets 401', t.includes(`${dev.name} was signed out.`) && st === 401 && (await alice.getByText('No computers yet.').isVisible()), `${t} / ${st}`);
  });

  // TC-395: delete an account (dave)
  const dave = await newPage('dave');
  await step('TC-395 #1', async () => {
    await dave.goto(base + '/account');
    await dave.getByRole('button', { name: 'Delete account…' }).click();
    await dialog(dave).getByRole('heading', { name: 'Delete your Imbo account?' }).waitFor();
    await wait(300);
    const text = await dialog(dave).innerText();
    await shot(dave, 'tc395-1');
    ok('TC-395 #1 what goes, Delete unavailable, focus on Cancel',
      text.includes(`Account ${D} and your name are deleted. The ID is never reused.`) && text.includes("Deleting doesn't cancel an App Store subscription.") &&
        (await dialog(dave).getByRole('button', { name: 'Delete account' }).getAttribute('aria-disabled')) === 'true' && (await focused(dave)) === 'Cancel',
      text.slice(0, 160));
  });
  await step('TC-395 #2', async () => {
    await dialog(dave).getByLabel('Type DELETE to confirm').fill('delete');
    ok('TC-395 #2 lower-case delete is not enough', (await dialog(dave).getByRole('button', { name: 'Delete account' }).getAttribute('aria-disabled')) === 'true');
  });
  await step('TC-395 #3', async () => {
    await dialog(dave).getByLabel('Type DELETE to confirm').fill('DELETE');
    await dialog(dave).getByRole('button', { name: 'Delete account' }).click();
    const t = await toast(dave, 'deleted');
    await dave.waitForURL('**/login', { timeout: 8000 });
    const [st] = await api('dave', 'GET', '/v1/me');
    ok('TC-395 #3 deleted, signed out, his computer gets 401', t.includes('Your Imbo account was deleted.') && st === 401, `${t} / ${st}`);
  });
  await dave.context().close();

  // TC-396: a phone-width window (bob, who now owns release-web)
  await step('TC-396 #1', async () => {
    await bob.setViewportSize({ width: 390, height: 844 });
    await bob.goto(base + '/contacts');
    await bob.getByRole('button', { name: 'Add contact' }).click();
    await wait(400);
    const box = await dialog(bob).boundingBox();
    await shot(bob, 'tc396-1');
    ok('TC-396 #1 Add a contact fits, nothing cut', inWindow(box, 390, 844) && !(await clipped(dialog(bob))).length, JSON.stringify(box));
    await bob.keyboard.press('Escape');
  });
  await step('TC-396 #2', async () => {
    await openDetails(bob, 'release-web');
    await dialog(bob).getByRole('button', { name: 'Rename group' }).click();
    await wait(300);
    const input = await dialog(bob).getByLabel('Group name').boundingBox();
    const save = await dialog(bob).getByRole('button', { name: 'Save' }).boundingBox();
    await shot(bob, 'tc396-2');
    ok('TC-396 #2 rename row: box at least 160 wide, Save in the dialog', input.width >= 160 && inWindow(save, 390, 844), `box ${Math.round(input.width)}`);
    await bob.keyboard.press('Escape');
    await dialog(bob).getByRole('button', { name: 'Change group picture' }).click();
    await wait(300);
    const menu = await bob.getByRole('menu').boundingBox();
    await shot(bob, 'tc396-3');
    ok('TC-396 #3 picture menu inside the window', inWindow(menu, 390, 844), JSON.stringify(menu));
    await bob.keyboard.press('Escape');
    await bob.keyboard.press('Escape');
  });
  await step('TC-396 #4', async () => {
    await bob.goto(base + '/sessions');
    await bob.getByRole('navigation', { name: 'Sessions' }).getByRole('link', { name: /orders-api/ }).first().click();
    await bob.getByRole('button', { name: 'Rename orders-api' }).click();
    await wait(300);
    const input = await bob.getByLabel('Session name').boundingBox();
    const save = await bob.getByRole('button', { name: 'Save' }).boundingBox();
    const cancel = await bob.getByRole('button', { name: 'Cancel' }).boundingBox();
    await shot(bob, 'tc396-4');
    ok('TC-396 #4 session rename: box at least 160 wide, Save and Cancel under it, in the window',
      input.width >= 160 && save.y >= input.y + input.height && inWindow(save, 390, 844) && inWindow(cancel, 390, 844), `box ${Math.round(input.width)}, Save at ${Math.round(save.y)}`);
    await bob.getByLabel('Session name').press('Escape');
  });
  await step('TC-396 #5', async () => {
    await bob.goto(base + '/account');
    await bob.getByRole('button', { name: 'Delete account…' }).click();
    await wait(400);
    const box = await dialog(bob).boundingBox();
    await shot(bob, 'tc396-5');
    ok('TC-396 #5 Delete account fits', inWindow(box, 390, 844) && !(await clipped(dialog(bob))).length, JSON.stringify(box));
    await bob.keyboard.press('Escape');
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
