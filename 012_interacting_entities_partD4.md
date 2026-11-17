# 012 — Interacting Entities: State, Invariants, Coordination and Time

## Part D4 — Evolution

Parts D1 to D3 described fourteen alternatives and, for each, how a system arrives at it and leaves it. This Part gathers those paths. It answers the question Part C postponed: when a mechanism is not built now, what does it cost to add later?

That cost is what makes "defer it" either prudent or reckless. Without it the over-engineering test of C.4 has only one side.

---

## D4.1 Why evolution is an input to design

### Business reading

A shop with one till and one ledger becomes a chain. The owner did not design the first shop wrongly by having one ledger. But some early habits made the growth easy and others made it painful. A shop that wrote on every receipt which till issued it could open a second till without touching its past. A shop that had not could no longer tell its old receipts apart.

The habit cost nothing at the time. Its value appeared only at the transition.

### Technical reading

`[S]` The parameters of Part C drift, and they drift in predictable directions: sources of constraint multiply (P1), writers multiply (P3), stores multiply (P4). A design chosen correctly for today's values will be asked to move. The question for the designer is which moves remain cheap.

---

## D4.2 Additive and meaning-changing transitions

The central distinction of this Part.

| | Additive | Meaning-changing |
|---|---|---|
| **Definition** | Everything that was true of existing records remains true. New kinds of fact, state or constraint are added beside the old | Some statement that held of every existing record is no longer guaranteed, or an existing term denotes something different |
| **Existing data** | Valid as it stands | Must be reinterpreted, migrated or marked |
| **The business** | Is consulted only about the new feature | Must be consulted about the past and the transition |
| **Typical cost** | Development | Development, migration, communication, and a period in which both meanings coexist |

**The test** `[S]`: *is there a sentence that was true of every past record and will not be guaranteed after the change?* If so, the change is meaning-changing, however small the code.

### Three kinds of meaning change

| Kind | What changes | Example |
|---|---|---|
| **Identity** | What counts as one thing | A protocol that was part of a declaration becomes an entity of its own |
| **Guarantee** | What is promised to hold, and when | Two changes that were atomic now happen one after the other |
| **Vocabulary** | What a term denotes | *Kontrollitud* comes to mean "last protocol confirmed" where it meant "no further checking possible" |

### An asymmetry

`[S]` **Strengthening a guarantee is additive; weakening one is meaning-changing.** If two entities that used to agree "eventually" now agree at all times, nothing that was true has become false. In the other direction an interval of disagreement appears that did not exist, and somebody must say what is true during it.

This asymmetry explains much of the transition matrix below. Moves toward a larger consistency boundary are cheap in meaning and costly in throughput. Moves toward a smaller one are the reverse.

**Sources.** `[P]` The vocabulary of compatible and incompatible change comes from schema evolution; for event-sourced systems, Young (2017). `[P]` The practice of introducing a change in parallel with the old form and retiring the old later is known as *parallel change* or *expand and contract*.

---

## D4.3 Event-sourcing specifics

An event-sourced system has one evolutionary advantage and one evolutionary hazard.

**The advantage.** Read models are computed from events and can be recomputed. Any change confined to how state is *derived* is a two-way door: a new projection, a new fold, a new headline status.

**The hazard.** History is immutable. A mistake of identity, or an omission of information, is permanent in the stored events. It can be worked around at read time. It cannot be undone.

### Facts versus status assignments

D1.1 introduced this. An event *StatusChanged(to: Parandamisel)* records a conclusion. An event *CorrectionRequested(by, protocol, version, reason, at)* records what happened. From the second the first can be computed, under any state model the designer later prefers. From the first the second cannot be recovered.

> **Technical box — what upcasting can and cannot do**
>
> `[P]` *Upcasting* transforms an old event shape into a new one as it is read.
>
> ```csharp
> // Possible: the information is present, only its shape changes.
> static object Upcast(SubmittedV1 e) =>
>     new SubmittedV2(e.DeclarationId, e.Version, e.At, By: e.DeclarantId);
>
> // Not possible: the cause was never recorded.
> static object Upcast(StatusChanged e) => e.To switch
> {
>     "Parandamisel" => new CorrectionRequested(/* by whom? which protocol? */),
>     ...
> };
> ```
>
> The second function can be written only by inventing data.

### Splitting a stream

One entity's history becomes two entities' histories.

| Approach | Consequence |
|---|---|
| Leave history in place; new events go to new streams; the new entities read both | No migration. Permanent complexity in loading |
| Copy and transform history into new streams | Clean result. A migration, and stream identifiers referenced elsewhere must be remapped |

Either way two things are lost.

- **Total order.** Within one stream, any two events had a definite order. Across two streams they have one only if the store keeps a global position.
- **Free invariants.** Rules between the two halves were enforced by the single stream. After the split they are cross-entity rules and need a D2 mechanism.

### Merging streams

The reverse needs an interleaving of two histories into one. That is well defined only if the store recorded a global order. Expected versions change for every writer.

### Retrofitting tags

For a Dynamic Consistency Boundary (D2.3), events need tags naming the entities they concern.

| Situation of old events | Cost |
|---|---|
| The entity identifiers are in the event payload | A mechanical backfill: derive tags from the payload |
| The identifiers are not in the payload | Each event must be related to others to discover what it concerns. Expensive and sometimes ambiguous |

**A hazard specific to this transition.** Until the backfill is complete, a query by tag does not see untagged history. D2.3 named "query too narrow" as the technique's characteristic failure: conflicts go undetected and invariants break silently. A partially tagged store is in that condition by construction. The backfill must finish before any decision relies on tags.

### Introducing an invariant

History may already violate a rule that is about to become hard (D3.5). The new invariant cannot be assumed of existing data. Either the violations are found and repaired first, or the invariant is declared to hold only from a stated date.

### Instances in flight

A process started under the old rules is still running when the rules change. Every change to a gate, a deadline or a process definition needs a transitional rule: do open instances finish under the old rule, switch to the new, or restart?

---

## D4.4 One-way and two-way doors

C.4 used the distinction. Here are the criteria `[S]`. A transition is a one-way door, or close to it, when any of these holds.

| Criterion | Example |
|---|---|
| The information needed to return was not kept | Sources of holds collapsed into a boolean |
| Outside parties have come to rely on it | A status shown publicly; a legal effect; a published interface |
| Instances in flight cannot be migrated | Long-running workflow instances under a changed definition |
| The asset is in a vendor's format | A body of policies; a library of process definitions |
| Identity was changed | Streams split or merged; events tagged for several entities |

A two-way door has none of them. Changes of derivation, of display, and of pure decision logic over unchanged facts are two-way.

---

## D4.5 Design moves that keep transitions cheap

These are the receipts with the till number on them. `[S]` Each is a commitment at the level of analysis or data, not machinery. In the terms of C.1 they belong to the "thorough analysis, light machinery" quadrant. Each costs a field, a function boundary or a line in a register.

| # | Move | Cost now | Transitions it keeps cheap |
|---|---|---|---|
| 1 | Record facts with actor, time and cause; never status assignments | Naming events properly | Flat → regions → holds; any re-modelling of state |
| 2 | Every event carries the identifiers of all entities it concerns | A few fields | Splitting streams; retrofitting tags; merged aggregate → anything |
| 3 | Every hold records its source, even while only one kind of source exists | One field | Boolean → hold set; hold → reservation; saga's semantic lock |
| 4 | Every judgement records the version it judged | One field | Locking → version-binding and back; leases with fencing |
| 5 | Domain logic is a pure function from state and command to events; infrastructure hosts it | A boundary in the code | Handler ↔ actor ↔ DCB; exhaustive testing (Part E) |
| 6 | Gates and completeness conditions are named functions | A function | Any change of gate (O1) |
| 7 | Deadlines are functions of facts; the current time is an input | A parameter | Any change of time rule; timer failure (008) |
| 8 | Display statuses are derived and are never read by guards | Discipline | Any change of presentation |
| 9 | The invariant register states, for each invariant, the mechanism and what it depends on ("relies on a shared transaction") | A column | Any change of store topology |
| 10 | The parameter record states each value, its owner and its trigger for review | A page | Detecting that a transition is due |
| 11 | Intermediate states are named when they exist, not in anticipation | Restraint | Avoids states that must later be explained away |

Moves 1 to 4 concern what is written into immutable history. They are the ones that cannot be applied retroactively, and so the ones worth applying from the first day.

---

## D4.6 Natural growth paths

As a parameter rises, designs tend to move along a characteristic path. Each step is marked **A** (additive) or **M** (meaning-changing).

| Driver | Path |
|---|---|
| **P1** rises: more kinds of constraint | Flat state —A→ a hold with a source —A→ a hold set —A→ externalised policy for combination |
| **P3** rises: more writers | Merged aggregate —M→ separate entities with multi-stream append —A→ DCB, or —M→ actors |
| **P4** rises: more stores | Multi-stream append —M→ process manager with messaging —A→ reservation where acts are irreversible |
| Number of processes rises | Process manager —A→ workflow engine (new instances), with an M for those in flight |
| Cost of violations rises | Detect and compensate —M→ prevention |
| Cost of waiting rises | Locking for the duration —M→ binding to versions and reconciling |

The P1 path is additive throughout, provided moves 1 and 3 were made. The P4 path begins with a meaning change that no design move avoids: an interval appears. The moves only ensure it is known where.

---

## D4.7 Transition matrix

Rows are the starting point, columns the destination.

| Code | Meaning |
|---|---|
| **A** | Additive |
| **A\*** | Additive if the relevant design move of D4.5 was made; otherwise M |
| **M** | Meaning-changing; migration or reinterpretation |
| **M!** | Meaning-changing and visible to the business: a new condition must be explained to users |
| **1W** | A one-way door in practice |

### Structure inside an entity (D1)

| From ↓ / To → | Flat states | Regions | Hold set | External policy |
|---|---|---|---|---|
| **Flat states** | — | A\* (move 1) | A\* (moves 1, 3) | A for authorisation; M if lifecycle is moved into policy |
| **Regions** | M: combinations collapse | — | A\* (move 3) | A |
| **Hold set** | 1W once several sources are in use | M | — | A: holds become attributes the policy reads |
| **External policy** | 1W | 1W | 1W | — |

### The consistency boundary (D2)

| From ↓ / To → | Merged aggregate | Multi-stream append | DCB | Actors |
|---|---|---|---|---|
| **Merged aggregate** | — | M: identity; order between halves | A\* (move 2), with backfill | A: an aggregate is nearly an actor |
| **Multi-stream append** | M: merge needs a global order | — | A\* (move 2), with backfill | M!: atomicity between entities is lost |
| **DCB** | 1W: multi-tagged events fit no single stream | M | — | M! |
| **Actors** | M | A in one store: the guarantee strengthens | A\* (move 2) | — |

### Process coordination (D3), and crossing into it

| From ↓ / To → | Atomic (D2) | Choreography | Process manager / saga | Workflow engine | Reservation | Detect and compensate |
|---|---|---|---|---|---|---|
| **Atomic (D2)** | — | M! | M! | M! | M!: "reserved" appears | M!: violations become possible |
| **Choreography** | A: strengthens | — | A: reactions gathered | A | M! | — |
| **Process manager / saga** | A: strengthens | M: timeouts and visibility lost | — | A for new instances; M in flight | A | — |
| **Workflow engine** | 1W | 1W | 1W | — | — | — |
| **Reservation** | A: strengthens | M! | A | A | — | M! |
| **Detect and compensate** | M: history holds violations | — | — | — | M: history holds violations | — |

A dash marks a move that is not a meaningful substitution.

### Reading the matrix

- **The first row of the third table is all M!.** Leaving atomicity is always business-visible. This is the price of C.2's advice that a multi-entity transaction is acceptable in one store, and the reason move 9 exists.
- **The first column of the same table is mostly A.** Returning to atomicity is cheap in meaning.
- **A\* cells cluster around moves 1, 2 and 3.** Three habits of recording decide most of the matrix.
- **1W cells cluster around assets in external formats and around identity.**

**Limit.** The matrix classifies transitions by meaning. It does not estimate effort, which depends on data volume, code size and the team. A cell marked A can still be weeks of work.

---

## D4.8 The case: pricing the bets

C.5 and D1 left three bets open. The matrix prices them.

| Bet | Build now? | Reasoning |
|---|---|---|
| A hold *set* for the submission lock, though one source exists | No | Flat → hold set is A\* under moves 1 and 3. Record *SubmissionHeld(by: protocol, version)* as a fact now; fold it into whatever representation suffices. The set is later a change of fold: a two-way door |
| DCB | No | Multi-stream → DCB is A\* under move 2. Put entity identifiers in every event now |
| Messaging or a process manager between Deklaratsioon and Protokoll | No | It would be an M! taken without need. But record in the invariant register which rules rely on the shared store (move 9) |

In each case the conclusion has the same shape: **do not build the mechanism; make the recording decision that keeps it cheap.**

The open business decisions can be classified the same way. This does not resolve them. It says which deserve the most care because they will be hardest to revisit.

| Decision | To change it later | Why |
|---|---|---|
| O1, the gates | Two-way for new protocols; a transitional rule for those in flight | The gate is a function (move 6) |
| O2, idle lock versus the 90-day window | **M!** in either direction | It alters clocks already running and the declarant's legitimate expectations |
| O3, trapped drafts | M if *Kontrollitud* ceases to be terminal: a vocabulary change | Other rules and reports rely on "terminal" |
| O4, submit versus start-assessment | Two-way | An ordering rule and a message to the loser |

`[S]` O2 is the decision in the case that most resembles a one-way door. It is also the one that depends on the two parameters C.5 marked unknown. That is where the analyst's effort should go first.

---

## Glossary (Part D4)

| Term | Definition |
|---|---|
| Additive transition | A change after which everything true of existing records remains true |
| Backfill | Computing and storing, for existing records, information newly required |
| Copy and transform | Migrating events by writing a transformed copy to new streams |
| Design move | A cheap commitment in recording or structure that keeps later transitions cheap |
| Global position | A store-wide ordering of all events |
| Growth path | A characteristic sequence of designs as a parameter rises |
| In-flight instance | A process or entity begun under old rules and still open when rules change |
| Meaning-changing transition | A change after which some statement true of all past records is no longer guaranteed, or a term denotes something different |
| Parallel change | Introducing the new form beside the old and retiring the old later |
| Strengthening / weakening | Making a guarantee hold in more / fewer circumstances |
| Transition matrix | The table classifying moves between alternatives |
| Transitional rule | The stated treatment of in-flight instances at a change |
| Upcasting | Transforming an old event shape into a new one at read time |
| A, A\*, M, M!, 1W | The transition codes of D4.7 |
