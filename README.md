# D-Tox for YouTube

YouTube for what you came for. D-Tox hides the parts of YouTube that pull you elsewhere, and
it stays measurably light. A Saaquib Labs product. MIT.

> The rebuild (v2.0.0) is in progress: see `docs/STATUS.md`, `CONTEXT.md` and `docs/adr/`.

## Layout

| Path | What |
|------|------|
| `settings.json` | The only list of Settings. The extension, site and checks all read it. |
| `extension/` | The Chrome extension (Manifest V3, plain TypeScript and CSS, built with esbuild). |
| `site/` | The product page, `d-tox.saaquiblabs.com`. |
| `checks/` | Live-YouTube checks run as Openship jobs (nightly check, Release Gate). |
| `docs/` | Decisions (`adr/`), research and status. |

## Extension

```bash
cd extension
npm ci                 # also turns on the pre-push hook (.githooks/)
npx playwright install chromium   # once
npm run build          # dist/ — fails above 40 KB excluding icons
npm test               # typecheck, build, saved-page tests
```

Load `extension/dist` from `chrome://extensions` → Developer mode → Load unpacked.

### How hiding works

`extension/src/hide.css` is declared in the manifest, so Chrome applies it before YouTube draws.
Each rule is gated on an attribute on `<html>` (`html[data-dtox-comments] …`) and scoped to its
page. `extension/src/content.ts` copies Settings from `chrome.storage.sync` onto `<html>` and
follows storage changes, which is how the popup applies to open tabs at once (ADR 0001).

### Adding a Setting

1. Add it to `settings.json` (id, name, "Hides …" line, group, type, Calm Default value).
2. Add its rule to `extension/src/hide.css`, gated on `html[data-dtox-<id>]` and scoped to its
   page. Selectors ported from RYS go in `extension/src/hide-rys.css`, which stays MPL-2.0.
3. Add its pages to `extension/tests/cases.ts`: what it hides and what it keeps on each. If it
   needs a page not yet saved, capture one with
   `node tests/fixtures/capture.mjs <name> <youtube url> [width]` and add it to `pages`. The
   tests fail until both exist. Every Setting is also checked on every saved page to hide
   nothing beyond what its cases list.
