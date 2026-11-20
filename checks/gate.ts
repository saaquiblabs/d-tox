// The Release Gate (#25, ADR 0005): no slow or broken release ships. Builds the extension, then
// runs the audit on live YouTube with no extension (the Baseline Run) and with every Setting on,
// alternating, GATE_ROUNDS times (default 3), on this machine. Passes only when D-Tox is within
// ~10% of the Baseline Run on long tasks and style recalc, nothing keeps growing, no page times
// out, a video plays and seeks, Shorts swipe, and end screens and the wide player behave.
//   npm run gate             run it; exit 0 pass, 1 fail, 2 blocked (bot check, error page)
//   GATE_ROUNDS=1 npm run gate   a quick try (not for a release)
// Run on the Mac on a home connection, with other apps closed: it measures speed, and YouTube
// refuses video to datacenter addresses such as the VPS. Writes checks/results/release-gate-*.json,
// the numbers the product page quotes.
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, platform, release, totalmem } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { audit, everySettingOn, viewport, type Mode } from './lib/audit.ts';
import { allowance, judge, type PageRun } from './lib/verdict.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const extensionDir = fileURLToPath(new URL('../extension/', import.meta.url));
const rounds = Number(process.env.GATE_ROUNDS ?? 3);
const git = (...args: string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim();

console.log('\nD-Tox Release Gate: building the extension');
const build = spawnSync('npm', ['run', 'build'], { cwd: extensionDir, stdio: 'inherit' });
if (build.status !== 0) {
  console.error('gate: the extension did not build');
  process.exit(1);
}
const { version } = JSON.parse(await readFile(new URL('../extension/package.json', import.meta.url), 'utf8'));
const dist = fileURLToPath(new URL('../extension/dist', import.meta.url));

console.log(`D-Tox ${version} against the Baseline Run, ${rounds} round(s), every Setting on\n`);
const runs: Record<Mode, PageRun[][]> = { baseline: [], dtox: [] };
let blocked = false;
for (let i = 0; i < rounds && !blocked; i++) {
  // Alternate which goes first, so neither always gets the warmer or quieter moment.
  const order: Mode[] = i % 2 ? ['dtox', 'baseline'] : ['baseline', 'dtox'];
  for (const mode of order) {
    console.log(`Round ${i + 1}, ${mode === 'dtox' ? 'D-Tox' : 'Baseline Run'}`);
    const result = await audit(mode, dist, (line) => console.log(line));
    runs[mode].push(result);
    if (result.some((p) => p.blocked)) {
      blocked = true;
      break;
    }
  }
}

const verdict = judge(runs);
const pct = (d: number, b: number) => (b ? `${d <= b ? '' : '+'}${Math.round(((d - b) / b) * 100)}%` : '–');
console.log('\nMedians per page (ms)          long tasks: Baseline → D-Tox    style recalc: Baseline → D-Tox');
for (const p of verdict.pages)
  console.log(`  ${(p.counted ? p.page : p.page + ' (worst case, not counted)').padEnd(28)} ${String(p.baseline.longTaskMs).padStart(6)} → ${String(p.dtox.longTaskMs).padEnd(14)} ${String(p.baseline.styleMs).padStart(6)} → ${p.dtox.styleMs}`);
const t = verdict.totals;
console.log(`  ${'all pages'.padEnd(28)} ${String(t.baseline.longTaskMs).padStart(6)} → ${String(t.dtox.longTaskMs).padEnd(6)} (${pct(t.dtox.longTaskMs, t.baseline.longTaskMs)})  ${String(t.baseline.styleMs).padStart(6)} → ${t.dtox.styleMs} (${pct(t.dtox.styleMs, t.baseline.styleMs)})`);
for (const n of verdict.notChecked) console.log(`  not checked: ${n}`);
for (const b of verdict.blocks) console.log(`  BLOCKED: ${b}`);
for (const f of verdict.failures) console.log(`  FAILED: ${f}`);
console.log(
  verdict.status === 'pass'
    ? `\nPASS: D-Tox ${version} is within ${allowance * 100}% of the Baseline Run and everything works.`
    : verdict.status === 'blocked'
      ? '\nBLOCKED: nothing about D-Tox was decided. Try again later or on another connection.'
      : '\nFAIL: this build must not ship.',
);

// The dated results file: what the product page's numbers come from.
const now = new Date();
const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' }).format(now).replace(' ', 'T').replace(':', '');
const file = new URL(`results/release-gate-${stamp}.json`, import.meta.url);
await mkdir(new URL('results/', import.meta.url), { recursive: true });
const record = {
  date: now.toISOString(),
  version,
  commit: git('rev-parse', '--short', 'HEAD'),
  uncommittedChanges: git('status', '--porcelain').length > 0,
  machine: { platform: platform(), release: release(), cpu: cpus()[0]?.model, cores: cpus().length, memoryGb: Math.round(totalmem() / 2 ** 30) },
  browser: chromium.executablePath().match(/chromium[-_][\w-]*\d+/)?.[0] ?? 'chromium',
  viewport,
  rounds: runs.dtox.length,
  settings: everySettingOn,
  verdict,
  runs,
};
await writeFile(file, JSON.stringify(record, null, 2) + '\n');
console.log(`results: ${fileURLToPath(file)}`);
process.exit(verdict.status === 'pass' ? 0 : verdict.status === 'fail' ? 1 : 2);
