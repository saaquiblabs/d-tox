# checks/

Checks against live YouTube: the nightly check (#24), an Openship job on the home VPS (ADR 0003),
and the Release Gate (#25), a command run on the Mac before each release (ADR 0005). The fast
saved-page tests that run before every push live with the extension in `extension/tests/`.

## Nightly check

For every Setting in `settings.json`, in English and then in Hindi: open its page from
`extension/tests/cases.ts` on live YouTube (its `liveUrl` if it has one, at its `width`), scroll
until each of its Distractions is in the page with D-Tox off, turn the Setting on and expect a
hide rule to match each one. Chromium loads only the extension's stylesheets (every `.css` at the
top of `extension/src/`), injected by Chrome before the page draws, as the real extension does;
the check's copy marks each hide rule with a custom property, so "the rule matches" is checked
directly, even for things YouTube isn't showing. Video, images and ads are never fetched, so
nothing plays, and the check is signed out. Distractions that need a playing video or a signed-in
account (`needs` in `cases.ts`: the end-screen grid, the bell) are left to the saved-page tests
and the Release Gate. A full run (9 Settings) takes about 3 minutes.

```bash
cd checks
npm ci
npm run nightly        # exit 1 on any failure
npm test               # typecheck + the checker against saved pages and a fake GitHub
```

| Line | Means | Fix |
|------|-------|-----|
| `✓ Comments (comments), Hindi` | found and hidden | — |
| `✓ … (2 of 5 Distractions need a playing video: not checked)` | the rest were found and hidden | — |
| `not found` | YouTube no longer builds the Distraction as `cases.ts` describes it, or not on that page today | look at the page in a browser; update the selector in `cases.ts` (no text: it runs in Hindi too) and recapture the saved page, or pick a better `liveUrl` |
| `still visible` | the rule in `extension/src/*.css` no longer matches | fix the rule |
| `skipped, its Distractions need a signed-in account` | nothing it hides shows to a signed-out visitor (the bell) | — |
| `skipped, it changes a behaviour` | behaviour Settings (Stop autoplay) are tested by their own spec, not here | — |
| `BLOCKED in Hindi` | bot check, consent page, page in the wrong language, or YouTube didn't load | not a pass: nothing was checked in that language |
| `note: the player's bot check … refused the video` | YouTube refuses video to the VPS's datacenter address but renders the page; nothing checked needs the video | — (if a Distraction is then missing, it is BLOCKED instead) |

A Setting gets a second try before it counts as broken. Any failure exits 1, so Openship emails
“Job failed”. With `DTOX_ISSUES_TOKEN` set, it also opens a `needs-triage` issue: one per broken
Setting naming its languages, one for a block. An issue carries a hidden marker
(`<!-- nightly-check: comments -->`), so no second issue opens while one is open; close it when
fixed.

### The Openship job (copy of record)

Job `d-tox nightly` on `home-vps`, **daily 23:00 UTC = 04:30 IST** (after the backups at
02:30–03:30 IST), timeout 20 minutes, **no retries** (the check retries each Setting itself; an
Openship retry would open issues twice). Secret `DTOX_ISSUES_TOKEN` (below). Like `mihrab smoke`,
it reads `checks/job.mjs` from `main` with Openship’s GitHub token and runs it in the pinned
Playwright image; `job.mjs` fetches the rest of `main`, runs `npm ci` in `checks/` and then
`npm run nightly`. Keep the image tag equal to `playwright` in `checks/package.json`.

```sh
~/.openship/bin/openship --local --json github repo file saaquiblabs/d-tox checks/job.mjs | docker run --rm -i --init -e DTOX_ISSUES_TOKEN mcr.microsoft.com/playwright:v1.63.0-noble node --input-type=module -e "let s=\"\";for await(const c of process.stdin)s+=c;await import(\"data:text/javascript;base64,\"+Buffer.from(JSON.parse(s).content).toString(\"base64\"))"
```

To try a branch before merging, add `-e DTOX_REF=<branch>` after `-e DTOX_ISSUES_TOKEN` and
`--branch <branch>` after `checks/job.mjs` (run it by hand, not as the scheduled job).

From the Mac: `ssh najmush-oracle '~/.openship/bin/openship --local job list'`, then
`job run <key> --follow`.

### [HUMAN] The issues token

About 5 minutes. The token can only write issues on this one repo.

1. GitHub → avatar (top right) → **Settings** → **Developer settings** (bottom of the left
   column) → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Token name** `d-tox nightly issues`. **Resource owner** `saaquiblabs` (if the org asks for
   approval, approve it under the org's **Settings** → **Personal access tokens** →
   **Pending requests**). **Expiration** 1 year; put the date in your calendar.
3. **Repository access** → **Only select repositories** → `saaquiblabs/d-tox`.
4. **Permissions** → **Repository permissions** → **Issues** → **Read and write**. Leave every
   other permission at **No access** (Metadata: read-only is added by GitHub and can't be removed).
5. **Generate token**, then copy it (it is shown once).
6. `https://ops.saaquiblabs.com` → **Jobs** → `d-tox nightly` → edit it → section
   **Environment** → under **Secrets** click **Replace secrets** (the job has none, so nothing is
   lost) → **Add secret** → name `DTOX_ISSUES_TOKEN`, value the token → **Save changes**.
7. Tell Claude. It runs the job once and checks the log ends without `DTOX_ISSUES_TOKEN is not set`.

## Release Gate

No slow or broken release ships. `npm run gate` builds the extension, then visits live YouTube in a
fresh Chromium with no extension (the **Baseline Run**) and with D-Tox and every Setting on,
alternating, three rounds. Pages: home, search ("python tutorial"), a Shorts-heavy search ("cooking": reported and checked
for runaway loading, not in the speed total), a watch page, a
playlist, a channel, a Short, and the Shorts redirect (D-Tox only). Video plays muted; nothing is
recorded. About 30 minutes for three rounds.

**Run it on the Mac, on a home connection, with other apps closed** (ADR 0005: YouTube won't play
video to the VPS, and the gate measures speed).

```bash
cd checks
npm ci
npm run gate              # exit 0 pass, 1 fail, 2 blocked
GATE_ROUNDS=1 npm run gate   # a quick try, not for a release
```

It passes only when, over the pages' medians:

| Rule | From |
|------|------|
| Long-task time and style recalc, summed, within 10% (+50 / +20 ms) of the Baseline Run | `lib/verdict.ts` |
| Once a page has settled after scrolling (up to 30 s), it adds no more than 500 elements in 8 s idle beyond the Baseline Run (YouTube loading page after page) | |
| No D-Tox page times out (150 s) or crashes | |
| A video plays and seeks, a playlist plays and keeps its column, a Short plays and swipes to the next, the Shorts redirect lands on `/watch` and plays | |
| End screens can't be seen at the end of a video (checked only if the Baseline Run saw some) | |
| The wide player (#46) is at least 40 px wider than YouTube's own, with the channel row above the fold | |

**BLOCKED** (exit 2) means nothing about D-Tox was decided: a Google "unusual traffic" page, a
consent page, the player's bot check, a Baseline Run that errored, or a check that fails without
D-Tox too. Try again later, or on another connection (a phone hotspot). The Mac's ISP shares
addresses and was flagged for a few hours on 2026-11-20.

Seeking jumps back within what has loaded: past it, YouTube's player stalls for an automated
browser with or without D-Tox (checked 2026-11-20), and the gate does not hide that it is automated.

Each run writes `results/release-gate-<date>T<time IST>.json`: version, commit, machine, every
page of every round, and the verdict. Commit the passing one with the release; the product page's
numbers come from it, with its date.
