# Project context: Koosloome UI

Facts established by earlier work. Sources: `analysis/REPORT.md` (static investigation) and `docs/ui-characterization/feasibility.md`. If the repository contradicts something here, trust the repository and mention the difference in your summary.

## Stack

- React 19, function components only, no legacy APIs. TypeScript since 2022; about a quarter of files are older `.jsx`.
- MUI throughout, styled with `sx` and `styles.tsx` theme objects. There is no shared UI layer between MUI and domain code; this is the main cause of duplication.
- State: react-tracked stores. About 530 hooks are generated-style store getters.
- Data loading: custom fetch hooks, HOCs (`with-load-…`, about 110), and fetch-in-effect in newer code. Several mechanisms coexist.
- Realtime: SignalR hubs `/hub/koosloome` (notifications) and `/hub/dokument` (document editing, Yjs updates).
- Editors: Slate (`text-editor`), older Quill displays being replaced by Slate, and the `redaktor-virtualized` structure shell with three copied editor trees (eelnõu, muutmise-seaduse, proto-otsuse).
- Routing: nearly everything lives under `/teema/:t/versioon/:v/:sisu?`, and the visible content is chosen by query (`?tab=…&t1=<SISU>`). The set of available views comes from the backend. This is why route-based static reachability says little.

## Use-case vocabulary

A use-case is a point in this space plus an operation:

| Axis | Values |
|---|---|
| Teema liik | EV, EL |
| Etapp | Eelanalüüs, VTK, VTK+eelnõu tööversioon, Seaduse eelnõu, Avalik koostööring, Koordinatsioonikogu, POE EL seisukohad, POE NK seisukohad |
| Role | Vaatleja, Koostaja, Toimetaja, Kommenteerija, Vastutaja; global: ElKoordineerija, RIK |
| View | Dashboard pages; teema views such as EELANALÜÜS, VÄLJATÖÖTAMISKAVATSUS_V2, EELNÕU, MUUDETAVAD_ÕIGUSAKTID, SELETUSKIRI_V2; töövaade; lugemisvaade |
| Operation | view, fill text, comment, add or remove a muudetav õigusakt, structure operations (create, number, delete, revert), etapp change, signing, export |

Use the Estonian domain terms as they appear in the code and UI. Do not translate them in the record.

## Known generation pairs

A newer implementation exists beside an older one. No duplicate cluster crosses these pairs, because the newer one was a rewrite.

| Older | Newer |
|---|---|
| `redaktor` | `redaktor-virtualized` |
| `editor` | `text-editor` |
| `teema-dokument` | `document-töövaade` |

Which side a live use-case actually executes is exactly what the team needs to know. Fill the `generation` field for every unit under these directories, and if a single use-case executes units from both sides of a pair, record it (signal H4).

`new_design_components` is a frozen 2022 design-system attempt. Treat units from it the same way.

## Eras

| Years | Typical traits |
|---|---|
| 2020–21 | `.jsx`, no `memo`, style objects, original `redaktor` and `editor` |
| 2022–23 | Three vendors in parallel; `memo` everywhere, HOC data loading, SignalR subscriptions, `redaktor-virtualized`; most duplicate clusters originate here |
| 2024 | Theme style-object factories; fetch-in-effect grows |
| 2025–26 | Storybook, MSW, Vitest; `document-töövaade`, `text-editor` |

## Existing data to reuse

Under `analysis/`. Field names inside the JSON files are not documented here: print the keys of one entry before relying on them.

| File | Content | Use it for |
|---|---|---|
| `data/components.json` | 1,232 components, id `file#name`, kind (plain, `memo`, HOC-wrapped, `styled`, `forwardRef`), props, LOC, complexity | `components[]` entries; take `id` and `path` verbatim so records join with this data |
| `data/hooks.json` | 1,142 hooks: 532 store hooks, 282 fetch hooks, 326 other | kind and role of hooks; which store a hook belongs to |
| `data/hocs.json` | 112 HOCs, mostly `withLoadX` and `withXSubscription` | data-loader and hub-client units; signal C8 |
| `data/jsx-callsites.json` | 7,748 JSX call sites, resolved through barrels, aliases, `memo` and HOC wrappers | render edges; `consumers_in_use_case`; `props_passed_here` |
| `data/usage.json` | Per component: instances, fan-in and fan-out, props per call site, prop combinations, never-passed props, reachability | `consumers_total`; signals C3, C4, B8, B9 |
| `data/depcruise-raw.json` | Module graph, 2,851 modules, 8,629 edges | import edges; static cycles (B2) |
| `data/dead-candidates.csv`, `data/knip-raw.json` | Static dead candidates by confidence | cross-check against the trace; never as proof of liveness or death |
| `clusters/C0xx.md`, `data/backlog.csv` | Duplicate cluster reviews with intentional differences | `cluster_id`; signal C10 |
| `phase-N-summary.md`, `REPORT.md` | Narrative and totals | context only |

The ts-morph call-site data is the primary source where it and react-scanner differ. The inventory covers top-level declarations only; components defined inside other components are in the lint data.

## Facts that shape the analysis

- **All 27 stores are mounted globally** (`nestComponents(...)` in `app/protected`). The store layer is in effect one global singleton, so no store access is local by construction. Whether a slice is *used* locally is therefore a finding (S4), and it can only be established by listing its readers and writers.
- **Store hooks are one per field** (`useStore<Field>`, and `useValue` / `useSetDraft` defined once per `createContainer` store, 30 times each). A store edge is found by resolving the hook to its store through `hooks.json`, not by the hook's name alone.
- **There are no lazy routes and no dynamic `import()`.** Every module is loaded at startup, so "the file was loaded" says nothing. Only executed functions count as liveness evidence.
- **Names are weak identifiers.** 76 component names are shared by more than one component (`NumberComponent` ×18, `Root` ×10), 191 default exports are anonymous, and 89 default exports are named differently from their file. Always refer to units by id.
- **Most-shared units** by parents: `AuthorizeTeemaVersioon` (63), `Prompt` (34), `IconLink` (32, with 23 prop combinations), `TeemaVersioonAuthorizer` (31), `ToolbarIconButton` (25). Expect them in almost every record; describe them once and do not let them dominate the findings.

Known blind spot: components whose names start with a non-ASCII capital (for example `ÕigusaktAutocomplete`) are missing from the inventory and lint data. About 780 source paths contain non-ASCII characters; quote paths and never round-trip them through tools that mangle them.

## Constraints

- Nothing under `frontend/` changes during analysis.
- There are no frontend tests. Any move's precondition is therefore a characterization test that does not exist yet, unless one has been written for this use-case.
- Traces need the Vite dev server or a `vite build --minify false --sourcemap` build; the production bundle has minified names.
