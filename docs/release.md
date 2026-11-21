# Releasing D-Tox

How a version reaches the Chrome Web Store (#28, ADR 0002). The listing is
`ocngpkbaoflpfjamgcnnjbdnhmakmgel`; the upload is by hand. Steps marked **[HUMAN]** are Najmush's.

## 1. Build (agent)

1. `extension/package.json` has the new version, and `site/src/pages/changelog.astro` has its
   entry (no date yet: it shows "Coming soon"). `CHANGELOG.md` has the engineering view.
2. `cd extension && npm test && npm run zip` → `extension/release/d-tox-<version>.zip` (prints its
   sha256 and contents; fails if the changelog has no entry).
3. `cd site && npm run build && nice node scripts/store-assets.mjs` → `extension/release/store/`:
   five 1280×800 screenshots of live YouTube (signed out, real videos, nothing swapped):
   `1-watch`, `2-search`, `4-comments` are without/with D-Tox side by side, `3-home` the
   Intention Page, `5-popup` the popup over the watch page; plus `promo-440x280.png`. Raw
   captures land in `store/raw/` (`capture` or `compose` runs one half). Results change per load:
   look at each one.
4. The site is deployed, so the listing's links show the current page.

## 2. Upload (**[HUMAN]**, about 15 minutes)

Open https://chrome.google.com/webstore/devconsole and pick **D-Tox** (`ocngpkbaoflpfjamgcnnjbdnhmakmgel`).

**Package**
1. **Package** (left menu) → **Upload new package** → `extension/release/d-tox-2.0.0.zip`.
   The listing's name becomes the manifest's, "D-Tox for YouTube", and its summary the manifest's
   description. Check both after the upload.

**Store listing**
2. **Description**: replace it with the text in [Listing text](#listing-text) below.
3. **Category**: Productivity (keep it if already set). **Language**: English.
4. **Store icon**: `extension/public/icon-128.png` (the folded-D mark).
5. **Screenshots**: delete every screenshot already there, then add `extension/release/store/1-watch.png`
   through `5-popup.png`, in order.
6. **Small promo tile**: `extension/release/store/promo-440x280.png`. **Marquee promo tile**:
   replace v1's (it carries the old brand) with `extension/release/store/marquee-1400x560.png`.
7. **Homepage URL**: `https://d-tox.saaquiblabs.com`. **Support URL**:
   `https://github.com/saaquiblabs/d-tox/issues`.
8. **Save draft**.

**Privacy practices**
9. **Single purpose**: "Hides the parts of YouTube that pull you away from what you came for (the
   recommended feed, Shorts, autoplay and similar), each behind its own switch."
10. **Permission justification**:
    - `storage`: "Keeps the user's switches (which parts of YouTube to hide). Nothing else is stored."
    - Host permission `https://www.youtube.com/*`: "Applies the stylesheet that hides the chosen
      parts of YouTube's pages. Only www.youtube.com; nothing is read from the page or sent anywhere."
11. **Remote code**: No, I am not using remote code.
12. **Data usage**: tick nothing (it collects no user data); tick the three certifications.
13. **Privacy policy URL**: `https://d-tox.saaquiblabs.com/privacy`.
14. **Save draft**.

**Account** (applies to every item on this developer account)
15. **Contact email**: `hello@saaquiblabs.com` (it needs verifying by a link sent there).
16. **Publisher name**: check what it shows. Changing it to Saaquib Labs here renames the
    publisher of every item on the account; moving the item to a group publisher is a separate
    transfer (ADR 0002 allows it, not needed for v2.0.0).

**Submit**
17. **Submit for review**. Untick **Publish automatically after the review**, so the publish
    happens when you choose (the changelog is dated and the GitHub release made on the same day).
    Review usually takes 1–3 days and can take longer.

## 3. After the review (**[HUMAN]** publishes, then the agent)

1. **[HUMAN]** In the dashboard, **Publish**. Tell the agent the date.
2. Agent, one PR: date the entry in `changelog.astro` and `CHANGELOG.md`; STATUS.
3. Agent: GitHub release `v<version>` on `main` with the zip attached and the changelog entry as
   its notes (on Najmush's yes; it is public).
4. Cut-over (#28): repoint links (saaquiblabs repo's D-Tox card and story); `d-tox.najmushsaaquib.com`
   301s to `d-tox.saaquiblabs.com` for 30 days, then the portfolio's D-Tox route group is removed in
   a PR there (saaquiblabs ADR 0006).

## Listing text

Paste as is (plain text; the store keeps line breaks).

```
YouTube for what you came for. Nothing else.

D-Tox hides the parts of YouTube that pull you elsewhere: the recommended feed, Shorts, the next video. What you came for stays.

It starts calm, from the first install:
• Home asks "What are you here for?" instead of showing a feed
• Shorts are hidden
• Recommendations beside the video are hidden, and the video grows into the room
• Autoplay is off

Ten switches, each named for what it does:
• Home page: ask me first, Subscriptions, or YouTube's feed
• Hide recommendations
• Hide end screens
• Stop autoplay
• Hide comments
• Hide Shorts
• Play Shorts as videos
• Clean up search
• Hide Explore and Trending
• Hide the notifications bell

Light: under 10 KB runs on YouTube, one stylesheet and a small script, with no timers and nothing watching the page. Measured against YouTube alone with every switch on, YouTube did 7% less main-thread work.

Private: D-Tox sends nothing anywhere. No account, no analytics, no tracking. Your switches stay in Chrome's own storage.

Checked every night on live YouTube, in English and Hindi.

Free and open source (MIT): https://github.com/saaquiblabs/d-tox
A Saaquib Labs product: https://d-tox.saaquiblabs.com
```
