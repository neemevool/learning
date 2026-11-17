#!/usr/bin/env node
// Convert Playwright V8 JS coverage (page.coverage.stopJSCoverage()) into a per-source-file summary.
//
// Works when each source file is served as its own script, i.e. against the Vite DEV SERVER
// (URLs like http://localhost:3000/src/components/x/Y.tsx). For a bundled build every source
// file is inside one script; that needs source-map mapping, which this script does not do.
// It detects that case and says so instead of printing misleading numbers.
//
// Usage:
//   node coverage-to-files.mjs <coverage.json> [--root frontend/src] [--src-prefix /src/] [--all]
//
//   --root        path prefix written in the output (where the URL's src directory lives in the repo)
//   --src-prefix  URL path prefix that marks application source (default /src/)
//   --all         also list files in which nothing executed (default: only files with executed code)
//
// Output (stdout, JSON):
//   { summary: {...}, files: [{ path, functions_total, functions_executed, executed_fraction,
//                               executed_functions: [...], unexecuted_functions: [...] }] }
//
// "Function" means a V8 function: components, hooks, callbacks and inline arrows all count.
// The module's own top-level function is excluded. Anonymous functions are named "(anonymous@offset)".

import { readFileSync } from 'node:fs';

function parseArgs(argv) {
  const args = { root: 'frontend/src', srcPrefix: '/src/', all: false, file: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') args.root = argv[++i];
    else if (a === '--src-prefix') args.srcPrefix = argv[++i];
    else if (a === '--all') args.all = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else if (!args.file) args.file = a;
    else fail(`Unexpected argument: ${a}`);
  }
  return args;
}

function fail(msg) {
  process.stderr.write(`coverage-to-files: ${msg}\n`);
  process.exit(2);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.file) {
  process.stderr.write('Usage: node coverage-to-files.mjs <coverage.json> [--root frontend/src] [--src-prefix /src/] [--all]\n');
  process.exit(args.help ? 0 : 2);
}

let entries;
try {
  entries = JSON.parse(readFileSync(args.file, 'utf8'));
} catch (e) {
  fail(`cannot read ${args.file}: ${e.message}`);
}
if (!Array.isArray(entries)) fail('expected a JSON array of V8 script coverage entries');

const root = args.root.replace(/\/+$/, '');
const prefix = args.srcPrefix.endsWith('/') ? args.srcPrefix : args.srcPrefix + '/';

// Several entries can exist for one URL (reloads, new browser contexts). Merge by function identity.
const byPath = new Map();
let skipped = 0;
let appScripts = 0;

for (const entry of entries) {
  if (!entry || typeof entry.url !== 'string' || !Array.isArray(entry.functions)) { skipped++; continue; }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(entry.url).pathname);
  } catch {
    skipped++;
    continue;
  }
  if (!pathname.startsWith(prefix) || pathname.includes('/node_modules/')) { skipped++; continue; }
  appScripts++;
  const rel = `${root}/${pathname.slice(prefix.length)}`;
  let fns = byPath.get(rel);
  if (!fns) { fns = new Map(); byPath.set(rel, fns); }

  entry.functions.forEach((fn, index) => {
    const first = fn.ranges && fn.ranges[0];
    if (!first) return;
    // The first function with an empty name spanning from offset 0 is the module body itself.
    if (index === 0 && fn.functionName === '' && first.startOffset === 0) return;
    const name = fn.functionName || `(anonymous@${first.startOffset})`;
    const key = `${name}@${first.startOffset}`;
    const executed = first.count > 0;
    fns.set(key, { name, executed: executed || (fns.get(key)?.executed ?? false) });
  });
}

if (appScripts === 0) {
  fail(`no script URL starts with "${prefix}". If the trace was taken against a bundled build, ` +
       `the sources are inside one bundle and need source-map mapping; take the trace against the Vite dev server, ` +
       `or pass the right --src-prefix.`);
}

const files = [];
for (const [path, fns] of byPath) {
  const all = [...fns.values()];
  const executed = all.filter(f => f.executed).map(f => f.name);
  const unexecuted = all.filter(f => !f.executed).map(f => f.name);
  if (!args.all && executed.length === 0) continue;
  files.push({
    path,
    functions_total: all.length,
    functions_executed: executed.length,
    executed_fraction: all.length ? Math.round((executed.length / all.length) * 1000) / 1000 : null,
    executed_functions: executed,
    unexecuted_functions: unexecuted,
  });
}
files.sort((a, b) => a.path.localeCompare(b.path));

const suspectBundle = byPath.size <= 3 && [...byPath.values()].some(f => f.size > 2000);

process.stdout.write(JSON.stringify({
  summary: {
    source: args.file,
    scripts_in_trace: entries.length,
    app_scripts: appScripts,
    scripts_skipped: skipped,
    files_loaded: byPath.size,
    files_with_executed_code: [...byPath.values()].filter(f => [...f.values()].some(x => x.executed)).length,
    warning: suspectBundle
      ? 'Very few files with very many functions: this looks like a bundle, not per-file dev-server modules. Numbers are not per source file.'
      : null,
  },
  files,
}, null, 2) + '\n');
