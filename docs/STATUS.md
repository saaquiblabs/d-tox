# Status

Last updated: 2026-11-19 (IST), 04:40. Each session overwrites this at handoff.

## Where we are

D-Tox is being rebuilt from scratch as the first Saaquib Labs product. The design grill is
finished: 32 questions, all answered by Najmush on 2026-11-18. **Read `CONTEXT.md` and
`docs/adr/` before doing anything.** They are the decisions; this file only summarises them.

- Research: `docs/research/2026-11-rebuild-grounding.md` (audit, competitors, MV3) and
  `docs/research/2026-11-product-page-organization.md` (repo and page layout).
- Agent-skills config: `CLAUDE.md` and `docs/agents/` (GitHub Issues, default triage labels).
- **Code exists now (#18, PR #30, merged 2026-11-18).** v1.4.1 is removed. `settings.json` (one
  Setting so far: comments), `extension/` (esbuild build, `src/hide.css`, `src/content.ts`, plain
  popup, saved-page Playwright tests), placeholder `site/` and `checks/`.
  How to build, test and add a Setting: root `README.md`.
- **Site (#26) is live (2026-11-19)** at `d-tox.saaquiblabs.com`, Umami included; Najmush
  checked it. `site/`: Astro static, `/` (stand-in for #27), `/welcome`, `/privacy`, 404;
  `npm run verify` = tests, build, `/welcome` vs `settings.json`, links, Lighthouse. Openship
  project `d-tox.saaquiblabs.com` (`proj_ombNMbyjVUOS-aV7`, home-vps); the domain had to be
  added as the project's public endpoint before the edge served the real certificate. Deploys
  are manual: `ssh najmush-oracle '~/.openship/bin/openship --local deploy --project
  proj_ombNMbyjVUOS-aV7 --branch main --env production --watch'`.
- **Product page `/` is live from the #22 prototype (direction H, pass 3; branch
  `feat/27-product-page-live`, 2026-11-19).** Najmush: "make this live for the moment, we will
  polish it at another moment." `site/src/pages/index.astro` is its own dark page (not Base.astro):
  wipe showcase, "Ten switches" story with the popup, numbers bento, Home scene (full feed →
  Intention Page B), close + footer. Assets in `site/public/{shots,feed,logo,fonts}`; Instrument
  Serif + Inter self-hosted (OFL, `public/fonts/LICENSES.txt`). Gate: 100 everywhere, `/` ~395 KB
  phone. **Still to polish (#27):** PLACEHOLDER numbers (#25), the feed uses real creators'
  thumbnails (replace before promoting the page), the hero mark is hidden on phones (it was the
  slow LCP). Every page now shares the look: `components/Header`, `components/Footer` and
  `styles/site.css` (fonts, tokens, header, footer) are used by `/` and by `Base.astro`
  (`/privacy`, `/welcome`, 404); styles are inlined per page. Gate 100 everywhere, inner pages
  ~127 KB.
  New icon: the folded-D mark on the page's dark tile, rendered by `extension/scripts/render-icons.mjs`
  into `extension/public/icon-{16,48,128}.png` (the toolbar icon and, copied, the favicon) plus
  `site/public/og.jpg` (social card on every page; also the README banner). Repo description,
  homepage and topics updated. **[HUMAN]** upload `site/public/og.jpg` as the repo's social preview
  (GitHub Settings → Social preview; no API) and the new 128 icon to the Web Store listing at the
  next release.
  The page builds itself after first paint, section by section, and the Home scene and the noise
  only when scrolled near (the VPS gate measured 430 ms blocking time when it was one task).
  The prototype's history and Najmush's verdicts live on `proto/22-prototypes` (docs/STATUS.md
  there); picks so far: popup D, Intention Page **B** (from the Home scene), page H.
- **#20 (PR #36, merged 2026-11-19):** Settings shorts, shorts-redirect, search-clean-up, explore, bell.
  RYS-derived selectors in `extension/src/hide-rys.css` (MPL-2.0, its own file). Merged with
  #19's harness: cases may list `distractions` under `elsewhere`, and every hiding Setting is
  checked on every saved page to hide nothing outside its Distractions.
- **Nightly check (#24, PR #37, merged 2026-11-19).** `checks/`: `npm run nightly` checks every
  Setting on live YouTube in English and Hindi, plays no video, exits 1 on a failure and (with
  `DTOX_ISSUES_TOKEN`) opens a `needs-triage` issue. Openship job **`d-tox nightly`**
  (`custom:yzEqfBekA24oA7JU`, home-vps), daily 23:00 UTC = 04:30 IST, 20 min timeout, no
  retries; command of record in `checks/README.md`. Green on the VPS in the pinned container
  (2026-11-19, ~3.5 min). **Still [HUMAN]:** the issues token (`checks/README.md` § The issues
  token); until then a failure only emails.

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
  Current size 7.16 KB (script 1,271 bytes); `:has()` 3 of 5.
- Repo: `extension/`, `site/` (Astro static, set up like saaquiblabs `site/`),
  `settings.json` (the single list of Settings), `checks/`, `docs/`.
- Release Gate: a manual Openship job on the home VPS. It runs the audit with every Setting on
  against a Baseline Run: within ~10% on long tasks and style recalc, no runaway DOM, no
  timeouts, playback and Shorts swipe working. **Standing approval for muted headless
  playback in the Release Gate only** (Najmush, 2026-11-18). Other video work still needs a yes.
- Nightly check: a scheduled Openship job (not GitHub Actions). It checks that each Setting's
  selector matches, in English and in Hindi, and plays no video. A failure emails (Openship) and opens a
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

research ✅ → grill ✅ → spec ✅ (#16) → tickets ✅ (#18–#28) → build: #18 ✅ (PR #30), #26 ✅ (live), #19 ✅ (PR #34), #20 ✅ (PR #36), #24 ✅ (PR #37), rest next →
prototypes of the popup, Intention Page and product page (seen running before anything is picked).

## Next step: #21 and #25

#20 and #24 are merged. No branch is open. Next: #21 (Home choice + Intention Page) and #25
(Release Gate, alone on a quiet machine: it measures speed). Najmush: the issues token for the
nightly check (5 minutes, `checks/README.md`).

**Order (two sessions at most at a time):**
1. ✅ #19 + #26.
2. ✅ #20 (PR #36) + #24 (PR #37).
3. Then #21 (after #19) and #25 (alone on a quiet machine: it measures speed). #23, #27, #28 as before; #22 prototypes still need Najmush.

Merge one PR at a time; after each, rebase the other open branch on `main`.

**On a new machine:** `git clone git@github.com:saaquiblabs/d-tox.git`, then per ticket
`git worktree add ../d-tox-19 feat/19-watch-page` (and so on); in each, `npm ci` in `extension/`
(plus `site/` or `checks/` where the ticket uses them) and `npx playwright install chromium` once.
Start Claude inside the worktree and say: "Continue #19 from the STATUS table."

**#20, accepted by Najmush (2026-11-19)**
- "People also watched" (`ytd-shelf-renderer`) is hidden by search clean-up but untested: no
  signed-out capture shows it (tried 4 searches); it seems signed-in only. A test needs a
  signed-in capture, i.e. Najmush's cookies — his call if ever wanted.
- A channel's Shorts *tab* stays visible; only its grid is hidden. It can be found only by
  `tab-title="Shorts"` (text), which ADR 0001 forbids.
- Untested rules (no signed-out saved page has them): the Trending, Explore and Playables
  menu links (only the Explore section is tested), and search clean-up's
  `ytd-horizontal-card-list-renderer`. The full menu's Shorts link is found by position (first
  section, the entry without a link); signed-in menus may differ. All need signed-in captures.
- "Explore, Trending and Playables" hides the menu's whole Explore section (Music, Gaming, News,
  Sports…); its "hides" line says so (issue: "the menu offers nothing to browse").
- Still open from the handoff: the bell and signed-in Home Shorts shelves are untested against
  real signed-in markup; Release Gate risk that hiding Shorts on Shorts-heavy searches makes
  YouTube load page after page (#25 should look).
- The Shorts redirect listens to `currententrychange`, not `navigate`: `navigate` fires before
  YouTube's pushState commits, so `replace()` replaced the page before the Short and Back left
  YouTube. Search ads are left alone; no Setting covers ads.
- Flaky (seen once in 4 full runs, never in 72 runs alone): `autoplay.spec.ts` › "the saved
  page starts with YouTube autoplay on" (#19's test), likely a storage/popup race under full
  parallel load. Fix with #21 or when it next shows.
- #19's watch-page Settings now go through the every-saved-page check too; a hidden element
  counts as a Distraction if it is one, holds one, or sits inside a hidden one.

**#24 (merged 2026-11-19), what the next tickets should know**
- The nightly checks that a hide rule *matches* each Distraction (a marker custom property in its
  copy of the stylesheets), not that it disappears: no video plays. It loads every `.css` at the
  top of `extension/src/`. Every hide rule must use `display: none !important` (noted in `hide.css`).
- `cases.ts` gained three nightly-only fields. `needs`: Distractions it can't see, skipped with
  the reason (end-screen links and grid need "a playing video", the bell "a signed-in account").
  `width`: the page's capture width (Gaming 1600, for the full menu). `liveUrl`: the search page
  opens "cooking" live, because "python tutorial" has no Shorts shelf in Hindi.
- **Case selectors must work in Hindi**: the Explore case's `a[title="Music"]` failed there; it
  now uses the Music channel's address. New cases: no text in selectors the nightly uses.
- YouTube's player shows the VPS (a datacenter address) "Sign in to confirm you're not a bot"
  and refuses the video, but the page renders. The check notes it and carries on; it blocks only
  if a Distraction is then missing. **#25 (Release Gate, plays video) cannot run on the VPS as
  is**: it needs a residential address (the Mac, or a proxy). Decide in #25.
- #25 should check live what the nightly skips: end-screen links and grid. Behaviour Settings
  (Autoplay off, Shorts redirect) and `elsewhere` pages are not checked nightly.
- Follow-up: if a Setting breaks in a second language while its issue is open, the new language
  is only logged, not added to the issue.

**Carry-overs from #26's review**
- `/welcome` now lists #19's two Calm Default Settings (Recommendations, Autoplay off). A choice (Home) that starts on YouTube's default must use `calmDefault: false`.
- The site's fonts are the system stack: Gellix is a trial licence and this repo is public.
- `/privacy` says the extension reads nothing from YouTube's pages: re-check it in #21 (Intention Page).
- The site's address is written in `astro.config.mjs`, `src/site.ts` and `tests/verify.mjs`.

**#19 (merged 2026-11-19), what the next tickets should know**
- ADR 0001 now allows class selectors (the player has no ids); text and labels are still banned.
- Autoplay off: once per tab, only on `/watch`, only when YouTube's button is visible. A Learner
  who switches autoplay on keeps it for that tab. YouTube hides the button in playlists, and a
  playlist always plays on. "Turns …" lines are allowed for behaviour Settings.
- The popup builds its switches only after storage answers (a click before then was undone).
- `capture.mjs` turns nested `<button>`/`<a>` into `<div>`; without this, saved pages lost the
  player's controls.
- Live check (Brave): the slow start and "Experiencing interruptions?" were uBlock Origin, not D-Tox.
- Follow-ups: the transcript is checked only by its panel header (recapture with the panel open);
  `.ytp-fullscreen-grid` also hides the mid-video fullscreen scroll grid.

**Carry-overs from #18's review** (the flash is fixed in #19)
- The popup builds switches only; the Home choice needs a `<select>` (#21).
- No test yet checks a Setting hides nothing on other pages (spec #16, Testing Decisions).
- Root `promo-*.html` and `assets/` are v1 store material, left for #26/#28 to replace or remove.

**Workflow:** every PR updates this file in the same PR (last commit before the push). No
separate STATUS PRs. Feature PRs merge only on Najmush's go-ahead.

**No git hooks** (Najmush, 2026-11-19): the pre-push hook is removed. Run `npm test` in
`extension/` and `npm run verify` in `site/` yourself before a PR; the Openship build still runs
the site gate. On a machine that ran `npm ci` before: `git config --unset core.hooksPath`.

**Code review only when it is needed** (Najmush, 2026-11-18): once per ticket, before its first PR,
when the ticket adds or changes behaviour. Not after test runs, rebases, fixes to earlier review
findings, or docs/STATUS changes, and not again on a branch already reviewed. The `/code-review`
steps in the table above follow this rule; when unsure, ask.

## Standing rules

- No video creation, recording or encoding until Najmush asks; the only exception is the
  Release Gate's muted playback (above).
- Nothing visual is decided until he has seen it running.
- Times in IST.
