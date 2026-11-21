// The launch gate, ported from the saaquiblabs studio site's tests/verify.mjs (saaquiblabs ADR 0014):
// link check + Lighthouse with the studio's budgets, on the built site. `npm run verify` runs the
// unit tests, builds, checks /welcome against settings.json (tests/welcome.mjs), then runs this; the
// git pre-push hook runs it. The Openship deploy runs `npm run verify:deploy` (`--links`): the same
// minus Lighthouse, no Chrome, so a deploy takes about two minutes (as the studio site, its #89).
// Keep every budget here.
//
// Budgets: Lighthouse 100 in all four categories, page JS < 50 KB, page < 400 KB. Bytes are what the
// page loads, measured uncompressed (the local server doesn't gzip), so the live page is lighter.
//
// Chrome: CHROME_PATH, else Playwright's Chromium (`npx playwright install chromium`).
import { readFile, readdir, access } from "node:fs/promises";
import { join, relative } from "node:path";
import { serve, dist } from "./serve.mjs";

const origin = "https://d-tox.saaquiblabs.com";
const budget = { score: 1, js: 50_000, page: 400_000 };
// Lighthouse never reaches the real Umami: no counted visits, no third party in the numbers.
const blocked = ["*analytics.saaquiblabs.com*"];
const problems = [];
const kb = (n) => `${(n / 1000).toFixed(1)} KB`;

const server = await serve();
const { base } = server;

// Every page the sitemap lists (astro.config.mjs: every page but the 404).
const sitemap = await readFile(join(dist, "sitemap-0.xml"), "utf8");
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
// `node tests/verify.mjs / /welcome` runs Lighthouse on those pages only (for debugging; the gate runs all).
// `--links` (the deploy): the link check only.
const linksOnly = process.argv.includes("--links");
const args = process.argv.slice(2).filter((a) => a !== "--links");
const pages = args.length ? args : listed;
if (!listed.length) problems.push("sitemap lists no pages");

// --- Links: every href/src/srcset in every built HTML file, internal and external. ---
async function htmlFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const links = new Map(); // url → first page that uses it
for (const file of await htmlFiles(dist)) {
  const rel = "/" + relative(dist, file).replace(/(^|\/)index\.html$/, "").replace(/\.html$/, "");
  const html = await readFile(file, "utf8");
  const found = [
    ...[...html.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/\ssrcset="([^"]*)"/g)].flatMap((m) => m[1].split(",").map((s) => s.trim().split(/\s+/)[0])),
    ...[...html.matchAll(/<meta[^>]+content="(https?:\/\/[^"]+)"/g)].map((m) => m[1]),
  ];
  for (const raw of found) {
    const v = raw.replaceAll("&amp;", "&");
    if (!v || /^(mailto:|tel:|data:|#|javascript:)/.test(v)) continue;
    let u = new URL(v, origin + rel);
    if (u.origin === origin) u = new URL(u.pathname + u.search, base); // ours: check the build, not the live site
    u.hash = "";
    if (!links.has(u.href)) links.set(u.href, rel);
  }
}

async function ok(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "user-agent": "Mozilla/5.0 (link check)" } });
      if (r.status < 400) return null;
      if (attempt) return String(r.status);
    } catch (e) {
      if (attempt) return e.cause?.code ?? e.name;
    }
  }
}
const queue = [...links];
await Promise.all(Array.from({ length: 8 }, async () => {
  for (let item; (item = queue.shift()); ) {
    const [url, page] = item;
    const bad = await ok(url);
    if (bad) problems.push(`link: ${url.replace(base, "")} on ${page}: ${bad}`);
  }
}));
console.log(`verify: ${links.size} links checked`);

if (linksOnly) {
  server.close();
  if (problems.length) {
    console.error(`verify: ${problems.length} problem(s)\n  ` + problems.join("\n  "));
    process.exit(1);
  }
  console.log("verify: ok (links only; Lighthouse runs before each push)");
  process.exit(0);
}

const { default: lighthouse } = await import("lighthouse");
const { default: desktop } = await import("lighthouse/core/config/desktop-config.js");
const { launch } = await import("chrome-launcher");
const { default: pw } = await import("playwright");

// --- Lighthouse, phone and desktop, every page. ---
const chromePath = process.env.CHROME_PATH ?? pw.chromium.executablePath();
if (!(await access(chromePath).then(() => true, () => false))) {
  console.error(`verify: no Chrome at ${chromePath}. Run \`npx playwright install chromium\` or set CHROME_PATH.`);
  process.exit(1);
}
// --disable-dev-shm-usage: the Openship build runs in Docker, whose /dev/shm is 64 MB; Chrome
// crashed every page there (TARGET_CRASHED) until it wrote to /tmp instead (#48).
const chrome = await launch({
  chromePath,
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"],
});
const audit = async (url, config) =>
  (await lighthouse(url, { port: chrome.port, logLevel: "error", blockedUrlPatterns: blocked }, config)).lhr;
// Inline <script> bytes: Lighthouse lists only script files, but inline JS is JS too (JSON-LD is data).
const inlineJs = async (path) =>
  [...(await (await fetch(base + path)).text()).matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)]
    .reduce((n, m) => n + Buffer.byteLength(m[1]), 0);
try {
  // The first run in a fresh Chrome is slow (measured: home on phone 91, then 100 every time after).
  await audit(base + "/");
  for (const path of pages) {
    for (const [form, config] of [["phone", undefined], ["desktop", desktop]]) {
      const tag = `${path} ${form}`;
      let lhr = await audit(base + path, config);
      // Performance is timing, so it wobbles; one more run before calling it a failure. The other
      // three categories are deterministic and never get a second try.
      const others = (l) => Object.values(l.categories).every((c) => c.id === "performance" || c.score >= budget.score);
      if (!lhr.runtimeError && lhr.categories.performance.score < budget.score && others(lhr)) {
        console.log(`verify: ${tag}: performance ${Math.round(lhr.categories.performance.score * 100)}, running again`);
        lhr = await audit(base + path, config);
      }
      if (lhr.runtimeError) { problems.push(`${tag}: Lighthouse: ${lhr.runtimeError.code}`); continue; }
      const scores = Object.values(lhr.categories).map((c) => [c.id, Math.round(c.score * 100)]);
      for (const c of Object.values(lhr.categories)) {
        if (c.score >= budget.score) continue;
        const failing = c.auditRefs
          .filter((r) => r.weight > 0 && lhr.audits[r.id].score !== null && lhr.audits[r.id].score < 1)
          .map((r) => r.id + (lhr.audits[r.id].displayValue ? ` (${lhr.audits[r.id].displayValue})` : ""));
        problems.push(`${tag}: ${c.id} ${Math.round(c.score * 100)}, want 100: ${failing.join(", ") || "see the report"}`);
      }
      const reqs = lhr.audits["network-requests"].details?.items ?? [];
      const js = reqs.filter((r) => r.resourceType === "Script").reduce((n, r) => n + r.transferSize, 0) + (await inlineJs(path));
      const all = reqs.reduce((n, r) => n + r.transferSize, 0);
      if (js >= budget.js) problems.push(`${tag}: ${kb(js)} of JS, want < ${kb(budget.js)}`);
      if (all >= budget.page) problems.push(`${tag}: page ${kb(all)}, want < ${kb(budget.page)}`);
      console.log(`verify: ${tag.padEnd(22)} ${scores.map(([id, s]) => `${id} ${s}`).join(" · ")} · JS ${kb(js)} · page ${kb(all)}`);
    }
  }
} finally {
  await chrome.kill();
  server.close();
}

if (problems.length) {
  console.error(`verify: ${problems.length} problem(s)\n  ` + problems.join("\n  "));
  process.exit(1);
}
console.log(`verify: ok (${pages.length} pages × phone + desktop)`);
