# Hide with one static stylesheet keyed on `<html>` attributes; no UI framework

v1.4.1 made YouTube 3–14× slower on the main thread: it rewrote a style tag at runtime, scanned the page every 2 s, observed the whole document and used 25 `:has()` rules (see `docs/research/2026-11-rebuild-grounding.md`). For the rebuild, every Distraction is hidden by one stylesheet declared in the manifest and loaded at `document_start`. Each rule is gated on an attribute on `<html>` (for example `html[data-dtox-feed]`) and scoped to the page it targets. A script of about 1 KB copies Settings onto `<html>`. JavaScript does only what CSS cannot, such as redirects. There are no timers and no hiding observers, and at most 5 `:has()` rules, each one measured. The popup is plain TypeScript and CSS. Unhook and RYS, the two leading extensions, work the same way, and both are ~30–110 KB against our 344 KB.

## Considered Options

- **Keep React/Tailwind in the popup**: rejected; the popup is a list of switches, and React alone is 191 KB.
- **Filter YouTube's data before render (BlockTube)**: rejected as the core; it touches player data, and a schema change breaks it silently. That is exactly the "can't play YouTube" failure we are fixing.
- **WXT**: rejected after measuring (#18, 2026-11-18). With the comments Setting, master switch and popup, WXT 0.21.5 built 6.79 KB (excluding icons) where plain esbuild 0.28.2 builds 2.42 KB from the same code. WXT added ~4.4 KB: its content-script wrapper took the script from 0.43 KB to 3.8 KB, and on every YouTube page it fires a CustomEvent and a `window.postMessage` and keeps a location watcher ready; the popup gained a ~0.6 KB modulepreload polyfill that sets up a MutationObserver. That is over the ~2 KB line agreed in the grill, so the extension is built by `extension/scripts/build.mjs` with esbuild.

## Consequences

- Budget: the whole extension under 40 KB excluding icons, enforced in CI next to the Release Gate.
- No selector may match visible text or labels (v1.4.1's `aria-label*="Explore"` only worked in English). Selectors use only element names, ids and attributes. A Distraction that can only be found by its text is left out. The nightly check also runs once with YouTube in Hindi.
- Selectors ported from RYS stay MPL-2.0 in their own file, with credit; the rest is MIT. Unhook's code is under an EULA and must not be copied.
