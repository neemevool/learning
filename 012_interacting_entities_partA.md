# 012 — Interacting Entities: State, Invariants, Coordination and Time

## Part A — The Essence, and Its Relation to Business

Part 0 separated seven classes of problem. This Part places each in the body of theory that already describes it, and then turns to the business side: why these problems are properties of the business, not of the software.

The order is deliberate. Theory comes first because it is the point of the document: each section ends with what the theory obliges a requirement or a design to state.

Provenance tags as in Part 0: `[T]` established theory, `[P]` practitioner knowledge, `[S]` this article's synthesis.

---

## A.1 State as a claim about what is accepted

### Business reading

A building permit application is "received", then "under review", then "granted" or "refused". The stage matters for one reason: it decides what can be done next. A received application can be withdrawn; a granted one cannot be withdrawn, only surrendered. If two stages allow exactly the same things, then for the purpose of running the process they are one stage, whatever the paperwork calls them.

The reason an application reached a stage may still matter, for reporting or for audit. That is information *about* the application. It is not a stage.

### Technical reading

`[T]` A finite automaton is a set of states, a set of inputs, and a transition function. The classical question of when two states are "really" different has a precise answer, due to Moore (1956) and Nerode (1958): two states are equivalent if and only if no sequence of future inputs produces different observable behaviour from them. A state is therefore an equivalence class of *histories*, grouped by what they make possible in the future.

> **Technical box — the distinguishability criterion**
>
> Let *h₁* and *h₂* be two histories (sequences of past inputs) of an entity. They lead to the same state iff for every continuation *w*, the entity's response to *h₁w* equals its response to *h₂w*. The minimal automaton has exactly one state per equivalence class (Myhill–Nerode theorem).

This yields the definition used in the rest of the article.

> **State** `[T]`, applied `[S]`: a state of an entity is a class of its histories that are indistinguishable by any future interaction. Two conditions of an entity are different states iff there is some command, fact or deadline to which the entity responds differently.

Two consequences follow directly.

- **A state that changes nothing is not a state.** `[S]` If "checking left unfinished" accepts exactly what "being checked" accepts, it is the same state with a remark attached. The remark belongs in data (Part B, issue 11).
- **Control state and data are different things.** `[P]` Practical models are *extended* state machines: a small set of control states plus variables. The control state decides which transitions exist; variables parameterise guards. The reason a declaration was returned is a variable; whether it can be submitted is control state.

`[T]` Flat automata scale badly. Harel (1987) introduced **statecharts**, adding three constructs:

| Construct | Meaning | What it prevents |
|---|---|---|
| **Hierarchy** (OR-states) | A state contains sub-states; a transition from the parent applies to all of them | Repeating the same exit from every sub-state |
| **Orthogonality** (AND-states, also called orthogonal regions) | An entity is in one state of *each* of several independent regions at once | The product: *n* independent aspects with *k* values each need *kⁿ* flat states, but only *n·k* in regions |
| **History** | Re-entering a composite state resumes the sub-state last occupied | Encoding "where we were" as extra states |

Orthogonality is the construct that matters most for this article. A declaration's drafting status, its publication status and its checking status are candidates for three regions. Flattening them into one enumeration is the origin of most "status" lists with fifteen entries (Part B, issue 12).

### What this obliges

A requirement that introduces a status must say what the entity accepts and refuses in it. If it cannot, the status is either data or a display label.

---

## A.2 Invariants, safety and liveness

### Business reading

Rules come in two kinds.

- **"Never" rules.** A property is never sold while a lien is registered. If this is broken, there is a definite moment at which it was broken, and nothing done afterwards unbreaks it.
- **"Eventually" rules.** Every application eventually receives a decision. This cannot be shown to be broken at any moment: however long the applicant has waited, the decision might still come tomorrow.

The second kind is not enforceable as written. It becomes enforceable only when given a bound: "within 30 days". Then it is a "never" rule in disguise: never does day 31 arrive without a decision.

### Technical reading

`[T]` Lamport (1977) introduced the distinction: a **safety** property says that something bad never happens; a **liveness** property says that something good eventually happens. Alpern and Schneider (1985) made it formal:

- A property is a safety property iff every violation has a finite prefix that cannot be extended into a satisfying execution. The damage is done at a point, irremediably.
- A property is a liveness property iff every finite execution can be extended into one that satisfies it. No finite observation refutes it.
- Every property is the intersection of a safety property and a liveness property.

`[T]` A bounded liveness requirement ("within *d*") is a safety property, since it is violated at a definite finite point.

Three points matter for requirements.

1. **An invariant is a safety property of states.** It is a predicate that holds in every reachable state. `[T]`
2. **Some safety rules are about transitions, not states.** "A confirmed protocol never becomes unconfirmed" cannot be checked by looking at one state. It constrains pairs of consecutive states. `[T]` Requirements often omit these because no screen shows them.
3. **Liveness needs an assumption about the actors.** `[T]` Formal proofs of liveness assume *fairness*: an action that stays possible is eventually taken. People provide no such guarantee. An assessor may never act. `[S]` Every liveness requirement that depends on a human therefore needs a time bound and a stated consequence when the bound passes; otherwise it is a hope.

008 treats the same pair for task execution. Here it applies to business rules.

### What this obliges

Every rule is classified. "Never" rules go to the invariant list. "Eventually" rules get a bound and a consequence, or are recorded as accepted risks.

---

## A.3 Consistency boundaries

### Business reading

A ledger page can be corrected in one stroke: the clerk sees the whole page and leaves it consistent. Two ledgers in two offices cannot. A rule that involves both ("the same parcel is not pledged twice") needs a procedure: a notice sent, a reply awaited, a period during which the answer is uncertain. The uncertainty is not a defect of the offices. It follows from there being two of them.

### Technical reading

`[T]` A **transaction** groups operations so that they take effect atomically and in isolation from concurrent work (Gray 1981; the ACID acronym is from Härder and Reuter 1983). Within one transaction on one store, a multi-entity invariant can be checked and preserved in a single step.

`[T]` Evans (2003) defines an **aggregate** as a cluster of objects treated as a unit for the purpose of data changes, with a root through which all access passes. Invariants inside the aggregate hold when each transaction completes; rules spanning aggregates are not expected to be up to date at all times.

`[P]` Vernon (2011) turned this into design guidance: put only true invariants inside a boundary, keep aggregates small, reference other aggregates by identity, and use eventual consistency across boundaries.

`[T]` Helland (2007) argues from a stated premise: systems that must scale almost without limit cannot rely on distributed transactions. He then derives that data must be partitioned into **entities** (his term for the unit that one transaction can change), that entities interact only by messages, and that each entity must remember per-partner progress, which he calls an **activity**.

`[S]` Two things should be read off this literature carefully.

- **The boundary is a design decision.** The business determines which invariants exist. The designer determines which of them fall inside one boundary, where they are cheap, and which fall across boundaries, where they must be negotiated.
- **The premises are not universal.** Helland's argument is conditional on scale. Vernon's rules optimise for contention and scalability. A registry with a single PostgreSQL database and a few hundred assessors does not satisfy the premise. Part C develops this.

### What this obliges

For every invariant that reads more than one entity, the design states whether the entities share a boundary. If they do not, it states what is true during the interval in which they disagree.

---

## A.4 Concurrent actors

### Business reading

Two clerks take the same file from the cabinet at the same moment. Each reads it, each decides on what was read, each writes a decision. Both followed the procedure. The result is one neither would have produced alone.

Paper offices solved this long ago: a sign-out card in the cabinet, a single counter where requests queue, a rule that the later entry in the register yields to the earlier.

### Technical reading

`[P]` The pattern is **read-then-act** (also check-then-act): read a condition, decide, write. Between the read and the write the condition may cease to hold.

`[T]` The correctness conditions are well defined. **Serializability** requires that concurrent transactions produce a result equal to some serial order. **Linearizability** (Herlihy and Wing 1990) requires that each operation appear to take effect at a single instant between its invocation and its response.

`[T]` Berenson et al. (1995) showed that the widely implemented **snapshot isolation** is weaker than serializability and permits an anomaly called **write skew**: two transactions each read data the other writes, each writes something different, and both commit. Neither overwrote the other, so no lost-update check fires.

Write skew is precisely the shape of a cross-entity guard.

> **Technical box — write skew in the case**
>
> ```sql
> -- T1: declarant submits a new version
> SELECT count(*) FROM protocol
>  WHERE declaration_id = :d AND status <> 'Kinnitatud';   -- 0
> UPDATE declaration SET status = 'Esitatud', version = version + 1
>  WHERE id = :d;
>
> -- T2: assessor starts a protocol, concurrently
> SELECT status, version FROM declaration WHERE id = :d;    -- 'Esitatud', v
> INSERT INTO protocol (declaration_id, declaration_version, status)
> VALUES (:d, :v, 'Koostamisel');
> ```
>
> Under PostgreSQL's default `READ COMMITTED`, and under `REPEATABLE READ` (which is snapshot isolation), both commit. The protocol now refers to a version the declarant has replaced. Under `SERIALIZABLE` (serializable snapshot isolation; Cahill et al. 2008), one transaction fails with SQLSTATE `40001` and must be retried.
>
> The same shape arises in an event store with per-stream optimistic concurrency: each append checks only its own stream's expected version.

`[T]` 008 Part D gives the deeper reason. In Herlihy's hierarchy a plain read/write register cannot solve consensus between even two processes, while compare-and-swap can for any number. Read-then-act is built from reads and writes. It is not a coordination primitive, and no amount of care in the "act" repairs that.

### What this obliges

For every guard that reads another entity, the requirement states the outcome when the guard's subject changes at the same moment. The design states which mechanism makes "the same moment" well defined.

---

## A.5 Time

### Business reading

An offer lapses after 30 days. Nobody does anything; the world changes anyway. Four questions decide what "after 30 days" means, and legal practice has names for all of them.

| Question | Legal analogue |
|---|---|
| From when? | The date of service, not the date of signing |
| In what unit? | Calendar days, working days, "by end of the day" |
| What restarts it? | Interruption of a limitation period: the clock goes back to zero |
| What pauses it? | Suspension (tolling): the clock stops and later resumes where it was |

Restarting and pausing are different rules with different consequences. Requirements that say "the period is extended" without choosing are incomplete.

### Technical reading

`[T]` Alur and Dill (1994) define a **timed automaton**: a finite automaton extended with real-valued **clocks**. All clocks advance at the same rate. A transition may carry a **clock constraint** as a guard and may **reset** clocks to zero. Later formulations add **location invariants**: a condition on clocks that must hold while the automaton stays in a state, which forces it to leave in time.

The formalism makes the four business questions unavoidable: a clock has a reset point, a constraint has a constant in a unit, resets are explicit per transition, and all clocks always run.

`[T]` That last property is significant. A clock that can be *paused* is a **stopwatch**, and automata with stopwatches are strictly more powerful: reachability, decidable for timed automata, becomes undecidable in general (Henzinger et al. 1998). `[S]` This does not make a paused clock hard to implement. It indicates that "pause" is a materially larger requirement than "restart", harder to analyse exhaustively, and worth a deliberate decision. Open decision O2 of the case is exactly this choice.

`[S]` A **deadline is a fact; a timer is a mechanism.** The deadline is a value computed from recorded facts: start instant plus duration, under a calendar. Whether it has passed is a guard that can be evaluated whenever a decision is made. A timer is a device for waking the system so that something happens without a command. 008 shows that the device may fire late, twice or not at all. A model in which correctness depends on the timer firing has confused the two. A model in which every command re-evaluates the deadline, and the timer merely prompts, is robust to all three failures.

### What this obliges

Every time rule states start event, unit and calendar, reset events, pause events (or their absence), and what the entity does when a command arrives after the deadline but before any timer has fired.

---

## A.6 Permissions and their combination

### Business reading

A bank account can carry several holds at once: one from the bank's fraud department, one from a court order, one from the tax authority. Each was placed by its own source for its own reason, and each is lifted only by that source. The account is usable when none remains. Nobody at the bank would implement this as a single "blocked: yes/no" tick-box, because the first source to lift its hold would unblock the account for all.

### Technical reading

`[T]` XACML 3.0 (OASIS 2013) standardises how several independent rules about one request are combined. A rule yields *Permit*, *Deny*, *NotApplicable* or *Indeterminate*. A **combining algorithm** reduces many results to one:

| Algorithm | Result |
|---|---|
| Deny-overrides | Any Deny wins |
| Permit-overrides | Any Permit wins |
| First-applicable | The first rule that applies decides; order matters |
| Only-one-applicable | Exactly one policy may apply; more is an error |
| Deny-unless-permit | Deny unless some rule permits; never NotApplicable |
| Permit-unless-deny | Permit unless some rule denies |

`[S]` The bank's holds are deny-overrides over a set keyed by source. This gives a distinction used throughout Parts B and D.

- An entity's **intrinsic lifecycle** is what its own history makes possible (A.1).
- **Extrinsic constraints** are placed on it by other parties, are identified by their source, and are combined by a stated algorithm.

Mixing the two, by turning each external constraint into a lifecycle state, produces both the state explosion of A.1 and the lost-lock defect of Part B (issue 8).

009 describes the separation of the point that enforces a decision (PEP) from the point that makes it (PDP). The combining algorithm is the part of the decision that requirements most often leave unstated.

### What this obliges

Wherever more than one party can block or allow an action, the requirement names the sources, states who may lift what, and names the combining rule.

---

## A.7 Process soundness

### Business reading

A well-designed procedure has three properties. Every case that starts can finish. When a case is finished, nothing is left hanging: no open sub-task, no unanswered request. And every step in the manual can actually occur in some case. A procedure lacking the first has cases that sit forever. One lacking the second closes cases with loose ends. One lacking the third contains dead text.

### Technical reading

`[T]` Van der Aalst (1997, 1998) models a procedure as a **workflow net**: a Petri net (Petri 1962) with one start place, one end place, and every node on a path between them. He defines **soundness**:

1. **Option to complete.** From every state reachable from the start, the end is reachable.
2. **Proper completion.** When the end is reached, no work remains elsewhere in the net.
3. **No dead transitions.** Every step can occur in at least one run.

`[T]` Soundness of a workflow net is decidable: it is equivalent to the net, with end connected back to start, being live and bounded.

In the case, "checking left unfinished" with no exit violates option to complete. A draft that survives the confirmation of the protocol (O3) is a candidate violation of proper completion.

**Limit.** `[T]` Classical soundness abstracts from data and from time. A net can be sound as drawn and unsound once guards on data are considered, because a guard may make a necessary branch unreachable. Part E returns to this.

### What this obliges

Each entity's lifecycle, and each multi-entity process, is checked against the three properties. Every non-final state has at least one exit that does not depend on a single party's goodwill.

---

## A.8 Which invariants need coordination at all

### Business reading

Some rules can be kept by each clerk alone. "Every assessment refers to an existing protocol": a clerk who checks this before writing cannot be made wrong by a colleague, provided protocols are never destroyed. Other rules can only be broken by two people acting together. "At most one open protocol per declaration": each clerk checks, each sees none, each opens one. No amount of individual diligence prevents this. Only rules of the second kind need a sign-out card.

### Technical reading

`[T]` Bailis et al. (2014) make this exact. A set of operations is **invariant confluent** with respect to an invariant if, whenever two copies of the data diverge through operations that each preserve the invariant locally, merging them yields a state that still satisfies it. Their result: invariant confluence is necessary and sufficient for the operations to run without coordination while preserving the invariant.

| Invariant | Operations | Confluent? |
|---|---|---|
| A reference points to an existing record | Insert only | Yes |
| A reference points to an existing record | Insert and delete | No |
| A counter stays ≥ 0 | Increment only | Yes |
| A counter stays ≥ 0 | Decrement | No |
| A value is unique | Insert with chosen value | No |
| At most one open protocol per declaration | Start protocol | No |

`[T]` The related CALM theorem (Hellerstein and Alvaro 2020) states that the programs with a consistent coordination-free implementation are exactly the monotonic ones: those whose conclusions are never retracted by further input.

`[S]` This is the theoretical ground of the over-engineering test in Part C. Coordination machinery is justified by the presence of a non-confluent invariant, and by nothing else. Conversely, a non-confluent invariant without coordination is a defect regardless of how unlikely the collision seems.

**Limit.** The theory describes when coordination is *avoidable*. On a single serializable store, coordination is supplied by the store, and the cost appears as aborts and waiting, not as design complexity.

### What this obliges

Each invariant on the list is marked as keepable by one actor alone or breakable only jointly. Only the second group enters the coordination design.

---

## A.9 The business side

### The problems predate the software

`[S]` Each class of Part 0 had a paper solution before it had a technical name. The correspondences below are this article's alignment; the individual mechanisms are common practice `[P]` and the technical sources are cited `[T]`.

| Paper or institutional mechanism | Technical counterpart | Source |
|---|---|---|
| Escrow: value set aside with a third party until conditions are met | Reservation; escrow transactional method | O'Neil 1986 |
| Bank hold on funds | Hold with a release condition | A.6 |
| Lien registered against a property | Constraint keyed by source | A.6 |
| Legal hold on documents | Deny-overrides constraint | XACML 3.0 |
| A search of the land register that reserves priority for a fixed period | Lease: a lock that expires | Gray & Cheriton 1989 |
| Airline overbooking with compensation | Guess, then apologise | Helland & Campbell 2009 |
| "Subject to contract" | Tentative operation, later confirmed or cancelled | Helland 2007 |
| Limitation period with suspension | Stopwatch clock | A.5 |

`[T]` Brooks (1986) distinguishes **essential** complexity, inherent in the problem, from **accidental** complexity, introduced by the means of solving it. `[S]` The concurrency, the uncertainty and the time-dependence in this article are essential. They are present in the office with paper files. Software can add accidental complexity on top, and can hide the essential kind badly, but it cannot remove it.

### A race signals a missing concept

`[P]` Dahan (2010) argues that race conditions do not exist in the business: if a difference of microseconds changes the outcome, the requirements have failed to say what the business wants in that situation. His example is an order cancelled as it ships. The business does not want "whichever message arrived first"; it wants a rule, and usually a new concept: a cancellation *request* that may be refused once shipping has begun.

`[S]` The claim is a heuristic, and the title overstates it. Contention is real: there is one last seat, and two buyers. What disappears under analysis is the *undefined* outcome. The business concept that resolves it may simply be a priority rule ("first registered prevails"), but it must be stated, and the loser's experience must be designed. Open decision O4 is this.

### Uncertainty lives in business semantics

`[T]` Helland (2007) concludes that without distributed transactions, the handling of uncertainty cannot be hidden in infrastructure and must be expressed in the application's own terms: tentative operations, confirmations, cancellations. Helland and Campbell (2009) put it more sharply: a system has only **memories** (what it has seen), **guesses** (decisions made on partial knowledge) and **apologies** (what it does when a guess proves wrong).

`[S]` The condition matters again. Where one store holds everything a decision reads, the decision need not be a guess. Where it does not, or where a human-scale delay separates the read from the act (an assessor reads a declaration on Monday and judges on Thursday), the guess is unavoidable whatever the database. Long human think-time creates the distributed-system problem inside a single database.

---

## A.10 Why requirements written at the level of the screen fail

### Business reading

"The status column shows *Parandamisel*" describes what someone sees. It does not say whose status it is, who set it, what it permits, or what it is concluded from. Several different underlying situations could put the same word in that column. A developer given only the screen must invent the rest, and will invent it differently from the next developer.

### Technical reading

`[T]` Jackson (1995), and Zave and Jackson (1997), distinguish **requirements**, which are statements about the world the system is placed in, from **specifications**, which describe behaviour at the interface between system and world. A specification is correct only relative to requirements and to stated assumptions about the world.

`[S]` A screen-level statement is a specification with no requirement behind it. In the terms of this article it is a statement about a **projection**: a many-to-one mapping from the model to a display. The mapping cannot be inverted. From the display one cannot recover which entity owns the status (class 1), whether it is stored or derived (class 6), what guards it (class 2), or how it behaves under concurrency and time (classes 3 and 4). The per-assessor status in the case, which existed only as a display column, is the limiting example: a visible value with no model element underneath.

### What an analyst should describe instead

| Element | Form | Example from the case |
|---|---|---|
| **Entity** | A noun with identity and an owner | Protokoll, one per round of checking of one Deklaratsioon |
| **Fact** (event) | Past tense, with actor and time | "Assessor K recorded a judgement on version 3 at *t*" |
| **Command** | Imperative, with who may issue it | "Start protocol", by Kontrollija of the competent authority |
| **Guard** | A condition on facts, per command | "Only if the declaration has a submitted version" |
| **Invariant** | "Never" or "always", with the entities it reads | "Never two unconfirmed protocols for one declaration" |
| **Time rule** | Start, unit, reset, pause, consequence | "90 calendar days from the fact *submitted*; …" |
| **Derived status** | A function from facts to one value, total and single-valued | "Checking status of a declaration = …" |
| **Display** | A mapping from the above to labels | Last, and separately |

`[S]` The display comes last because it is the only element that can be changed without changing the system's behaviour.

---

## Summary of Part A

| Class (Part 0) | Theory | What must be stated |
|---|---|---|
| 1 Single-entity lifecycle | Automata, statecharts; workflow-net soundness | What each state accepts; an exit from every non-final state |
| 2 Cross-entity invariant | Transactions, aggregates, invariant confluence | Which entities each rule reads; whether they share a boundary |
| 3 Concurrent actors | Serializability, linearizability, write skew | The outcome of simultaneous action; the loser's experience |
| 4 Time-driven transition | Timed automata; safety versus liveness | Start, unit, reset, pause, consequence |
| 5 Multi-party coordination | Workflow nets; sagas (Part D3) | Every partially completed condition and its way out |
| 6 Derived versus stored | Functions and projections | A total, single-valued definition, or a recorded fact; never both |
| 7 Conflicting permissions | Combining algorithms | Sources, who lifts what, the combining rule |

---

## Glossary (Part A)

| Term | Definition |
|---|---|
| Activity (Helland) | The state one entity keeps about its dealings with one partner |
| Aggregate | A cluster of objects changed as a unit, accessed through a root (Evans) |
| Clock | In a timed automaton, a real-valued variable that advances with time and can be reset |
| Combining algorithm | A rule reducing several permit/deny results to one |
| Control state | The part of an entity's state that decides which transitions exist |
| Deadline | A point in time computed from recorded facts |
| Essential / accidental complexity | Inherent in the problem / introduced by the solution (Brooks) |
| Extended state | Variables that parameterise guards without changing which transitions exist |
| Extrinsic constraint | A restriction placed on an entity by another party, identified by its source |
| Fairness | The assumption that an action which stays possible is eventually taken |
| Intrinsic lifecycle | What an entity's own history makes possible |
| Invariant confluence | Property that merging independently valid states stays valid (Bailis et al.) |
| Linearizability | Each operation appears to take effect at one instant between call and return |
| Liveness property | "Something good eventually happens"; not refutable by a finite observation |
| Orthogonal regions | Independent parts of a statechart, each in one state at a time |
| Projection | A many-to-one mapping from model to display or read model |
| Read-then-act | Read a condition, decide, write; the condition may change in between |
| Requirement / specification | Statement about the world / about behaviour at the system's interface (Jackson) |
| Safety property | "Something bad never happens"; violated at a definite point |
| Serializability | Concurrent transactions give a result equal to some serial order |
| Snapshot isolation | Each transaction reads a consistent snapshot; permits write skew |
| Soundness | Option to complete, proper completion, no dead transitions (van der Aalst) |
| State | A class of an entity's histories indistinguishable by any future interaction |
| Statechart | Automaton with hierarchy, orthogonality and history (Harel) |
| Stopwatch | A clock that can be paused and resumed |
| Timed automaton | Finite automaton with clocks, clock guards and resets (Alur & Dill) |
| Timer | A mechanism that wakes the system; may fire late, twice or never |
| Workflow net | A Petri net with one start, one end, and every node on a path between them |
| Write skew | Two transactions each read what the other writes; both commit; the joint result is invalid |
