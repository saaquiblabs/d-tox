// The nightly check (#24, ADR 0003): does each Setting in settings.json still find and hide its
// Distraction on live YouTube, in English and in Hindi? Plays no video.
//   npm run nightly                 check, print the result, exit 1 on any failure
//   DTOX_ISSUES_TOKEN=… npm run nightly   also open a needs-triage issue per broken Setting
// On the home VPS this runs as the Openship job `d-tox nightly` through job.mjs.
import settings from '../settings.json' with { type: 'json' };
import { cases } from '../extension/tests/cases.ts';
import { fileIssues, type Result } from './lib/issues.ts';
import { checkLanguage, languages, launch, readStylesheets } from './lib/live.ts';

const repo = 'saaquiblabs/d-tox';
const hideCss = await readStylesheets();

console.log(`\nD-Tox nightly check: ${settings.length} Settings × ${languages.map((l) => l.name).join(', ')}`);
const results: Result[] = [];
for (const language of languages) {
  const context = await launch(language, hideCss);
  try {
    const run = await checkLanguage(context, language, settings, cases);
    results.push(...run.results);
    console.log(run.lines.join('\n'));
  } finally {
    await context.close();
  }
}

const blocked = results.filter((r) => r.kind === 'blocked').length;
const broken = results.length - blocked;
console.log(results.length ? `\nFAILED: ${broken} broken, ${blocked} language(s) blocked` : '\nAll Settings found and hid their Distraction.');

if (results.length) {
  const token = process.env.DTOX_ISSUES_TOKEN;
  if (token) for (const line of await fileIssues(results, { repo, token })) console.log(line);
  else console.log('issues: not opened (DTOX_ISSUES_TOKEN is not set)');
  process.exit(1);
}
