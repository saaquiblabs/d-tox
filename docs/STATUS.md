# Status

Last updated: 2026-11-18. Each session overwrites this at handoff.

## Where we are

D-Tox is being rebuilt from scratch as the first Saaquib Labs product.

- **Settled:** repo moved to `saaquiblabs/d-tox` (the org is verified for
  saaquiblabs.com). Product page on its own subdomain (`d-tox.saaquiblabs.com`,
  in the spirit of dossier.aien.me). Chrome only for v1, YouTube only.
- **Step 1 done:** `docs/research/2026-11-rebuild-grounding.md` covers the v1.4.1 code
  audit, the live YouTube audit, competitors (Unhook, RYS, BlockTube, DF Tube), MV3
  facts and the Dossier/Openship pages. The live audit script is
  `docs/research/2026-11-live-audit.mjs`; run it with `nice` and keep its time limits.
- **Headline finding:** v1.4.1 makes YouTube 3–14× slower on the main thread, sends
  search into a runaway infinite scroll (160k DOM nodes) and wedges later pages. The
  Shorts player itself works.

## Pipeline

research (done) → `/grill-with-docs` (next) → `/to-spec` + `/to-tickets` → product
page prototypes (seen running before anything is picked) → `/implement #n` per ticket.

## Next step

Run `/setup-matt-pocock-skills` in this repo (issue tracker: GitHub Issues on
`saaquiblabs/d-tox`; domain docs: single context, `CONTEXT.md` + `docs/adr/`), then
`/grill-with-docs`. The first round was asked in the previous session and is
unanswered:

1. **Core promise:** recommended "YouTube for what you came for": intention first as
   the headline, provable lightness as the foundation, schedules later.
2. **Who first:** recommended students and knowledge workers who need YouTube for
   learning, then people quitting Shorts. Parents are out of scope for v1.
3. **Licence and money:** recommended MIT, free, with a sponsor link and no paid tier.
4. **Privacy:** recommended that nothing leaves the browser: no analytics, no accounts,
   with any stats kept on the device.
5. **Store listing:** is v1.4.1 live on the Chrome Web Store, and with how many users?
   If live, ship v2.0.0 on the same listing with settings migrated; if not, a fresh
   listing under Saaquib Labs.
6. **Name:** recommended "D-Tox" in prose ("D-Tox for YouTube") and `d-tox` in
   URLs and the repo.
7. **Release gate:** recommended the live audit with every feature on, within ~10% of
   "off", no runaway DOM, no timeouts, playback and Shorts swipe working. It runs
   before every release and nightly.

## Standing rules

- No video creation, recording or encoding until Najmush asks. Headless playback for
  the audit was approved once, on 2026-11-18; ask again before re-running it.
- Nothing visual is decided until he has seen it running.
- Times in IST.
