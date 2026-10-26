import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // index.html is the landing page; Pages serves privacy.html at /privacy, terms.html at /terms, and 404.html, with status 404, for any unknown path
  build: { rolldownOptions: { input: { main: "index.html", notFound: "404.html", privacy: "privacy.html", terms: "terms.html" } } },
  // brand/ lives two levels up (Imbo/brand); let the dev server read it
  server: { fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] } },
});
