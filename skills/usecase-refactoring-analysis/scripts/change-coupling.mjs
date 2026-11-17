#!/usr/bin/env node
// Change coupling for a set of files, from git history.
//
// Usage:
//   node change-coupling.mjs --files-from <list.txt> [--repo .] [--since "24 months ago"]
//                            [--max-files 60] [--top 10] [--scope frontend/src]
//
//   --files-from  text file, one repository-relative path per line (the use-case's file set)
//   --repo        git repository root (default .)
//   --since       git date expression (default "24 months ago")
//   --max-files   ignore commits touching more files than this: formatting, renames, migrations (default 60)
//   --top         how many pairs / external files to report (default 10)
//   --scope       only consider external files under this path prefix (default: none)
//
// Output (stdout, JSON), shaped for the record's `coupling` section:
//   since, commits_considered, commits_ignored_as_bulk, commits_touching_set,
//   per_file: [{path, commits}],
//   internal_pairs: [{a, b, together, jaccard}],
//   external: [{path, together_with_set, commits_touching_set_share}]
//
// Reading the numbers:
//   jaccard = commits touching both / commits touching either. 1.0 means they never change apart.
//   commits_touching_set_share = of the commits that touch the set, the share that also touch this outside file.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function fail(msg) {
  process.stderr.write(`change-coupling: ${msg}\n`);
  process.exit(2);
}

const opts = { repo: '.', since: '24 months ago', maxFiles: 60, top: 10, scope: null, filesFrom: null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--repo') opts.repo = argv[++i];
  else if (a === '--since') opts.since = argv[++i];
  else if (a === '--max-files') opts.maxFiles = Number(argv[++i]);
  else if (a === '--top') opts.top = Number(argv[++i]);
  else if (a === '--scope') opts.scope = argv[++i];
  else if (a === '--files-from') opts.filesFrom = argv[++i];
  else if (a === '-h' || a === '--help') {
    process.stderr.write('Usage: node change-coupling.mjs --files-from <list.txt> [--repo .] [--since "24 months ago"] [--max-files 60] [--top 10] [--scope prefix]\n');
    process.exit(0);
  } else fail(`Unexpected argument: ${a}`);
}
if (!opts.filesFrom) fail('--files-from is required');
if (!Number.isFinite(opts.maxFiles) || !Number.isFinite(opts.top)) fail('--max-files and --top must be numbers');

const norm = p => p.trim().replace(/\\/g, '/').replace(/^\.\//, '');
let setFiles;
try {
  setFiles = new Set(readFileSync(opts.filesFrom, 'utf8').split(/\r?\n/).map(norm).filter(Boolean));
} catch (e) {
  fail(`cannot read ${opts.filesFrom}: ${e.message}`);
}
if (setFiles.size === 0) fail('the file list is empty');

// -z gives NUL-separated, unquoted paths, which keeps non-ASCII file names intact.
let raw;
try {
  raw = execFileSync('git', [
    '-C', opts.repo, '-c', 'core.quotepath=false',
    'log', `--since=${opts.since}`, '--no-merges', '--name-only', '-z', '--pretty=format:%x01%H',
  ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 512 });
} catch (e) {
  fail(`git log failed: ${e.message}`);
}

const commits = [];
for (const chunk of raw.split('\x01')) {
  if (!chunk) continue;
  const parts = chunk.split('\0').map(s => s.replace(/^\n+/, '')).filter(Boolean);
  // parts[0] is "<hash>" possibly followed by a newline and the first path
  const [head, ...rest] = parts;
  const headLines = head.split('\n').filter(Boolean);
  const files = [...headLines.slice(1), ...rest].map(norm).filter(Boolean);
  if (files.length) commits.push(files);
}

let ignoredBulk = 0;
const perFile = new Map();        // set file -> commits
const pair = new Map();           // "a\0b" -> together
const external = new Map();       // outside file -> commits together with the set
let touchingSet = 0;

for (const files of commits) {
  if (files.length > opts.maxFiles) { ignoredBulk++; continue; }
  const inside = files.filter(f => setFiles.has(f));
  if (inside.length === 0) continue;
  touchingSet++;
  for (const f of inside) perFile.set(f, (perFile.get(f) || 0) + 1);
  inside.sort();
  for (let i = 0; i < inside.length; i++) {
    for (let j = i + 1; j < inside.length; j++) {
      const k = `${inside[i]}\0${inside[j]}`;
      pair.set(k, (pair.get(k) || 0) + 1);
    }
  }
  for (const f of files) {
    if (setFiles.has(f)) continue;
    if (opts.scope && !f.startsWith(opts.scope)) continue;
    external.set(f, (external.get(f) || 0) + 1);
  }
}

const round = x => Math.round(x * 1000) / 1000;

const internalPairs = [...pair.entries()].map(([k, together]) => {
  const [a, b] = k.split('\0');
  const union = perFile.get(a) + perFile.get(b) - together;
  return { a, b, together, jaccard: round(together / union) };
}).filter(p => p.together >= 2)
  .sort((x, y) => y.together - x.together || y.jaccard - x.jaccard)
  .slice(0, opts.top);

const externalTop = [...external.entries()]
  .map(([path, together]) => ({
    path,
    together_with_set: together,
    commits_touching_set_share: touchingSet ? round(together / touchingSet) : null,
  }))
  .filter(e => e.together_with_set >= 2)
  .sort((x, y) => y.together_with_set - x.together_with_set)
  .slice(0, opts.top);

process.stdout.write(JSON.stringify({
  since: opts.since,
  commits_considered: commits.length - ignoredBulk,
  commits_ignored_as_bulk: ignoredBulk,
  commits_touching_set: touchingSet,
  files_in_set: setFiles.size,
  files_in_set_never_changed: [...setFiles].filter(f => !perFile.has(f)).length,
  per_file: [...perFile.entries()].map(([path, c]) => ({ path, commits: c })).sort((a, b) => b.commits - a.commits),
  internal_pairs: internalPairs,
  external: externalTop,
}, null, 2) + '\n');
