// The Release Gate's verdict (#25): pure, so it is tested without a browser. The audit
// (audit.ts) measures each page once per run; the gate runs the Baseline Run (no extension) and
// D-Tox (every Setting on) several rounds, alternating, and this decides from the medians.

export type PageId = 'home' | 'search' | 'watch' | 'playlist' | 'channel' | 'shorts' | 'shorts-redirect';

/** What one page gave in one run. A check is true or false, or null when it could not be tried. */
export type PageRun = {
  page: PageId;
  /** The page could not be measured for a reason outside D-Tox: a bot check, consent, an error page. */
  blocked?: string;
  /** Timed out or crashed. */
  error?: string;
  longTaskMs?: number;
  styleMs?: number;
  /** DOM nodes when scrolling stopped, and how many more after sitting idle. */
  nodes?: number;
  idleGrowth?: number;
  checks?: Partial<Record<Check, boolean | null>>;
  /** Watch page: the player's width, and how many end-screen elements were seen at the end. */
  playerWidth?: number;
  endScreens?: number | null;
};

export type Check =
  | 'plays'
  | 'seeks'
  | 'swipes'
  | 'redirects'
  | 'title in view'
  | 'playlist column kept';

export type Runs = { baseline: PageRun[][]; dtox: PageRun[][] };

/** Long-task time and style recalc, summed over the pages, may be at most this much over the Baseline Run. */
export const allowance = 0.1;
/** …plus a little, in ms, so a page with almost no cost doesn't fail on noise. */
export const slackMs = { longTaskMs: 50, styleMs: 20 } as const;
/** Nodes D-Tox may add while a page sits idle, beyond what the Baseline Run adds. */
export const idleGrowthSlack = 500;
/** The wide player (#46) must be at least this many px wider than YouTube's own. */
export const widerBy = 40;

export type Totals = { longTaskMs: number; styleMs: number };
export type PageSummary = { page: PageId; baseline: Totals & { idleGrowth: number }; dtox: Totals & { idleGrowth: number } };
export type Verdict = {
  status: 'pass' | 'fail' | 'blocked';
  /** Why it failed or was blocked, and what was not checked. */
  failures: string[];
  blocks: string[];
  notChecked: string[];
  pages: PageSummary[];
  totals: { baseline: Totals; dtox: Totals };
};

export const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

const pagesOf = (runs: PageRun[][], page: PageId) => runs.map((r) => r.find((p) => p.page === page)).filter((p) => p !== undefined);
const med = (runs: PageRun[], key: 'longTaskMs' | 'styleMs' | 'idleGrowth' | 'playerWidth') => median(runs.map((r) => r[key] ?? 0));
const round = (n: number) => Math.round(n);

export function judge({ baseline, dtox }: Runs): Verdict {
  const failures: string[] = [];
  const blocks: string[] = [];
  const notChecked: string[] = [];

  for (const [mode, runs] of [['Baseline Run', baseline], ['D-Tox', dtox]] as const)
    for (const p of runs.flat()) if (p.blocked) blocks.push(`${p.page} (${mode}): ${p.blocked}`);
  // A Baseline Run that didn't finish can't be compared with: not D-Tox's fault.
  for (const p of baseline.flat()) if (p.error) blocks.push(`${p.page} (Baseline Run): ${p.error}`);
  for (const p of dtox.flat()) if (p.error) failures.push(`${p.page}: ${p.error}`);

  // Speed: per page the median over rounds, then summed. Pages only D-Tox visits are left out.
  const ids = [...new Set(baseline.flat().map((p) => p.page))];
  const pages: PageSummary[] = ids.map((page) => {
    const b = pagesOf(baseline, page).filter((p) => !p.error && !p.blocked);
    const d = pagesOf(dtox, page).filter((p) => !p.error && !p.blocked);
    return {
      page,
      baseline: { longTaskMs: round(med(b, 'longTaskMs')), styleMs: round(med(b, 'styleMs')), idleGrowth: round(med(b, 'idleGrowth')) },
      dtox: { longTaskMs: round(med(d, 'longTaskMs')), styleMs: round(med(d, 'styleMs')), idleGrowth: round(med(d, 'idleGrowth')) },
    };
  });
  const sum = (side: 'baseline' | 'dtox', key: keyof Totals) => pages.reduce((a, p) => a + p[side][key], 0);
  const totals = {
    baseline: { longTaskMs: sum('baseline', 'longTaskMs'), styleMs: sum('baseline', 'styleMs') },
    dtox: { longTaskMs: sum('dtox', 'longTaskMs'), styleMs: sum('dtox', 'styleMs') },
  };
  for (const [key, name] of [['longTaskMs', 'long-task time'], ['styleMs', 'style recalc']] as const) {
    const limit = totals.baseline[key] * (1 + allowance) + slackMs[key];
    if (totals.dtox[key] > limit)
      failures.push(`${name}: ${totals.dtox[key]} ms with D-Tox, over the limit of ${round(limit)} ms (Baseline Run ${totals.baseline[key]} ms + ${allowance * 100}%)`);
  }

  // Nothing grows without limit: a page that keeps adding nodes while idle is loading page after page.
  for (const p of pages)
    if (p.dtox.idleGrowth > p.baseline.idleGrowth + idleGrowthSlack)
      failures.push(`${p.page}: ${p.dtox.idleGrowth} DOM nodes added while idle with D-Tox (Baseline Run ${p.baseline.idleGrowth}): something keeps loading`);

  // What must work. A check that fails without D-Tox too says nothing about D-Tox.
  const checks = new Set(dtox.flat().flatMap((p) => Object.keys(p.checks ?? {}) as Check[]).map((c) => c));
  for (const page of new Set(dtox.flat().map((p) => p.page))) {
    const d = pagesOf(dtox, page).filter((p) => !p.error && !p.blocked);
    const b = pagesOf(baseline, page).filter((p) => !p.error && !p.blocked);
    for (const check of checks) {
      const results = d.map((p) => p.checks?.[check]).filter((r) => r !== undefined);
      if (!results.length) continue;
      if (results.some((r) => r === null)) notChecked.push(`${page}: ${check} (could not be tried)`);
      if (!results.includes(false)) continue;
      const withoutDtox = b.map((p) => p.checks?.[check]).filter((r) => r !== undefined);
      if (withoutDtox.length && withoutDtox.every((r) => r === false)) blocks.push(`${page}: ${check} fails without D-Tox too`);
      else failures.push(`${page}: ${check} failed in ${results.filter((r) => r === false).length} of ${results.length} rounds`);
    }
  }

  // End screens: hidden with D-Tox, but only a check if the Baseline Run saw some.
  const bWatch = pagesOf(baseline, 'watch').filter((p) => p.endScreens != null);
  const dWatch = pagesOf(dtox, 'watch').filter((p) => p.endScreens != null);
  if (!bWatch.length || median(bWatch.map((p) => p.endScreens!)) === 0 || !dWatch.length)
    notChecked.push('watch: end screens (YouTube showed none, or the video never reached its end)');
  else if (dWatch.some((p) => p.endScreens! > 0)) failures.push(`watch: end screens showed with D-Tox (${dWatch.map((p) => p.endScreens).join(', ')})`);

  // The wide player (#46): with recommendations hidden the player is wider than YouTube's own.
  const bw = med(pagesOf(baseline, 'watch'), 'playerWidth');
  const dw = med(pagesOf(dtox, 'watch'), 'playerWidth');
  if (!bw || !dw) notChecked.push('watch: player width');
  else if (dw < bw + widerBy) failures.push(`watch: the player is ${round(dw)} px with D-Tox, not wider than YouTube's ${round(bw)} px`);

  const status = blocks.length ? 'blocked' : failures.length ? 'fail' : 'pass';
  return { status, failures, blocks, notChecked, pages, totals };
}
