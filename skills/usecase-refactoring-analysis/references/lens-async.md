# Lens A: interleaving and remote calls

Source: article 011, §2 (race condition versus data race), §3 (ordering), §4 (partial failure).

## The idea

A browser tab runs one thread, so there are no data races. There are plenty of race conditions: every `await`, every effect, every hub message is a point where something else can run first. The article's example applies literally: `if (!cache) cache = await load()` can load twice with no data race at all.

A remote call has three outcomes, not two: definite success, definite failure, and unknown (timeout, dropped connection). Code with only `try` and `catch` has silently mapped "unknown" onto one of the others. A retry after "unknown" can perform the effect twice unless the operation is idempotent.

Structure matters here because these defects are produced by where async code sits. Fetching inside presentational components, several units talking to the same hub, and the same data loaded by different mechanisms each multiply the interleavings nobody designed.

## Signals

| ID | Signal | Detect | Record in `measure` |
|---|---|---|---|
| A1 | **Stale response can win.** An effect fetches on a changing input and sets state on resolve, with no cancellation or check that the input is still current | effects with `fetch`/`await` and no cleanup, `AbortController`, or sequence check | effect location, input |
| A2 | **Suppressed or wrong effect dependencies.** `eslint-disable` on `exhaustive-deps`, or a closure that reads a value not in the list | lint data (78 known, 57 suppressed) | count in set |
| A3 | **Check-then-act across an await.** A condition is tested, an await follows, then the code acts as if the condition still held | read async handlers | handler |
| A4 | **Double submit possible.** A mutation can be triggered again before the first completes: no disabled state, no in-flight guard | read submit handlers | handler |
| A5 | **Non-idempotent mutation retried or repeatable.** POST without a client-generated id or idempotency key, in a path that retries or that the user can repeat after an unknown outcome | handler plus API call | call |
| A6 | **Unknown outcome treated as failure or as success.** Catch block that shows "failed" (user repeats) or swallows the error (user believes it saved) | read catch blocks around mutations | call, mapping |
| A7 | **Order dependence between channels.** Correct display depends on a REST response arriving before or after a hub event | writers of the same slice from both channels (see S8) | slice |
| A8 | **Subscription without teardown, or duplicated.** Hub or event listener added in an effect with no cleanup, or the same subscription made by several mounted units | `connection.on` without matching `off`; count subscribers per method | method, subscribers |
| A9 | **Mount-order dependence.** A unit assumes another has already loaded data or opened a connection | reads of store slices that have no loader in the unit's own ancestry | slice, assumed loader |
| A10 | **Same data, several loading mechanisms.** HOC loader, fetch hook and fetch-in-effect all used for one entity within the use-case | list loaders per entity | entity, mechanisms |
| A11 | **Impure render.** Render reads the clock, random values, or mutates something | lint data (56 known sites) | count in set |
| A12 | **Unhandled failure path.** Promise without catch, or an error boundary absent above an async-driven view | read | location |

## Typical moves

A1, A3, A4 → `add-cancellation-or-guard`. A8, A9 → `isolate-side-effect` or `make-dependency-explicit`. A10 → `unify-data-access`.

A5, A6 and A7 often need a backend or product decision. Record the finding and raise an open question; do not propose a client-only patch as if it settled the matter.

State which user-visible behaviour each finding puts at risk. "Stale response can overwrite the selected version's content when the user switches versions quickly" is useful. "Possible race" is not.
