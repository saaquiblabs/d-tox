# Status

Last updated: 2026-11-18, 22:35 IST. Each session overwrites this at handoff.

## Where we are

D-Tox is being rebuilt from scratch as the first Saaquib Labs product. The design grill is
finished: 32 questions, all answered by Najmush on 2026-11-18. **Read `CONTEXT.md` and
`docs/adr/` before doing anything.** They are the decisions; this file only summarises them.

- Research: `docs/research/2026-11-rebuild-grounding.md` (audit, competitors, MV3) and
  `docs/research/2026-11-product-page-organization.md` (repo and page layout).
- Agent-skills config: `CLAUDE.md` and `docs/agents/` (GitHub Issues, default triage labels).
- **Code exists now (#18, PR #30, merged 2026-11-18).** v1.4.1 is removed. `settings.json` (one
  Setting so far: comments), `extension/` (esbuild build, `src/hide.css`, `src/content.ts`, plain
  popup, saved-page Playwright tests), `.githooks/pre-push`, placeholder `site/` and `checks/`.
  How to build, test and add a Setting: root `README.md`.
- **Site skeleton (#26) is in a PR, not merged, not live.** `site/`: Astro 7.4.7 static, ported
  from the studio site; `/` (stand-in for #27), `/welcome` (Calm Default from `settings.json` + pin
  steps), `/privacy` (corrected: `chrome.storage.sync`, nothing sent), 404. `npm run verify` = unit
  tests, build, `/welcome` vs `settings.json` check, link check, Lighthouse (all 100 on phone +
  desktop, pages 13–17 KB, 0 KB JS; passed after the rebase on 2026-11-18). The pre-push hook runs
  it when a push touches `site/`, `settings.json` or `extension/public/`. Brand copies pinned to
  saaquiblabs `042b314` (`npm run sync-brand`). Goes live through the [HUMAN] steps in `site/README.md`.

## Decisions (grill, 2026-11-18)

**Product**
- Promise: "YouTube for what you came for." Learners first, Shorts Quitters second; parents
  are out of scope for v1. MIT, free, GitHub Sponsors on the `saaquiblabs` org (popup and page
  footers only). The extension sends nothing anywhere; Settings live in `chrome.storage.sync`.
- Name: "D-Tox" in prose, `d-tox` in URLs and code. Chrome only, `www.youtube.com` only (no
  Music, Studio, m. or embeds).
- v1 has 10 Settings: Home (Intention Page / Subscriptions / YouTube default), watch-page
  recommendations, end screens, Shorts hide, Shorts redirect, comments, autoplay off (player
  button stays usable), notifications bell, Explore/Trending/Playables, search clean-up.
  Cut: live chat (YouTube has its own hide), profile photos, header, video info, annotations,
  mixes/playlists/"More from YouTube", fundraisers, merch.
- Calm Default on every install, new or updated (no migration; ADR 0002): Intention Page,
  Shorts hidden, autoplay off, watch-page recommendations hidden.
- Intention Page: "What are you here for?" + search + links to Subscriptions and Watch later.
  Session intention with timers is v2.1, not v1.
- Popup: master switch (no pause timer), Settings grouped Home · Watch · Shorts · Search ·
  Everywhere, footer Privacy · Changelog · Sponsor. No options page. Follows system dark
  mode; the Intention Page follows YouTube's theme.
- Install opens `d-tox.saaquiblabs.com/welcome` once (not on update).

**Engineering** (ADRs 0001, 0003, 0004)
- One static stylesheet at `document_start`, rules gated on `<html>` attributes and scoped by
  page; a ~1 KB script copies Settings; no timers or hiding observers; at most 5 `:has()`;
  no selectors that match text. Popup in plain TS and CSS. Under 40 KB excluding icons.
- **Build is plain esbuild, not WXT** (measured in #18: WXT added ~4.4 KB; ADR 0001).
  Current size 2.42 KB.
- Repo: `extension/`, `site/` (Astro static, set up like saaquiblabs `site/`),
  `settings.json` (the single list of Settings), `checks/`, `docs/`.
- Release Gate: a manual Openship job on the home VPS. It runs the audit with every Setting on
  against a Baseline Run: within ~10% on long tasks and style recalc, no runaway DOM, no
  timeouts, playback and Shorts swipe working. **Standing approval for muted headless
  playback in the Release Gate only** (Najmush, 2026-11-18). Other video work still needs a yes.
- Nightly check: a scheduled Openship job (not GitHub Actions). It checks that each Setting's
  selector matches, once in Hindi, and plays no video. A failure emails (Openship) and opens a
  `needs-triage` issue using a fine-grained token (Issues: write on this repo only).
- Release: Najmush uploads the zip by hand ([HUMAN] steps) as v2.0.0 on the existing listing
  `ocngpkbaoflpfjamgcnnjbdnhmakmgel`; switch the listing's name, site and email to Saaquib Labs.

**Product page** `d-tox.saaquiblabs.com`
- Pages: `/`, `/welcome`, `/privacy`, 404. The changelog is GitHub Releases.
- `/` sections: hero ("YouTube for what you came for. Nothing else." + Add to Chrome),
  before/after screenshots, the 10 Settings from `settings.json`, measured numbers from
  the Release Gate (dated), an honest comparison with Unhook and RYS, privacy in one line, footer.
- Umami (self-hosted, cookieless) counts visits and Add to Chrome clicks; the footer says so.
- Brand files: a pinned copy of `saaquiblabs/brand` via `npm run sync-brand`.
- Cut-over: the new page goes live, links are repointed, then `d-tox.najmushsaaquib.com` 301s
  (30 days, saaquiblabs ADR 0006), then the portfolio's `app/(products)/d-tox/` is removed.

## Pipeline

research ✅ → grill ✅ → spec ✅ (#16) → tickets ✅ (#18–#28) → build: #18 ✅ (PR #30), #26 in PR (live after [HUMAN] steps), rest next →
prototypes of the popup, Intention Page and product page (seen running before anything is picked).

## Next step: three tickets on branches, #26 in a PR

On 2026-11-18 four sessions ran in parallel and the Claude limit ran out. Each branch ends with a
`wip(#n)` commit: everything was saved as it stood, **not tested as a whole**. Pick up from here.

| Branch | Ticket | State | To finish |
|---|---|---|---|
| `feat/19-watch-page` | #19 recommendations, end screens, autoplay off | Code written, incl. the flash fix (Calm Default applied before storage answers). Last full test run failed only because the Mac was overloaded (browser start ~12 s vs 20 s limit). | Run `npm test` in `extension/` on a quiet machine; fix real failures; check the "never shows while the page loads" test fails if the early Calm Default is removed; `/code-review`; STATUS; PR. Autoplay after YouTube's own navigation needs a live check: Najmush tries `extension/dist` in Chrome, or says yes to a short muted headless playback. |
| `feat/20-shorts-search-menu-bell` | #20 Shorts hide + redirect, search clean-up, Explore/Trending/Playables, bell | Code written, typecheck passes. Adds `src/hide-rys.css` (MPL-2.0, from RYS). Full suite not run; tests not proven fail-first. | Rebase on `main` **after #19 merges** (they overlap: `content.ts`, `hide.css`, `settings.json`, `tests/`). Then full tests, `/code-review`, STATUS, PR. **Decisions for Najmush:** (1) a channel's Shorts tab can only be found by `tab-title="Shorts"` (text; ADR 0001 forbids it): amend the ADR or leave the tab; (2) the bell and signed-in home Shorts shelves are untested against real markup (only signed-out pages could be saved); (3) Release Gate risk: hiding Shorts on Shorts-heavy searches may make YouTube load page after page. |
| `feat/24-nightly-check` | #24 nightly check (Openship job) | `checks/` written (`nightly.ts`, `job.mjs`, `lib/`), its 9 tests pass. The live run against YouTube was interrupted. | Run the live check once (`npm run nightly` in `checks/`, no video plays); `/code-review`; STATUS; PR. Then the [HUMAN] Openship job setup and the issues token. |
| `feat/26-site-skeleton` | #26 site skeleton | Rebased on `main`, `npm run verify` passes, PR open. | Najmush's go-ahead to merge; then the [HUMAN] go-live steps below. |

**Order (two sessions at most at a time, four emptied the limit):**
1. #19 + #26 together (they don't overlap).
2. #20 (rebased on #19) + #24.
3. Then #21 (after #19) and #25 (alone on a quiet machine: it measures speed). #23, #27, #28 as before; #22 prototypes still need Najmush.

Merge one PR at a time; after each, rebase the other open branch on `main`.

**On a new machine:** `git clone git@github.com:saaquiblabs/d-tox.git`, then per ticket
`git worktree add ../d-tox-19 feat/19-watch-page` (and so on); in each, `npm ci` in `extension/`
(plus `site/` or `checks/` where the ticket uses them) and `npx playwright install chromium` once.
Start Claude inside the worktree and say: "Continue #19 from the STATUS table."

**#26 go-live ([HUMAN], `site/README.md` § Going live):** 1. create the D-Tox website in Umami and
give Claude its ID (until then the tag, the footer line and the privacy page's Umami paragraph are
left out); 2. Openship clone access if the public clone 403s; 3. the Openship project
(`rootDirectory: site`, build `npm run verify`); 4. Cloudflare A record `d-tox` → `144.24.124.152`,
grey cloud; 5. domain + certificate; 6. checks.

**Carry-overs from #26's review**
- `settings.json` has no Calm Default Settings yet, so `/welcome` says "starts with nothing hidden"
  until #19–#21 land. A choice (Home) that starts on YouTube's default must use `calmDefault: false`.
- The site's fonts are the system stack: Gellix is a trial licence and this repo is public.
- `/privacy` says the extension reads nothing from YouTube's pages: re-check it in #21 (Intention Page).
- The site's address is written in `astro.config.mjs`, `src/site.ts` and `tests/verify.mjs`.

**Carry-overs from #18's review** (the flash is handled on the #19 branch)
- The popup builds switches only; the Home choice needs a `<select>` (#21).
- No test yet checks a Setting hides nothing on other pages (spec #16, Testing Decisions).
- The pre-push hook is turned on by `npm ci` in `extension/` (`prepare` sets `core.hooksPath`).
- Root `promo-*.html` and `assets/` are v1 store material, left for #26/#28 to replace or remove.

**Workflow:** every PR updates this file in the same PR (last commit before the push). No
separate STATUS PRs. Feature PRs merge only on Najmush's go-ahead.

**Code review only when it is needed** (Najmush, 2026-11-18): once per ticket, before its first PR,
when the ticket adds or changes behaviour. Not after test runs, rebases, fixes to earlier review
findings, or docs/STATUS changes, and not again on a branch already reviewed. The `/code-review`
steps in the table above follow this rule; when unsure, ask.

## Standing rules

- No video creation, recording or encoding until Najmush asks; the only exception is the
  Release Gate's muted playback (above).
- Nothing visual is decided until he has seen it running.
- Times in IST.
