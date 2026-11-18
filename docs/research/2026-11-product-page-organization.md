# Where D-Tox's product page lives, and how the repo is organised

Date: 2026-11-18. Input for grill question Q25. Sources are local repos and GitHub, read on
this date.

## What exists today

- **The live page** (`d-tox.najmushsaaquib.com`) is a route group inside the portfolio's
  Next.js app: `najmushsaaquib.com/app/(products)/d-tox/` with `page`, `welcome`, `privacy`
  and `404`, 284 lines in all. It ships the React runtime, which the studio site rejected for
  exactly that reason (saaquiblabs ADR 0009: "~70 KB+ compressed breaks the JS budget").
  Its copy is out of date: it says Firefox and "20 toggles".
- **The studio site** (`saaquiblabs/site/`, Astro static, no UI framework, live 2026-11-14)
  already has a D-Tox story (`src/stories/dtox.md`) and a card in `src/work.ts`. Products keep
  their own pages; the studio site links out (roadmap phase 0).
- The portfolio has `app/prototype/home/capture-dtox.mjs`, which takes screenshots of D-Tox. It
  can be reused for before/after images.

## How others organise it

| Project | Where the page's code lives | Note |
|---|---|---|
| Openship | `apps/web` inside the product monorepo | The site and the product ship from one repo. |
| saaquiblabs studio | `site/` inside the brand repo (ADR 0010) | Built by Openship with `rootDirectory: site`, reading `../brand` at build time. |
| RYS | On the author's personal site (`lawrencehook.com/rys/`) | Like our current setup; its copy drifts from the extension. |
| Unhook | Separate site, closed source | Nothing to learn about organisation. |

## Facts that decide it

1. **Openship clones the whole repo.** `rootDirectory` only sets where the build runs. The
   studio site's `copy-brand.mjs` reads `../brand/web` and builds green on the home VPS. So a
   page in `d-tox/site/` can read files from the extension's folder at build time.
2. **Openship has no monorepo `sharedPaths`** (`openship-config` skill, v0.9.11). A relative
   read at build time (point 1) is the supported way to share files.
3. **The page and the extension describe the same things.** The welcome page lists the Calm
   Default, the product page lists the 10 Settings, and the privacy page must match what the
   extension stores. When these live in two repos they drift, as the live page already has
   ("20 toggles", Firefox).
4. **The Chrome Web Store needs a privacy-policy URL.** It must stay reachable and accurate,
   so it should change in the same PR that changes what is stored.
5. **SEO, subdomain or path:** Google treats either as fine. The subdomain was already chosen;
   the studio site links to it and it links back ("A Saaquib Labs product"), so authority
   flows both ways.

## Recommendation

One repo, three top-level parts, no workspaces tooling:

```
d-tox/
├── extension/        WXT project, its own pinned package.json
├── site/             Astro static, its own pinned package.json; Openship rootDirectory: site
├── settings.json     the single list of Settings: id, name, what it hides, on in the Calm Default
├── checks/           Playwright: Release Gate + nightly selector check (Openship jobs)
└── docs/             CONTEXT.md, ADRs, research, STATUS.md
```

- `settings.json` is read by the extension (popup, stylesheet attributes), the site (product
  page, welcome page) and the checks (one selector check per Setting). It is the single
  source, so the three cannot drift.
- `site/` copies the studio site's setup (Astro version, `verify.mjs` budgets, Lighthouse in the
  Openship build, pre-push hook), ported with credit rather than rebuilt (global rule).
- Brand tokens and fonts come from `saaquiblabs/brand` as a copy pinned to a commit, refreshed
  by `npm run sync-brand`. Openship clones only this repo, so it cannot read a sibling repo
  at build time.
- The portfolio's D-Tox route group is retired after the new page is live and the old
  hostname redirects (saaquiblabs ADR 0006: old hostnames redirect for 30 days).
