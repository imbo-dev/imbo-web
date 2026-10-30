// TC-362, TC-364 (docs/TEST.md): the line above the text box of an offline session. 362: can't open it, sending opens it, opening,
// couldn't open (§3「叫起提示」failure path: `sh web/app/tests/wake-env.sh 362` after the seed). 364: the line goes once the session
// is back and its reply comes (success path: a real Claude Code session t364). The page is http://localhost:5190 (`npm run dev`).
// Prints PASS/FAIL per step. Codes are read from $L/server.log and never printed.
// usage: node web/app/tests/wake.mjs <screenshot dir> 362|364
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const { chromium } = await import(
  `${execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim()}/playwright/index.mjs`
);
const base = "http://localhost:5190";
const L = "/tmp/imbo-t";
const [out, tc] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const checks = [];
const ok = (name, cond, detail = "") => {
  const line = `${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, " ")}` : ""}`;
  checks.push(line);
  console.log(line);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const codeLines = (email) =>
  fs
    .readFileSync(`${L}/server.log`, "utf8")
    .split("\n")
    .filter(
      (l) => l.includes("mail-log-only code=") && l.endsWith(`email=${email}`),
    );
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
    ok(id, false, e.message.split("\n")[0]);
  }
};

const later = "It gets your message when it comes back online.";
const browser = await chromium.launch();
try {
  const page = await (
    await browser.newContext({
      viewport: { width: 1280, height: 800 },
      colorScheme: "dark",
    })
  ).newPage();
  await page.goto(base + "/login");
  const before = codeLines("alice@imbo.test").length;
  await page.getByLabel("Email").fill("alice@imbo.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Check your email").waitFor();
  await page.keyboard.type(await codeFor("alice@imbo.test", before));
  await page.waitForURL("**/chats");

  const agents = await page.evaluate(() =>
    fetch("/v1/agents").then((r) => r.json()),
  );
  const on = agents.agents.find((a) => a.title === `t${tc}`)?.device_name;
  const shot = (n) => page.screenshot({ path: `${out}/tc${tc}-${n}.png` });
  const open = async (title) => {
    await page
      .getByRole("navigation", { name: "My sessions" })
      .getByRole("link")
      .filter({ has: page.getByText(title, { exact: true }) })
      .click();
    await page
      .getByRole("main")
      .locator("header")
      .first()
      .getByText(title, { exact: true })
      .waitFor();
  };
  const note = async () => {
    const n = page.locator(".composer-note");
    return (await n.count()) ? (await n.innerText()).trim() : "";
  };
  // Polls until the line reads `want`; returns what it read last and how long it took.
  const noteBecomes = async (want, ms) => {
    const t0 = Date.now();
    let read = await note();
    while (read !== want && Date.now() - t0 < ms) {
      await wait(250);
      read = await note();
    }
    return { read, s: ((Date.now() - t0) / 1000).toFixed(1) };
  };
  const send = async (text) => {
    await page.locator("textarea.composer").fill(text);
    await page.locator("textarea.composer").press("Enter");
  };
  const waiting = (text, title) =>
    page
      .locator("article", { hasText: text })
      .getByText(`Waiting for ${title} to come online`);

  if (tc === "362") {
    await step("TC-362 #1", async () => {
      await page.goto(base + "/sessions");
      await open("checkout");
      await page.locator("textarea.composer").waitFor();
      await wait(1000);
      const read = await note();
      await shot(1);
      ok(
        "TC-362 #1 no line for an online session",
        read === "",
        read && `reads "${read}"`,
      );
    });

    await step("TC-362 #2", async () => {
      await open("t362x");
      const want = `t362x is offline. ${later}`;
      const { read } = await noteBecomes(want, 5000);
      await shot(2);
      ok(
        "TC-362 #2 a Codex session says it waits",
        read === want,
        `reads "${read}"`,
      );
    });

    await step("TC-362 #3", async () => {
      await open("t362");
      const want = `t362 is offline. Sending opens it in the background on ${on}.`;
      const { read } = await noteBecomes(want, 5000);
      await shot(3);
      ok(
        "TC-362 #3 a Claude Code session says sending opens it",
        read === want,
        `reads "${read}"`,
      );
    });

    await step("TC-362 #4", async () => {
      await send("T362 one");
      await waiting("T362 one", "t362").waitFor({ timeout: 5000 });
      const want = `Opening t362 on ${on}…`;
      const { read, s } = await noteBecomes(want, 5000);
      await shot(4);
      ok(
        "TC-362 #4 opening within 5 s",
        read === want,
        `after ${s} s reads "${read}"`,
      );
    });

    await step("TC-362 #5", async () => {
      const want = `Couldn't open t362 on ${on}: It didn't come online within 30 seconds. ${later}`;
      const { read, s } = await noteBecomes(want, 70_000);
      const still = await waiting("T362 one", "t362").count();
      await shot(5);
      ok(
        "TC-362 #5 couldn't open within 70 s, the message still waits",
        read === want && still === 1,
        `after ${s} s reads "${read}"; waiting labels ${still}`,
      );
    });

    await step("TC-362 #6", async () => {
      await open("t362n");
      const first = `t362n is offline. Sending opens it in the background on ${on}.`;
      const { read: was } = await noteBecomes(first, 5000);
      await send("T362 two");
      const want = `Couldn't open t362n on ${on}: No record of this session on this computer. ${later}`;
      const { read, s } = await noteBecomes(want, 15_000);
      await shot(6);
      ok(
        "TC-362 #6 no record of the session",
        was === first && read === want,
        `before "${was}"; after ${s} s "${read}"`,
      );
    });
  } else {
    await step("TC-364 #1", async () => {
      await page.goto(base + "/sessions");
      await open("t364");
      const want = `t364 is offline. Sending opens it in the background on ${on}.`;
      const { read } = await noteBecomes(want, 5000);
      await shot(1);
      ok("TC-364 #1 sending opens it", read === want, `reads "${read}"`);
    });

    await step("TC-364 #2", async () => {
      await send("T364 reply to me with the word PONG");
      await page.locator("article", { hasText: "T364 reply" }).waitFor();
      const { read, s } = await noteBecomes("", 40_000);
      await waiting("T364 reply", "t364")
        .waitFor({ state: "detached", timeout: 5000 })
        .catch(() => {});
      const still = await waiting("T364 reply", "t364").count();
      await shot(2);
      ok(
        "TC-364 #2 the line goes once it is back",
        read === "" && still === 0,
        `after ${s} s reads "${read}"; waiting labels ${still}`,
      );
    });

    await step("TC-364 #3", async () => {
      const reply = page
        .locator("article", { hasText: "PONG" })
        .filter({ hasNotText: "T364 reply" });
      await reply.first().waitFor({ timeout: 120_000 });
      await shot(3);
      ok(
        "TC-364 #3 the reply comes",
        true,
        (await reply.first().innerText()).slice(0, 120),
      );
    });
  }
} finally {
  await browser.close();
}
const failed = checks.filter((c) => c.startsWith("FAIL")).length;
console.log(`${failed} failed`);
process.exit(failed ? 1 : 0);
