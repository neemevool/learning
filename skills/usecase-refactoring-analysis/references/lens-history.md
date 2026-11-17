# Lens H: change history

Source: article 011, §15 (accumulated change), §11 (measuring boundaries), §19 (Conway).

## The idea

Structure diagrams show intent. History shows what actually had to change together. Three results from the article apply:

- **Interest is paid only where changes are made.** Poor structure in code nobody touches costs nothing. Priority is complexity times change frequency (the hotspot).
- **Change coupling beats the dependency graph as boundary evidence.** If two units with no import relation change in the same commits, they share a secret that no boundary hides.
- **Software mirrors the communication structure that built it.** Three vendors working in parallel left three copies; that pattern predicts where seams and duplicates lie.

History also has limits. Squashed merges, bulk reformatting and file moves distort it. Check for those before trusting a number.

## Tooling

`scripts/change-coupling.mjs` gives, for the files of the set: commits touching each file, pairs that change together inside the set, and files outside the set that change together with it. Before interpreting, look at the largest commits in the window; if a few commits touch hundreds of files (format, rename, migration), rerun with `--max-files 40` so they are ignored.

## Signals

| ID | Signal | Detect | Record in `measure` |
|---|---|---|---|
| H1 | **Hotspot.** A unit in the set that is both large or complicated and frequently changed | commits in window × LOC, top of the set | commits, loc |
| H2 | **Internal change coupling without a structural link.** Two units of the set change together often and neither imports the other | `internal_pairs` crossed with `edges` | pair, together, jaccard |
| H3 | **External change coupling.** Files outside the set that change together with it in a substantial share of the set's commits | `external` list | path, share |
| H4 | **Both generations executed.** The trace shows units from both sides of a known generation pair in one use-case | `generation` field | units per side |
| H5 | **Era seam.** A direct dependency between units created in different eras where the newer one wraps, adapts or works around the older | `created_year` on both ends of an edge, plus reading | the edge |
| H6 | **Frozen but live.** Executed unit with no commits for three years or more | git | last commit date |
| H7 | **Churning but unexecuted.** Unit in the static set that changes regularly and that the trace did not execute | git plus `executed: no` | commits |
| H8 | **Many hands.** Unit changed by many authors with small contributions each | `git shortlog -sn -- <path>` | authors, top share |
| H9 | **Suppression added over time.** `eslint-disable`, `@ts-ignore`, `any` casts introduced after creation | `git log -S` on the marker | count |

H3 is the strongest single piece of boundary evidence a record can contain: it says the use-case, as delimited by what executes, is not the unit of change. Always report it in the summary.

H7 is a warning about the trace, not about the code. It usually means the use-case definition missed a path. Raise it as an open question before anything is called dead.

## Typical moves

History signals rarely map to a move by themselves. They set priority (H1) and feed the synthesis (H2, H3, H4, H5). Attach H1 to the moves that target the same unit by listing its finding id under `addresses`.
