# Lens C: abstractions and contracts

Source: article 011, §9 (language and abstraction) and §12 (interfaces and contracts).

## The idea

An abstraction has three parts: an interface (what you may say), a cost model, and a failure model. Most specify only the first. A component's props are its interface; what it fetches, subscribes to, writes, and how it fails are the other two parts, and in React they are usually invisible at the call site.

Three distinctions from the article matter here:

- **Abstraction, indirection and generalization are different.** A wrapper that only forwards is indirection. One component serving five cases through flags is generalization, which couples the cases to each other. Neither is abstraction unless it lets the caller ignore something.
- **The wrong abstraction is costlier than duplication.** Two paths were merged because they looked alike, then diverged; the shared unit accumulates flags.
- **Hyrum's law.** Callers depend on whatever a unit observably does, not on what it was meant to promise. Unused flexibility is a cost; unstated behaviour is a contract.

## Signals

| ID | Signal | Detect | Record in `measure` |
|---|---|---|---|
| C1 | **Mixed roles.** One unit fetches, holds state, applies domain rules and renders | Read it; list the jobs | jobs |
| C2 | **Flag accumulation.** Several boolean or mode props that select between behaviours; the body is mostly branching | count such props and branches | flags, branches |
| C3 | **Dead flexibility.** Props declared and never passed anywhere, or passed with one constant value everywhere | usage data (`props_declared` vs. passed) | props |
| C4 | **Flexibility unused here.** This use-case exercises a small part of a general unit | `executed_fraction` low while `consumers_total` is high or low: record both | fraction, consumers |
| C5 | **Hidden effect.** A unit that looks presentational fetches, subscribes to a hub, writes a store, navigates, or reads the clock | grep inside units with role `domain-widget` or `ui-primitive` | effect kinds |
| C6 | **Illegal states representable.** Props or state that allow combinations with no meaning (`isLoading` and `error` and `data` all independent; `mode='readonly'` with `onChange`) | read the type | the combination |
| C7 | **Leaked shape.** A backend DTO, store shape or third-party type (MUI, Slate, Quill) passes through the unit's props unchanged, so callers depend on it | prop types | type, depth |
| C8 | **HOC stack.** Behaviour assembled from several HOCs, so props appear from nowhere and order matters | `export default a(b(c(X)))` | HOCs in order |
| C9 | **Implicit contract.** Callers rely on something unstated: render order, a particular DOM structure, a side effect on mount, a default that is never passed | read call sites next to the callee | what is relied on |
| C10 | **Near-duplicate with intentional difference.** Member of a duplicate cluster where `clusters/C0xx.md` notes a real behavioural difference | cluster review | cluster, difference |
| C11 | **Component defined inside a component.** Remounts on every render; state is lost | lint data (41 known sites) | parent, child |
| C12 | **Untyped or loosely typed boundary.** `.jsx`, `any`, or index signatures on a unit with several consumers | file extension and types | consumers |

## Typical moves

C1 → `split-by-responsibility`, `extract-pure-logic`, `isolate-side-effect`. C2 → `replace-flag-with-variants`. C3 → `remove-unused-prop`. C4 with low fraction → `remove-unexecuted-branch`, but only after an open question confirms the branch is not a dormant feature. C5 → `isolate-side-effect` or `make-dependency-explicit`. C7 → `narrow-interface`. C8 → `make-dependency-explicit`.

C10 never gets a `merge-duplicates` move on your own authority. Raise an open question for the domain owner and reference the cluster review.
