import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    // imbo-server only takes sign-in requests from IMBO_WEB_ORIGIN, so the page always runs at http://localhost:5190.
    port: 5190,
    strictPort: true,
    // Same origin for the API: the session cookie and the Origin check both just work. IMBO_API picks another server.
    proxy: { "/v1": process.env.IMBO_API ?? "http://127.0.0.1:18080" },
    // brand/ lives two levels up (Imbo/brand); let the dev server read it
    fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] },
  },
});
