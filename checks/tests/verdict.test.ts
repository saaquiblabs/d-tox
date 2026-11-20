import assert from 'node:assert/strict';
import { test } from 'node:test';
import { judge, median, type PageRun } from '../lib/verdict.ts';

/** A healthy page; override what a test is about. */
const page = (over: Partial<PageRun> & Pick<PageRun, 'page'>): PageRun => ({
  longTaskMs: 1000,
  styleMs: 200,
  nodes: 5000,
  idleGrowth: 0,
  checks: {},
  ...over,
});
const watch = (over: Partial<PageRun> = {}) =>
  page({ page: 'watch', checks: { plays: true, seeks: true }, playerWidth: 1200, endScreens: 4, ...over });
/** Three rounds of the same pages. */
const rounds = (...pages: PageRun[]) => [pages, pages, pages];

const base = rounds(watch(), page({ page: 'search' }));
const good = rounds(watch({ playerWidth: 1400, endScreens: 0 }), page({ page: 'search' }));

test('median', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), 0);
});

test('passes when D-Tox is no slower, everything works and end screens are hidden', () => {
  const v = judge({ baseline: base, dtox: good });
  assert.equal(v.status, 'pass', JSON.stringify(v));
  assert.deepEqual(v.totals.baseline, { longTaskMs: 2000, styleMs: 400 });
});

test('fails when long-task time is more than 10% over the Baseline Run', () => {
  const slow = rounds(watch({ playerWidth: 1400, endScreens: 0, longTaskMs: 1300 }), page({ page: 'search' }));
  const v = judge({ baseline: base, dtox: slow });
  assert.equal(v.status, 'fail');
  assert.match(v.failures.join(), /long-task time: 2300 ms/);
});

test('within 10% (and a little slack) passes', () => {
  const ok = rounds(watch({ playerWidth: 1400, endScreens: 0, longTaskMs: 1240 }), page({ page: 'search' }));
  assert.equal(judge({ baseline: base, dtox: ok }).status, 'pass');
});

test('fails on style recalc too', () => {
  const slow = rounds(watch({ playerWidth: 1400, endScreens: 0, styleMs: 300 }), page({ page: 'search' }));
  assert.match(judge({ baseline: base, dtox: slow }).failures.join(), /style recalc/);
});

test('uses the median, so one noisy round does not fail it', () => {
  const noisy = [...good];
  noisy[1] = [watch({ playerWidth: 1400, endScreens: 0, longTaskMs: 9000 }), page({ page: 'search' })];
  assert.equal(judge({ baseline: base, dtox: noisy }).status, 'pass');
});

test('fails when a page keeps growing while idle', () => {
  const runaway = rounds(watch({ playerWidth: 1400, endScreens: 0 }), page({ page: 'search', idleGrowth: 4000 }));
  assert.match(judge({ baseline: base, dtox: runaway }).failures.join(), /search: 4000 DOM nodes/);
});

test('fails when a video does not play with D-Tox but does without', () => {
  const broken = rounds(watch({ playerWidth: 1400, endScreens: 0, checks: { plays: false, seeks: true } }), page({ page: 'search' }));
  const v = judge({ baseline: base, dtox: broken });
  assert.equal(v.status, 'fail');
  assert.match(v.failures.join(), /watch: plays failed in 3 of 3/);
});

test('a check that fails without D-Tox too blocks instead of failing', () => {
  const nowhere = rounds(watch({ checks: { plays: false, seeks: false } }), page({ page: 'search' }));
  const v = judge({ baseline: nowhere, dtox: rounds(watch({ playerWidth: 1400, endScreens: 0, checks: { plays: false, seeks: false } }), page({ page: 'search' })) });
  assert.equal(v.status, 'blocked');
  assert.match(v.blocks.join(), /plays fails without D-Tox too/);
});

test('a check that fails in one round of three (an ad, a slow load) passes and is noted', () => {
  const once = [...good];
  once[1] = [watch({ playerWidth: 1400, endScreens: 0, checks: { plays: false, seeks: true } }), page({ page: 'search' })];
  const v = judge({ baseline: base, dtox: once });
  assert.equal(v.status, 'pass');
  assert.match(v.notChecked.join(), /plays failed in 1 of 3 rounds/);
});

test('a Baseline Run page that errored in one round is compared on the others', () => {
  const flaky = [...base];
  flaky[0] = [page({ page: 'watch', error: 'page time limit 180s' }), page({ page: 'search' })];
  const v = judge({ baseline: flaky, dtox: good });
  assert.equal(v.status, 'pass');
  assert.match(v.notChecked.join(), /errored in 1 of 3/);
});

test('a bot check blocks, whichever run met it', () => {
  const walled = rounds(page({ page: 'watch', blocked: 'bot check at https://www.google.com/sorry/index' }), page({ page: 'search' }));
  assert.equal(judge({ baseline: walled, dtox: good }).status, 'blocked');
  assert.equal(judge({ baseline: base, dtox: walled }).status, 'blocked');
});

test('a D-Tox page that times out fails; a Baseline Run that times out blocks', () => {
  const late = rounds(page({ page: 'watch', error: 'page time limit 90s' }), page({ page: 'search' }));
  assert.equal(judge({ baseline: base, dtox: late }).status, 'fail');
  assert.equal(judge({ baseline: late, dtox: good }).status, 'blocked');
});

test('end screens that show with D-Tox fail', () => {
  const shown = rounds(watch({ playerWidth: 1400, endScreens: 3 }), page({ page: 'search' }));
  assert.match(judge({ baseline: base, dtox: shown }).failures.join(), /end screens showed/);
});

test('end screens are not checked when the Baseline Run saw none', () => {
  const none = rounds(watch({ endScreens: 0 }), page({ page: 'search' }));
  const v = judge({ baseline: none, dtox: good });
  assert.equal(v.status, 'pass');
  assert.match(v.notChecked.join(), /end screens/);
});

test('the wide player must be wider than YouTube’s own', () => {
  const same = rounds(watch({ playerWidth: 1210, endScreens: 0 }), page({ page: 'search' }));
  assert.match(judge({ baseline: base, dtox: same }).failures.join(), /not wider/);
});

test('a page only D-Tox visits (the Shorts redirect) is checked but not timed', () => {
  const extra = good.map((r) => [...r, page({ page: 'shorts-redirect', longTaskMs: 99999, checks: { redirects: true, plays: true } })]);
  const v = judge({ baseline: base, dtox: extra });
  assert.equal(v.status, 'pass');
  assert.equal(v.pages.length, 2);
});

test('a check D-Tox could not try is listed, not failed', () => {
  const untried = rounds(watch({ playerWidth: 1400, endScreens: 0, checks: { plays: true, seeks: null } }), page({ page: 'search' }));
  const v = judge({ baseline: base, dtox: untried });
  assert.equal(v.status, 'pass');
  assert.match(v.notChecked.join(), /watch: seeks/);
});

test('the worst-case search is reported and checked for runaway loading, but not in the speed total', () => {
  const worst = (over: Partial<PageRun> = {}) => page({ page: 'search-shorts', longTaskMs: 300, ...over });
  const v = judge({ baseline: base.map((r) => [...r, worst()]), dtox: good.map((r) => [...r, worst({ longTaskMs: 5000 })]) });
  assert.equal(v.status, 'pass');
  assert.equal(v.totals.dtox.longTaskMs, 2000);
  assert.equal(v.pages.find((p) => p.page === 'search-shorts')!.dtox.longTaskMs, 5000);
  const runaway = judge({ baseline: base.map((r) => [...r, worst()]), dtox: good.map((r) => [...r, worst({ idleGrowth: 3000 })]) });
  assert.match(runaway.failures.join(), /search-shorts: 3000 DOM nodes/);
});
