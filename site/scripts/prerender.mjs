// Inline the server-rendered pages into dist/*.html so crawlers and first paint get full HTML.
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const { render, renderPage } = await import(pathToFileURL(`${root}dist-ssr/entry-server.js`).href);
const pages = [["index.html", render], ["404.html", () => renderPage("notFound")], ["privacy.html", () => renderPage("privacy")], ["terms.html", () => renderPage("terms")]];
for (const [name, fn] of pages) {
  const file = `${root}dist/${name}`;
  const html = fs.readFileSync(file, "utf8");
  if (!html.includes("<!--app-->")) throw new Error(`dist/${name} has no <!--app--> marker`);
  // Cloudflare's Email Address Obfuscation (on for the imbo.dev zone) rewrites addresses into [email protected] markup that
  // React then fails to hydrate (error #418), so mark the body to be left alone.
  fs.writeFileSync(file, html.replace("<!--app-->", fn()).replace("<body>", "<body><!--email_off-->").replace("</body>", "<!--/email_off--></body>"));
  console.log(`prerendered dist/${name}`);
}
fs.rmSync(`${root}dist-ssr`, { recursive: true });
