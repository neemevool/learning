# 012 — Interacting Entities: State, Invariants, Coordination and Time

## Part B1 — Catalogue of Issues: Modelling Defects

Part B is a catalogue of defects that recur in requirements and designs for interacting entities. B1 covers defects that are visible in the model of a single moment: where a status lives, how it is defined, what shape the lifecycle has. B2 covers defects that appear only when entities act on each other, concurrently and over time.

Issue numbers 1–16 are fixed and used throughout the article; 17 and 18 are additions. B1 treats issues 1, 2, 3, 18, then 5, 11, 12, 17, then 10.

Each issue has the same seven fields.

| Field | Content |
|---|---|
| **Symptom** | How it looks in a requirements document |
| **Business reading** | What is wrong, in domain terms |
| **Technical reading** | What is wrong, precisely |
| **Name and source** | The established name, if there is one, with provenance tag |
| **Detection heuristic** | A test an analyst can apply without technical knowledge |
| **Resolution options** | Alternatives, with trade-offs |
| **In the case** | Where it occurs in the worked example |

Where no established name exists, the field says so. Inventing a name and presenting it as canonical would be a defect of this article.

---

# Group I — Placement and definition

## Issue 1 — Category error: a state attached to the wrong entity

**Symptom.** A status is listed among the statuses of entity X, but the sentences that describe its effects are all about entity Y. "The protocol is in status *Parandamisel*; in this status the declarant can edit the declaration."

**Business reading.** A building inspector writes "defects found" in the inspection report. What changes as a result is the *building's* situation: it may not be occupied until the defects are remedied. If the rule "may not be occupied" is attached to the report, then two reports can disagree about one building, and archiving a report appears to make the building habitable.

**Technical reading.** By A.1, a state is defined by what an entity accepts. A status whose only effects are on the commands accepted by another entity is, by definition, a state of that other entity. Placing it elsewhere has two consequences:

- The owning entity must read another entity's state to decide what it accepts. This is a cross-entity guard (issue 7) that did not need to exist.
- If the holder is one of many (several protocols per declaration), the status is multi-valued for the entity it actually governs.

> **Technical box — the same defect as a dependency error**
>
> In relational terms, "can the declaration be edited" is functionally dependent on the declaration's key. Stored on a row keyed by protocol, it depends on only part of the information that identifies that row's subject. Codd's normal forms exist to remove exactly this: a fact stored under a key it does not depend on can be recorded inconsistently.

**Name and source.** No single canonical name. `[T]` The relational formulation is Codd's normalisation (1971). `[P]` In domain-driven design it is a misplaced responsibility across an aggregate boundary. `[S]` "Category error" is this article's label.

**Detection heuristic.** Two questions.

1. *Whose permitted actions change when this status is entered?* That entity owns it.
2. *If there were two of the holder, could they show different values, and would that make sense?* If two protocols could disagree about whether the declaration is under correction, and the business says that is meaningless, the status is on the wrong entity.

**Resolution options.**

| Option | Consequence |
|---|---|
| Move the state to the entity it governs; leave a *fact* on the original ("assessor requested correction") | Clean ownership. Requires a defined link from fact to state change: who or what moves the declaration (issue 17) |
| Keep nothing on the governed entity; derive its condition from the others' facts | No duplication, but the derivation must be a function (issue 3) and every command on the governed entity becomes a cross-entity read (issue 7) |
| Keep the state where it is and accept a cross-entity guard | Cheapest to write down; pays later under concurrency and fan-out |

**In the case.** *Parandamisel* was placed on the Protokoll. Its effects (the declarant may edit and resubmit) are on the Deklaratsioon. The evolved model moves it there and leaves *Parandamisele* ("sent for correction") on the protocol as the record of what the protocol did.

---

## Issue 2 — Duplicated or conflicting definitions; one name with several homes

**Symptom.** The same status name appears in two sections with different conditions. Or two attribute names turn out to mean the same thing. Or a name is used for two entities without qualification.

**Business reading.** A contract that defines "Completion Date" in clause 1 and again, differently, in clause 14 will be litigated. Legal drafting has a strict convention for this reason: each defined term is defined once, and used with a capital letter everywhere else.

**Technical reading.** Two distinct defects hide here.

- **Synonym**: one concept, two names or two definitions. Implementations will pick different ones.
- **Homonym**: one name, two concepts. This is harmless when the name is always qualified by its entity (a declaration *Koostamisel*, a protocol *Koostamisel*) and harmful when it is not.

**Name and source.** `[T]` Evans (2003): the *ubiquitous language*, in which each term has one meaning within a bounded context. `[P]` Single source of truth. `[P]` Synonyms and homonyms are standard terms in data modelling and schema integration.

**Detection heuristic.** Build an index: every status name, with every place it is defined or given a condition. Then:

- a name with more than one definition is a synonym candidate or a contradiction;
- a definition that appears under more than one name is a synonym;
- a name attached to more than one entity is a homonym and must always be written with its entity.

**Resolution options.**

| Option | Consequence |
|---|---|
| One definition; every other mention refers to it | The standard remedy |
| If the two definitions differ on purpose, they are two concepts: give two names | Reveals a distinction that was hidden |
| Qualify homonyms by entity in every sentence | Wordier, unambiguous |

**In the case.** *Kontrollitud* was defined twice under two attribute names: a synonym, and the two definitions were not identical. *Koostamisel* is a homonym across Deklaratsioon and Protokoll: acceptable, provided it is never written bare.

---

## Issue 3 — A derived status that is not a function

**Symptom.** A parent's status is defined by a list of sentences of the form "if there exists a child in state A, the status is X". Several sentences can be true at once. For some combinations none is.

**Business reading.** "A shipment is *delayed* if any parcel is late. A shipment is *delivered* if any parcel has arrived." With one parcel late and one arrived, the shipment is both. With no parcels, it is neither. The author imagined one parcel.

**Technical reading.** A derived status is a mapping from the facts to a value. To be usable it must be a **function**:

- **total** — every possible combination of inputs yields a value, including the empty combination;
- **single-valued** — no combination yields two.

Rules written with existential quantifiers ("there exists a child such that…") overlap as soon as children can be in different states. The input is not one child state. It is a *collection* of child states, and the definition must cover every collection.

> **Technical box — a construction that is a function by design**
>
> Order the child states by precedence, for example `Kinnitatud < Koostamisel < Parandamisele`. Define the parent's value as the maximum over its children, with a stated value for "no children".
>
> ```csharp
> static CheckStatus Derive(IEnumerable<ProtocolStatus> protocols) =>
>     protocols.Select(Rank).DefaultIfEmpty(Rank.None).Max() switch
>     {
>         Rank.None           => CheckStatus.NotStarted,
>         Rank.Confirmed      => CheckStatus.Checked,
>         Rank.Drafting       => CheckStatus.InProgress,
>         Rank.ToCorrection   => CheckStatus.UnderCorrection,
>     };
> ```
>
> A maximum is commutative, associative and idempotent, so the result does not depend on the order in which children are examined or on duplicates. It is total once the empty case is given. Whether this particular order is the *right* one is a business decision; the construction only guarantees that some definite answer exists.

**Name and source.** `[T]` Totality and single-valuedness are the definition of a function. `[T]` In decision modelling the same properties are *completeness* and *consistency* of a decision table; the OMG's DMN standard makes the author declare a **hit policy** (Unique, Any, Priority, First, and multi-hit variants) precisely so that overlap is either forbidden or resolved. `[T]` In statecharts, guards on transitions leaving one state on one trigger must be mutually exclusive.

**Detection heuristic.** Write the table. Rows: no children; one child in each state; two children in every pair of different states. For each row, read off the value from the rules. Any row with no value or with two is a defect. Seven or eight rows suffice to expose nearly every case.

**Resolution options.**

| Option | Consequence |
|---|---|
| State a precedence among the rules (first-applicable, or the maximum construction) | Minimal change. The precedence is a business decision and must be owned |
| Rewrite with partitions: *all* children, *some but not all*, *none* | Explicit and total; grows with the number of child states |
| Define the status on one designated child (the "current" protocol) | Simple, but "current" must itself be a function |
| Stop deriving: record the status as a fact on the parent | Removes the problem and creates a recorded decision. See issues 1 and 18 |

**In the case.** The declaration-level assessment status was derived from protocol states by overlapping predicates that did not cover every combination. With one protocol *Kinnitatud* and a later one *Koostamisel*, two rules applied.

---

## Issue 18 — A stored status that can disagree with the facts it summarises

**Symptom.** A status is described twice in different grammatical moods: once as something that *is the case when* certain conditions hold, and once as something that *is set* by an action.

**Business reading.** A customer file carries a stamp "CREDITWORTHY". The stamp was applied last spring. The ledger since then says otherwise. Which governs? If the stamp is a conclusion from the ledger, it is out of date. If it is the credit committee's decision, then the ledger is merely evidence and the stamp stands until the committee revisits it. Both are legitimate designs. A design that has not chosen is not.

**Technical reading.** A status is either **derived** (a function of other recorded facts, issue 3) or **recorded** (itself a fact, with an actor and a time). A status that is both has two sources of truth and an unstated rule for when they differ.

**Name and source.** `[T]` Update anomaly from redundancy (Codd). `[P]` In event-sourced systems: confusion between a projection and the source of truth. `[P]` Cache invalidation.

**Detection heuristic.** Ask one question of every status: *if this value and the underlying facts disagree, which is right?*

- "The facts": it is derived. It must have no command that sets it.
- "The status": it is a recorded decision. It must have an actor, and the facts are its evidence, not its definition.
- "They cannot disagree": ask what makes that so.

**Resolution options.**

| Option | Fits when | Cost |
|---|---|---|
| Derive on every read | The function is cheap and the facts are at hand | None in correctness; some in query design |
| Record as a decision | Someone is accountable for the value, or it must survive changes in the facts | Needs an actor, a transition and a rule for revisiting |
| Store a derived copy for speed, declared as such | Reads dominate | A stated staleness bound and a rebuild procedure; the copy is never read by a guard |

`[S]` The third option is ordinary engineering. The defect is only in not declaring it: a stored copy that guards read as if it were the truth turns a performance decision into a correctness risk.

**In the case.** *Kontrollitud* on the declaration: is it concluded from "the protocol is confirmed", or is it a recorded outcome? The evolved model makes it a terminal state of the Deklaratsioon, which commits to *recorded*. The per-assessor status, which existed only as a display column, is the opposite failure: a value with neither a definition nor a record.

---

# Group II — The shape of the lifecycle

## Issue 5 — Dead states and missing exits

**Symptom.** A status is described by how it is entered and never by how it is left. Elsewhere, a rule makes progress conditional on that status not being present.

**Business reading.** A case file marked "awaiting information" with no rule for what happens if the information never comes. Individually harmless. Combined with "no new case may be opened while one is pending", it blocks the citizen permanently.

**Technical reading.** A violation of soundness (A.7): from some reachable state, no final state is reachable (*option to complete* fails). Two variants should be distinguished.

- **Trap state**: no outgoing transition at all.
- **Hostage state**: outgoing transitions exist, but all are controlled by one party who has no obligation and no deadline. Formally the state has an exit; in terms of A.2 the liveness of the process rests on an unfounded fairness assumption.

**Name and source.** `[T]` Soundness of workflow nets (van der Aalst 1997). `[T]` Deadlock, in concurrency theory. `[S]` "Hostage state" is this article's term.

**Detection heuristic.** For each state that is not declared final, list every way out, and beside each write who or what causes it. Then:

- no exits: trap;
- every exit caused by the same single party, with no time-driven alternative: hostage;
- also check the reverse: is every state reachable from the start at all?

**Resolution options.**

| Option | Consequence |
|---|---|
| Add an explicit exit: resume, reassign, annul | Each new transition needs an actor and a guard |
| Add a time-driven exit | Sound only if the state it leads to has exits of its own (see the Preface: a timer does not repair a missing exit) |
| Remove the state: it was an observation, not a state (issue 11) | Often the correct answer |
| Relax the rule that the state blocks | Changes an invariant; a business decision |

**In the case.** *Kontroll jäi pooleli* arose after 14 days without change and had no exit. With "a new protocol only if none is unconfirmed", the declaration could never again be checked. The fault lies in the pair. Either the state needed an exit or the blocking rule needed an exception.

---

## Issue 11 — History encoded as state

**Symptom.** Two statuses whose descriptions of what is permitted are identical. The names differ by a reason: "…after return", "…expired", "…left unfinished", "re-…".

**Business reading.** A library book is "on loan" or "on loan (renewed)". The borrower may do the same things in both. The second records an event in the book's past. That event may matter, for a renewal limit, but then the thing to record is the *count of renewals*, and the rule should mention the count.

**Technical reading.** By A.1 two states with identical future behaviour are one state. The distinguishing information is history, and history belongs in data: an attribute, a timestamp, or in an event-sourced system simply the events already recorded.

**Name and source.** `[T]` Equivalent states in the sense of Moore and Nerode. `[T]` Harel's history construct exists so that "where we were" need not be flattened into extra states. `[S]` The label is this article's.

**Detection heuristic.** Build the capability matrix (Part E): one row per state, one column per command, each cell *accepted* or *refused*. Two identical rows are one state. A quicker screen: look for status names that contain a reason or a past participle.

**A necessary caution.** Identical rows today may be intended to differ tomorrow. If the business means the "unfinished" protocol to be reassignable while an ordinary one is not, the rows are not identical and the state is real. The requirement must then say so. The defect is a state with no stated behavioural difference, not a state as such.

**Resolution options.**

| Option | Consequence |
|---|---|
| Merge the states; record the reason as an attribute or rely on the event | Smaller model; the reason remains available to reports |
| Replace with a derived indicator ("no change for 14 days") | Nothing to store or to exit from; it is class 6, and must be a function |
| Keep the state and write down what differs | Legitimate when a difference exists |

**In the case.** *Kontroll jäi pooleli* is both this issue and issue 5. "Fourteen days without change" is an observation computable from the last recorded fact. As an indicator it needs no exit, because it is not a state. As a state it needed one and had none.

---

## Issue 12 — Flat enumerations versus orthogonal regions

**Symptom.** A long status list in which names are conjunctions or carry suffixes: "Submitted – under check", "Submitted – corrected – public". Each new requirement adds several statuses. The same transition ("withdraw") is drawn from many states.

**Business reading.** A person is employed or not, resident or not, insured or not. No office keeps a single list of eight "person statuses". Each fact is kept by its own register, and they vary independently.

**Technical reading.** Independent aspects multiply when flattened: *n* aspects of *k* values give *kⁿ* combined states and a comparable multiplication of transitions (A.1). Harel's **orthogonal regions** keep the aspects separate: the entity is in one state per region.

The declaration has at least three candidate aspects:

| Aspect | Values (illustrative) |
|---|---|
| Drafting | no working copy / working copy open |
| Publication | nothing public / version *n* public |
| Checking | not started / in progress / under correction / checked |

**Name and source.** `[T]` State explosion; orthogonality (Harel 1987).

**Detection heuristic.** Take any two statuses and ask: *can both be true of the same thing at the same time?* If the natural answer is yes, they are values in different regions and should not be in one list. A second test: *does a change in one leave the other untouched?*

**Resolution options.**

| Option | Consequence |
|---|---|
| Orthogonal regions within the entity | Linear growth. Cross-region guards must be listed explicitly |
| Move an aspect to another entity that already has its own lifecycle | Often right for checking: the Protokoll exists. Introduces a cross-entity dependency (B2) |
| Model an aspect as an extrinsic constraint (a hold) | Right when the aspect is imposed by another party. Part D1 |
| Keep the flat list | Reasonable for a small entity with dependent aspects. Part C gives the test |

**Limit.** `[S]` Regions are only as good as their independence. If nearly every transition in one region is guarded by the state of another, the aspects are not orthogonal and the regions merely hide a flat machine. A handful of cross-guards is normal; a guard on every transition is a signal.

**In the case.** The evolved model adds *Parandamisel* and *Kontrollitud* to the declaration's list alongside *Koostamisel* and *Esitatud*. Whether "under correction" is a lifecycle state, a value in a checking region, or a hold placed by the protocol is examined in Part D1. The choice determines how O2 and O3 can be answered.

---

## Issue 17 — A transition with no stated cause

**Symptom.** The passive voice. "The protocol is confirmed." "The status becomes *Kontrollitud*." "The declaration is returned for correction."

**Business reading.** In a procedure manual every step has someone who performs it. "The application is approved" is not a step. "The head of department approves the application" is. Where no person acts, the manual says what does: "on the thirtieth day the application lapses."

**Technical reading.** A transition has a trigger. There are exactly three kinds, and each places the transition in a different problem class.

| Cause | Form | Consequences |
|---|---|---|
| **Command** from an actor | "Kontrollija confirms" | Needs authorisation; can race with other commands (class 3) |
| **Reaction** to a fact recorded elsewhere | "when the last assessment is recorded" | Needs a statement of whether the reaction is in the same atomic step or follows later; if later, there is a visible interval |
| **Time** | "14 days after the last change" | Needs everything in A.5 |

A transition with no stated cause leaves all of these open, and usually conceals a decision about *authority*: someone meant "automatically", someone else read "by the supervisor".

**Name and source.** `[T]` In statecharts and UML state machines every transition is labelled *trigger [guard] / effect*; a transition with no trigger is a *completion transition*, taken when the source state's internal activity finishes, which is itself a defined cause. `[S]` As a requirements defect it has no established name.

**Detection heuristic.** Scan for passive verbs attached to statuses. Then fill the *actor* column of the transition table (Part E). An empty cell is a defect. "The system" is not an answer; "the system, upon fact F" is.

**Resolution options.**

| Option | Consequence |
|---|---|
| Name an actor and make it a command | A person is accountable; the transition waits for them (issue 5) |
| Name the fact it reacts to, and say *immediately* or *subsequently* | No human delay. "Subsequently" creates an intermediate condition that must be described |
| Name a time rule | See issue 6 in B2 |

**In the case.** "Starting a Protokoll locks submission" is a reaction: the declaration's behaviour changes because of a fact about a protocol. Whether that happens in the same step or afterwards is what decides the outcome of O4. Likewise the gates of O1: "the protocol becomes *Kinnitatud*" on the first assessor's judgement, on the last, or on a separate act of confirmation?

---

# Group III — Versions and judgements

## Issue 10 — Binding judgements to document versions

**Symptom.** "The assessor assesses the declaration." Elsewhere: "the declarant may edit the declaration."

**Business reading.** A signature on a contract is a signature on *that text*. An auditor's opinion is on the accounts *as at* a date. A notarised copy certifies one document. Nobody supposes that an opinion follows the document through later amendments. Paper makes this hard to get wrong, because the signed sheet physically is the version. Software makes it easy to get wrong, because "the declaration" is a single row that changes.

**Technical reading.** A judgement is a fact about a pair *(entity, version)*, not about an entity. Recording it against the entity alone creates three exposure intervals, and a requirement must speak to each.

| Interval | Question |
|---|---|
| Before the assessor opens the subject | Which version is offered for judgement? |
| Between opening and recording the judgement | If the subject changes meanwhile, is the judgement accepted, rejected, or accepted as a judgement of the older version? |
| After recording | If the subject changes later, does the judgement stand, lapse, or need reaffirming? |

The middle interval is the human-timescale read-then-act of A.9: the assessor reads on Monday and judges on Thursday.

**Name and source.** `[T]` Optimistic concurrency control: validate at write time that what was read is still current (Kung and Robinson 1981). `[P]` Version stamps; in event stores, the *expected version* of a stream. `[S]` The three-interval formulation is this article's.

**Detection heuristic.** For every approval, opinion, signature or assessment, ask: *of what, exactly?* Then ask whether that thing can change during each of the three intervals.

**Resolution options.**

| Option | Business-visible consequence | Technical consequence |
|---|---|---|
| **Freeze the subject** while it is being judged | The author cannot work during assessment; delay by the assessor becomes the author's cost | A lock: issues 8 and 9 apply |
| **Bind to version; the subject moves on freely** | Judgements of superseded versions remain as history; assessors may judge something already replaced | The judgement carries the version; a rule says what a superseded judgement counts for |
| **Bind to version; a change invalidates open judgements** | Assessors' work can be discarded by the author's action | A fan-out from one change to many judgements (issue 4) |
| **Bind to version; require reaffirmation** | Assessors are asked to confirm against the new version | An extra step and a new waiting condition |

None of these is correct in general. The first favours the assessor's certainty, the second the author's freedom, the third the currency of judgements, the fourth their continuity.

**In the case.** The declarant may edit voluntarily for 90 days while the public sees the last submitted version. There are therefore already two versions in play before any assessor appears: the working copy and the submitted one. The evolved model chooses the first option ("starting a Protokoll locks submission"), which is why O2 (what an idle lock does to the 90-day window) and O3 (drafts trapped by confirmation) arise. They are the price of that option, not separate accidents.

---

# Rules that emerge from B1

These are this article's synthesis `[S]`. Each is stated with the theory that supports it.

| Rule | Statement | Support | Issues |
|---|---|---|---|
| **R1** | A state belongs to an entity if and only if it changes what that entity accepts | Moore 1956, Nerode 1958 (A.1) | 1, 11 |
| **R2** | A status has one home and one definition | Evans 2003; Codd 1971 | 2 |
| **R3** | A derived status is a total, single-valued function of recorded facts. A status is derived or recorded, never both | Definition of a function; DMN hit policies | 3, 18 |
| **R4** | Every non-final state has an exit that does not rest on one party's goodwill | van der Aalst 1997; Alpern & Schneider 1985 (A.2, A.7) | 5 |
| **R5** | Every transition names its cause: a command with its actor, a fact, or a time rule | Statechart transition labels | 17 |
| **R6** | Independent aspects are modelled independently | Harel 1987 | 12 |
| **R7** | A judgement is a fact about a version | Kung & Robinson 1981 | 10 |

**Limit.** These rules detect defects in a model. They do not choose between sound models. R1 says where *Parandamisel* cannot live; it does not say whether the first assessor or all assessors put the declaration there.

## Summary of B1

| # | Issue | One-line test |
|---|---|---|
| 1 | State on the wrong entity | Whose permitted actions change? |
| 2 | Duplicate or conflicting definitions | Does each term have exactly one definition? |
| 3 | Derived status not a function | Does the table of child combinations give exactly one value per row? |
| 18 | Stored status disagreeing with facts | If they differ, which is right? |
| 5 | Dead states, missing exits | Who or what causes each exit? |
| 11 | History encoded as state | Are two rows of the capability matrix identical? |
| 12 | Flat enumeration | Can two statuses hold at once? |
| 17 | Transition without cause | Is the actor column filled? |
| 10 | Judgement not bound to a version | A judgement of what, exactly? |

---

## Glossary (Part B1)

| Term | Definition |
|---|---|
| Capability matrix | A table of states against commands, each cell *accepted* or *refused* (built in Part E) |
| Category error | A state recorded on an entity other than the one whose behaviour it governs |
| Completion transition | A transition with no explicit trigger, taken when the source state's activity finishes |
| Derived status | A status that is a function of other recorded facts |
| Expected version | The version a writer believes current, checked when writing |
| Function (total, single-valued) | A mapping giving exactly one output for every possible input |
| Hit policy | In a decision table, the declared rule for what happens when several rows match |
| Homonym | One name used for two concepts |
| Hostage state | A state all of whose exits depend on one party with no obligation or deadline |
| Optimistic concurrency control | Proceed without locking; verify at write time that what was read is unchanged |
| Recorded status | A status that is itself a fact, with an actor and a time |
| Synonym | Two names or definitions for one concept |
| Trap state | A non-final state with no outgoing transition |
| Ubiquitous language | A vocabulary in which each term has one meaning within its context (Evans) |
| R1–R7 | The rules emerging from Part B1 |
