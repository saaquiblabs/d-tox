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
JavaScript does only what CSS can't: Autoplay off clicks YouTube's own autoplay button, on
YouTube's own events (no timers, no observers).

### Adding a Setting

1. Add it to `settings.json` (id, name, "Hides …" line, group, type, Calm Default value). A
   Setting that changes a behaviour rather than hiding something says "Turns …" instead.
   `calmDefault` is `true`/`false` for a switch; for a choice it is the value it starts on, or
   `false` if it starts on YouTube's own behaviour.
2. Hiding: add its rule to `extension/src/hide.css`, gated on `html[data-dtox-<id>]` and scoped
   to its page. Selectors ported from RYS go in `extension/src/hide-rys.css`, which stays
   MPL-2.0. A behaviour CSS can't change goes in `extension/src/content.ts`, driven by YouTube's
   own events.
3. Add a case to `extension/tests/cases.ts`; if it needs a page not yet saved, capture one with
   `node tests/fixtures/capture.mjs <name> <youtube url> [width]`. The tests fail until both
   exist. A hiding Setting lists its `distractions` and what it `keeps`, and other pages it acts
   on under `elsewhere`; `settings.spec.ts` tests it from that, and also checks it hides nothing
   else on every saved page. A behaviour Setting names its own `spec` file in `tests/`.
4. If it is in the Calm Default, `/welcome` lists it on the next site build (`site/`); its "hides"
   line is what the page shows.

## Site

```bash
cd site
npm ci                 # also turns on the pre-push hook
npm run dev            # http://localhost:4321
npm run verify         # tests, build, /welcome vs settings.json, links, Lighthouse 100s
```

Details and the go-live steps: `site/README.md`.
