// The product page, d-tox.saaquiblabs.com: Astro static output, no UI framework (ADR 0004).
// Ported from the saaquiblabs studio site's astro.config.mjs (saaquiblabs ADR 0009).
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://d-tox.saaquiblabs.com",
  output: "static",
  // Pages are addressed as the site links them: /welcome, not /welcome/. Canonical tags, the
  // sitemap and Openship's routing (cleanUrls, trailingSlash false) agree.
  trailingSlash: "never",
  // Styles go inline in each page (they are small), so no stylesheet blocks the first paint.
  build: { format: "directory", inlineStylesheets: "always" },
  // Every page except the 404 page.
  integrations: [sitemap({ filter: (url) => !/\/404\/?$/.test(url) })],
});
