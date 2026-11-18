// Minimal static server for dist/, used by verify.mjs (ported from the saaquiblabs studio site).
// Answers like the live server should: /welcome serves welcome/index.html (no redirect), and a missing
// path gets the 404 page with status 404 (#47).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

export const dist = fileURLToPath(new URL("../dist/", import.meta.url));

export const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".avif": "image/avif", ".ico": "image/x-icon", ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json", ".txt": "text/plain", ".xml": "application/xml",
};

/** Serves `root` on a free port of 127.0.0.1. Returns { base, close }. */
export async function serve(root = dist) {
  const server = createServer(async (req, res) => {
    const p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    let file = join(root, p);
    try {
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
      res.end(await readFile(file));
    } catch {
      const nf = await readFile(join(root, "404.html")).catch(() => null);
      res.writeHead(404, nf ? { "content-type": types[".html"] } : {}).end(nf ?? "not found");
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
