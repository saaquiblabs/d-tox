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

One action per line. Tick as you go.

### 2a. Open the item

- [x] Open https://chrome.google.com/webstore/devconsole
- [x] Click **D-Tox for YouTube** (ID `ocngpkbaoflpfjamgcnnjbdnhmakmgel`)

### 2b. Package

- [x] Left menu: **Package**
- [x] Click **Upload new package**
- [x] Choose `extension/release/d-tox-2.0.0.zip`
- [x] Check the name now reads **D-Tox for YouTube**

### 2c. Store listing

- [x] Left menu: **Store listing**
- [x] **Description**: delete the old text
- [x] **Description**: paste the [Listing text](#listing-text) below
- [x] **Category**: Productivity
- [x] **Language**: English
- [x] **Store icon**: upload `extension/public/icon-128.png`
- [x] **Screenshots**: delete every one already there
- [x] **Screenshots**: add `extension/release/store/1-watch.png`
- [x] **Screenshots**: add `2-search.png`
- [x] **Screenshots**: add `3-home.png`
- [x] **Screenshots**: add `4-comments.png`
- [x] **Screenshots**: add `5-popup.png`
- [x] **Small promo tile**: upload `extension/release/store/promo-440x280.png`
- [x] **Marquee promo tile**: remove the old one
- [x] **Marquee promo tile**: upload `extension/release/store/marquee-1400x560.png`
- [ ] **Official URL**: leave it empty (pick "None"). It only accepts a site verified in Google
      Search Console, and `d-tox.saaquiblabs.com` isn't yet. See [Official URL](#official-url).
- [x] **Homepage URL**: `https://d-tox.saaquiblabs.com`
- [x] **Support URL**: `https://github.com/saaquiblabs/d-tox/issues`
- [x] **Mature content**: off
- [x] Click **Save draft**

### 2d. Privacy practices

- [x] Left menu: **Privacy practices**
- [x] **Single purpose**: paste
      `Hides the parts of YouTube that pull you away from what you came for (the recommended feed, Shorts, autoplay and similar), each behind its own switch.`
- [x] **storage** justification: paste
      `Keeps the user's switches (which parts of YouTube to hide). Nothing else is stored.`
- [x] **Host permission** (`https://www.youtube.com/*`) justification: paste
      `Applies the stylesheet that hides the chosen parts of YouTube's pages. Only www.youtube.com; nothing is read from the page or sent anywhere.`
- [ ] **Remote code**: No, I am not using remote code
- [ ] **Data usage**: tick no data types
- [ ] **Data usage**: tick all three certifications
- [ ] **Privacy policy URL**: `https://d-tox.saaquiblabs.com/privacy`
- [ ] Click **Save draft**

### 2e. Account (affects every item on this developer account)

- [x] Left menu: **Account**
- [x] **Contact email**: `hello@saaquiblabs.com`
- [x] Open the verification email sent there and click its link
- [x] **Publisher name**: look at it, don't change it now. Renaming it renames the publisher of
      every item on the account (ADR 0002; not needed for v2.0.0).

### 2f. Submit

- [x] Back on the item, click **Submit for review**
- [x] Untick **Publish automatically after the review**
- [x] Confirm the submit
- [ ] Tell the agent: "submitted today"
- [ ] Wait for the review (usually 1–3 days, sometimes longer)

### Official URL

Optional. To fill it later:

1. Open https://search.google.com/search-console
2. Add property → **Domain** → `saaquiblabs.com`
3. Copy the TXT record it gives
4. Add that TXT record at the DNS provider for `saaquiblabs.com`
5. Back in Search Console, click **Verify**
6. Use the same Google account as the developer dashboard
7. Back in the dashboard, Official URL now lists the site; pick it and **Save draft**

## 3. After the review

### 3a. You (**[HUMAN]**)

- [x] In the dashboard, click **Publish**
- [ ] Tell the agent the date

### 3b. Agent

- [ ] One PR: date the entry in `changelog.astro` and `CHANGELOG.md`; update STATUS
- [ ] On Najmush's yes (it is public): GitHub release `v<version>` on `main`, zip attached, changelog entry as notes
- [ ] Cut-over (#28): repoint the saaquiblabs repo's D-Tox card and story to `d-tox.saaquiblabs.com`
- [ ] Cut-over: `d-tox.najmushsaaquib.com` 301s to `d-tox.saaquiblabs.com` for 30 days
- [ ] After 30 days: remove the portfolio's D-Tox route group in a PR there (saaquiblabs ADR 0006)

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
