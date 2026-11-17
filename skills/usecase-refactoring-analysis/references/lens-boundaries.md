# Lens B: boundaries and coupling

Source: article 011, §11 (module boundaries), with §7 for the cost of crossings.

## The idea

A module is worth having when it hides a decision that is likely to change (Parnas). Two units are coupled to the degree that changing one forces a change in the other (connascence). Strong coupling is fine between units that are meant to change together and expensive between units that are not. No decomposition makes every change local, so the question for a use-case is concrete: **what has to be known and changed together to alter this behaviour, and how much of that lies outside what a developer would think of as "this use-case"?**

In React, a large share of the coupling is invisible to import graphs. A component that reads a store slice depends on whoever writes it. A component under a provider depends on the provider's value. A hub subscription makes a component depend on a server event. These hidden edges are what you look for here.

## How to find hidden edges

| Kind | Grep for | Edge type |
|---|---|---|
| Store access | `useStore…` field hooks, `useValue`, `useSetDraft`; resolve each to its `createContainer` store through `data/hooks.json`, because the same hook name exists once per store | `store-read`, `store-write` |
| HOC-injected data | `withLoad…`, `with…Subscription` around the default export (`data/hocs.json`); the wrapped unit's props then come from the HOC, not the parent | `import` plus the store or hub edge the HOC creates |
| Context | `createContext`, `useContext`, `.Provider` | `context` |
| Hub | `connection.on(`, `.invoke(`, `.send(`, the SignalR provider hooks | `hub` |
| Events | `addEventListener`, custom emitters, `window.` or `document.` used as a bus, `postMessage` | `event` |
| Singletons | module-level `let` or mutable objects imported by more than one unit | `singleton` |
| Inversion by callback | props named `on…`, `render…`, or children-as-function that carry control back up | `callback-prop` |

All 27 stores are mounted globally, so nothing limits who can read or write a slice; only the actual readers and writers show its real scope. For every store slice, context and hub method touched by the set, list its writers and readers across the whole application. Writers or readers outside the set are external edges; record them.

## Signals

| ID | Signal | Detect | Record in `measure` |
|---|---|---|---|
| B1 | **Shared mutable state across the use-case edge.** A store slice or context that this use-case reads is written by units outside it, or the reverse | Writers/readers list above | slice name, writers in/out, readers in/out |
| B2 | **Cycle.** Static import cycle, or a dynamic one: A renders B, and B writes state that A reads to decide what to render | depcruise output for static; trace store-write → store-read → render for dynamic | the cycle as an ordered list of ids |
| B3 | **Control coupling.** A prop or argument whose only purpose is to steer the callee's behaviour (`mode`, `variant` used in `if`, `isX` flags) | Read the callee: is the value rendered, or branched on? | flag names, number of branches |
| B4 | **Stamp coupling / prop drilling.** A whole object or many props pass through units that do not use them | Follow one prop from origin to use; count pass-through hops | prop, hops |
| B5 | **Reach into internals.** Import from another area's non-index file, deep relative paths (`../../../`), or use of something its owner did not export for reuse | Import paths | importer, imported path, depth |
| B6 | **Shallow unit.** Interface about as large as the behaviour behind it: a wrapper that forwards props and adds almost nothing | props count vs. own logic lines | props, own LOC |
| B7 | **Wide fan-out at one level.** A unit directly depends on many others of different kinds (UI, data, store, hub) | count edges by type from one unit | edges by type |
| B8 | **Shared unit with one real consumer.** Lives in a shared or common location, but `consumers_total` is 1 or all consumers are in this use-case | usage data | consumers_total, location |
| B9 | **Private unit with many consumers.** Lives inside one area but is imported from several unrelated areas | usage data | consumer areas |
| B10 | **Chatty crossing.** One user action triggers several backend round trips or hub calls in sequence from different units | trace or network log; else read the handlers | calls per action |
| B11 | **Same concept, two definitions.** The same domain term names different shapes or types in two units of the set (a sign that a boundary of meaning runs through it) | compare type definitions and field usage | term, the two shapes |

## Typical moves

B1 → `make-dependency-explicit` or `relocate-state-to-owner`. B2 → `break-cycle`. B3 → `replace-flag-with-variants`. B4 → `narrow-interface`. B6 → `inline-shallow-wrapper`. B10 → `unify-data-access`.

B5, B8, B9 and B11 usually have no local move. They are placement evidence for the synthesis step. Record them carefully and leave `moves` alone.
