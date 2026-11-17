# 012 — Interacting Entities: State, Invariants, Coordination and Time

## Part D3 — Alternatives: Process Coordination

D2 ended where data can no longer be changed together. D3 covers what manages the crossing: **how steps on either side of a boundary are sequenced, and how a half-finished sequence is repaired**.

A boundary must be crossed in two situations, and they should be kept apart.

| Situation | Parameter | Example |
|---|---|---|
| The data is in different stores or systems | P4 high | A register and an external notification service |
| The activity lasts longer than any transaction | P8 high | An assessment that takes days |

The second arises in a single database. The case has it; C.5 assumed it does not have the first.

D3 covers six alternatives: choreography, process manager and saga, workflow-engine orchestration, reservation, detect-and-compensate, and the executable net. The file ends with the comparison across all fourteen alternatives of Part D.

Products named here are from the author's knowledge and were not re-checked; verify against the current version and licence.

---

## D3.1 Choreography with reaction rules

### Idea

There is no coordinator. Each entity records facts. Others react to those facts by rules of their own: "whenever a protocol is confirmed, the declaration records that it has been checked."

**A note on vocabulary.** `[P]` Event-storming practice (Brandolini) calls such a rule a *policy*. D1.4 used "policy" for authorisation rules. To avoid the homonym this article warned against (issue 2), the term here is **reaction rule**.

**Business reading.** Departments that work from a shared bulletin. Each reads what the others have posted and does its own part. Nobody directs.

### Origin and source

`[T]` The distinction between orchestration and choreography comes from the web-services literature (Peltz 2003). `[P]` Publish-subscribe messaging (Hohpe and Woolf 2003). `[T]` Helland (2007) for entities that interact only by messages.

### When it fits

- Few steps, mostly in a line.
- Each reaction is local: it needs only the fact and the reacting entity's own state.
- No completeness condition over several parties.
- P5 tolerant: the interval between fact and reaction may be visible.

### Failure modes

| Failure | Detail |
|---|---|
| **The process is written nowhere** | It exists only as the sum of the reactions. Its soundness (A.7) cannot be checked without assembling it by hand |
| **Absence cannot be reacted to** | A reaction rule fires on a fact. Nothing fires when an expected fact does not arrive. Timeouts have no home |
| **Nobody owns a stuck case** | "Where is this declaration held up?" has no one place to be answered |
| **Delivery** | Facts may arrive twice, late or out of order (006, 008). Every reaction must tolerate this |
| **Cycles** | A reacts to B's fact, B to A's |
| **Accretion** | Each added reaction is locally reasonable; together they interact (issue 16) |
| **Fan-out timing** | Several children react to one parent fact at different moments (issue 4) |

### Costs

| | |
|---|---|
| Technical | Across stores: messaging, an outbox, idempotent receivers. Within one store a reaction can run in the same transaction as the fact; then it is D2.2 with the code decoupled |
| Organisational | Low coupling between owners of the entities. High cost of understanding the whole |

### Business-visible consequences

When reactions are asynchronous, intermediate conditions are visible: the protocol is confirmed, the declaration does not yet say so.

### Evolution

**Into:** from direct calls in one transaction, by making a reaction asynchronous. That step introduces an interval that did not exist; it changes meaning.

**Out of:** to a process manager, when a completeness condition or a timeout appears. The facts already exist; the scattered reactions are gathered into one place. Moderate cost, mostly additive.

### In the case

Suitable for the simple reactions: *ProtocolConfirmed* leads the declaration to *Kontrollitud*; *CorrectionRequested* leads it to *Parandamisel*. In one store these can be immediate, which answers issue 17's "immediately or subsequently?" with "immediately".

Unsuitable for the idle protocol. Nothing is recorded when an assessor does nothing, so no rule can fire. O2 cannot be addressed by choreography alone.

---

## D3.2 Process manager and saga

These two names are used interchangeably in practice. They are different things, and the difference matters.

### The distinction

| | Saga | Process manager |
|---|---|---|
| **What it is** | A way of handling *failure* in a long sequence | A place where the *state of a sequence* is kept |
| **Definition** | A long-lived transaction split into steps T₁…Tₙ, each committing on its own, each with a compensating step C₁…Cₙ₋₁. Either all Tᵢ complete, or the compensations of the completed ones run | A central component that remembers how far a process has got and decides the next step from the results so far |
| **Source** | Garcia-Molina and Salem 1987 `[T]` | Hohpe and Woolf 2003 `[P]` |
| **Gives up** | Isolation: intermediate results are visible to others | Nothing in itself |
| **Says nothing about** | Where control lives | What happens on failure |

They are answers to two different questions and can be combined freely.

| | With compensation | Without compensation |
|---|---|---|
| **Central coordinator** | A saga run by a process manager | A plain process manager |
| **No coordinator** | A choreographed saga | Choreography (D3.1) |

`[P]` The confusion has a known origin: several .NET messaging frameworks use "saga" for their stateful, message-driven coordinator, which is a process manager in Hohpe and Woolf's sense. Richardson (2018) speaks of "orchestrated" and "choreographed" sagas, which is the table above.

It is worth noting that the original saga paper concerns long transactions *within one database*. The pattern is about duration, not distribution.

**Business reading.** A *process manager* is the closing agent of B2 (issue 14): the one who knows what is outstanding. A *saga* is a travel booking: flight, hotel, car are each booked for real, and if the car cannot be had, the hotel and flight are cancelled, perhaps with a fee. The cancellation is a new act, not an erasure.

### When each fits

| | Fits when |
|---|---|
| Process manager | There are completeness conditions, branches, or timeouts; someone must be able to say where a case stands; P8 or P4 high |
| Saga | Each step must commit on its own; a later step may fail; earlier steps can be compensated (P6 not high) |

### Failure modes

**Of the process manager.**

| Failure | Detail |
|---|---|
| **It accumulates business rules** | It should hold progress and routing. Decisions belong to the entities. A manager that decides is authority placed in mechanism (009) |
| **Its view diverges from the entities'** | It believes a step done that the entity has not recorded. Commands must be idempotent and correlated |
| **It is itself concurrent** | Two messages for one instance arrive together. It needs its own consistency control |
| **It is used where a domain entity exists** | The inverse of issue 14 |

**Of the saga.**

| Failure | Detail |
|---|---|
| **No isolation** | Others see intermediate results and act on them. `[P]` Richardson lists countermeasures; the first is the *semantic lock*: a flag on the record saying a saga is in progress |
| **Compensation fails** | It must be retried until it succeeds, so it must be idempotent |
| **A step cannot be compensated** | It must come last among the steps that can fail. Richardson calls it the *pivot* |
| **Compensation is not undo** | The world has seen the intermediate state. A cancelled booking is a booking and a cancellation |

`[S]` The semantic lock is the hold of D1.3 under another name. A hold placed at the first step and released at the last or by compensation is how a saga recovers the isolation it gave up, for the commands the hold denies.

### Costs

| | |
|---|---|
| Technical | A store for process state; correlation; timeouts (008); idempotent steps |
| Organisational | Someone owns each process definition. Compensations must be designed with the business, since they are business acts |

> **Technical box — a process manager is a small state machine over messages**
>
> ```csharp
> record AssessmentProgress(ProtocolId Id, ISet<AssessorId> Awaiting, Instant IdleSince);
>
> static IEnumerable<Command> Handle(AssessmentProgress p, object msg, Instant now) => msg switch
> {
>     AssessmentRecorded e when Complete(p with { Awaiting = p.Awaiting.Without(e.By) })
>                               => [new ConfirmProtocol(p.Id)],
>     Tick when now - p.IdleSince > IdleLimit
>                               => [new EscalateProtocol(p.Id)],
>     _                         => []
> };
> ```
>
> It issues commands; the entities decide whether to accept them. `Complete` is the replaceable gate of issue 14.

### Business-visible consequences

Intermediate conditions become named parts of the model: "pending", "awaiting assessors". Compensations are visible as events in their own right.

### Evolution

**Into:** from choreography, or from D2.2 when a store is divided.

**Out of:** to a workflow engine, by lifting the definition out of code; moderate. Back to an atomic operation only if stores are merged, which is rare.

### In the case

The Protokoll already plays the process manager for assessment, and legitimately, as a domain entity (issue 14's qualification). It collects assessments, applies the gate (O1), and is the natural home for the idleness rule (O2).

Starting a protocol is a two-step sequence: place the hold, record the start. With D2.2 the two are atomic and no saga is needed. If the stores were ever separated, it would become a saga whose compensation for the first step is "release the hold", and the hold would be its semantic lock. The design already contains the piece that the later transition would need.

---

## D3.3 Orchestration with a workflow engine

### Idea

The process is an explicit artefact, a diagram or a program, executed by a dedicated engine that persists progress, runs timers, retries failed steps and shows where every instance stands.

**Business reading.** A case-management office with a wall chart of every open case and its stage, staffed by people whose only job is to move cases along and chase delays.

### Origin and source

`[T]` Workflow management systems and the Workflow Management Coalition's reference model (Hollingsworth 1995). `[T]` BPMN 2.0 (OMG 2011). `[T]` The workflow patterns of van der Aalst et al. (2003), a catalogue of control-flow constructs against which engines are compared.

`[P]` Two families exist today.

| Family | The process is | Read by | Examples (verify) |
|---|---|---|---|
| Model-driven | A BPMN diagram that is itself executed | Analysts and developers | Camunda; Elsa Workflows in .NET |
| Durable execution | Ordinary code whose progress the engine records and replays | Developers | Temporal; Azure Durable Functions; Dapr Workflow |

### When it fits

- Many long-running processes, not one.
- Human tasks, timers and escalations are central.
- P7: the process itself must be auditable.
- Process definitions change often.
- Several systems take part.

### Failure modes

| Failure | Detail |
|---|---|
| **Versioning of running instances** | A definition changes while instances started under the old one are still open, perhaps for months. This is the hardest problem of the approach, in both families |
| **The engine is a second store** | Engine state and domain state do not change atomically. Adopting an engine raises P4, and so creates the distributed problem it then helps to manage |
| **Two sources of truth** | The engine says "step 3"; the entity says *Esitatud*. This is issue 18 at the scale of systems |
| **Business rules in the diagram** | Gateways fill with conditions that belong to the entities |
| **Unsound diagrams execute** | BPMN permits models that deadlock or never complete. The notation does not guarantee soundness (A.7) |
| **Determinism constraints** | In durable execution, workflow code must be deterministic so that it can be replayed |
| **Dependence** | Definitions and running instances are in the engine's format |

### Costs

| | |
|---|---|
| Technical | High: a platform to deploy, operate, upgrade and secure |
| Organisational | High: skills, ownership of definitions, licences. Against this: a shared, executable picture of the process |

### Business-visible consequences

The largest of any alternative, and mostly favourable: stakeholders can see the process and the position of each case; deadlines and escalations are standard features. A model-driven engine also makes the diagram a shared artefact between analyst and developer.

### Evolution

**Into:** from several process managers, when their number justifies a platform.

**Out of:** hard. Definitions and in-flight instances must both be migrated.

### In the case

By the over-engineering test: one kind of process, a few steps, one store. An engine would add a second store to a system that has one. Nothing in C.5 justifies it.

A justification could come from outside this article's parameters: an organisation running many registers might standardise on a workflow platform for reasons of its own. That is a legitimate decision. It should be recorded as an organisational one, not presented as a requirement of this case.

---

## D3.4 Reservation, Try-Confirm/Cancel, escrow

### Idea

An act is split into two business-level phases. First a time-limited promise is obtained: the owner of a resource sets it aside. Then the promise is confirmed or cancelled. If neither happens in time, it lapses.

**Business reading.** The hotel holds the room until six o'clock. The card is pre-authorised before it is charged. In a property sale, money and deed are placed in escrow and released together.

### Origin and source

| Form | Source |
|---|---|
| **Escrow** for quantities: part of a total is set aside so that concurrent transactions can each commit without knowing the final value | O'Neil 1986 `[T]` |
| **Tentative operations** with confirmation or cancellation | Helland 2007 `[T]` |
| **Try-Confirm/Cancel (TCC)** as a named protocol | Attributed to Pardon `[P]` |
| **Reservation** | Common practice `[P]` |

`[T]` The infrastructure-level ancestor is two-phase commit (Gray 1978). The differences are what make reservation usable where two-phase commit is not:

| | Two-phase commit | Reservation |
|---|---|---|
| Visible to the business | No | Yes: "reserved" is a state people understand |
| Duration | As short as possible | As long as the business allows |
| If the coordinator disappears | Participants are blocked | The reservation lapses; the participant recovers alone |

### When it fits

- P5 none or low: an invalid outcome must not be shown.
- P6 high: the final act cannot be undone, so certainty is needed first.
- P4 high or P8 high.
- A scarce resource.

### Failure modes

| Failure | Detail |
|---|---|
| **Confirmation after expiry** | The reserver believes it still holds the promise. Fencing is needed (issue 9; 008) |
| **Orphaned reservations** | Must lapse on their own |
| **Capacity tied up** | Unconfirmed reservations consume the resource; a careless or hostile reserver can exhaust it |
| **Confirmation must not fail** | The participant promised. Confirm is idempotent and retried until it succeeds |
| **Partial confirmation** | The coordinator stops after confirming some. A durable record of intent is needed, which is a process manager |

### Costs

| | |
|---|---|
| Technical | Every participant implements three operations and an expiry |
| Organisational | All parties agree the protocol. The business accepts "reserved" as a real condition with rules of its own |

### Business-visible consequences

"Reserved" or "pending" appears in the model and on the screen. People are used to this from hotels, banks and libraries, which makes it one of the easier patterns to explain.

### Evolution

**Into:** from a hold (D1.3). A hold with an expiry and a confirming step is a reservation. The step is small.

**Out of:** to a plain atomic operation, if the boundary that required it disappears.

### In the case

Starting a protocol can be read as a reservation: the assessor reserves a submitted version for assessment. Confirming the protocol is the *confirm*; annulment or lapse is the *cancel*. Read this way, O2 is the reservation's expiry policy, and the questions a hotel must answer apply directly. How long is it held? Who may extend it? What is the guest told?

`[S]` One option for O2, pausing the declarant's 90-day clock, also has an escrow reading: the unused days are set aside while the reservation stands and returned when it ends. This is offered as a way of explaining the option to stakeholders, not as an argument for it.

---

## D3.5 Detect and compensate

### Idea

Do not prevent the violation. Let each party act on what it knows. Find violations afterwards, and repair them by a business-level act: an apology.

**Business reading.** Airlines sell more seats than the aircraft has, because some passengers do not come. When too many do, someone is compensated and rebooked. The airline has decided that occasional apology is cheaper than flying empty seats.

### Origin and source

`[T]` Helland and Campbell (2009): a system has memories, guesses and apologies (A.9). `[T]` Optimistic replication (Saito and Shapiro 2005).

### When it fits

The condition is an inequality `[S]`:

> probability of violation × cost of an apology  <  cost of prevention per operation

together with:

- P6 not high: the act can be compensated.
- P5 tolerant.
- P7 permits it.

### Failure modes

| Failure | Detail |
|---|---|
| **Irreversible effects** | Something was published, sent, or relied on by a third party |
| **Detection is a process too** | The detector must exist, run, and be complete. Its own liveness is an obligation |
| **Cascades** | Decisions were built on the invalid state and must also be repaired |
| **No authority to apologise** | Someone must be empowered to decide the remedy |
| **Rare is not never** | The inequality shifts as volume grows |

### Costs

| | |
|---|---|
| Technical | Little up front. A detector and repair tooling later |
| Organisational | Exception handling by people; customer contact; possibly legal exposure |

### Business-visible consequences

Occasionally a user is told that something they did has been reversed or adjusted. Whether this is acceptable is entirely a business judgement.

### Evolution

**Into:** `[S]` often by accident. A system with an unenforced invariant is already in this pattern, without the detection or the compensation. Every advisory rule (issue 15) is in it deliberately.

**Out of:** to prevention, when the rate or the cost rises. This is costly in an unexpected place: existing data may already contain violations, so the new invariant cannot be assumed of history and a clean-up is needed first.

### In the case

Applied to O4: both *Submit* and *StartProtocol* succeed; afterwards it is detected that the protocol refers to a superseded version. P6 then constrains the remedy. A submitted version is public and cannot be withdrawn, so the compensation can only fall on the protocol: it moves to the new version, or is annulled.

At human timescale this pattern is already present in any design that binds judgements to versions (issue 10, second and fourth options): "this version has been superseded" is the detection; "please reaffirm" is the compensation. For think-time, detect-and-compensate is not an exotic choice. It is the alternative to locking.

---

## D3.6 The executable net

### Idea

The process is written as a Petri net or workflow net and run by an interpreter that moves tokens. The model that is analysed is the model that executes.

**Business reading.** A board game of the procedure: counters on squares, rules for moving them. What is checked on paper is what is played.

### Origin and source

`[T]` Petri (1962). `[T]` Workflow nets (van der Aalst 1998). `[T]` YAWL, a workflow language founded on nets and on the workflow patterns (van der Aalst and ter Hofstede 2005). `[T]` Coloured Petri nets, which add data to tokens (Jensen).

### When it fits

- Proof of soundness is a primary requirement (P7 high).
- The control flow is intricate: parallel branches, partial joins, cancellation.

### Failure modes

| Failure | Detail |
|---|---|
| **Data and time** | Classical nets abstract from both (A.7). Adding them makes analysis much harder |
| **Scarce runtimes and skills** | Few mainstream execution environments; few practitioners |
| **The gap** | If the net is analysed and the code is written separately, nothing ties them together |

### Costs

| | |
|---|---|
| Technical | Little infrastructure |
| Organisational | Specialist skills. Diagrams less approachable for stakeholders than BPMN |

### Business-visible consequences

None directly.

### Evolution

**Into:** from BPMN; mappings to nets exist for analysis (Dijkman et al. 2008).
**Out of:** by translation to an engine's notation.

### In the case

As an analysis tool, not a runtime (Part E). It does contribute one precise observation. O1 is a choice between two of the catalogued workflow patterns `[T]`:

| Gate | Workflow pattern | The question the pattern forces |
|---|---|---|
| All assessors | Synchronisation (AND-join) | What if one never arrives? |
| First assessor | Discriminator (first of N) | What becomes of the branches still running: ignored, or cancelled? |

"What happens to the other assessors' work once the first has decided?" is not an afterthought. It is part of choosing the discriminator.

---

## How positions combine

A design takes one position in D1, one in D2, and none, one or several in D3. Three illustrative compositions `[S]`; none is a named pattern.

| Situation | D1 | D2 | D3 |
|---|---|---|---|
| One store, few writers, long think-time | Lifecycle plus a hold with a lease | Multi-stream atomic append | Immediate reactions; versions detected and reaffirmed |
| One store, many kinds of constraint arriving | Hold/grant set | DCB | The same |
| Several stores or external parties | Hold/grant set | One aggregate per transaction | Process manager; reservation where the act is irreversible; compensation elsewhere |

## Comparison across all fourteen

| # | Alternative | Decides | Justified by | Intermediate states visible | Addresses think-time (P8) | Characteristic failure | Maturity | Exit |
|---|---|---|---|---|---|---|---|---|
| D1.1 | Flat states | Structure | Small entity, P1 ≤ 1 | — | No | Explosion (12) | Established | Cheap if facts recorded |
| D1.2 | Orthogonal regions | Structure | Independent aspects | — | No | False orthogonality | Established | Moderate |
| D1.3 | Hold/grant set | Structure | P1 > 1; P8 high | — | **Yes**, with lease | Orphaned holds (9) | Composition | Moderate |
| D1.4 | Externalised policy | Structure | P1 open-ended; rules governed elsewhere | — | No | Stale decision (7) | Established | Hard |
| D2.1 | Merged aggregate | Boundary | Child has no independent life | No | No | False conflicts | Established | Hard |
| D2.2 | Multi-stream append | Boundary | P4 low | No | No | Unchecked read stream | Established; store-dependent | Easy to DCB |
| D2.3 | DCB | Boundary | Rules cross-cutting and volatile | No | No | Query ≠ read set | Recent | Hard |
| D2.4 | Actors | Boundary | P3 high | Between actors | No | Cross-actor read-then-act | Established | Easy with a pure decider |
| D3.1 | Choreography | Coordination | Few local steps | Yes, if asynchronous | No: cannot see absence | Process written nowhere | Established | Moderate |
| D3.2a | Process manager | Coordination | Completeness, timeouts | Yes | **Yes** | Accumulates rules | Established | Moderate |
| D3.2b | Saga | Coordination | Steps commit separately; compensable | Yes | Partly | No isolation | Established | Moderate |
| D3.3 | Workflow engine | Coordination | Many long processes; P7 | Yes | **Yes** | Versioning of instances | Established | Hard |
| D3.4 | Reservation / TCC | Coordination | P5 low with P6 high | Yes: "reserved" | **Yes** | Confirm after expiry | Established | Moderate |
| D3.5 | Detect and compensate | Coordination | Apology cheaper than prevention | Yes | **Yes** | Irreversible leak | Established | Costly: history holds violations |
| D3.6 | Executable net | Coordination | Soundness must be proved | Yes | Partly | Data and time abstracted | Niche | Moderate |

Two readings of the table.

- **Think-time has few answers.** Only five rows say "yes": a hold with a lease, a process manager, a workflow engine, a reservation, and detect-and-compensate. They reduce to two strategies: *hold the thing for the duration*, or *let it move and reconcile afterwards*. Issue 10 said the same in the analyst's vocabulary.
- **Maturity and exit do not move together.** The most established options include some of the hardest to leave. Part D4 takes up the cost of moving.

---

## Glossary (Part D3)

| Term | Definition |
|---|---|
| Apology | A business-level act that repairs the consequence of a decision that proved wrong |
| Choreography | Coordination with no central controller; each party reacts to others' facts |
| Compensation | A new act that semantically reverses an earlier committed step |
| Discriminator | A join that proceeds on the first of several incoming branches |
| Durable execution | Running ordinary code so that its progress survives failures, by recording and replaying |
| Escrow | Setting aside part of a resource so that concurrent parties can each proceed |
| Orchestration | Coordination by a central controller |
| Pivot | In a saga, the step after which the saga can no longer be abandoned |
| Process manager | A component holding the state of a multi-step process and deciding its next step |
| Reaction rule | "Whenever fact F is recorded, do G" (called a *policy* in event storming) |
| Reservation | A time-limited promise of a resource, later confirmed or cancelled |
| Saga | A long sequence of separately committed steps, each with a compensation |
| Semantic lock | A marker that a saga is in progress on a record; a hold (D1.3) |
| Synchronisation | A join that waits for all incoming branches |
| Try-Confirm/Cancel | A reservation protocol with three operations per participant |
| Two-phase commit | An infrastructure protocol for atomic commitment across participants |
| Workflow engine | A product that executes explicit process definitions and persists their progress |
| Workflow patterns | A catalogue of control-flow constructs (van der Aalst et al.) |
