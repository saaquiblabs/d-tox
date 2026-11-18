// /welcome must list exactly what the Calm Default turns on, each with its "hides" line from
// ../settings.json (#26). `npm run verify` runs this on the built page; tests/welcome.test.mjs
// proves it fails when they disagree. Run alone after a build: node tests/welcome.mjs
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/** Same rule as src/settings.ts, written out again on purpose so the check doesn't trust the page's code:
 * a switch is in the Calm Default when it is true; a choice (Home) when it starts on a value of its own
 * (a choice that starts on YouTube's default sets calmDefault: false). */
export const inCalmDefault = (s) => s.calmDefault === true || typeof s.calmDefault === "string";

const decode = (s) =>
  s.replace(/<[^>]*>/g, " ").replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

/** Every way the page disagrees with the Settings list; [] when it agrees. */
export function welcomeProblems(html, settings) {
  const list = html.match(/<ul[^>]*\sdata-calm-default[^>]*>([\s\S]*?)<\/ul>/);
  if (!list) return ["/welcome has no <ul data-calm-default> list"];
  const shown = new Map(
    [...list[1].matchAll(/<li[^>]*\sdata-setting="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => [m[1], decode(m[2])]),
  );
  const want = settings.filter(inCalmDefault);
  const problems = [];
  for (const s of want) {
    if (!shown.has(s.id)) problems.push(`${s.id}: in the Calm Default but missing from /welcome`);
    else if (!shown.get(s.id).includes(s.hides)) problems.push(`${s.id}: /welcome doesn't show its hides line "${s.hides}"`);
  }
  for (const id of shown.keys()) {
    if (!want.some((s) => s.id === id)) problems.push(`${id}: on /welcome but not in the Calm Default`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const settings = JSON.parse(await readFile(new URL("../../settings.json", import.meta.url), "utf8"));
  const html = await readFile(new URL("../dist/welcome/index.html", import.meta.url), "utf8");
  const problems = welcomeProblems(html, settings);
  if (problems.length) {
    console.error(`welcome: /welcome disagrees with settings.json\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`welcome: ok (${settings.filter(inCalmDefault).length} Calm Default Settings listed)`);
}
