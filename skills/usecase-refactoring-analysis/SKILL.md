---
name: usecase-refactoring-analysis
description: Analyze the React components behind ONE user-reachable use-case of the Koosloome UI and write a fixed-schema JSON record of facts, findings and architecture-neutral refactoring moves. Use this whenever the user asks to analyze a use-case, view, flow, screen or component subset for refactoring, architecture, layering, coupling, state ownership or "what is wrong with this part of the frontend", or asks for a use-case record, even if they do not say "skill". Do not use it for whole-codebase statistics (already done in analysis/REPORT.md) or for proposing the target architecture (that is a separate synthesis step over many records).
---

# Use-case refactoring analysis

## Why this skill exists

The frontend has about 1,200 components, 1,100 hooks and 110 HOCs, written by several teams over five years. Whole-codebase static analysis is finished (`analysis/REPORT.md`). It showed that almost everything is statically reachable, and the developers found that reading code cannot tell them whether a component or use-case is still active.

So the work now proceeds one use-case at a time. Each run of this skill produces one **record**. Many records are later aggregated by a separate synthesis step that compares candidate architectures against the evidence. That division decides everything below:

- **A record states what is, with evidence.** It does not state where code should live.
- **Records must be comparable.** Fifty runs by different agents have to aggregate, so the schema and vocabularies are fixed.

## Three rules that protect the result

1. **Do not propose a target architecture.** No folder names, no "move to features/…", no layer names, no named patterns (feature-sliced, atomic design, clean architecture). You will have a strong prior toward the layouts common in public React code. If every record carries that prior, the synthesis will measure the prior and not this application. Record properties of the code. The `moves` section is limited to local, architecture-neutral moves from a fixed list.
2. **Liveness is evidence, never a conclusion from reading.** A component counts as executed only if a runtime trace says so. If there is no trace, the record says `static-only` and every component's `executed` is `"unknown"`. "It looks unused" is an open question for a human, not a finding.
3. **Facts come from tools; judgment is for interpretation.** Import edges, consumer counts, executed fractions, creation dates and change coupling come from scripts and existing data files. If a number cannot be produced by a tool, leave the field `null`. Never estimate.

Also: this analysis is read-only. Change nothing under `frontend/`. Write only under `analysis/usecases/`.

## Inputs

Ask for anything missing in the first two rows. Do not invent a use-case.

| Input | Required | Notes |
|---|---|---|
| Use-case definition | Yes | Teema liik, etapp, role, view, operation, and the user steps. Vocabulary is in `references/project-context.md` |
| Component-set source | Yes | A trace file (preferred), or an explicit statement that this run is `static-only` from a named entry component |
| Use-case id | No | Default: `<view>-<operation>-<role>` in lowercase ASCII, for example `eelanalyys-fill-text-vastutaja` |

## Procedure

Work through the steps in order. Create the tasks in your task list so progress is visible.

### 1. Load context

Read `references/project-context.md` and `references/record-schema.md`. The context file lists the data files the earlier investigation produced under `analysis/data/` and what each is for. Print the keys of one entry from each file you will use, then reuse the data. Recompute only what is missing for this subset.

### 2. Establish the component set

**With a V8 coverage trace** (Playwright `page.coverage.stopJSCoverage()` output saved as JSON, taken against the Vite dev server or an unminified build):

```bash
node <skill>/scripts/coverage-to-files.mjs <trace.json> --root frontend/src > analysis/usecases/<id>/coverage.json
```

This gives, per source file, which functions ran and the executed fraction. Files with at least one executed function form the component set. Set `liveness.status` to `traced`.

**With a fiber trace** (a list of activated component names from bippy): map names to files through the inventory. Set `liveness.status` to `traced` and leave `executed_fraction` as `null`.

**Without a trace:** follow imports from the entry component the user named, stop at the first shared boundary you cannot attribute to the use-case, and set `liveness.status` to `static-only`. Say plainly in the final summary that the set is over-inclusive.

If a trace exists but no characterization test does, record that under `liveness.evidence` as a manual or agent-driven walk, with the steps taken.

### 3. Build the inventory

For every file in the set, fill one `components` entry per top-level component, hook, HOC or store, exported or module-internal, as the inventory lists them. Use the inventory's `id` and path verbatim, so that records join with `analysis/data/` and with each other; pass a matching `--root` to the coverage script. Take from existing data where possible:

- consumers across the whole app (call-site usage data) and consumers inside this use-case;
- duplicate cluster id, if any;
- props declared versus props passed at the call sites in this use-case;
- creation year: `git log --diff-filter=A --follow --format=%ad --date=format:%Y -- <path> | tail -1`.

Assign `role` from the fixed vocabulary in the schema by what the unit does, not by its folder or name. If two roles fit, pick the dominant one and add a `mixed-roles` finding (lens C).

### 4. Collect edges and history

- **Static edges** inside the set: imports and JSX render relations.
- **Hidden edges**: store reads and writes, context provide/consume, hub subscriptions, event emitters, module-level singletons. These are the couplings static tools do not show, and they are the main reason this analysis is done by an agent. Grep for them deliberately; the patterns are in `references/lens-boundaries.md`.
- **Change coupling**:

```bash
node <skill>/scripts/change-coupling.mjs --repo . --since "24 months ago" --files-from analysis/usecases/<id>/files.txt > analysis/usecases/<id>/coupling.json
```

It reports which files of the set change together, and which files outside the set change together with it. The second list is often the most informative output of the whole run.

### 5. Apply the lenses

Read each lens file when you reach it, not before. Each lens lists signals with stable IDs, how to detect them, and what to record.

| Order | Lens file | Question it answers |
|---|---|---|
| 1 | `references/lens-boundaries.md` | What must be known together, and what crosses the edge of this use-case? |
| 2 | `references/lens-state.md` | Who owns each piece of state, and what is a copy? |
| 3 | `references/lens-contracts.md` | Are the abstractions and props honest about what they do? |
| 4 | `references/lens-async.md` | What can interleave, fail without a verdict, or happen twice? |
| 5 | `references/lens-cognition.md` | How much must a developer hold in mind to change this? |
| 6 | `references/lens-history.md` | What does the change history say that the structure does not? |

Rules for findings:

- One finding per distinct fact. Each needs a lens signal ID, the component ids involved, and evidence as `path:line-range`.
- State the observation as a fact about the code ("`X` writes store slice `s` that only `Y` reads"), not as a verdict ("bad coupling").
- `basis` is `tool` if a script or data file produced it, `reading` if you concluded it from source. `confidence` is yours to set honestly; `low` is a legitimate value.
- If a lens yields nothing, write nothing. An empty lens is a result. Do not pad.
- If a signal recurs in many components, record it once with all component ids, not once per component.

### 6. Derive moves

For findings that have an obvious local remedy, add a `moves` entry using only the move types in the schema. Each move references the findings it addresses and states its precondition (usually a characterization test over the affected behaviour). A finding with no local remedy gets no move. Many of the most important findings (wrong boundary, two generations of the same view) have none, and that is what the synthesis step is for.

### 7. Record open questions

Anything that needs the theory of the system goes to `open_questions`, addressed to a kind of person: `domain-owner`, `designer`, `senior-developer`, `product-owner`. Typical cases: whether a difference between near-duplicates is intentional; which of two generations is the target; whether an unexecuted branch is a dormant feature or residue.

### 8. Validate and write

Write `analysis/usecases/<id>/record.json`, then:

```bash
node <skill>/scripts/validate-record.mjs analysis/usecases/<id>/record.json
```

Fix every reported error. Then give the user a summary of at most ten lines: liveness status, component count by role, the three findings you consider most consequential and why, the outside-the-set change coupling if any, and the open questions. Do not restate the record.

## What a good record looks like

- A reader can verify every finding by opening the cited lines.
- Two agents analysing the same use-case would produce the same inventory and edges, and mostly overlapping findings.
- Nothing in it depends on which architecture is eventually chosen.
- It says "unknown" wherever the tools did not answer.
