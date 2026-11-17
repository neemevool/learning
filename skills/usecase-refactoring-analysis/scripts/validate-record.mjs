#!/usr/bin/env node
// Validate a use-case record against schema version 1 (references/record-schema.md).
// No dependencies. Exit code 0 = valid (warnings allowed), 1 = errors, 2 = cannot read.
//
// Usage: node validate-record.mjs <record.json>

import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  process.stderr.write('Usage: node validate-record.mjs <record.json>\n');
  process.exit(2);
}
let rec;
try {
  rec = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  process.stderr.write(`validate-record: cannot read ${file}: ${e.message}\n`);
  process.exit(2);
}

const E = {
  teema_liik: ['EV', 'EL', 'any'],
  liveness_status: ['traced', 'static-only'],
  evidence_type: ['v8-coverage', 'fiber-trace', 'characterization-test', 'agent-walk', 'manual-walk', 'access-log', 'human-statement'],
  kind: ['component', 'hook', 'hoc', 'store', 'context', 'module'],
  role: ['route-page', 'view-composite', 'domain-widget', 'editor-element', 'ui-primitive', 'layout-shell',
    'data-loader', 'store', 'store-accessor', 'hub-client', 'provider', 'domain-logic', 'util'],
  executed: ['yes', 'no', 'unknown'],
  state_kind: ['store', 'context', 'server', 'url', 'local', 'hub'],
  state_access: ['read', 'write', 'read-write', 'subscribe'],
  edge_type: ['import', 'render', 'store-read', 'store-write', 'context', 'hub', 'event', 'callback-prop', 'singleton'],
  basis: ['tool', 'reading'],
  confidence: ['high', 'medium', 'low'],
  move_type: ['split-by-responsibility', 'merge-duplicates', 'remove-unexecuted-branch', 'remove-unused-prop',
    'replace-flag-with-variants', 'relocate-state-to-owner', 'derive-instead-of-store', 'make-dependency-explicit',
    'narrow-interface', 'extract-pure-logic', 'isolate-side-effect', 'break-cycle', 'add-cancellation-or-guard',
    'unify-data-access', 'inline-shallow-wrapper'],
  risk: ['low', 'medium', 'high'],
  question_for: ['domain-owner', 'designer', 'senior-developer', 'product-owner'],
};

const errors = [];
const warnings = [];
const err = (path, msg) => errors.push(`${path}: ${msg}`);
const warn = (path, msg) => warnings.push(`${path}: ${msg}`);

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string' && v.length > 0;
const isNumOrNull = v => v === null || (typeof v === 'number' && Number.isFinite(v));

function reqStr(o, k, p) { if (!isStr(o?.[k])) err(`${p}.${k}`, 'required non-empty string'); }
function reqEnum(o, k, p, list) {
  if (!list.includes(o?.[k])) err(`${p}.${k}`, `must be one of: ${list.join(', ')} (got ${JSON.stringify(o?.[k])})`);
}
function reqArr(o, k, p) {
  if (!Array.isArray(o?.[k])) { err(`${p}.${k}`, 'required array'); return []; }
  return o[k];
}
function numOrNull(o, k, p) {
  if (!(k in (o || {}))) err(`${p}.${k}`, 'required (use null when no tool produced it)');
  else if (!isNumOrNull(o[k])) err(`${p}.${k}`, 'must be a number or null');
}

if (!isObj(rec)) { err('$', 'record must be a JSON object'); finish(); }

if (rec.schema_version !== '1') err('schema_version', 'must be "1"');

// use_case
const uc = rec.use_case;
if (!isObj(uc)) err('use_case', 'required object');
else {
  reqStr(uc, 'id', 'use_case');
  if (isStr(uc.id) && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(uc.id)) err('use_case.id', 'lowercase ASCII letters, digits and single hyphens only');
  for (const k of ['title', 'etapp', 'role', 'view', 'operation', 'entry']) reqStr(uc, k, 'use_case');
  reqEnum(uc, 'teema_liik', 'use_case', E.teema_liik);
  if (reqArr(uc, 'steps', 'use_case').length === 0) err('use_case.steps', 'at least one user step');
  reqArr(uc, 'backend_calls', 'use_case').forEach((c, i) => {
    reqStr(c, 'method', `use_case.backend_calls[${i}]`);
    reqStr(c, 'path', `use_case.backend_calls[${i}]`);
    if (isStr(c?.path) && /[0-9a-f]{8}-[0-9a-f]{4}-/i.test(c.path)) err(`use_case.backend_calls[${i}].path`, 'contains a uuid; use a path template');
  });
  reqArr(uc, 'hub_methods', 'use_case');
}

// liveness
const lv = rec.liveness;
if (!isObj(lv)) err('liveness', 'required object');
else {
  reqEnum(lv, 'status', 'liveness', E.liveness_status);
  const ev = reqArr(lv, 'evidence', 'liveness');
  ev.forEach((e, i) => { reqEnum(e, 'type', `liveness.evidence[${i}]`, E.evidence_type); reqStr(e, 'ref', `liveness.evidence[${i}]`); });
  const runtime = ev.some(e => ['v8-coverage', 'fiber-trace', 'characterization-test'].includes(e?.type));
  if (lv.status === 'traced' && !runtime) err('liveness', 'status "traced" needs v8-coverage, fiber-trace or characterization-test evidence');
}

// run
if (!isObj(rec.run)) err('run', 'required object');
else {
  for (const k of ['date', 'commit', 'agent', 'skill_version']) reqStr(rec.run, k, 'run');
  reqArr(rec.run, 'data_sources', 'run');
}

// components
const comps = reqArr(rec, 'components', '$');
if (Array.isArray(rec.components) && comps.length === 0) err('components', 'at least one entry');
const ids = new Set();
comps.forEach((c, i) => {
  const p = `components[${i}]`;
  if (!isObj(c)) { err(p, 'must be an object'); return; }
  for (const k of ['id', 'path', 'name']) reqStr(c, k, p);
  if (isStr(c.id)) {
    if (ids.has(c.id)) err(`${p}.id`, `duplicate id ${c.id}`);
    ids.add(c.id);
    if (isStr(c.path) && !c.id.startsWith(c.path + '#')) err(`${p}.id`, 'must be "<path>#<name>"');
  }
  reqEnum(c, 'kind', p, E.kind);
  reqEnum(c, 'role', p, E.role);
  reqEnum(c, 'executed', p, E.executed);
  for (const k of ['created_year', 'loc', 'executed_fraction', 'consumers_total', 'consumers_in_use_case', 'props_declared', 'props_passed_here']) numOrNull(c, k, p);
  if (typeof c.executed_fraction === 'number' && (c.executed_fraction < 0 || c.executed_fraction > 1)) err(`${p}.executed_fraction`, 'must be between 0 and 1');
  for (const k of ['cluster_id', 'generation']) {
    if (!(k in c)) err(`${p}.${k}`, 'required (string or null)');
    else if (c[k] !== null && !isStr(c[k])) err(`${p}.${k}`, 'must be a string or null');
  }
  reqArr(c, 'state_touched', p).forEach((s, j) => {
    reqEnum(s, 'kind', `${p}.state_touched[${j}]`, E.state_kind);
    reqStr(s, 'name', `${p}.state_touched[${j}]`);
    reqEnum(s, 'access', `${p}.state_touched[${j}]`, E.state_access);
  });
  if (lv?.status === 'static-only' && c.executed !== 'unknown') err(`${p}.executed`, 'must be "unknown" when liveness.status is static-only');
  if (lv?.status === 'static-only' && c.executed_fraction !== null && c.executed_fraction !== undefined) err(`${p}.executed_fraction`, 'must be null when liveness.status is static-only');
});

// edges
reqArr(rec, 'edges', '$').forEach((e, i) => {
  const p = `edges[${i}]`;
  reqStr(e, 'from', p); reqStr(e, 'to', p); reqStr(e, 'evidence', p);
  reqEnum(e, 'type', p, E.edge_type);
  if (!e?.external) {
    if (isStr(e?.from) && !ids.has(e.from)) err(`${p}.from`, `unknown component id ${e.from} (set "external": true if it is outside the set)`);
    if (isStr(e?.to) && !ids.has(e.to)) err(`${p}.to`, `unknown component id ${e.to} (set "external": true if it is outside the set)`);
  } else if (isStr(e?.from) && isStr(e?.to) && !ids.has(e.from) && !ids.has(e.to)) {
    err(p, 'an external edge must have one end inside the set');
  }
});

// findings
const findingIds = new Set();
const PRESCRIPTIVE = /(feature[- ]sliced|atomic design|clean architecture|hexagonal|\bfeatures\/|\bshared\/ui\b|\bentities\/|\bwidgets\/|should (be )?(moved?|live|go) (to|in|under))/i;
reqArr(rec, 'findings', '$').forEach((f, i) => {
  const p = `findings[${i}]`;
  if (!isObj(f)) { err(p, 'must be an object'); return; }
  reqStr(f, 'id', p);
  if (isStr(f.id)) { if (findingIds.has(f.id)) err(`${p}.id`, `duplicate id ${f.id}`); findingIds.add(f.id); }
  if (!isStr(f.signal) || !/^[BSCALH]\d{1,2}$/.test(f.signal)) err(`${p}.signal`, 'must be a lens signal ID such as B3, S2, C10, A1, L0, H3');
  reqStr(f, 'observation', p);
  reqEnum(f, 'basis', p, E.basis);
  reqEnum(f, 'confidence', p, E.confidence);
  const cs = reqArr(f, 'components', p);
  if (Array.isArray(f.components) && cs.length === 0) err(`${p}.components`, 'at least one component id');
  cs.forEach(c => { if (!ids.has(c)) err(`${p}.components`, `unknown component id ${c}`); });
  const ev = reqArr(f, 'evidence', p);
  if (Array.isArray(f.evidence) && ev.length === 0) err(`${p}.evidence`, 'at least one "path:line-range"');
  ev.forEach(x => {
    if (!isStr(x)) err(`${p}.evidence`, 'entries must be strings');
    else if (!/:\d+(-\d+)?$/.test(x) && f.basis === 'reading') warn(`${p}.evidence`, `"${x}" has no line reference`);
  });
  if (!('measure' in f)) err(`${p}.measure`, 'required (object or null)');
  else if (f.measure !== null && !isObj(f.measure)) err(`${p}.measure`, 'must be an object or null');
  if (isStr(f.observation) && PRESCRIPTIVE.test(f.observation)) warn(`${p}.observation`, 'reads like a target-architecture proposal; state the fact about the code instead');
});

// moves
reqArr(rec, 'moves', '$').forEach((m, i) => {
  const p = `moves[${i}]`;
  if (!isObj(m)) { err(p, 'must be an object'); return; }
  reqStr(m, 'id', p); reqStr(m, 'precondition', p);
  reqEnum(m, 'type', p, E.move_type);
  reqEnum(m, 'risk', p, E.risk);
  const ts = reqArr(m, 'targets', p);
  if (Array.isArray(m.targets) && ts.length === 0) err(`${p}.targets`, 'at least one component id');
  ts.forEach(t => { if (!ids.has(t)) err(`${p}.targets`, `unknown component id ${t}`); });
  const as = reqArr(m, 'addresses', p);
  if (Array.isArray(m.addresses) && as.length === 0) err(`${p}.addresses`, 'at least one finding id');
  as.forEach(a => { if (!findingIds.has(a)) err(`${p}.addresses`, `unknown finding id ${a}`); });
  if (isStr(m.note) && PRESCRIPTIVE.test(m.note)) warn(`${p}.note`, 'reads like a target-architecture proposal; moves are local and architecture-neutral');
  if (m.type === 'remove-unexecuted-branch' && lv?.status === 'static-only') err(`${p}.type`, 'remove-unexecuted-branch needs a runtime trace');
});

// coupling
if (!isObj(rec.coupling)) err('coupling', 'required object (null values inside if change coupling was not run)');
else {
  for (const k of ['since', 'commits_considered', 'internal_pairs', 'external']) {
    if (!(k in rec.coupling)) err(`coupling.${k}`, 'required (null if not run)');
  }
  for (const k of ['internal_pairs', 'external']) {
    if (rec.coupling[k] !== null && rec.coupling[k] !== undefined && !Array.isArray(rec.coupling[k])) err(`coupling.${k}`, 'must be an array or null');
  }
}

// open questions
reqArr(rec, 'open_questions', '$').forEach((q, i) => {
  const p = `open_questions[${i}]`;
  reqStr(q, 'id', p); reqStr(q, 'question', p);
  reqEnum(q, 'for', p, E.question_for);
  reqArr(q, 'blocks', p).forEach(b => {
    if (!findingIds.has(b) && !(rec.moves || []).some(m => m?.id === b)) err(`${p}.blocks`, `unknown finding or move id ${b}`);
  });
});

// cross-checks worth a warning
if (comps.length && !(rec.findings || []).some(f => f?.signal === 'L0')) warn('findings', 'no L0 finding: the comparable cognitive-load measures are missing');
if (lv?.status === 'traced' && comps.length && comps.every(c => c?.executed === 'unknown')) warn('components', 'status is traced but no component has executed yes/no');

finish();

function finish() {
  for (const w of warnings) process.stdout.write(`warning  ${w}\n`);
  for (const e of errors) process.stdout.write(`error    ${e}\n`);
  process.stdout.write(`${errors.length} error(s), ${warnings.length} warning(s)\n`);
  process.exit(errors.length ? 1 : 0);
}
