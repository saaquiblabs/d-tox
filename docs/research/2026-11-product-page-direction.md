# Product page pass 2: type, colour, and a 3D-feeling mark

Date: 2026-11-19. Input for STATUS "product page, pass 2", step 1. CSS values below were read
on this date from each site's HTML and linked stylesheets (curl, then grep). Font licences come
from the Google Fonts repo and the Fontshare download zip.

## 1. Quiet product pages: what they actually do

| Page | Type | Colour | Hero copy |
|---|---|---|---|
| [linear.app](https://linear.app) | Inter Variable with `font-feature-settings: "cv01","ss03"`; Tiempos Headline as serif display; Berkeley Mono | Dark bg `#08090a` (marketing `#010102`), text `#f7f8f8` / `#d0d6e0` / `#8a8f98`, one accent `#7170ff` | "The product development system for teams and agents" |
| [raycast.com](https://raycast.com) | Inter for UI text, **Instrument Serif** for one display title (86px, `letter-spacing:-2px`), Geist Mono for detail | Near-black `#0c0d0f` / `#111214`, brand red `#ff6363`, faint radial glows (`#9aaaff1a`) | "Your shortcut to everything." |
| [one-sec.app](https://one-sec.app) | SF Pro Rounded 700, 39 to 48px, line-height 1.15; Inter for body | Dark `#1c1c1e`, yellow `#fbc937` plus a soft violet `#7f7fde` | "Cut your screen time in half" |
| [opal.so](https://opal.so) | SF Pro Rounded; hero 5.5rem at weight 700 | Deep navy-black `#030510`, one blue `#0075ff` | "Attention on autopilot." |
| [mymind.com](https://mymind.com) | Louize (205TF serif) for display, Maison Neue for text; tight tracking `-0.011` to `-0.033rem` | Black and white, one hot accent `#ff5924` | "Remember everything. Organize nothing." |
| [culturedcode.com/things](https://culturedcode.com/things/) | System stack only (`ui-sans-serif, -apple-system…`) | Light greys, one blue `#2576eb` | h1 "Things", h2 "Simply Powerful" |

What they share:

- **The scale is small except for one line.** Linear's whole scale runs 17px to 64px, and only
  the top steps get tight tracking: `--title-4..8` use `-0.022em` with line-height 1.0 to 1.125,
  while body-sized titles use `-0.012em` at 1.33 to 1.4 ([linear.app](https://linear.app)).
  Raycast uses 12 to 16px for most text and 48 to 64px only for heroes ([raycast.com](https://raycast.com)).
- **Weights in between.** Linear's tokens are 400 / 510 / 590 / 680, not 400/500/600/700
  ([linear.app](https://linear.app)). With a variable font, headings at 510 to 590 look calmer than bold.
- **One background hue, one accent, then greys.** Each page has a near-black background tinted
  slightly cool (`#08090a`, `#030510`), three steps of text grey, and one saturated accent used
  sparingly. one sec is the exception that still feels soft: two accents (yellow and violet), both
  at the same lightness ([one-sec.app](https://one-sec.app)).
- **Depth comes from light, not lines.** Raycast's CSS has 88 `radial-gradient`s and 78 `blur()`s,
  for example `radial-gradient(96.53% 62.13% at 22.87% 46.84%, #fff0 17.89%, #9aaaff1a 100%)`, a
  10%-alpha tint on the edge ([raycast.com](https://raycast.com)). Linear draws edge highlights with
  radial-gradient masks (`--edge-highlight-x/y/width/height`) ([linear.app](https://linear.app)).
- **Serif display plus sans text is the "rich but quiet" move.** Raycast (Instrument Serif),
  Linear (Tiempos Headline token) and mymind (Louize) all set one large line in a serif and keep
  everything else in a neutral sans.
- **Few words, and value without rivals.** Every hero is one outcome in 2 to 6 words. None of the
  h1/h2 headings on these six pages names a competitor. Claims are stated as results ("in half",
  "on autopilot", "Organize nothing").

## 2. Fonts you can ship as self-hosted woff2 in a public repo

All of these are **SIL OFL 1.1**, with no Reserved Font Name in their headers, so subsetting
and converting to woff2 under the same name is allowed. The OFL grants the right "to use, study,
copy, merge, embed, modify, redistribute, and sell modified and unmodified copies", on condition
that each copy ships with the copyright notice and the licence. **Commit `OFL.txt` next to the
woff2 files** ([Inter OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt)).

| Font | Axes ([Google Fonts METADATA](https://github.com/google/fonts/tree/main/ofl)) | Licence file |
|---|---|---|
| Instrument Serif | 400 only, plus italic | [OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentserif/OFL.txt) |
| Fraunces | wght 100–900, opsz 9–144, **SOFT 0–100**, WONK 0–1, italic | [OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/OFL.txt) |
| Newsreader | wght 200–800, opsz 6–72, italic | [OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/newsreader/OFL.txt) |
| Inter (v4; Inter Display is its opsz axis) | wght 100–900, opsz 14–32, italic | [OFL](https://raw.githubusercontent.com/rsms/inter/master/LICENSE.txt) |
| Geist | wght 100–900, italic | [OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/geist/OFL.txt) |
| Bricolage Grotesque | wght 200–800, opsz 12–96, wdth 75–100 | [OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/OFL.txt) |
| Hanken Grotesk | wght 100–900, italic | [OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/hankengrotesk/OFL.txt) |
| Onest | wght 100–900 | [OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/onest/OFL.txt) |
| Manrope | wght 200–800 | [OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt) |
| Instrument Sans | wght 400–700, wdth 75–100, italic | [OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentsans/OFL.txt) |

**Satoshi and General Sans are out.** Both are Fontshare fonts under the *ITF Free Font License
v2.0 (17 Aug 2026)*, read from `License/FFL.txt` in the Satoshi download zip
([fontshare.com/fonts/satoshi](https://www.fontshare.com/fonts/satoshi),
[licence page](https://www.fontshare.com/licenses/itf-ffl)). Self-hosting is allowed ("You may
self-host the Font Software on your own servers…"), but a public repo is not:

> "The Font Software may not … be distributed, duplicated, loaned … or otherwise made available
> to any other person or entity, whether for free or for a fee. This includes distributing the
> Font Software through another font website, font library, marketplace, **repository**, download
> service … publicly accessible servers…"

The licence also forbids "subsetting, format conversion", so you could not even make your own woff2.

### Recommended pairings (dark page, 16px root)

**A. Instrument Serif + Inter.** This is Raycast's pairing, so it is proven on a dark page.
- Hero: Instrument Serif 400, `clamp(52px, 8vw, 88px)`, line-height 1.0, `letter-spacing: -0.02em`.
- H2: Instrument Serif 400, 40px / 1.1, `-0.01em`. An italic word can carry emphasis instead of bold.
- Body: Inter 400, 17px / 1.6, `0`, `font-feature-settings: "cv01","ss03"` (Linear's settings), colour = secondary grey.
- Small/labels: Inter 510, 13px / 1.45, `+0.01em`.
- Ship 3 files: Instrument Serif regular and italic, and Inter variable (latin subset).

**B. Fraunces (soft) + Hanken Grotesk.** The softest option. Fraunces' `SOFT` axis rounds the terminals.
- Hero: Fraunces `wght 360, opsz 144, SOFT 100, WONK 0`, `clamp(48px, 7.5vw, 80px)` / 1.02, `-0.025em`.
- H2: Fraunces `wght 420, opsz 72, SOFT 100`, 36px / 1.12, `-0.015em`.
- Body: Hanken Grotesk 400, 17px / 1.6, `0`.
- Small: Hanken Grotesk 500, 13px / 1.45, `+0.02em`.

**C. Bricolage Grotesque only.** One variable file. Use `opsz` to change voice between display and text.
- Hero: `wght 560, opsz 96, wdth 92`, `clamp(48px, 7vw, 76px)` / 1.0, `-0.03em`.
- H2: `wght 540, opsz 48`, 34px / 1.1, `-0.02em`.
- Body: `wght 400, opsz 14, wdth 100`, 17px / 1.55, `0`.
- Small: `wght 500, opsz 12`, 13px / 1.45, `+0.01em`.

## 3. A colourful, 3D-feeling mark from the parent brand

**What the parent mark is.** The Saaquib Labs S is three folded graphite slabs with chamfered
cuts and a soft top-light bevel. Its brand rule already splits by size: "The 3D symbol is the main
mark: use it at 64 px and up … Below that … use the **flat** symbol"
(`~/AI/projects/saaquiblabs/brand/README.md`). D-Tox should copy that rule.

**Guidance from Apple's icon system** ([HIG: App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)):
- "Consider basing your icon design around filled, overlapping shapes. Overlapping solid shapes
  … paired with transparency and blurring, can give an icon a sense of depth."
- "Express it in a simple, unique way with a minimal number of shapes. Prefer a simple background,
  such as a solid color or gradient."
- "Avoid extremely thin line weights and sharp corners … they tend to lose detail … in smaller icon sizes."
- "Vary opacity in foreground layers to increase the sense of depth." On Apple platforms the system
  adds specular highlights and shadows. A web page has no system to do this, so bake the effects
  in lightly and keep them as separate layers.
- "Provide a visually consistent icon design across all the platforms" (one design, not one per surface).

**Chrome's limits** ([CWS images](https://developer.chrome.com/docs/webstore/images),
[configure icons](https://developer.chrome.com/docs/extensions/develop/ui/configure-icons)):
the 128px icon has 96px of artwork and 16px of transparent padding. Icons should be "front-facing
… rather than having built-in perspective", should "avoid large drop shadows", and should work on
light and dark. Manifest icons cannot be SVG ("SVG files are not supported for any icons declared
in the manifest"), so render PNGs at 16, 32, 48 and 128.

**Pure-SVG recipe (large mark, 64px and up)**, back to front:
1. **Shadow:** an ellipse under the mark with `feGaussianBlur stdDeviation≈3% of size`, black at
   25–35% opacity, offset down. Keep it small, per CWS.
2. **Extrusion/side:** a copy of each slab shifted 3–4% down and right, filled with a darker
   `linearGradient` of the same hue. This gives the thickness the S has.
3. **Face:** the slab shape filled with a diagonal `linearGradient` (light top-left → saturated
   bottom-right), plus an overlaid `radialGradient` at the top-left corner (white at 0.35 → 0) for a
   soft glow. Use different hues per slab at equal lightness (as one sec does), so it looks colourful but calm.
4. **Specular rim:** the same path again with `stroke` set to a vertical white→transparent
   gradient, ~1.5% wide, clipped to the shape (`clipPath`), so only the top edge catches light.
5. **Inner shadow:** a dark stroke, clipped to the shape and blurred slightly, or a stacked
   darker shape inset 2% at the bottom edge.
6. Optional: `feSpecularLighting` gives real bump-lit highlights from the alpha channel
   ([MDN](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feSpecularLighting)).
   Set `color-interpolation-filters="sRGB"` so the colours match. Use it only if the gradients look flat.

**Small variant (16–32px):** a separate SVG with no filters, no rim and no shadow. Use the
silhouette with one gradient or two flat tones, widen the gaps between slabs (the brand README
notes the S's gap "closes" at 16px), and hint the shapes to the pixel grid. Render the 16/32px
PNGs from this file, not from the large one.

## For D-Tox

- **Dark by default, one hue family.** Use a near-black tinted toward the logo's hue (for example
  `#0b0b10`), three text greys, and one accent taken from the logo. Add depth with one or two
  10%-alpha radial glows behind the hero and the logo, not with borders or cards.
- **Typography: start with pairing A** (Instrument Serif hero/H2 + Inter body at 17px, 510 for
  labels). Build B (Fraunces SOFT) as the alternative variant, because "soft" is in the brief.
- **One display line per section.** Use serif only at hero and H2, and sans for everything else.
  Keep the scale to 5 sizes: 88 / 40 / 20 / 17 / 13.
- **Copy: one outcome per heading, 2–6 words.** "YouTube for what you came for." is already
  the right shape. Cut each section body to one sentence, and remove every Unhook/RYS mention.
- **Ship fonts as woff2 + `OFL.txt` in `site/`.** Do not use Satoshi or General Sans: their
  licence forbids repositories and format conversion.
- **Logo:** use the S's slab-and-fold language, with three slabs (or a D built from two) in
  graded colours at equal lightness. Build it as layered SVG (shadow, side, face, rim), front-facing.
- **Two files for the logo:** `dtox-mark.svg` (64px and up, with effects) and
  `dtox-mark-small.svg` (flat, no filters). Render PNGs at 16/32/48/128 from the right one, and
  check the 128px PNG against CWS's 96+16 padding rule.
- **Check legibility at 16px in the toolbar on both light and dark Chrome themes** before
  choosing a direction. Apple's and Chrome's guidance both rule out thin lines and fine detail.
