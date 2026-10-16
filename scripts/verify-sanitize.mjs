// Regression harness for sanitizeFilename() in src/content.js.
//
// The function is extracted from the real source and executed here, so this
// tests the shipped code rather than a copy of it. Run with:
//
//   node scripts/verify-sanitize.mjs
//
// Exits non-zero on any failure, so it can gate a release.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(repoRoot, 'src', 'content.js');
const source = readFileSync(sourcePath, 'utf8');

// --- Extract `function sanitizeFilename(...) { ... }` by brace matching ------
const start = source.indexOf('function sanitizeFilename(');
if (start === -1) {
  console.error(`Could not find sanitizeFilename() in ${sourcePath}`);
  process.exit(1);
}
let depth = 0;
let end = -1;
for (let i = source.indexOf('{', start); i < source.length; i++) {
  if (source[i] === '{') depth++;
  else if (source[i] === '}') {
    depth--;
    if (depth === 0) { end = i + 1; break; }
  }
}
const sanitizeFilename = new Function(
  `${source.slice(start, end)}; return sanitizeFilename;`
)();

// --- Cases -------------------------------------------------------------------
// [ label, input, expected ]
const cases = [
  // The reported bug: non-Latin titles must survive verbatim.
  ['Chinese (simplified)', '产品评审会', '产品评审会'],
  ['Chinese + digits', '周会 2026-03-05', '周会 2026-03-05'],
  ['Chinese long title', '2026年第三季度产品路线图评审会议纪要', '2026年第三季度产品路线图评审会议纪要'],
  ['Chinese single char', '会', '会'],
  ['Japanese kanji + kana', '四半期レビュー会議', '四半期レビュー会議'],
  ['Japanese middle dot', 'ミーティング・ノート', 'ミーティング_ノート'],
  ['Japanese dakuten (NFC)', 'か\u3099いぎ', 'がいぎ'],
  ['Korean Hangul', '분기별 회의록', '분기별 회의록'],
  ['Cyrillic', 'Еженедельная встреча', 'Еженедельная встреча'],
  ['Greek', 'Συνάντηση ομάδας', 'Συνάντηση ομάδας'],
  ['Accented Latin', 'Réunion générale', 'Réunion générale'],
  ['Thai', 'บันทึกการประชุม', 'บันทึกการประชุม'],
  ['Vietnamese', 'Cuộc họp tuần', 'Cuộc họp tuần'],
  ['Mixed CJK + ASCII', 'Q3 产品 Roadmap 评审', 'Q3 产品 Roadmap 评审'],

  // Regression: ASCII behaviour is unchanged.
  ['Plain ASCII', 'Weekly Sync 2026', 'Weekly Sync 2026'],
  ['Hyphen / underscore kept', 'Standup - Team_Alpha', 'Standup - Team_Alpha'],

  // Dangerous set is still neutralised.
  ['Forward slash', 'a/b', 'a_b'],
  ['Back slash', 'a\\b', 'a_b'],
  ['Colon', 'a:b', 'a_b'],
  ['Windows illegal set', 'a*b?c"d<e>f|g', 'a_b_c_d_e_f_g'],
  ['Leading/trailing dots', '...name...', '___name___'],
  ['Leading/trailing space', '  name  ', 'name'],
  ['Control chars neutralised', 'a\u0000b\u0007c\u001bd', 'a_b_c_d'],
  ['Bidi override neutralised', 'invoice\u202Egnp.exe', 'invoice_gnp_exe'],
  ['NUL only', '\u0000', '_'],

  // Edge cases.
  ['null', null, ''],
  ['undefined', undefined, ''],
  ['empty', '', ''],
  ['Emoji -> underscore', 'Party 🎉', 'Party _'],
];

let pass = 0;
const failures = [];
for (const [label, input, expected] of cases) {
  const got = sanitizeFilename(input);
  if (got === expected) {
    pass++;
  } else {
    failures.push(`${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
  }
}

// Idempotency: applying twice must equal applying once.
for (const [label, input] of cases) {
  const once = sanitizeFilename(input);
  if (sanitizeFilename(once) !== once) {
    failures.push(`${label}: not idempotent (${JSON.stringify(once)} -> ${JSON.stringify(sanitizeFilename(once))})`);
  }
}

// End-to-end name assembly, mirroring the transcript download path.
const assembled = `${sanitizeFilename('产品评审会')}${sanitizeFilename('_transcript')}.vtt`;
if (assembled !== '产品评审会_transcript.vtt') {
  failures.push(`assembly: got ${JSON.stringify(assembled)}`);
}

for (const f of failures) console.error(`FAIL  ${f}`);
console.log(`${pass}/${cases.length} cases passed; ${failures.length} failure(s)`);
console.log(`Assembled filename example: ${assembled}`);
process.exit(failures.length === 0 ? 0 : 1);
