# 012 — Interacting Entities: State, Invariants, Coordination and Time

## Part D1 — Alternatives: Structure Inside an Entity

Part D presents fourteen alternatives in three groups, by what each decides.

| Group | Decides | Part |
|---|---|---|
| Structure inside an entity | How one entity represents what it accepts | D1 (this file) |
| The consistency boundary | Which data changes atomically | D2 |
| Process coordination | How steps across boundaries are sequenced and repaired | D3 |

The groups are not rivals. A design takes one position in each. The alternatives *within* a group are the rivals.

D1 covers four: flat explicit states, orthogonal regions, hold/grant constraint sets, and externalised policy decision. None of them solves concurrency on its own. They determine what there is to be concurrent about.

Each alternative uses the same eight fields.

| Field | Content |
|---|---|
| **Idea** | What it is |
| **Origin and source** | Where it comes from, with provenance tag |
| **When it fits** | In terms of the parameters P1–P8 of Part C |
| **Failure modes** | How it goes wrong, by issue number from Part B |
| **Costs** | Technical and organisational |
| **Business-visible consequences** | What users and stakeholders will notice |
| **Evolution** | How a system arrives at it and leaves it |
| **In the case** | Applied to the declarations registry |

---

## D1.1 Flat explicit states

### Idea

The entity has one status drawn from one list. A table says, for each status and each trigger, what the next status is.

**Business reading.** A form with a single box labelled "Status", and a procedure manual with one page per status.

### Origin and source

`[T]` Finite automata (Mealy 1955; Moore 1956). `[P]` In object-oriented design, the State pattern (Gamma et al. 1994).

### When it fits

- P1 low: at most one outside source affects the entity.
- One aspect only, or several aspects that always change together.
- `[S]` Small enough that the complete transition table fits on a page and can be read aloud in a meeting. There is no theoretical threshold; this is a test of whether people can still check it.

### Failure modes

| Failure | Issue |
|---|---|
| Independent aspects multiply the list | 12 |
| A status records why, not what is permitted | 11 |
| Another party's activity becomes a status of this entity | 13 |
| A status used as a lock is cleared by the first of several holders | 8 |
| Transitions that return to the same status while changing hidden data | A sign of a second aspect |

### Costs

| | |
|---|---|
| Technical | The lowest of any alternative. One value to store, to index, to project |
| Organisational | None at the start: analysts write this naturally and stakeholders read it without training. The cost arrives with each added concern, as a multiplication of statuses that nobody decided on |

### Business-visible consequences

The word on the screen *is* the model. That is a real advantage: there is no translation between what users say and what the system holds. It lasts until users begin saying "submitted, but…".

### Evolution

**Into:** this is where most systems start, correctly.

**Out of:** the cost of leaving depends almost entirely on one early decision.

| How state changes were recorded | Leaving for regions or holds |
|---|---|
| As **facts**: *Submitted*, *CorrectionRequested*, *ProtocolConfirmed* | Cheap. Status is computed from the facts; computing it differently is a code change with no data migration |
| As **status assignments**: *StatusChanged(to: X)* | Expensive. The reason for each change was never recorded and must be reconstructed or guessed |
| As an overwritten column with no history | The most expensive. Only the present value survives |

`[S]` This is the most valuable inexpensive design move in the article: record what happened, not what the status became. It keeps every later restructuring a two-way door. Part D4 returns to it.

### In the case

The evolved model, read flat:

| From | Trigger | Guard | To | Actor |
|---|---|---|---|---|
| Koostamisel | Submit | — | Esitatud | Deklarant |
| Esitatud | Edit voluntarily | Within 90 days; lock rule (O2) | Esitatud | Deklarant |
| Esitatud | Submit again | No open protocol | Esitatud | Deklarant |
| Esitatud | Correction requested | Gate (O1) | Parandamisel | Reaction to Protokoll |
| Parandamisel | Submit | — | Esitatud | Deklarant |
| Parandamisel | Correction deadline passes | Not stated | Not stated | Time |
| Esitatud | Protocol confirmed | Gate (O1) | Kontrollitud | Reaction to Protokoll |

Three observations.

- Two rows go from *Esitatud* to *Esitatud*. Something changes that the status does not show: a working copy exists, a new version is public. That is the second-aspect signal.
- "No open protocol" is a guard on another entity's state (issue 7). In a flat model the alternative is a new status, *under assessment*, which is another party's activity recorded as this entity's state (issue 13).
- Counting honestly, *Esitatud* alone covers {no working copy, working copy open} × {no protocol, protocol open}: four distinct conditions under one name.

The flat model is not wrong for this case. It is under visible strain from one status.

---

## D1.2 Orthogonal regions

### Idea

The entity has several small lifecycles, one per independent aspect, and is in one state of each at once. A short list of cross-region rules records where they are not independent.

**Business reading.** An ERP sales order shows a delivery status, a billing status and a credit status side by side. Each has its own owner and its own progress.

### Origin and source

`[T]` Harel (1987). `[T]` Standardised in UML 2 state machines and in the W3C's SCXML (2015), where regions are written as parallel states. `[P]` Implemented by statechart libraries such as XState (verify against the current version).

### When it fits

- Several aspects, each with a lifecycle of its own.
- The aspects are mostly independent: few cross-region guards.
- Each aspect has one source (P1 low per region), and one instance at a time (P2 low).

### Failure modes

| Failure | Detail |
|---|---|
| **False orthogonality** | Nearly every transition is guarded by another region. The regions hide a flat machine (issue 12, limit) |
| **Invalid combinations** | Not every tuple of region states is meaningful. The forbidden ones must be listed as invariants; otherwise they are reachable |
| **Simultaneous transitions** | One trigger moves two regions. `[T]` Statechart semantics differ on the order of effects (von der Beeck 1994 compares the variants). The model must say which applies |
| **A region that mirrors another entity** | A "checking" region on the declaration duplicates the protocol's lifecycle: a stored copy that can disagree (issue 18) |
| **The headline status** | Users still want one word. It becomes a derived status over the tuple and must be a function (issue 3) |

### Costs

| | |
|---|---|
| Technical | Modest. Several values instead of one; tests over combinations, not single states |
| Organisational | Analysts deliver one transition table per region, plus a cross-region table, plus a list of forbidden combinations. Stakeholders must accept that "the status" is plural |

### Business-visible consequences

Several indicators in place of one. A user sees "public: version 3; working copy: open; checking: in progress" and can understand each independently. Reports that group by "status" need the derived headline.

### Evolution

**Into:** from flat states, at the cost described in D1.1.

**Out of:**

| Towards | When | Cost |
|---|---|---|
| A separate entity | The region acquires identity: several instances over time, its own actors, its own records | In an event-sourced system this is a stream split (Part D4): meaning-changing |
| A hold/grant set | A region's condition can have more than one source | Additive if changes were recorded as facts with their source |

### In the case

| Region | States | Owner of transitions |
|---|---|---|
| Drafting | no working copy / working copy open | Deklarant; the 90-day rule |
| Publication | nothing public / version *n* public | Follows submission |
| Checking | not started / in progress / under correction / checked | Reactions to the Protokoll |

*Parandamisel* becomes a value of the Checking region. Two of the open decisions take a precise form.

- **O3** is one cell: is the tuple (Drafting = working copy open, Checking = checked) permitted? If forbidden, a rule must say what happens to the working copy on entry to *checked*. If permitted, *Kontrollitud* is not terminal for the entity as a whole, only for one region.
- **O2** is one cross-region rule: the 90-day clock belongs to Drafting; does Checking = in progress pause it, leave it, or extend it?

The weakness is the fourth failure mode. The Checking region restates what the Protokoll already knows. That pressure leads to D1.3.

---

## D1.3 Hold and grant constraint sets

### Idea

The entity keeps its own lifecycle, and beside it a set of constraints placed by others. Each constraint records who placed it, what it affects, and what ends it. A command is accepted when the lifecycle allows it and no hold denies it.

**Business reading.** The bank account of A.6. The account is *open*; that is its lifecycle. Separately, the fraud department holds outgoing payments and the court holds everything. A grant works the other way: the tax office grants an extension, and a filing that would be late is accepted.

### Origin and source

`[S]` **This is a composition, not a single named canonical pattern**, and is presented as such. Its parts:

| Part | Source |
|---|---|
| Holds and blocks as business objects | Banking and ERP practice `[P]` |
| "Free when no hold remains" | Deny-overrides, XACML 3.0 `[T]` |
| A set of holders, each releasing only its own | The lock table of a lock manager (Gray & Reuter 1993) `[T]` |
| Expiry | Leases (Gray & Cheriton 1989) `[T]` |
| Legal hold | Records-management practice `[P]` |

### When it fits

- P1 middle or high: several kinds of source, or more expected.
- P8 high: the constraint lasts long enough to be a business fact.
- The constraint applies across several lifecycle states.
- P7: there is a need to show who blocked what, and when.

### Failure modes

| Failure | Detail |
|---|---|
| **Orphaned holds** | The source disappears or stalls (issue 9). Every hold needs an expiry, an escalation or an administrative release |
| **Holds that try to oblige** | A hold can deny. It cannot create a duty or start a deadline. When an outside act creates obligations, a hold alone is the wrong shape |
| **Placement needs its own guard** | May a hold be placed on a declaration still being drafted? On one already checked? The placing is a command on the entity like any other |
| **Grants against holds** | If both exist, the combining rule must be stated (A.6). Deny-overrides is usual, not automatic |
| **Override authority** | Who may remove a hold they did not place? This is a question of authority, not mechanism (009) |
| **The headline status** | As with regions, a single display word is derived |

### Costs

| | |
|---|---|
| Technical | Moderate. A set in the entity's state; facts for placing, releasing and expiring. The source must reach the entity to place the hold: a two-entity operation, whose atomicity is a D2 decision |
| Organisational | A new artefact, the **hold register**: for each kind of hold, its source, scope, release condition and idle-release rule (R11). Operations staff need a view answering "what is blocking this?" |

> **Technical box — sketch**
>
> ```csharp
> record Hold(HoldId Id, Source By, IReadOnlySet<CommandKind> Denies,
>             Instant PlacedAt, Instant? ExpiresAt, string Reason);
>
> static bool Accepts(DeclarationState s, CommandKind c, Instant now) =>
>     Lifecycle.Allows(s.Stage, c)
>     && !s.Holds.Any(h => h.Denies.Contains(c)
>                          && (h.ExpiresAt is null || now < h.ExpiresAt));
> ```
>
> `Source` is a kind plus an identity, for example (Protokoll, P-17). Placing the same hold twice and releasing it twice are harmless, because the set is keyed.

### Business-visible consequences

The system can tell a user *why* an action is refused and *by whom*: "submission is held by protocol P-17, started on 3 March". Several reasons can be shown together. An authorised person can lift one hold without disturbing others. None of this is available from a status word.

### Evolution

**Into:** from a lifecycle state or a boolean. Additive where facts were recorded with their source. Past locks recorded without a source need one invented ("legacy"), which is a small, permanent blemish.

**Out of:**

| Towards | When |
|---|---|
| Externalised policy (D1.4) | The combining rules become numerous and change often |
| Dynamic Consistency Boundary (D2) | The stored set is replaced by a query over tagged facts at decision time |

### In the case

Starting a Protokoll places a hold on the Deklaratsioon: source (Protokoll, *id*), denying *Submit*.

**The effect on O4.** *Submit* now reads only the declaration's own state (R8). The contest between "submit" and "start assessment" becomes an ordering of two commands on one entity, *Submit* and *PlaceHold*, which one entity decides atomically. Two outcomes are possible, and each exposes one business parameter.

| Order at the declaration | What follows | The business parameter |
|---|---|---|
| Hold placed first | *Submit* is refused, with the reason | What the declarant is told |
| *Submit* first | The hold arrives naming a version that is no longer current (issue 10) | Whether the protocol is refused, or proceeds on the new version |

**The effect on O2.** The idle-release rule is one field of the hold. Whether the 90-day clock pauses while a hold is present is a separate time rule keyed to the hold's presence. Two decisions, visibly independent.

**Where a hold is the wrong shape.** *Parandamisel* is caused by the authority, which suggests a constraint. But consider what it does: it lifts the hold on *Submit*; it obliges the declarant to correct; it starts a deadline. The second and third are not denials. `[S]` *Parandamisel* is therefore a condition of the declaration, caused by a fact from the protocol, and the assessment lock is a hold. The case needs both shapes, each for the part it fits.

---

## D1.4 Externalised policy decision

### Idea

The question "may this command proceed?" is answered by a separate component, from attributes of the actor, the action, the entity and the circumstances. The rules are data, not code. The entity or its handler only enforces the answer.

**Business reading.** A clerk at a counter does not decide entitlement from memory. The clerk consults the regulations, which are kept and amended by someone else. The clerk enforces; the regulations decide.

### Origin and source

`[T]` The separation of a policy enforcement point (PEP) from a policy decision point (PDP) comes from the IETF policy framework (RFC 2753, 2000). `[T]` XACML (OASIS; version 3.0, 2013) standardised a policy language and the combining algorithms of A.6. `[T]` NIST SP 800-162 (2014) defines attribute-based access control. `[P]` Current engines include Open Policy Agent, with its language Rego, and Cedar. For all of these, verify features and .NET integration against the current version.

009 treats PEP and PDP under the heading of mechanism versus authority.

### When it fits

- P1 high and open-ended: many kinds of rule, more arriving.
- Rules change more often than software is released.
- The rules are owned by someone other than the developers (P7).
- The same rules govern many kinds of entity.
- The question is about *who*: roles, organisational scope, delegation.

### Failure modes

| Failure | Detail |
|---|---|
| **Stale attributes** | The decision point decides on attributes supplied at one moment; the change happens at another. This is read-then-act (issue 7). A hard invariant decided this way is not enforced (R15) |
| **A remote decision inside a transaction** | To avoid staleness the decision must be made within the consistency boundary. A network call there costs latency and ties availability to the engine |
| **Lifecycle written as policy** | A policy can say whether a command is permitted. It cannot say what state follows. Encoding transitions in policy rules confuses authority with mechanism (009) |
| **Interactions between rules** | Rules added independently interact (issue 16). The engine combines them by algorithm; whether the result is intended is not its concern |
| **Which rules decided?** | For audit, each decision must record the policy version that produced it |
| **Indeterminate results** | What happens when the engine cannot decide? Fail-closed is safe and creates outages; fail-open is the reverse |

### Costs

| | |
|---|---|
| Technical | An engine, a policy store, deployment and versioning of policies, plumbing to supply attributes, tooling to explain a denial |
| Organisational | The largest of the four. Someone must own the policies, learn the language, review changes and test them. "Changeable without a release" also means "changeable without the release process's safeguards" |

### Business-visible consequences

Rules can change quickly, and denials can be explained by citing the rule. The risk is the other face of the same property: a rule changed in isolation, whose interaction with the others nobody examined.

### Evolution

**Into:** from scattered role checks, or from a hold set whose combining rules have multiplied.

**Out of:** difficult once the body of policies is large. The policies are the asset, and they are written in the engine's language. This is the nearest thing to a one-way door in D1.

**A partial adoption** `[S]` is usually the right first step, and often the last:

| Question | Answered by |
|---|---|
| *May this actor attempt this command on this entity?* | The decision point, from roles and organisational scope |
| *Is this command valid for this entity now?* | The entity, from its own state, atomically with the change |

### In the case

Two questions in the case are of the first kind and suit a decision point.

- What a Superkontrollija may do that a Kontrollija may not.
- That an assessor acts only on declarations within the scope of their own Pädev asutus.

The submission lock is of the second kind. It is a hard rule about state and belongs with the entity.

By the over-engineering test of C.4, nothing in the case's parameters justifies a policy *engine*. A plain policy class in the application is a decision point: it separates authority from mechanism, which is the benefit, without the engine, which is the cost. An engine would be justified by P1 becoming open-ended or by P7 requiring that the rules be governed outside the development team. Both are unknown (C.5).

---

## *Parandamisel*, three ways

B1 (issue 12) and B2 (issue 13) deferred this question here.

| Modelled as | What is gained | What is lost | O2 and O3 appear as |
|---|---|---|---|
| A lifecycle state (D1.1) | Simplicity; one word on the screen | Combination with drafting and publication is implicit; the lock is a cross-entity guard | Guards and exceptions scattered across transitions |
| A value in a Checking region (D1.2) | Combinations are explicit; O3 is one cell | The region mirrors the Protokoll's lifecycle | One forbidden-combination entry and one cross-region time rule |
| A hold (D1.3) | Source and release are explicit | Wrong shape: correction obliges and starts a deadline, which a hold cannot express | — |
| **A lifecycle or region state caused by a protocol fact, with the assessment lock as a separate hold** `[S]` | Each part has the shape that fits it | Two mechanisms in place of one | O2: a field of the hold plus one time rule. O3: one forbidden-combination entry |

The last row is this article's composition. It is the most expressive and the most machinery. Whether the case warrants it over the first row is decided by P1's trend and by the cost of moving later, which is the subject of Part D4.

## Comparison within D1

| | Flat states | Orthogonal regions | Hold/grant set | Externalised policy |
|---|---|---|---|---|
| Answers | What stage? | What stage, per aspect? | What is imposed, by whom? | Who may, under which rules? |
| P1 at which it fits | ≤ 1 | 1 per region | Several | Open-ended |
| Growth with new concerns | Multiplicative | Additive | Additive | Additive, in policies |
| Explains a refusal | By status | By region | By source and reason | By rule |
| Typical failure | Explosion (12) | False orthogonality | Orphaned holds (9) | Stale decision (7) |
| Organisational cost | Lowest | Low | Moderate | Highest |
| Exit | Cheap if facts were recorded | Moderate | Moderate | Hard |

---

## Glossary (Part D1)

| Term | Definition |
|---|---|
| Attribute-based access control | Deciding access from attributes of actor, action, resource and environment |
| Cross-region rule | A guard in one region that reads the state of another |
| Fact (as recorded) | A record of what happened, as opposed to a record of what a status became |
| Forbidden combination | A tuple of region states declared invalid by an invariant |
| Headline status | A single display word derived from several regions or from holds |
| Hold register | The analyst's list of hold kinds: source, scope, release, idle-release |
| Idle-release rule | What ends a hold when its holder does nothing |
| PDP | Policy decision point: the component that decides |
| PEP | Policy enforcement point: the component that enforces the decision |
| Policy engine | A separate product that evaluates policies written in its own language |
| Scope (of a hold) | The set of commands the hold denies |
| Source (of a hold) | The kind and identity of whatever placed it |
| Status assignment | A record of the form "status changed to X", which omits the reason |
