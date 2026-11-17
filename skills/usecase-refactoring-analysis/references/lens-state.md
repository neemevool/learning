# Lens S: state ownership and derived data

Source: article 011, §10 (system of record versus derived data; data inside versus data outside) and §6 (replicas, read-your-writes).

## The idea

For every datum there should be one authoritative home; everything else is a copy with a rule for how it is refreshed. The test question is: **if two holders of this value disagree, which one wins, and how is the other repaired?**

A browser application is a replica of server state. The server is the system of record. Anything the client keeps (a store slice, a cache, component state, a Yjs document) is derived data, some of it with local edits not yet acknowledged. Problems arise when the client holds the same server fact in several places with no stated owner, or when it stores what it could compute.

Classify each piece of state the use-case touches before judging it:

| Class | Home | Examples here |
|---|---|---|
| Server state | Backend; client holds a copy | teema, versioon, dokument, struktuurielemendid, koostöörühm |
| Collaborative document state | Yjs document synchronized through `/hub/dokument` | Slate text and marks |
| URL state | The address bar | teema and versioon ids, `tab`, `t1` |
| Session state | Auth provider | user, roles |
| UI state | One component or one view | open panels, selection, draft input, scroll |
| Derived | Nowhere; computed | filtered lists, counts, permissions computed from role |

## Signals

| ID | Signal | Detect | Record in `measure` |
|---|---|---|---|
| S1 | **Server fact held in more than one place.** The same entity is in a store and in component state, or in two stores, or fetched separately by two units | Trace each `backend_calls` response to where it is kept | entity, holders |
| S2 | **Effect-derived state.** `useEffect` that calls `setState` with something computed from props or other state | Lint data (the earlier investigation counted 164 sites); else read effects | count in set |
| S3 | **Stored value that is derivable.** State that is always a function of other state or props | Read reducers and setters | field, source |
| S4 | **State far from its use.** Global store slice read and written by a single component or a single view | writers/readers from lens B | slice, readers, writers |
| S5 | **State too local.** The same value is lifted through callbacks or re-fetched because siblings need it | callback chains; duplicate fetches | value, hops or fetches |
| S6 | **URL-worthy state kept in memory.** What the user sees depends on state that a reload loses, where the URL already carries similar state | compare view-selection state with query parameters | state name |
| S7 | **No refresh rule.** A client copy of server state with no invalidation: not refetched after a mutation, not updated by a hub event | For each mutation in the use-case, find what updates the copies | entity, mutation |
| S8 | **Two sources updating one copy.** A value is set by both a fetch response and a hub event, with no ordering rule | find all writers of the slice | slice, writers |
| S9 | **Optimistic update without reconciliation.** UI shows a change before the server confirms, and failure is not rolled back | read the mutation handler | handler |
| S10 | **Invariant spanning holders.** Two fields that must agree live in different stores or components and are updated separately | look for paired updates | fields |
| S11 | **Store as a data-passing channel.** A value is written to a store by one component only so another can read it in the same interaction | write immediately followed by navigation or render of the reader | slice |

## Typical moves

S1, S7 → `unify-data-access`. S2, S3 → `derive-instead-of-store`. S4, S5, S10 → `relocate-state-to-owner`. S11 → `make-dependency-explicit`.

S8 and S9 are correctness risks as much as structure. Give them their own findings even if a lens-A signal covers the same code, and say which user-visible behaviour is at stake.
