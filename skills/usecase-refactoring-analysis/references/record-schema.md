# Record schema (version 1)

One file per use-case: `analysis/usecases/<id>/record.json`. The validator (`scripts/validate-record.mjs`) enforces everything marked **enum** or **required** here. A filled example is in `assets/record.example.json`.

Use `null` for a value that no tool produced. Never guess a number.

## Top level

| Key | Type | Notes |
|---|---|---|
| `schema_version` | `"1"` | required |
| `use_case` | object | required |
| `liveness` | object | required |
| `run` | object | required |
| `components` | array | required, at least one |
| `edges` | array | required, may be empty |
| `findings` | array | required, may be empty |
| `moves` | array | required, may be empty |
| `coupling` | object | required; copy of the change-coupling summary, or `null` values if not run |
| `open_questions` | array | required, may be empty |

## `use_case`

| Key | Type | Notes |
|---|---|---|
| `id` | string | lowercase ASCII, digits, hyphens |
| `title` | string | one line, in the team's words |
| `teema_liik` | enum | `EV`, `EL`, `any` |
| `etapp` | string | etapp name or `any` |
| `role` | string | koostöörühm or global role, or `any` |
| `view` | string | sisu or page identifier, for example `EELANALÜÜS`, `dashboard` |
| `operation` | string | what the user does: `view`, `fill-text`, `add-moa`, `delete-element`, … |
| `entry` | string | URL pattern with placeholders |
| `steps` | string[] | user steps in order |
| `backend_calls` | array of `{method, path}` | path templates, no uuids |
| `hub_methods` | string[] | SignalR targets seen or used |

## `liveness`

| Key | Type | Notes |
|---|---|---|
| `status` | enum | `traced` (runtime trace exists), `static-only` |
| `evidence` | array of `{type, ref}` | `type` enum: `v8-coverage`, `fiber-trace`, `characterization-test`, `agent-walk`, `manual-walk`, `access-log`, `human-statement`. `ref` is a file path or a short description |
| `notes` | string or null | limits of the evidence: steps not covered, branches not taken |

## `run`

`date` (ISO), `commit` (frontend commit SHA), `agent` (model name), `skill_version` (`"1"`), `data_sources` (string[]: which `analysis/data/*` files were reused).

## `components[]`

| Key | Type | Notes |
|---|---|---|
| `id` | string | `<path>#<ExportName>`; unique within the record |
| `path` | string | relative to the repository root |
| `name` | string | export name |
| `kind` | enum | `component`, `hook`, `hoc`, `store`, `context`, `module` |
| `role` | enum | see roles below |
| `created_year` | number or null | from git |
| `loc` | number or null | |
| `executed` | enum | `yes`, `no`, `unknown` |
| `executed_fraction` | number 0–1 or null | functions executed / functions in file, from coverage |
| `consumers_total` | number or null | call sites or importers in the whole app |
| `consumers_in_use_case` | number or null | |
| `cluster_id` | string or null | duplicate cluster from the earlier investigation, for example `C004` |
| `generation` | string or null | when the unit belongs to a known generation pair, the directory name, for example `text-editor` |
| `props_declared` | number or null | components only |
| `props_passed_here` | number or null | distinct props passed by call sites inside this use-case |
| `state_touched` | array of `{kind, name, access}` | `kind` enum: `store`, `context`, `server`, `url`, `local`, `hub`. `access` enum: `read`, `write`, `read-write`, `subscribe` |

### Roles (enum)

Assign by what the unit does.

| Role | Meaning |
|---|---|
| `route-page` | Mounted by the router; owns a URL |
| `view-composite` | Assembles one screen or tab from parts; knows the use-case |
| `domain-widget` | Shows or edits one domain concept; reusable across views in principle |
| `editor-element` | A structural element inside one of the document editors |
| `ui-primitive` | No domain knowledge: button, modal shell, skeleton, layout piece |
| `layout-shell` | App or page chrome: header, navigation, panels |
| `data-loader` | HOC or hook whose job is to fetch and hand data down |
| `store` | State container definition |
| `store-accessor` | Getter or setter hook over a store |
| `hub-client` | SignalR connection, subscription or provider |
| `provider` | Context provider with no UI of its own |
| `domain-logic` | Pure rules, mapping, validation; no React |
| `util` | Generic helper with no domain knowledge |

## `edges[]`

`{from, to, type, evidence}`. `from` and `to` are component ids, or an external path when the edge leaves the set (then add `"external": true`).

`type` enum: `import`, `render`, `store-read`, `store-write`, `context`, `hub`, `event`, `callback-prop`, `singleton`.

`evidence` is `path:line`.

## `findings[]`

| Key | Type | Notes |
|---|---|---|
| `id` | string | `F1`, `F2`, … |
| `signal` | string | signal ID from a lens file, for example `B3`, `S2` |
| `components` | string[] | component ids |
| `observation` | string | a fact about the code, one or two sentences |
| `evidence` | string[] | `path:line-range`, at least one |
| `basis` | enum | `tool`, `reading` |
| `confidence` | enum | `high`, `medium`, `low` |
| `measure` | object or null | numbers behind the finding, if any |

## `moves[]`

| Key | Type | Notes |
|---|---|---|
| `id` | string | `M1`, … |
| `type` | enum | see move types below |
| `targets` | string[] | component ids |
| `addresses` | string[] | finding ids, at least one |
| `precondition` | string | what must exist first, usually a test |
| `risk` | enum | `low`, `medium`, `high` |
| `note` | string or null | |

### Move types (enum)

These are deliberately local. None of them names a destination in a future architecture.

| Type | Meaning |
|---|---|
| `split-by-responsibility` | One unit does two jobs; separate them |
| `merge-duplicates` | Members of a duplicate cluster collapse to one |
| `remove-unexecuted-branch` | Code no trace executed; needs human confirmation first |
| `remove-unused-prop` | Declared, never passed |
| `replace-flag-with-variants` | Boolean or mode props that select behaviour become separate units or composition |
| `relocate-state-to-owner` | State held away from the unit that owns its invariant |
| `derive-instead-of-store` | Stored copy of something computable from other state |
| `make-dependency-explicit` | A hidden edge (store, context, singleton, event) becomes a prop or parameter |
| `narrow-interface` | Unit receives more than it uses |
| `extract-pure-logic` | Domain rules tangled in render or effect code |
| `isolate-side-effect` | Fetch, hub or timer code mixed into presentation |
| `break-cycle` | Mutual dependency, static or through shared state |
| `add-cancellation-or-guard` | Async result can land after it is stale |
| `unify-data-access` | Same server data fetched by several mechanisms |
| `inline-shallow-wrapper` | Wrapper that adds no behaviour |

## `coupling`

`{since, commits_considered, internal_pairs: [{a, b, together, jaccard}], external: [{path, together_with_set, commits_touching_set_share}]}`. Keep the top ten of each.

## `open_questions[]`

`{id, question, for, blocks}`. `for` enum: `domain-owner`, `designer`, `senior-developer`, `product-owner`. `blocks` is a list of finding or move ids that wait on the answer; may be empty.
