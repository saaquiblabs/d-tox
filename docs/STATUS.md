# Status

Last updated: 2026-11-18 (IST). Each session overwrites this at handoff.

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

research ✅ → grill ✅ → spec ✅ (#16) → tickets ✅ (#18–#28) → build: #18 ✅ (PR #30), rest next →
prototypes of the popup, Intention Page and product page (seen running before anything is picked).

## Next step

Tickets #18–#28 are sub-issues of #16, with GitHub "blocked by" links. #18 is closed.

- **Start now (unblocked):** #19 watch page, #20 Shorts/search/menu/bell, #21 Home + Calm Default
  + install, #24 nightly check, #25 Release Gate, #26 site skeleton — all in parallel. #22
  prototypes is `ready-for-human`: Najmush must see them running and pick.
- #23 popup/Intention Page design waits on #21 + #22; #27 product page on #22 + #25 + #26;
  #28 release waits on everything.

**Carry-overs from #18's review**
- Possible flash: `content.ts` sets `<html>` attributes after an async `chrome.storage.sync.get`,
  so the page can draw first. Invisible for comments (they load late) but it matters for
  Settings that are on by default: fix in #19/#21 (research §3: a cached first-paint attribute).
  The saved-page tests use `toBeHidden()`, which retries, so they can't catch a flash yet.
- The popup builds switches only; the Home choice needs a `<select>` (#21).
- No test yet checks a Setting hides nothing on other pages (spec #16, Testing Decisions).
- The pre-push hook is turned on by `npm ci` in `extension/` (`prepare` sets `core.hooksPath`).
- Root `promo-*.html` and `assets/` are v1 store material, left for #26/#28 to replace or remove.

Ready prompts: `/implement #19`, `/implement #21`, `/implement #20`, `/implement #24`,
`/implement #25`, `/implement #26`.

**Workflow:** every PR updates this file in the same PR (last commit before the push). No
separate STATUS PRs.

## Standing rules

- No video creation, recording or encoding until Najmush asks; the only exception is the
  Release Gate's muted playback (above).
- Nothing visual is decided until he has seen it running.
- Times in IST.
