// Copy the extension's icons into public/ before each build, so the site's favicon is the icon people
// see in Chrome's toolbar. The extension is the single source; the copies are gitignored.
// Pattern ported from the saaquiblabs studio site's scripts/copy-brand.mjs.
import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const site = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(site, "..", "extension", "public");
const icons = ["icon-16.png", "icon-48.png", "icon-128.png"];

for (const f of icons) {
  if (!existsSync(join(src, f))) {
    console.error(`copy-icons: ${join(src, f)} not found. The build needs the whole repo, not only site/.`);
    process.exit(1);
  }
  cpSync(join(src, f), join(site, "public", f));
}
console.log(`copy-icons: ${icons.length} icons from extension/public`);
