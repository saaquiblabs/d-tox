# Automated checks run as Openship jobs on the home VPS, not GitHub Actions

The nightly selector check (does each Setting still match live YouTube?) runs as a scheduled Openship job on the home VPS. It follows the Saaquib Labs pattern (saaquiblabs ADRs 0005 and 0014; mihrab-ummah's `mihrab smoke` job): the job fetches the script from this repo and runs it in a pinned Playwright container, and Openship's "Job failed" email is the alert. GitHub Actions was rejected because its free minutes ran out on another project, and Openship is where everything else already runs. The VPS was measured on 2026-11-18: 2 OCPU and 11 GB RAM, of which 9 GB was free, and it already runs Chromium for the studio site's Lighthouse build.

## Consequences

- The job is scheduled at a quiet hour that does not overlap the backup jobs (02:30–03:30 IST).
- YouTube sees the VPS's Oracle datacenter IP. If YouTube starts showing it a bot check, the job fails loudly rather than reporting false passes.
- Amended 2026-11-20: the Release Gate does not run here; it runs on the Mac (ADR 0005). The nightly check stays an Openship job.
