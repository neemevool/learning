# 012 — Interacting Entities: State, Invariants, Coordination and Time

## Part C — Over-Analysing versus Over-Engineering; Selection Parameters

Part B listed eighteen ways a model can be wrong. A reader could conclude that a correct system needs a mechanism for each. That conclusion is the subject of this Part, and it is false.

This Part separates two things that are routinely confused, examines the unstated premises of the literature Part A drew on, and gives a set of parameters by which a design can be justified or challenged. The evolution of a design over time, and the transition matrix between patterns, follow in Part D4, after the patterns themselves have been described.

---

## C.1 Two different excesses

### Business reading

A surveyor who examines the ground thoroughly before a garden shed is built has not built a cathedral. The survey costs a day and is then finished. If it finds nothing, that is a finding. The cathedral costs every year, in upkeep, for as long as it stands.

What must be avoided is the inference "the survey was thorough, therefore the foundations must be deep".

### Technical reading

`[S]` **Analysis** produces knowledge: a list of entities, invariants, questions, and the class of each problem. **Engineering** produces machinery: components, states, messages, tables, timers. They differ in the structure of their cost.

| | Analysis | Machinery |
|---|---|---|
| Cost is paid | Once | Continuously: built, tested, operated, explained to each new person |
| If wrong | Discarded | Must be removed, which is itself work, and may be a one-way door |
| Output if nothing is found | "No issue here", which is information | Not applicable |
| Failure mode of excess | Delay | Accidental complexity (Brooks 1986, A.9) |

Applying the eighteen issues of Part B to a four-state entity with one writer may return "does not apply" fourteen times. That is the catalogue working. The four remaining rows are where attention goes.

**Telling them apart.** Three questions.

1. *Did this step add a question for the business, or a component to the system?* The first is analysis.
2. *If it were deleted tomorrow, would anything run differently?* If not, it was analysis.
3. *Is the proposed mechanism justified by a named invariant and a named parameter value?* If it is justified only by the fact that an issue was identified, the slide from analysis to machinery has happened.

**The correct sequence** `[S]` from an identified issue to a mechanism has four steps, and most over-engineering skips the middle two.

| Step | Question | Source |
|---|---|---|
| 1 | Which invariant is at stake, and is it hard, overridable or advisory? | B2, issue 15 |
| 2 | Can each actor keep it alone, or can it only be broken jointly? | A.8, invariant confluence |
| 3 | What are the parameter values? | C.3 below |
| 4 | What is the cheapest mechanism that enforces it at those values? | Part D |

**Over-analysis is also real.** Its symptom is analysis that cannot change any decision. `[T]` Decision theory has a measure for this: the value of information is the difference it makes to the choice (Howard 1966). `[S]` The stopping rule follows: analysis stops when no remaining question could change the selection among the alternatives actually on the table.

The four combinations:

| | Light machinery | Heavy machinery |
|---|---|---|
| **Thorough analysis** | The target: know all eighteen, build for three | Defensible only if the parameters demand it |
| **Thin analysis** | Works until the first collision; then fails without explanation | The worst case: cost without understanding |

### YAGNI, and its boundary

`[P]` "You aren't going to need it", from Extreme Programming, advises against building for requirements that have not arrived. `[S]` It is sound advice about machinery, subject to two limits.

- It does not apply to understanding. Not *building* a hold set is a saving. Not *knowing* that a second lock source would break the boolean is a liability.
- It presumes that adding the thing later is cheap. Where the later change is a one-way door (Part D4), deferral has a price that must be estimated, not assumed to be zero.

---

## C.2 The premises the literature does not repeat

### Business reading

Advice written for a multinational bank with branches on every continent is not wrong for a village savings society, but much of it answers questions the society does not have. The society has one ledger. The advice about reconciling ledgers between continents can be read, understood, and set aside, as long as it is known *why* it does not apply and *what would make it apply*.

### Technical reading

Each source in Part A argued from a premise. The premise is usually stated once, in the original, and then lost as the guidance is repeated.

| Guidance | Source | Premise | When the premise fails |
|---|---|---|---|
| No transactions across entities; interact by messages; keep per-partner activity state | Helland 2007 `[T]` | The system must scale almost without limit; data may be repartitioned across machines at any time | With one store, a transaction across entities is available and is the stronger guarantee |
| One aggregate per transaction; small aggregates; reference by identity; eventual consistency between them | Vernon 2011 `[P]` | Contention and scalability matter; the store may be unable to transact across aggregates | With low contention and a transactional store, several aggregates may be changed together |
| Sagas: break a long transaction into steps with compensations | Garcia-Molina & Salem 1987 `[T]` | The transaction is *long-lived* and would hold locks too long | A short transaction needs no saga |
| Stream = aggregate = consistency boundary | Event-sourcing practice `[P]` | The event store offers optimistic concurrency per stream only | A store built on a relational database can append to several streams in one transaction (verify against the current version of the product) |
| Choose between consistency and availability | Brewer 2000; Gilbert & Lynch 2002 `[T]` | Replicas can be partitioned from each other | A single-node store has no replicas to disagree |
| Database per service | Microservice practice `[P]` | Teams must deploy and evolve independently | One team, one deployable: the premise is organisational and absent |

`[S]` **"One aggregate per transaction" is a scalability guideline, not a law of correctness.** For correctness, a serializable transaction over two aggregates is *stronger* than two transactions joined by a message: there is no interval of disagreement to describe. `[P]` Vernon's later book (2013, chapter 10) lists four reasons to break the rule: the convenience of the user interface, the lack of a technical mechanism for eventual consistency, global transactions, and query performance.

What a multi-aggregate transaction costs is something else:

| Cost | Nature |
|---|---|
| The two aggregates must live in one store | A constraint on topology |
| They contend: a long write to one delays the other | Throughput, at volume |
| Separating them later means introducing the interval of disagreement that was avoided | Evolution cost (Part D4) |
| The coupling is invisible in the domain model unless documented | Understanding |

None of these is a correctness cost. All are real.

### What a single store does not remove

`[S]` The opposite error is to conclude that one database dissolves the whole of Part B. It dissolves the problem at one scale only. From issue 7: the window between read and act exists at three scales. A single serializable store closes the smallest.

| Problem | Removed by a single linearizable store? |
|---|---|
| Write skew between two entities in one transaction (issue 7, smallest window) | Yes, at serializable isolation or with explicit locking |
| Need for messaging and outbox between internal entities (006) | Yes |
| Guards read from a lagging read model (issue 7, middle window) | No. A matter of where the guard reads |
| Human think-time: read Monday, act Thursday (issues 9, 10) | No. No transaction spans days |
| Fan-out scope and precedence (issue 4) | No. A matter of meaning |
| Time rules (issue 6) | No |
| Feature interaction (issue 16) | No |
| A second system: an external register, a portal, a notification service | No. The premise has become true |

The practical reading: a single store lets the designer ignore distribution at machine timescales. It leaves every problem that exists at human timescales, and those are the ones the business can see.

---

## C.3 Selection parameters

008 A.7 gave parameters for selecting a task-execution design. The same discipline applies here. A design for interacting entities is determined by the values of eight parameters. Seven are standard; the eighth is this article's addition, following A.9.

### The parameters and their ranges

| # | Parameter | Low | Middle | High |
|---|---|---|---|---|
| **P1** | External influencers on an entity: how many *kinds* of source can constrain it | One | A few, fixed | Open-ended; new kinds expected |
| **P2** | Instances per influencer: how many of one kind can be active at once | At most one, enforced | A small, bounded number | Unbounded |
| **P3** | Concurrent writers to an entity, or to entities linked by a rule | One at a time by nature | A few people | Many, or automated |
| **P4** | Store topology | One linearizable store, and guards read it | One store, but decisions read lagging copies | Several stores or external systems |
| **P5** | Business tolerance for visible intermediate states | None | Seconds | Days |
| **P6** | Reversibility of the actions being coordinated | Freely undone | Compensable at a cost | Irreversible: published, notified, legally effective |
| **P7** | Regulatory constraints | None | Audit trail | Statutory deadlines, accountable decision-maker, evidence of what was seen |
| **P8** | Duration of the longest hold `[S]` | Sub-second | Minutes | Days |

**Business reading.** Every one of these is a question about the business or its environment. None is a technology choice. An analyst can supply P1, P2, P3, P5, P6, P7 and P8 without knowing how the system will be built. P4 is the architect's.

### What each value justifies

`[S]` The table reads one way: a value in the right-hand part of a range *justifies* machinery; a value in the left-hand part *withdraws the justification*. It does not select a design mechanically, because the parameters interact.

| Parameter | At low values, sufficient | At high values, justified | Not justified by this parameter alone |
|---|---|---|---|
| P1 influencers | A lifecycle state or a boolean | A hold/grant set keyed by source (D1) | A policy engine |
| P2 instances | "The X" is well defined by invariant | Explicit fan-out rules; a set per source | A process manager |
| P3 writers | Any consistent mechanism | Small boundaries; avoidance of shared hot records | Distribution |
| P4 topology | Multi-entity transactions (D2) | Messaging, process managers, reservations, compensation (D3) | — |
| P5 tolerance | Eventual consistency between entities | Atomic change, or reservation before action | — |
| P6 reversibility | Detect-and-compensate (D3) | Prevention: the invariant must hold *before* the act | — |
| P7 regulation | Free choice | Recorded facts with actor and version; no silent automatic decisions | — |
| P8 hold duration | A database lock or transaction | A hold as a recorded fact, with a lease; judgements bound to versions | Distribution |

Three interactions deserve stating outright.

- **P8 dominates P4 at human scale.** A hold that lasts days is a recorded business fact whatever the store. No topology removes issues 9 and 10 from a process with long think-time.
- **P6 high forbids the cheapest pattern.** Where an act cannot be undone, "let both proceed and apologise" is unavailable for that act. Publication is the usual example.
- **P5 none with P4 high is the expensive corner.** No tolerance for intermediate states across several stores means reservation protocols or consensus. Most business processes, examined, turn out not to be in this corner: paper tolerated intermediate states for centuries (A.9).

**Limit.** The parameters are this article's selection `[S]`. They are the ones that discriminate between the alternatives of Part D. Performance targets, team size and existing platform commitments also shape a design and are deliberately outside this table.

---

## C.4 Three tests

### The over-engineering test

> For every mechanism in the design: **which invariant does it protect, and which parameter value justifies it?**

An answer names both. Acceptable: "The lease on the protocol protects the declarant's ability to proceed; justified by P8 = days." Not acceptable: "It is best practice." "We might need it."

"We might need it" is a bet. A bet is legitimate when it is written as one:

| Element of a stated bet | Content |
|---|---|
| The parameter expected to change | "P1 will rise from one to several" |
| The trigger | "When a second kind of hold is requested" |
| The cost of building now | Estimated |
| The cost of adding later | From the transition matrix (Part D4) |

`[P]` Bezos (2015) distinguished decisions that are hard to reverse (one-way doors) from those that are easy (two-way doors), and argued that only the first kind deserves slow, careful treatment. `[S]` Applied here: if adding the mechanism later is a two-way door, defer it. If it is a one-way door, the bet may be worth making early, and the reasoning belongs in an architecture decision record (009).

### The under-engineering test

> For every hard invariant that can only be broken jointly (A.8): **which mechanism enforces it, and at which of the three scales of issue 7?**

This is the mirror image and is asked less often. "We check it before saving" is an answer at no scale. "The button is disabled" is an answer at none.

### The incompleteness test

> For every parameter: **where is its value written down, who owns it, and what event would cause it to be revisited?**

A design justified by "P4 = one store" is correct until a read replica is introduced for performance and a guard is pointed at it. Nobody decided to change the parameter. It changed.

A stated limit is an engineering artifact; an unstated one is a future incident. The parameter record is where the limits of a design are stated.

### The tests applied

Illustrative rows, not the case's design:

| Mechanism proposed | Invariant | Parameter cited | Verdict |
|---|---|---|---|
| Outbox and message between two entities in one database | Cross-entity guard | None; P4 is low | Over-engineered, unless written as a bet on P4 |
| Lease on a long-running assessment | The locked party can eventually proceed | P8 = days | Justified |
| Hold set where one source exists | Lock not lost | P1 = one today | A bet; decide by the cost of adding it later |
| Guard evaluated in a list view | Hard cross-entity invariant | — | Under-engineered: enforced at no scale |
| Workflow engine for a three-step process in one store | Process completes | None | Over-engineered, unless P7 demands its audit features |

---

## C.5 Parameter values for the case

The values below are what the case brief supports. Unknowns are marked, because the incompleteness test applies to this article as well.

| # | Parameter | Value for the case | Status |
|---|---|---|---|
| P1 | Influencers on the Deklaratsioon | One kind of extrinsic source today: the Protokoll. Time rules in addition (the 90-day window, the correction deadline) | Known. Whether further kinds are expected (supervisory or legal holds) is **unknown** |
| P2 | Instances | Protocols per declaration: many over time, at most one unconfirmed, by invariant. Assessments per protocol: several | Known in shape. The number of assessors per protocol is **unknown** |
| P3 | Writers | One declarant; a few assessors; time | Known. Contention is low; the declarant–assessor pair is the one that matters |
| P4 | Topology | PostgreSQL; event-sourced; read models are projections | Assumed one store. Whether any guard reads a projection, and whether any external system takes part, is **to be confirmed** |
| P5 | Tolerance for intermediate states | — | **Unknown.** A business decision, closely tied to O4 |
| P6 | Reversibility | Publication of a submitted version is public and in practice irreversible. Confirmation of a protocol has formal weight | Known in kind |
| P7 | Regulation | A statutory register with legal deadlines | Known in kind; the specific obligations are **to be stated** by the analyst |
| P8 | Longest hold | An assessment lasts days | Known |

**A preliminary reading**, to be completed in Part G:

- P4 low: at machine timescales, nothing in the case justifies messaging or a process manager between Deklaratsioon and Protokoll. O4 can be settled by ordering two operations in one store.
- P8 high: the lock that a protocol places is a business fact lasting days. Issues 9 and 10 apply in full, and no choice of store changes that. O2 and O3 live here.
- P6 high for publication: whatever is decided for O4, a design that lets a submission be published and then withdrawn by compensation is unavailable.
- P1 is one today, with an unknown trend. Whether to model the lock as a hold set is a bet, to be priced in Part D4.
- P5 and P7 are unknown, and two of the four open decisions depend on them. The first deliverable of the analysis is therefore not a design. It is these two values.

---

## Glossary (Part C)

| Term | Definition |
|---|---|
| Analysis | Work whose output is knowledge: entities, invariants, questions, classifications |
| Bet (stated) | A mechanism built ahead of need, with the parameter, trigger and costs written down |
| Incompleteness test | For each parameter: where is its value recorded, who owns it, what would change it? |
| Long-lived transaction | One that would hold locks for longer than the system can tolerate |
| Machinery | Work whose output must be built, operated and explained: components, states, messages |
| One-way door / two-way door | A decision that is hard / easy to reverse |
| Over-engineering test | For each mechanism: which invariant, and which parameter value? |
| P1–P8 | The eight selection parameters |
| Premise | The condition under which a piece of guidance was derived |
| Under-engineering test | For each jointly-breakable hard invariant: which mechanism, at which scale? |
| Value of information | The difference a piece of knowledge makes to a decision |
| YAGNI | "You aren't going to need it": do not build for requirements that have not arrived |
