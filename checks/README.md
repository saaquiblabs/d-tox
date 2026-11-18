# checks/

Checks against live YouTube that run as Openship jobs on the home VPS (ADR 0003): the nightly
check (#24, here) and the Release Gate (#25). The fast saved-page tests that run before every
push live with the extension in `extension/tests/`.

## Nightly check

For every Setting in `settings.json`, in English and then in Hindi: open its page from
`extension/tests/cases.ts` on live YouTube, scroll until each of its Distractions is in the page
with D-Tox off, turn the Setting on and expect a rule in `hide.css` to match each one. Chromium
loads only `extension/src/hide.css`, injected by Chrome before the page draws, as the real
extension does; the check's copy marks each hide rule with a custom property, so "the rule
matches" is checked directly, even for things YouTube isn't showing. Video, images and ads are
never fetched, so nothing plays. Distractions YouTube builds only once a video plays or ends
(`needPlayback` in `cases.ts`, such as the end-screen grid) are left to the saved-page tests and the
Release Gate.

```bash
cd checks
npm ci
npm run nightly        # about a minute per Setting; exit 1 on any failure
npm test               # typecheck + the checker against saved pages and a fake GitHub
```

| Line | Means | Fix |
|------|-------|-----|
| `✓ Comments (comments), Hindi` | found and hidden | — |
| `✓ … (2 of 5 Distractions need a playing video: not checked)` | the rest were found and hidden | — |
| `not found` | YouTube no longer builds the Distraction as `cases.ts` describes it | update the selector in `cases.ts`, recapture the saved page |
| `still visible` | the rule in `hide.css` no longer matches | fix the rule |
| `skipped, it changes a behaviour` | behaviour Settings (Autoplay off) are tested by their own spec, not here | — |
| `BLOCKED in Hindi` | bot check, consent page, page in the wrong language, or YouTube didn't load | not a pass: nothing was checked in that language |
| `skipped, choice Settings…` | choice Settings (Home) have no live check yet | add one with #21 |

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
