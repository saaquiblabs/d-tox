# site/

The product page, `d-tox.saaquiblabs.com`: Astro static, no UI framework, built by Openship with
`rootDirectory: site` (ADR 0004). Set up like the saaquiblabs studio site (`saaquiblabs/site/`), from
which `astro.config.mjs`, `tests/verify.mjs`, `tests/serve.mjs`, the layout, base styles and the 404
page are ported. Pages: `/` (a stand-in until #27), `/welcome`, `/privacy`, 404.

```sh
cd site
npm ci
npx playwright install chromium   # once, for Lighthouse
npm run dev                  # http://localhost:4321
npm run typecheck            # astro check
npm test                     # unit tests (node --test): the /welcome check itself
npm run verify               # the gate: tests, build, /welcome vs settings.json, links, Lighthouse (~1 min)
npm run sync-brand           # refresh the brand copies (needs your access to saaquiblabs)
```

- **Settings:** the build reads `../settings.json` (`src/settings.ts`). `/welcome` lists every
  Setting in the Calm Default with its "hides" line; `tests/welcome.mjs` fails `verify` when the
  built page and the file disagree.
- **Look:** every page shares `src/styles/site.css` (self-hosted Instrument Serif and Inter, OFL;
  the colour tokens; header and footer) and `src/components/Header.astro`, `Footer.astro`. `/` has
  its own page styles inline; the other pages add `src/styles/base.css` through `Base.astro`.
  Astro inlines all styles (`inlineStylesheets: "always"`), so nothing blocks the first paint.
- **Brand:** `src/brand/tokens.css` and `public/brand/symbol-flat.svg` are copies from the
  `saaquiblabs` repo, pinned to the commit in `src/brand/PINNED`. Don't edit them; run
  `npm run sync-brand [-- <sha>]` and commit the result. The pages use the flat S
  (`symbol-flat.svg`); `tokens.css` is kept in sync but no page imports it since the product page's
  look (#27).
- **Icons:** `npm run build` copies the extension's icons from `../extension/public/` (gitignored here).
- **Analytics:** self-hosted Umami, cookieless. The tag is left out until `analytics.websiteId` in
  `src/site.ts` is set (step 1 below). Lighthouse blocks it during `verify`.
- **Verify:** budgets are those of the studio site (saaquiblabs ADR 0014): Lighthouse 100 in all four
  categories on phone and desktop for every sitemap page, page JS < 50 KB, page < 400 KB, every
  link answers. `node tests/verify.mjs /welcome` re-runs Lighthouse on one page after a build.
  Caller: the Openship build. No GitHub Actions (ADR 0003).
- **Versions:** exact pins only (`.npmrc`). Astro 7.4.7, Node ≥ 22.12, npm 11.19.1.

## Going live: [HUMAN] steps

Copied from the studio site's deploy (saaquiblabs `docs/runbooks/site-deploy.md`, #48), which is
green on the same box. Do them in order; tell Claude after each.

1. **Umami website.** Open Umami (`analytics.saaquiblabs.com`) → **Settings** → **Websites** →
   **Add website**. Name `D-Tox`, Domain `d-tox.saaquiblabs.com` → **Save**. Open it → **Edit** →
   copy the **Website ID**. Give it to Claude, who puts it in `src/site.ts` (`analytics.websiteId`).
2. **Openship can read the repo.** `saaquiblabs/d-tox` is public, so the clone should need no token.
   If the first build fails at the clone with `403`: github.com → avatar → **Settings** →
   **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → the token Openship
   uses → **Edit** → **Resource owner** must be able to see `saaquiblabs` repos; add
   `saaquiblabs/d-tox` under **Only select repositories**, **Contents: Read-only** → **Update**.
3. **The Openship project.** Openship → **New Project** → **Import project** → GitHub →
   `saaquiblabs/d-tox`, branch `main`. Fill in:

   | Field | Value |
   |---|---|
   | Server | `home-vps` |
   | Name | `d-tox.saaquiblabs.com` |
   | Framework | **Static site** |
   | Root directory | `site` |
   | Build image | `node:22` |
   | Install command | `npm ci --omit=dev` (no Chrome or test tools since 2026-11-21) |
   | Build command | `npm run verify:deploy` (tests, build, `/welcome` check, links; Lighthouse runs before each push) |
   | Output directory | `dist` |
   | Auto Deploy | off (deploy by hand after merges, like the studio site) |

   → **Create project**. Then in the project's routing settings: **Hide .html extensions** on,
   **Trailing slash** off, **SPA fallback** off (a missing path gets `404.html` with status 404;
   left on, every missing page answers 200). → **Deploy**. Wait for green (about 2 minutes). A red build means the gate failed and the log says which page and why.
   Tell Claude either way. If any field isn't where this says, stop and tell Claude: it can create the
   project from the CLI over SSH instead, as it did for the studio site (#48).
4. **DNS, after step 3 is green.** Cloudflare (account `saaquiblabs`) → `saaquiblabs.com` → **DNS** →
   **Records** → **Add record**: Type **A**, Name `d-tox`, IPv4 `144.24.124.152`, Proxy status
   **DNS only** (grey cloud), TTL Auto → **Save**. Don't look the name up yourself first: an early
   lookup caches "no such name" for up to 30 minutes. Tell Claude.
5. **Domain.** Openship → `d-tox.saaquiblabs.com` project → **Domains** → **Add domain** →
   `d-tox.saaquiblabs.com` → save, then verify it so Openship issues the certificate. Or Claude does
   it over SSH, as in #48.
6. **Check.** Open `https://d-tox.saaquiblabs.com/welcome`; then Umami → D-Tox → **Realtime** shows the
   visit. Claude checks from outside: `/` 200, `/welcome` 200 with no redirect, `/welcome/` 308 →
   `/welcome`, `/nope` 404.

The old `d-tox.najmushsaaquib.com` redirects here since 2026-11-21 (#28; portfolio PR #170). Before that, links were repointed first,
then it 301s here for 30 days.
