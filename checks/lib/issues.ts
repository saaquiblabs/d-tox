// Turns the nightly check's failures into GitHub issues labelled needs-triage: one per broken
// Setting (naming every language it failed in), and one when YouTube blocked the check. An issue
// is found again by a hidden marker in its body, so none is opened twice while one is open.

/** One failed check. A blocked language is not a Setting's fault, so it is reported apart. */
export type Result =
  | { kind: 'setting'; setting: { id: string; name: string }; language: string; problem: string }
  | { kind: 'blocked'; language: string; problem: string };

export type PlannedIssue = { key: string; title: string; body: string };
type OpenIssue = { number: number; body?: string | null };

const marker = (key: string) => `<!-- nightly-check: ${key} -->`;

export function planIssues(results: Result[], openIssues: OpenIssue[]) {
  const byKey = new Map<string, Result[]>();
  for (const r of results) {
    const key = r.kind === 'blocked' ? 'blocked' : r.setting.id;
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }

  const open: PlannedIssue[] = [];
  const alreadyOpen: { key: string; number: number }[] = [];
  for (const [key, rs] of byKey) {
    const existing = openIssues.find((i) => i.body?.includes(marker(key)));
    if (existing) {
      alreadyOpen.push({ key, number: existing.number });
      continue;
    }
    const languages = [...new Set(rs.map((r) => r.language))].join(', ');
    const details = rs.map((r) => `- **${r.language}:** ${r.problem}`).join('\n');
    const first = rs[0]!;
    if (first.kind === 'blocked') {
      open.push({
        key,
        title: `Nightly check blocked by YouTube (${languages})`,
        body: [
          'The nightly check could not look at YouTube: it was shown a bot check, a consent page or',
          'the wrong language, so no Setting was checked there. This is not a pass.',
          '',
          details,
          '',
          'YouTube sees the home VPS’s datacenter address (ADR 0003). Try the job again from Openship;',
          'if it keeps happening, the check needs another way in.',
          '',
          marker(key),
        ].join('\n'),
      });
    } else {
      const { id, name } = first.setting;
      open.push({
        key,
        title: `Nightly check: “${name}” no longer finds its Distraction (${languages})`,
        body: [
          `The nightly check against live YouTube failed for the Setting **${name}** (\`${id}\`).`,
          '',
          details,
          '',
          '“Not found” means YouTube changed the Distraction itself: update its selector in',
          '`extension/tests/cases.ts` and capture a fresh saved page (`tests/fixtures/capture.mjs`).',
          '“Still visible” means the rule in `extension/src/hide.css` no longer matches it.',
          '',
          marker(key),
        ].join('\n'),
      });
    }
  }
  return { open, alreadyOpen };
}

type Options = { repo: string; token: string; fetch?: typeof fetch };

/** Opens the planned issues and returns one line per issue for the job's log. */
export async function fileIssues(results: Result[], { repo, token, fetch: f = fetch }: Options) {
  const api = async (path: string, init?: RequestInit) => {
    const res = await f(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
        'user-agent': 'd-tox-nightly-check',
      },
    });
    if (!res.ok) throw new Error(`GitHub ${init?.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  };

  const openIssues: OpenIssue[] = [];
  for (let page = 1; page <= 20; page++) {
    const batch: OpenIssue[] = await api(`/issues?state=open&per_page=100&page=${page}`);
    openIssues.push(...batch);
    if (batch.length < 100) break;
  }

  const { open, alreadyOpen } = planIssues(results, openIssues);
  const lines = alreadyOpen.map(({ key, number }) => `issue for ${key} already open: #${number}`);
  for (const issue of open) {
    const made = await api('/issues', {
      method: 'POST',
      body: JSON.stringify({ title: issue.title, body: issue.body, labels: ['needs-triage'] }),
    });
    lines.push(`opened #${made.number} for ${issue.key}: ${made.html_url}`);
  }
  return lines;
}
