# d-tox rebuild: grounding research

Date: 2026-11-18. Input for the `/grill-with-docs` session that sets the rebuild's vision.
Covers: what is wrong with v1.4.1 (code audit), how the best competitors work, what
Chrome's Manifest V3 allows, and what the Dossier and Openship product pages do well.

**Status of the live audit:** not yet run. Loading a YouTube watch page or Shorts plays
video, and video playback (even headless) waits on Najmush's go-ahead. Everything under
"Code audit" is read from source; every "likely" in it is a hypothesis the live run must
confirm or kill. See "Live audit plan" at the end.

Decisions already made (2026-11-18): rebuild from scratch; Chrome only for v1; YouTube
only; repo lives at `saaquiblabs/d-tox`; product page on its own subdomain of
saaquiblabs.com.

---

## 1. Code audit of v1.4.1

Stack: WXT 0.20 + React 19 + Tailwind 4 + Headless UI + lucide. 13 commits, no tests.
The page-facing logic is three files: `entrypoints/content.ts` (160 lines),
`src/utils/css-injector.ts`, `src/constants/youtube-elements.ts` (the CSS rules).

### Selectors that hide far more than they mean to

These match the "touches everything / breaks YouTube" complaint directly.

| Feature | Rule (`youtube-elements.ts`) | What it also hides |
|---|---|---|
| Hide home feed | `ytd-rich-grid-renderer` (l.200) | Every rich grid: Subscriptions feed, a channel's Videos/Shorts/Live tabs. Not scoped to the home page. |
| Hide sidebar | `#secondary` (l.206) | The whole right column: playlist queue, live chat, chapters/transcript/engagement panels. |
| Hide live chat | `div[id*="chat"]` (l.285) | Any div whose id *contains* "chat", anywhere on any page. |
| Hide comments | `#comments`, `ytd-item-section-renderer#sections` (l.263–265) | Generic ids; `#sections` is reused by YouTube for other item sections. |
| Hide cards | `div[aria-label*="Card"]` (l.300) | Any div whose label contains "Card" (localised UIs differ, English matches broadly). |
| Hide explore | `a[aria-label*="Explore"]` (l.332) | Any link labelled with "Explore". |
| Disable autoplay | `.ytp-autonav-toggle-button-container { pointer-events:none }` | The user can no longer switch autoplay back on from the player. |

All rules are unscoped by page: there is no `ytd-browse[page-subtype="home"]` or
`ytd-watch-flexy` prefix, so a rule written for one page fires on every page.

### Runs on YouTube surfaces it was never designed for

`matches: ['https://*.youtube.com/*']` (`content.ts:94`) includes
`music.youtube.com` and `studio.youtube.com`. The generic rules above (`div[id*="chat"]`,
`#comments`, `#secondary`) apply there too.

### Likely sources of lag (to measure)

1. **25 `:has()` rules** with descendant arguments (`grep -c ":has("` = 25), evaluated
   against YouTube's very large, constantly mutating DOM. `:has()` makes the browser
   re-check ancestors when descendants change; with infinite scroll adding thousands of
   nodes, this is the prime suspect for style-recalc cost. No Chrome doc quantifies it
   (searched), so the live run must.
2. **Document-wide attribute observer** for autoplay (`content.ts:20`): watches every
   `aria-checked` change in the whole page, for as long as the tab lives.
3. **A 2-second `setInterval`** (`content.ts:82`) running `querySelectorAll` scans forever,
   even on pages with nothing to mark.
4. **Double re-apply on every navigation** (`content.ts:146–148`): clears all markers,
   rewrites the style tag, then again 600 ms later.
5. **Hiding starts late.** The script runs at the default `document_idle` and reads
   storage asynchronously before injecting CSS, so the feed is visible first, then hidden
   (flash), and layout runs twice.

### Hygiene

- `tabs` permission requested; it is not needed to `tabs.sendMessage` (only to read
  url/title). `activeTab` is redundant next to YouTube host permissions.
- Welcome and privacy URLs point at `d-tox.najmushsaaquib.com`; `package.json` says
  1.3.0 while the manifest says 1.4.1.
- `setupMutationObserver` in `css-injector.ts` is dead code; `YOUTUBE_SELECTORS` (half
  the constants file) is unused and contains jQuery-only `:contains()`, which is invalid CSS.
- No tests of any kind, so every YouTube DOM change ships silently broken.

---

## 2. Competitors

| | Users / rating | Licence | Technique |
|---|---|---|---|
| **Unhook** | 1,000,000 users, 4.9 (4.6K), updated 2026-03-22, Featured | closed | not visible |
| **RYS** (Remove YouTube Suggestions) | 590 stars; store rating ~3.4 seen in a side panel | MPL-2.0 | static CSS keyed on `<html>` attributes, `document_start` |
| **BlockTube** | 1.4k stars, 486 open issues | GPL-3.0 | edits YouTube's JSON data in the page (MAIN world) before render |
| **DF Tube New** | 20,000 users, 4.4 (220) | closed | not visible |

Sources: github.com/lawrencehook/remove-youtube-suggestions, github.com/amitbl/blocktube,
Chrome Web Store listings for Unhook (khncfooichmfjbepaaaebmommgaepoid) and DF Tube New
(kchgllkpfcggmdaoopkhlkbcokngahlg).

- **Unhook is the bar.** One clear job, huge trust, near-perfect rating. Its feature list
  is close to d-tox's; it also works on m.youtube.com and embeds and can redirect
  home → subscriptions. The one recent request in its reviews: hide YouTube "Playables".
- **RYS's technique is the one to copy.** The stylesheet ships in the manifest at
  `document_start`; JS only copies settings onto `<html>` as attributes
  (`html[remove_sidebar="true"] #related { display:none }`). Toggling a setting flips one
  attribute; no style tag rewrite, no per-element JS. Weakness: the attributes land after
  an async storage read, so a brief flash is possible; and its selectors carry
  old/new-layout duplicates that need constant upkeep. Features worth noting: schedules,
  redirect home to subscriptions, Shorts → normal watch page redirect, search-only mode.
- **BlockTube's technique is powerful but risky.** Filtering YouTube's data before render
  means no flash and no DOM cost, but it rewrites player and renderer objects; a schema
  change breaks it silently, and touching player data is exactly the "can't play YouTube"
  failure mode we must avoid. Good for content rules (block a channel/keyword), not as
  the core.

**Implication:** CSS-first, attribute-keyed, page-scoped rules injected at
`document_start`; JS only where CSS cannot decide (text matching, redirects), and
nothing that touches the player unless a feature needs it and is opt-in.

---

## 3. Chrome / Manifest V3 facts

From developer.chrome.com (content-scripts, scripting, storage, service-worker lifecycle,
activeTab, tabs, Web Store policies).

- **Earliest hiding:** manifest `css` files are "injected ... before any DOM is constructed
  or displayed for the page." `run_at: document_start` scripts run "after any files from
  `css`, but before any other DOM is constructed." So static CSS + a `document_start`
  script that sets attributes is the no-flash path.
- **Settings without the async gap:** `chrome.storage.local` is readable from content
  scripts but async. Options to close the gap (to decide in the grill): a synchronous
  first-paint default from a cached `<html>` attribute set by the previous page, or
  `chrome.scripting.registerContentScripts` re-registered with the settings baked in.
- **Storage:** local 10 MB; sync ~100 KB, 8 KB per item, 120 writes/min (enough to sync
  settings across a user's Chromes); session is memory-only and not visible to content
  scripts by default.
- **Service worker:** stops after 30 s idle; keep no state in globals.
- **Store policy:** single, narrow purpose; "narrowest permissions necessary"; a privacy
  policy is required if any user data is handled; no obfuscation (minify is fine). If we
  ever log watch time for stats, the Limited Use rule applies: browsing activity only for
  a user-facing feature.
- **Permissions:** `storage` + YouTube host permissions is enough. Drop `tabs` and
  `activeTab`.
- **Not answered by the docs:** whether a `USER`-origin stylesheet beats page
  `!important`; the cost of `:has()` or MutationObserver on large DOMs. Both are measured
  in the live run instead.

---

## 4. Product pages: Dossier and Openship

**Dossier** (dossier.aien.me), a self-hosted job-search app:
- One centred column. Full-sentence headlines with a full stop ("Your job search, on your
  own server." / "It never invents experience.").
- Proof in the hero (download count, a sample funnel), a chaptered tour, real screenshots
  with placeholder data and a disclaimer, a demo GIF labelled "1.2× speed".
- Honesty as a selling point: shows gaps, lists limitations ("Big screens", "Single
  user"), footer says no cookies and no third-party fonts or scripts.
- Weak spots: a nine-card equal-weight feature grid; tabs that hide content.

**Openship** (openship.io), a deployment platform:
- Two-beat headlines ("Deploy anything. Own everything."), real screenshots in light and
  dark pairs, no hero video, restrained decoration.
- An honest comparison table that concedes rows where rivals match, dated sources.
- Weak spots for us: 14 sections and ~15 CTAs; too dense for a one-purpose extension.

**What d-tox's page should take:** Dossier's honesty, single column and labelled real
demos; Openship's two-beat headlines and an honest comparison (d-tox vs Unhook vs RYS,
including where they win). One primary action: "Add to Chrome". Before/after of the same
YouTube page is the core proof. No cookies, no third-party scripts; say so in the footer.

---

## 5. Open questions for the grill

1. **What is d-tox for, in one sentence**, and how is it different from Unhook (1M users,
   4.9)? Candidates: calmer by default, honest about what it changes, intention prompts,
   schedules, a "why am I here" moment before Shorts.
2. **Default state on install:** hide nothing until the user picks, or a calm preset on?
3. **Shorts:** hide entry points only, redirect `/shorts/x` to `/watch?v=x`, or block
   entirely? (The complaint was that Shorts "don't work properly", so the user still
   wants to watch some.)
4. **Feature cut for v1:** which of the 20 toggles survive; what is new (schedules,
   redirect home → subscriptions, Playables)?
5. **Quality bar as numbers:** for example, zero added long tasks, under X ms added style
   recalc per scroll page, no visible flash, and a test that fails if Shorts or playback
   breaks.
6. **How we keep up with YouTube's DOM changes:** a nightly check against live YouTube
   that opens an issue when a selector stops matching?
7. **Stack:** keep WXT (good MV3 tooling), drop Tailwind/Headless UI from the popup in
   favour of plain CSS to match the Saaquib Labs sites?

---

## Live audit plan (waiting on the video go-ahead)

Headless Chromium (Playwright from `../mihrab-ummah`) with the v1.4.1 build loaded,
Minimal preset on vs extension off, muted, nothing recorded or saved as video.

Pages: home, search, a watch page, a playlist watch page, a live stream, `/shorts/…`,
Subscriptions, a channel's Videos tab, music.youtube.com.

Measured per page: long tasks (count, total ms), Chrome's `RecalcStyleDuration` /
`LayoutDuration` / `ScriptDuration` while scrolling, whether the video's `currentTime`
advances, whether Shorts swipe to the next one, and which wanted elements are wrongly
hidden (playlist queue, live chat, channel videos).

Cost: about 10–15 minutes, one Chromium window's worth of CPU while it runs.
