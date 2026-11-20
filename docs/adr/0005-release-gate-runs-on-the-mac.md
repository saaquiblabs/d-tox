# The Release Gate runs on the Mac, not as an Openship job

The grill (2026-11-18) put the Release Gate on the home VPS as a manual Openship job, beside the nightly check (ADR 0003). It can't run there: YouTube refuses video to the VPS's Oracle datacenter address ("Sign in to confirm you're not a bot", seen in #24), and the gate must prove a video plays and seeks and Shorts swipe. A residential proxy was rejected (it costs money and adds network noise to timings), and so were Najmush's YouTube cookies on the VPS (a session living on a server). Najmush chose the Mac on 2026-11-20: `npm run gate` in `checks/`, by hand, before each release.

## Consequences

- The gate is a command, not a job: `checks/README.md` § Release Gate is the copy of record. The nightly check stays an Openship job (ADR 0003).
- It measures speed, so it runs with other apps closed, on a home connection. The Baseline Run and D-Tox run alternate on the same machine in the same sitting, so the machine and network are the same for both; the comparison, not the absolute numbers, is what passes or fails.
- "Runs at low priority" from the ticket is dropped: on the Mac it would slow both runs alike and protect nothing.
- The Mac's ISP shares addresses (Excitel); on 2026-11-20 Google flagged it for a few hours ("unusual traffic", 429). The gate reports such a page as BLOCKED (exit 2), never as a pass or a D-Tox failure. Retry later or on another connection (a phone hotspot).
- Each run writes `checks/results/release-gate-<date>.json`, committed with the release; the product page's numbers come from it, dated.
- **Amended 2026-11-20 (Najmush): "we are not running this full race ever again on my MacBook."** The passing run of 2026-11-20 15:25 IST (`checks/results/release-gate-2026-11-20T1525.json`) is the gate for v2.0.0. #28 does not rerun it. How later releases are gated is open (a single round, another machine, or a check without video on the VPS); decide before v2.1.
