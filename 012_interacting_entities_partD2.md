# 012 — Interacting Entities: State, Invariants, Coordination and Time

## Part D2 — Alternatives: The Consistency Boundary

D1 dealt with how one entity represents what it accepts. D2 deals with a different decision: **which data changes together, atomically**. The alternatives are merging aggregates, a multi-stream atomic append, the Dynamic Consistency Boundary, and the actor model.

The position taken in D2 is independent of the one taken in D1. A hold set (D1.3) can live in a merged aggregate, be placed by a two-stream append, be computed from tagged events, or be kept by an actor.

**A limit common to all four.** Each closes the machine-timescale window of issue 7. None touches the human-timescale one. An assessment that lasts days (P8) is a recorded business fact under every alternative here, and issues 9 and 10 apply unchanged. This is stated once and not repeated per alternative.

Product statements in this Part were checked against vendor documentation in November 2026. They should be verified against the current version before being relied on.

The eight-field template is that of D1.

---

## D2.1 Merging aggregates

### Idea

If two entities share an invariant that must always hold, make them one unit of change. The child becomes part of the parent. Every command goes through one root, is ordered against all others, and sees the whole.

**Business reading.** Move both files into one folder kept by one clerk. Whoever wants either must queue at the same desk. Nothing can be done to one without sight of the other.

### Origin and source

`[T]` The aggregate (Evans 2003). `[P]` Vernon (2011) discusses the choice between a large cluster and several small ones, and recommends starting small. C.2 gave the premise of that recommendation.

### When it fits

- The invariant is a true one and is exercised often.
- The child has no life apart from the parent.
- P3 low: few concurrent writers.
- P2 bounded: the number of children stays small.

### Failure modes

| Failure | Detail |
|---|---|
| **False conflicts** | Two actors doing unrelated things to the same aggregate collide. Assessor A's judgement conflicts with assessor B's, though neither affects the other |
| **Growth** | All history is loaded for every command. Long-lived aggregates need snapshots |
| **Mixed authority** | Commands from different roles, with different authorisation, arrive at one root |
| **Lifecycle mismatch** | The child has identity, a history of its own, several instances over time. Buried in the parent, these are hard to see and to query |
| **A boundary drawn for one invariant catches everything** | Rules unrelated to the shared invariant now also share the queue |

`[P]` False conflicts are commonly softened by retrying: reload, decide again, append. Where the two commands do not affect each other's decision, the retry succeeds. With few writers this is cheap. It does not scale.

### Costs

| | |
|---|---|
| Technical | The lowest in D2. No cross-entity anything |
| Organisational | One model, one owner. No coordination between teams, because there is one team. Read-side queries that want the child on its own need a projection |

### Business-visible consequences

No intermediate states: every rule that spans parent and child holds at all times. Occasionally a user is asked to retry because "someone else changed this", when the someone was doing something unrelated.

### Evolution

**Into:** from two aggregates. In an event-sourced system this is a stream merge, which changes the meaning of stream identity (Part D4).

**Out of:** splitting a merged aggregate is the harder direction. It reintroduces the interval of disagreement the merge removed, and that interval is business-visible.

`[S]` A design move keeps the exit open: every event names the sub-entity it concerns, and event types are distinct per sub-entity. *AssessmentRecorded(protocolId, …)*, not *DeclarationUpdated*. A later split, or a later tagging for D2.3, is then mechanical.

### In the case

The Protokoll becomes part of the Deklaratsioon aggregate. O4 has a technical answer at once: *Submit* and *StartProtocol* are ordered by the one stream. The business question remains: what is the loser told?

Against it: a protocol is a legal record with its own actors and its own history; there are several per declaration over time; and assessors would contend with each other and with the declarant on one stream. With a handful of assessors (P3 low) the contention is tolerable. The real cost is the exit.

---

## D2.2 Multi-stream atomic append in one transaction

### Idea

Keep the entities separate. When a rule spans two of them, change both in one atomic operation, each with its expected version. Either both changes happen or neither.

**Business reading.** Two folders, two clerks, but for this one kind of act both sign the same sheet at the same moment, and the sheet is void unless both signatures are on it.

### Origin and source

`[T]` The transaction (Gray 1981). `[P]` Among event stores, the capability depends on the product:

| Store | Capability (checked November 2026; verify) |
|---|---|
| Relational-backed stores such as Marten on PostgreSQL | Changes to several streams commit in one database transaction |
| KurrentDB | Atomic append to several streams, from version 25.1, with current client libraries |
| Cratis Chronicle | Atomic append across several event sources |

C.2 argued that this is a legitimate design where the premise of "one aggregate per transaction" does not hold.

### When it fits

- P4 low: one store.
- The rule spans a small, known set of entities.
- The operation is short.

### Failure modes

| Failure | Detail |
|---|---|
| **Write skew survives** | Checking the version only of streams that are *written* does not protect a decision that *read* another stream. The read stream's version must be asserted too, or the read stream must also be written. A.4's example fails in exactly this way |
| **The rule lives between the entities** | The logic sits in a handler or domain service that spans both. A second handler written later can bypass it |
| **Invariants over open sets** | "No other open protocol for this declaration" has no single stream to check unless one entity carries the fact. This is why D2.2 usually needs D1.3: the declaration holds the hold |
| **Lock ordering** | With row locks in a relational store, two handlers taking locks in opposite orders deadlock |
| **Invisible coupling** | The domain model shows two independent entities. That they must share a store is recorded nowhere unless someone records it |

### Costs

| | |
|---|---|
| Technical | Low, given a store with the capability |
| Organisational | Discipline. Each invariant that relies on a shared transaction is listed in the invariant register (009) with that dependency stated. Otherwise the incompleteness test of C.4 fails silently when the topology changes |

> **Technical box — sketch, store-neutral**
>
> ```csharp
> // StartProtocol: the declaration is read AND written, so its version is checked.
> var decl = await store.Load<Declaration>(cmd.DeclarationId);       // version v
> var (held, started) = Decide(decl.State, cmd, now);                // pure
>
> await store.AppendAtomically(
>     (decl.Stream,     expected: decl.Version, [held]),             // SubmissionHeld
>     (protocolStream,  expected: NoStream,     [started]));         // ProtocolStarted
> ```
>
> *Submit* appends to the declaration's stream with its expected version. Both commands pass through that stream's version check, so one of two concurrent attempts fails and is retried against the new state.

### Business-visible consequences

No intermediate state and no "eventually". From the outside it is indistinguishable from D2.1, without the false conflicts between assessors.

### Evolution

**Into:** from two aggregates joined by a read-then-act guard. Cheap and additive: the handler changes, the events and streams do not.

**Out of:**

| Towards | Cost |
|---|---|
| D2.3 (DCB) | Natural. The facts are already separate; they acquire tags |
| D3 (messaging, process manager) | Expensive in meaning. An intermediate state appears that did not exist, and the business must be asked what is true during it |

### In the case

The sketch above is the case: starting a protocol appends *ProtocolStarted* to the protocol's stream and *SubmissionHeld* to the declaration's, atomically. This is D1.3 and D2.2 together `[S]`, a composition, not a named pattern. O4 is ordered by the declaration's stream; the version carried by the hold answers issue 10.

By the parameters of C.5 (P4 low, P3 low), nothing more than this is justified for O4.

---

## D2.3 Dynamic Consistency Boundary

### Idea

There is no fixed boundary. Each decision declares which facts it depends on, as a query over event types and tags. It reads those facts, decides, and appends on one condition: that no new fact matching the same query has appeared since it read. An event carries a tag for every entity it concerns, so one event can take part in several decisions' boundaries.

**Business reading.** No folders at all: one register in order of entry, each entry marked with every matter it touches. Before acting, a clerk reads the entries bearing on the decision, and notes the number of the last one. The act is entered only if no further entry bearing on it has been made since that number.

### Origin and source

`[P]` Introduced by Sara Pellegrini under the title "Killing the Aggregate"; developed with Milan Savić; specified at dcb.events under a Creative Commons licence. It is recent practitioner work, not established theory, and is tagged accordingly.

`[S]` It has a clear theoretical ancestry, which this article supplies: it is optimistic concurrency control (Kung and Robinson 1981) in which the read set is described by a *predicate* and validated at commit. Validating a predicate, where others validate individual records, is what excludes write skew. The idea of protecting a predicate goes back to predicate locks (Eswaran et al. 1976).

**Maturity (checked November 2026; verify).**

| Implementation | Status as documented |
|---|---|
| Axon Framework 5 / Axon Server (Java) | Supported |
| Marten (.NET, PostgreSQL) | Documented: tags attached at append, queries by tag, consistency enforced on save; integration with Wolverine handlers |
| Sekiban (.NET) | DCB is its recommended model; packages seen carried preview versions |
| eventsourcing (Python) | Supported from version 9.5 |
| Cratis Chronicle (.NET) | States that it is *not* a DCB event store; offers decision-scoped conditions in its own model |

Marten's own design notes observe that most DCB use cases were already served by its existing multi-stream consistency features. That is a fair summary of the relation between D2.2 and D2.3.

### When it fits

- The rules cut across entities in ways not known in advance, or that keep changing.
- P1 rising.
- The system is already event-sourced.
- P4 low. The append condition needs one global order of events: DCB is inherently a single-log technique.

### Failure modes

| Failure | Detail |
|---|---|
| **Query too narrow** | A fact the decision depended on is not in the query. A conflicting event is not detected and the invariant is silently broken. Correctness rests on the query being exactly the decision's read set |
| **Query too broad** | Unrelated events cause conflicts: the false conflicts of D2.1 return |
| **Tags fixed at write time** | An event not tagged for an entity cannot later be found by that entity's decisions. Retrofitting tags onto history is a migration (Part D4) |
| **No unit of ownership** | With aggregates, "all the rules about a declaration" is one file. Here the rules are spread over deciders. Which decisions read this tag? Feature interaction (issue 16) becomes harder to see |
| **Global order** | The requirement of one sequence limits partitioning |
| **Youth** | The specification and implementations are recent; operational experience is thin |

### Costs

| | |
|---|---|
| Technical | A store that supports it; indexes on tags |
| Organisational | A new mental model for developers. For analysts the fit is good: "the facts this command depends on" is what A.10 asked them to write for every guard |

> **Technical box — sketch, store-neutral**
>
> ```csharp
> var q = Query.Tagged($"declaration:{id}")
>              .OfTypes<Submitted, SubmissionHeld, HoldReleased, CorrectionRequested>();
>
> var (facts, position) = await store.Read(q);
> var events = Decide(Fold(facts), cmd, now);                        // pure
> await store.Append(events, failIf: q, after: position);
> ```

### Business-visible consequences

None directly. Decisions are atomic. Retries occur as elsewhere.

### Evolution

**Into:** from streams, by adding tags. Where a store supports tags alongside streams, the two can coexist and the move can be made one decision at a time.

**Out of:** harder. An event tagged for two entities belongs to no single stream, so re-partitioning into aggregates is ambiguous.

### In the case

*ProtocolStarted* is tagged with the declaration and with the protocol. *Submit* and *StartProtocol* both query the declaration's tag. Their conditions overlap, one append fails, and O4 is ordered. No hold set is stored: "held" is computed from the facts at each decision. The lease of issue 9 is still a fact, with an expiry.

By the over-engineering test: the case has one family of cross-entity rules, known in advance. DCB's distinctive benefit is boundaries that need not be known in advance. No parameter in C.5 claims that benefit. Adopting it would be a bet on P1 and on the volatility of the rules, to be written down as one.

---

## D2.4 The actor model

### Idea

Each entity is an actor: it has private state, handles one message at a time, and communicates with others only by sending messages. Inside one actor there is no concurrency to reason about.

**Business reading.** Every folder has its own clerk, who does one thing at a time and deals with other clerks only by memo.

### Origin and source

`[T]` Hewitt, Bishop and Steiger (1973); Agha (1986). `[P]` Erlang made it an industrial practice. `[T]` Orleans introduced *virtual actors*, which exist logically at all times and are activated on demand (Bernstein et al. 2014).

### When it fits

- P3 high: many concurrent writers per entity, often automated.
- Very many independent entities.
- Value in keeping live state in memory.

### Failure modes

| Failure | Detail |
|---|---|
| **Cross-actor invariants are untouched** | Two actors are two boundaries. Asking another actor and then acting is read-then-act (issue 7) |
| **Call cycles** | In Orleans a grain by default handles one request to completion before the next. If A calls B while B calls A, each waits for the other until a timeout |
| **Reentrancy** | Allowing requests to interleave avoids the deadlock and reintroduces interleaving at every await. The documentation labels it an advanced feature for that reason |
| **State and messages are not atomic** | Saving an actor's state and sending its messages are separate acts unless designed otherwise (006, the outbox) |
| **Two steps, one may fail** | Actor P asks actor D to place a hold, then records its own start. If P fails in between, the hold is orphaned (issue 9) |

### Costs

| | |
|---|---|
| Technical | A runtime: a cluster, placement, storage providers, monitoring |
| Organisational | A different programming model and the skills for it |

### Business-visible consequences

None specific. Response times are typically low.

### Evolution

**Into:** from one aggregate per stream. The mapping is direct: an aggregate is very nearly an actor.

**Out of:** actor code is bound to its runtime. `[S]` Keeping the domain logic as a pure function from state and command to events (the Decider, Part E) and letting the actor merely host it makes the exit cheap.

### In the case

A Deklaratsioon actor serialises *Submit* against *PlaceHold*: the ordering point of D1.3, obtained by construction. But starting a protocol is then two steps across two actors, and the gap between them needs a lease or a process manager (D3). D2.2 gives the same ordering *and* atomicity in the one store the case already has.

By the over-engineering test: the actor model is justified by P3. In the case P3 is low.

---

## What D2 leaves to D3

Every alternative in D2 presupposes that the data in question can be ordered or changed together: one aggregate, one store, one log, or one actor. Where it cannot, because there are two stores, an external system, or a step that takes days, a boundary is crossed and something must manage the crossing. That is Part D3.

## O4 under each alternative

| Alternative | How "submit" and "start assessment" are ordered | What remains a business decision |
|---|---|---|
| D2.1 Merged aggregate | By the single stream | What the loser is told |
| D2.2 Two-stream atomic append | By the declaration's stream version | The same; and whether a protocol may proceed on a newer version |
| D2.3 DCB | By the append condition on the declaration's tag | The same |
| D2.4 Actors | By the declaration actor's mailbox | The same; plus what happens if the second step fails |

The business decision is identical in every row. That is what "the model isolates the decision" means: the choice of mechanism and the choice of rule have been separated.

## Comparison within D2

| | Merged aggregate | Multi-stream append | DCB | Actors |
|---|---|---|---|---|
| Boundary is | Fixed, large | Fixed, per operation | Declared per decision | Fixed, one per entity |
| Requires | Nothing special | One store with the capability | One log with tags and conditional append | An actor runtime |
| Closes write skew | Yes | Yes, if read streams are version-checked | Yes, if the query is the read set | Within an actor only |
| False conflicts | Many | Few | Tunable by the query | None within an actor |
| Where the rule lives | In the aggregate | In a handler between entities | In each decider | In each actor, plus messages |
| Parameter that justifies it | Child has no independent life | P4 low | P1 rising; rules volatile | P3 high |
| Maturity | Established | Established; store-dependent | Recent | Established |
| Exit | Hard (split) | Easy to DCB; costly to D3 | Hard (re-partition) | Easy if logic is a pure decider |

---

## Glossary (Part D2)

| Term | Definition |
|---|---|
| Actor | An entity with private state that handles one message at a time and communicates only by messages |
| Append condition | In DCB, the requirement that no event matching a query has been added after a given position |
| Atomic append | Adding events to one or several streams so that all are stored or none |
| Decider | A pure function from state and command to events (Part E) |
| Dynamic Consistency Boundary (DCB) | A technique in which each decision declares, by query, the facts it depends on |
| False conflict | A concurrency failure between operations that do not affect each other |
| Global order | One sequence in which all events of a store are positioned |
| Grain | Orleans' term for a virtual actor |
| Predicate lock | A lock on all records satisfying a condition, including ones not yet written |
| Read set | The data a decision depended on |
| Reentrancy | Allowing an actor's requests to interleave at points where it waits |
| Stream | The ordered events of one entity in an event store |
| Tag | A marker on an event naming an entity it concerns |
| Virtual actor | An actor that exists logically at all times and is activated on demand |
