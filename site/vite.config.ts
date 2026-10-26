import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // brand/ lives two levels up (Imbo/brand); let the dev server read it
  server: { fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] } },
});
