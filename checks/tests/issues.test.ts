import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileIssues, planIssues, type Result } from '../lib/issues.ts';

const comments = { id: 'comments', name: 'Comments' };
const shorts = { id: 'shorts', name: 'Shorts' };

const failed = (setting: typeof comments, language: string, problem = 'still visible'): Result => ({
  kind: 'setting',
  setting,
  language,
  problem,
});

test('nothing to open when every check passed', () => {
  assert.deepEqual(planIssues([], []).open, []);
});

test('one issue per broken Setting, naming the Setting and every language it failed in', () => {
  const { open } = planIssues(
    [failed(comments, 'English'), failed(comments, 'Hindi', 'not found'), failed(shorts, 'Hindi')],
    [],
  );
  assert.equal(open.length, 2);
  const [c, s] = open;
  assert.match(c!.title, /Comments/);
  assert.match(c!.title, /English, Hindi/);
  assert.match(c!.body, /still visible/);
  assert.match(c!.body, /not found/);
  assert.match(s!.title, /Shorts/);
  assert.match(s!.title, /Hindi/);
  assert.doesNotMatch(s!.title, /English/);
});

test('no duplicate while an issue for the same Setting is open, whatever its labels', () => {
  const existing = planIssues([failed(comments, 'English')], []).open[0]!;
  const { open, alreadyOpen } = planIssues(
    [failed(comments, 'Hindi'), failed(shorts, 'English')],
    [{ number: 41, body: existing.body }],
  );
  assert.deepEqual(open.map((i) => i.key), ['shorts']);
  assert.deepEqual(alreadyOpen, [{ key: 'comments', number: 41 }]);
});

test('a bot check or consent page gets its own issue, not one blamed on a Setting', () => {
  const { open } = planIssues(
    [{ kind: 'blocked', language: 'Hindi', problem: 'consent page at https://consent.youtube.com/' }],
    [],
  );
  assert.equal(open.length, 1);
  assert.equal(open[0]!.key, 'blocked');
  assert.match(open[0]!.title, /blocked/i);
  assert.match(open[0]!.title, /Hindi/);
  assert.match(open[0]!.body, /consent\.youtube\.com/);
});

test('files each planned issue with the needs-triage label and reads every page of open issues', async () => {
  const calls: { method: string; url: string; body?: any }[] = [];
  const page1 = Array.from({ length: 100 }, (_, i) => ({ number: i + 1, body: 'other' }));
  const page2 = [{ number: 200, body: '<!-- nightly-check: shorts -->' }];
  const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ method: init?.method ?? 'GET', url: u, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (u.includes('/issues?')) {
      const page = new URL(u).searchParams.get('page');
      return Response.json(page === '1' ? page1 : page === '2' ? page2 : []);
    }
    return Response.json({ number: 300, html_url: 'https://github.com/x/y/issues/300' }, { status: 201 });
  };

  const lines = await fileIssues([failed(comments, 'English'), failed(shorts, 'English')], {
    repo: 'saaquiblabs/d-tox',
    token: 't0ken',
    fetch: fakeFetch as typeof fetch,
  });

  const posts = calls.filter((c) => c.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(posts[0]!.url, 'https://api.github.com/repos/saaquiblabs/d-tox/issues');
  assert.deepEqual(posts[0]!.body.labels, ['needs-triage']);
  assert.match(posts[0]!.body.title, /Comments/);
  assert.ok(lines.some((l) => l.includes('#300')));
  assert.ok(lines.some((l) => l.includes('#200')));
});

test('a refused GitHub call throws, so the job fails rather than passing quietly', async () => {
  const fakeFetch = async () => new Response('Bad credentials', { status: 401 });
  await assert.rejects(
    fileIssues([failed(comments, 'English')], { repo: 'saaquiblabs/d-tox', token: 'x', fetch: fakeFetch as typeof fetch }),
    /401/,
  );
});
