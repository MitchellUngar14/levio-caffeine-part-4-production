import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readHeadersFile } from "./security-headers";

// `vite preview` serves the production build with the same security headers
// Cloudflare Pages will send (public/_headers), so the CSP can be checked
// locally. The dev server is left alone: React Fast Refresh needs inline scripts.
const siteHeaders = readHeadersFile()["/*"] ?? {};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  preview: { port: 4173, headers: siteHeaders },
});
