# The extension, its product page and its checks live in one repo and share one list of Settings

The product page moves out of the portfolio's Next.js app into `site/` in this repo: Astro static, built by Openship with `rootDirectory: site`, and set up like the saaquiblabs studio site. The extension goes in `extension/` and the checks in `checks/`. A root `settings.json` is the only list of Settings, holding each one's id, name, what it hides, and whether it is in the Calm Default. The extension, the product and welcome pages, and the nightly check all read it. The live page, kept in another repo, had already drifted ("20 toggles", Firefox), and the store's privacy URL must change in the same PR as what the extension stores. Openship clones the whole repo, so the site can read `../settings.json` at build time. Brand files come from `saaquiblabs/brand` as a copy pinned to a commit (`npm run sync-brand`), because a build here cannot read another repo. Research: `docs/research/2026-11-product-page-organization.md`.

## Considered Options

- **Keep the page in the portfolio:** it ships React, and its copy drifts from the product.
- **A route in the saaquiblabs studio site:** it would be a second site on one Openship project, and the product's copy would sit in another repo.
- **npm/pnpm workspaces:** unnecessary for one shared JSON file.
