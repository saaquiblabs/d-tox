# Hide with one static stylesheet keyed on `<html>` attributes; no UI framework

v1.4.1 made YouTube 3–14× slower on the main thread: it rewrote a style tag at runtime, scanned the page every 2 s, observed the whole document and used 25 `:has()` rules (see `docs/research/2026-11-rebuild-grounding.md`). For the rebuild, every Distraction is hidden by one stylesheet declared in the manifest and loaded at `document_start`. Each rule is gated on an attribute on `<html>` (for example `html[data-dtox-feed]`) and scoped to the page it targets. A script of about 1 KB copies Settings onto `<html>`. JavaScript does only what CSS cannot, such as redirects. There are no timers and no hiding observers, and at most 5 `:has()` rules, each one measured. The popup is plain TypeScript and CSS. Unhook and RYS, the two leading extensions, work the same way, and both are ~30–110 KB against our 344 KB.

## Considered Options

- **Keep React/Tailwind in the popup**: rejected; the popup is a list of switches, and React alone is 191 KB.
- **Filter YouTube's data before render (BlockTube)**: rejected as the core; it touches player data, and a schema change breaks it silently. That is exactly the "can't play YouTube" failure we are fixing.
- **Plain esbuild instead of WXT**: kept as the fallback if WXT adds more than ~2 KB to the output.

## Consequences

- Budget: the whole extension under 40 KB excluding icons, enforced in CI next to the Release Gate.
- No selector may match visible text or labels (v1.4.1's `aria-label*="Explore"` only worked in English). Selectors use only element names, ids and attributes. A Distraction that can only be found by its text is left out. The nightly check also runs once with YouTube in Hindi.
- Selectors ported from RYS stay MPL-2.0 in their own file, with credit; the rest is MIT. Unhook's code is under an EULA and must not be copied.
