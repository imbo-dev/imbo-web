// Inline the server-rendered page into dist/index.html so crawlers and first paint get full HTML.
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const { render } = await import(pathToFileURL(`${root}dist-ssr/entry-server.js`).href);
const file = `${root}dist/index.html`;
const html = fs.readFileSync(file, "utf8");
if (!html.includes("<!--app-->")) throw new Error("dist/index.html has no <!--app--> marker");
fs.writeFileSync(file, html.replace("<!--app-->", render()));
fs.rmSync(`${root}dist-ssr`, { recursive: true });
console.log("prerendered dist/index.html");
