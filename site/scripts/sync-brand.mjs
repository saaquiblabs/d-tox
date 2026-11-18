// Copy the Saaquib Labs brand files this site uses from the saaquiblabs repo, pinned to one commit
// (ADR 0004). Openship clones only this repo, so the copies are committed here; this script is how
// they are refreshed. Run by hand, never by the build:
//
//   npm run sync-brand              # the newest commit on saaquiblabs main
//   npm run sync-brand -- <sha>     # a given commit
//
// The saaquiblabs repo is private: this needs your own git access to it (SSH). BRAND_REPO points at
// another copy (a local path works). The commit lands in src/brand/PINNED; commit that file with the copies.
// Gellix is not copied: the studio's files are a trial licence, and this repo is public (saaquiblabs
// ADR 0013). The pages fall back to the system font.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = process.env.BRAND_REPO ?? "git@github.com:najmushsaaquib/saaquiblabs.git";
const ref = process.argv[2] ?? "main";
const site = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Path in the saaquiblabs repo → path here. Add a line to take another file. */
const files = {
  "site/src/styles/tokens.css": "src/brand/tokens.css",
  "brand/symbol/saaquiblabs-symbol-flat-graphite.svg": "public/brand/symbol-flat.svg",
};

const tmp = mkdtempSync(join(tmpdir(), "sync-brand-"));
const git = (...args) => execFileSync("git", ["-C", tmp, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
try {
  git("init", "-q");
  git("fetch", "-q", "--depth", "1", repo, ref);
  const sha = git("rev-parse", "FETCH_HEAD");
  git("checkout", "-q", sha, "--", ...Object.keys(files));
  for (const [from, to] of Object.entries(files)) cpSync(join(tmp, from), join(site, to));
  writeFileSync(
    join(site, "src/brand/PINNED"),
    `${sha}\n# saaquiblabs commit the brand copies come from. Refresh: npm run sync-brand (site/scripts/sync-brand.mjs).\n`,
  );
  console.log(`sync-brand: ${Object.keys(files).length} files from saaquiblabs@${sha.slice(0, 7)}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
