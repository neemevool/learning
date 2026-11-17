# 012 — Interacting Entities: State, Invariants, Coordination and Time

## Part G — The Worked Example, Consolidated

The registry of declarations has appeared in every Part. Here it is taken from beginning to end, in the order in which the work would actually be done.

Two things this Part does not do. It does not resolve the open business decisions O1 to O4; it shows how the model confines each to one place. And it does not prescribe a design; it sets candidate designs against the parameters and shows what would tip the choice.

The terms and the case brief are in Part 0. Where this Part fills in details the brief does not give, it says so.

---

## G.1 Which problems are present

The first step is Part 0's: decide which classes of problem the case contains. It is tempting to skip, and skipping it is how a timer gets added to fix a missing exit.

| Class | Present? | Where |
|---|---|---|
| 1 Single-entity lifecycle | Yes | Deklaratsioon; Protokoll |
| 2 Cross-entity invariant | Yes | Submission against an open protocol; one unconfirmed protocol per declaration |
| 3 Concurrent actors | Yes, one pair | Declarant against assessor |
| 4 Time-driven transition | Yes, three | The 90-day window; the correction deadline; idleness of a protocol |
| 5 Multi-party coordination | Yes | Several assessors in one protocol |
| 6 Derived versus stored | Yes | The declaration-level checking status; the per-assessor status |
| 7 Conflicting permissions | Latent | One source of lock today |

Seven classes in a system of four entity types. This is ordinary. Small systems are not exempt from the classes; they have fewer instances of each.

---

## G.2 The original requirements, defect by defect

| # | Defect in the original | Issue | Rule broken | The heuristic that catches it |
|---|---|---|---|---|
| 1 | *Parandamisel* placed on the Protokoll | 1 | R1 | Whose permitted actions change? The declarant's, on the declaration |
| 2 | Declaration-level status derived by overlapping, non-total predicates | 3 | R3 | The combinations table: two protocols in different states give two values; none gives no value |
| 3 | *Kontrollitud* defined under two attribute names | 2 | R2 | The index of status names against definitions |
| 4 | *Kontroll jäi pooleli* after 14 days, with no exit | 5, 11, 6, 15 | R4, R1, R12, R15 | Who causes each exit? Nobody. Does it accept anything different? No |
| 5 | Resubmission and deadline expiry act on "the protocol" | 4 | R9 | Can there be more than one? Yes |
| 6 | A per-assessor status existing only as a display column | 18, A.10 | R3 | If it and the facts differ, which is right? There are no facts |

### How the defects compound

Defect 4 is four issues at once, and the original deadlock needed all of them together with the remedy for defect 5.

| Step | What happened | Issue |
|---|---|---|
| a | An observation, "no change for 14 days", was written as a status | 11 |
| b | An advisory observation was thereby given the force of a state | 15 |
| c | The time rule had a consequence but no scope and no exit | 6, 5 |
| d | To make "the protocol" well defined, a uniqueness rule was added: no new protocol while one is unconfirmed | 4 |
| e | The stuck protocol is unconfirmed for ever. No new one can start. The declaration can never be checked | 5 |

No single step is absurd. Step d is a reasonable repair of a real defect. The failure is in the combination, which is why Part B insisted that the issues be read as a catalogue and applied together. Checking each section of the requirements on its own would have passed all of them (issue 16).

---

## G.3 The evolved model, written down

The same model as in the case brief, expressed in the artefacts of Part E. Cells the requirements leave open are marked.

### Entities and what each owns

| Entity | Owns | Does not own |
|---|---|---|
| **Deklaratsioon** | Its versions; what the public sees; whether it can be edited or submitted; *Parandamisel*; *Kontrollitud* | Anything about how checking is conducted |
| **Protokoll** | One round of checking of one version; its assessments; the gate | Whether the declaration may be submitted |
| **Assessment** | One assessor's judgement of one version | — |
| **Kohustus** | The duty to file for a period | Not examined in this article |

Defect 6 is resolved by the third row. An Assessment is a recorded fact: assessor, version, judgement, time. "The assessor's status" is then concluded from it (*not yet assessed* or *assessed, with this judgement*), and R3 is satisfied.

### Lifecycles

The Deklaratsioon's transition table is in D1.1 and its capability matrix in E.6. The Protokoll's transition table is in E.6. Together they contain these open cells:

| Open cell | Decision |
|---|---|
| Who or what moves a protocol to *Parandamisele* or *Kinnitatud* | O1 |
| What an idle protocol becomes, and when | O2 |
| Whether the declarant may edit while a protocol is open | O2 |
| What happens to a working copy on confirmation | O3 |
| What a protocol in *Parandamisele* becomes on resubmission | Not stated |
| What happens when the correction deadline passes | Not stated |

### The hold register

One row today.

| Hold | Placed by | On | Denies | Bound to | Released by | Released if idle |
|---|---|---|---|---|---|---|
| Assessment hold | Start of a protocol | Deklaratsioon | *Submit* | The version being assessed | Protocol confirmed; protocol sent for correction | **O2** |

### Time-rule cards

| Field | Voluntary-edit window | Correction deadline | Protocol idleness |
|---|---|---|---|
| Start event | Submission: **first, or each?** | Correction requested | Last recorded act on the protocol |
| Unit, calendar | 90 days: **calendar?** | **Not stated** | 14 days: **calendar?** |
| Reset | **Not stated** | **Not stated** | Any recorded act |
| Pause | **O2** | **Not stated** | — |
| Scope | *Esitatud* | *Parandamisel* | *Koostamisel* (protocol) |
| Consequence | Guard: editing refused afterwards | **Not stated** | **O2** |
| Late command | Refused by the guard | **Not stated** | — |
| Clock | Server time at receipt | Server time at receipt | Server time |

Of twenty-four cells, eleven are open. The original requirements stated three durations and would have been read as complete.

### Facts between entities, and invariants

The five cross-entity facts and the invariants I1–I5, L1–L2 are in E.6. One observation from there bears repeating. Only I1, "at most one unconfirmed protocol per declaration", can be broken jointly and so needs coordination. Everything else each entity can keep alone.

---

## G.4 The open decisions, each in its place

For each: where it sits in the model, the options, what each option entails, what it depends on, and how hard it would be to change later (D4.8). The scenarios S1–S5 of E.6 are the form in which these go to stakeholders.

### O1 — The gates

**Where it sits.** One function: the Protokoll's completeness condition (issue 14, R14). Nothing else in the model depends on which is chosen.

| Option | Entails |
|---|---|
| The first assessor's judgement decides | Fast. The question of the remaining assessors must be answered: is their later work ignored, recorded as informational, or cancelled? (the discriminator, D3.6) |
| All assigned assessors must judge | Thorough. One absent assessor holds the protocol: a hostage state unless O2 supplies an exit (the AND-join) |
| All, or those who have judged by a time limit | A compromise; adds a time rule with all eight fields |
| Asymmetric: any one assessor can send for correction; confirmation needs all | Matches a cautious reading: an objection is enough to return, agreement must be complete. Two gates, each simple |
| A separate confirming act by a named role | The gate is a person's decision. A recorded fact with an accountable actor (P7) |

**Depends on:** P7. **To change later:** two-way for new protocols; a transitional rule for those open.

### O2 — The idle lock and the 90-day window

**Where it sits.** One field of the hold register, *released if idle*, and one field of a time-rule card, *pause*. It also fills one cell of the capability matrix: *Edit* while a hold is present.

It is really three questions, and separating them is most of the work.

| Question | Options |
|---|---|
| **a. May the declarant edit a working copy while a protocol is open?** | Yes: only *Submit* is held. No: editing is held too |
| **b. What ends a protocol on which nothing happens?** | It lapses (a lease). It is escalated to another person. Nothing: the hold is unlimited, by explicit decision |
| **c. What happens to the 90 days meanwhile?** | They run on. They pause. They restart when the hold ends |

| Combination | Who bears the authority's delay |
|---|---|
| Editing held, hold unlimited, window runs on | The declarant, entirely. The window can close without ever being usable |
| Editing allowed, protocol lapses, window runs on | The assessor, whose work is void if they are slow |
| Editing held, protocol escalated, window pauses | Nobody loses time; the process lengthens; the largest requirement (A.5) |

**Depends on:** P5 and P7, both unknown (C.5). **To change later:** meaning-changing and visible to users in either direction. It alters clocks already running. This is the decision in the case nearest to a one-way door.

Until O2 is decided, the liveness property L1 cannot be asserted, and L2 depends on L1 (E.6).

### O3 — Drafts trapped by confirmation

**Where it sits.** One invariant, I5, and one cell of the capability matrix.

| Option | Entails |
|---|---|
| A protocol cannot be confirmed while a working copy is open | The assessor now waits on the declarant. A new hostage state, in the other direction |
| The working copy is discarded on confirmation | The declarant's work is lost; they must be told, and told beforehand |
| The working copy survives; the declarant may submit it later | *Kontrollitud* is not terminal. A later submission presumably opens a new round of checking. A change of vocabulary (D4.2) |
| No working copy can exist while a protocol is open | O3 cannot arise. This is answer "no" to O2 question a |

The last row shows a dependency: one answer to O2 makes O3 disappear.

**To change later:** meaning-changing if the terminal nature of *Kontrollitud* changes.

### O4 — Submit against start-assessment

**Where it sits.** The ordering of two commands at the Deklaratsioon (D1.3, D2). Every mechanism in D2 orders them; the business decision is the same under all (D2, "O4 under each alternative").

| Option | Entails |
|---|---|
| Whichever is recorded first stands; the other is refused with the reason | Simple. Each party may occasionally be told "someone else acted first" |
| Submission always prevails; a protocol started on the superseded version is refused | Favours the declarant |
| Submission prevails; the protocol proceeds on the new version | The assessor finds themselves assessing a version they did not open. Issue 10 |

One option is absent on purpose. "The protocol prevails and the submission is withdrawn" is unavailable once the submitted version has been published (P6).

**To change later:** two-way.

### A fifth gap

Scenario S5 of E.6: a protocol is in *Parandamisele*, the correction deadline passes, and the declarant has not resubmitted. The requirements say nothing. It was not on the list of open decisions; filling in the time-rule card and the transition table found it. That is what the tables are for.

### The order in which to decide

| Order | Decision | Reason |
|---|---|---|
| 1 | O2 | Hardest to change; blocks L1; one of its answers removes O3 |
| 2 | O3 | Depends on O2 |
| 3 | O1 | Its "all assessors" option needs O2's exit |
| 4 | The fifth gap | A time rule; independent |
| Any time | O4 | Independent and two-way |

`[S]` This ordering is a result of the analysis, and it is the first thing to take to the business. It precedes any design.

---

## G.5 Candidate designs

Four candidates, each a position in D1, D2 and D3. All four enforce I1 and order O4. They differ in what else they give and what they cost.

| | A. Minimal | B. Hold as a fact | C. Merged | D. Tagged |
|---|---|---|---|---|
| **D1** | Flat states; *Submit* guarded by the protocol's state | Lifecycle, plus a hold carrying source, version and idle-release | Flat states inside one aggregate | As B, with the hold computed, not stored |
| **D2** | Both entities read and written in one serializable transaction | Two-stream atomic append | One stream | DCB |
| **D3** | Immediate reactions | Immediate reactions; superseded versions detected | None needed | As B |
| **Composition?** | No | Yes: D1.3 with D2.2 `[S]` | No | Yes |

### Against the parameters

| Parameter (C.5) | A | B | C | D |
|---|---|---|---|---|
| P1 = one source, trend unknown | Fits today. A second source means rework | Fits today and later | Fits today | Fits today and later |
| P3 low | Fits | Fits | Fits; assessors conflict on one stream, tolerably | Fits |
| P4 = one store | Requires it | Requires it | Requires it | Requires one log |
| P8 = days | The lease must live on the protocol; the declaration reads it | The idle-release rule is on the hold, where the declarant can be shown it | As A, internally | As B |
| P7, audit | "Refused: a protocol is open" | "Held by protocol P since date, for version *n*" | As A | As B |

### Against the tests of C.4

| Test | A | B | C | D |
|---|---|---|---|---|
| Over-engineering: is every mechanism justified by a parameter? | Yes | Yes: the hold by P8, the atomic append by P4 | Yes | No: nothing claims DCB's benefit. A bet |
| Under-engineering: is I1 enforced at the smallest scale? | Yes, if isolation is serializable or the read row is locked | Yes, by the declaration's stream version | Yes | Yes, if the query is the read set |
| R8: do guards read only the entity's own data? | No | Yes | Yes, trivially | Yes |

### Exits (D4.7)

| | A | B | C | D |
|---|---|---|---|---|
| To a second source of hold | Additive if facts carry a source; else meaning-changing | Additive | As A | Additive |
| To separate stores | Meaning-changing, business-visible | The same, but the hold is already the saga's semantic lock (D3.2) | Hardest: a split first | Meaning-changing |
| To DCB | Additive with entity identifiers in events | Additive | Additive with sub-entity identifiers | — |

### What the comparison shows

A and B both pass every test. They are close, and the difference between them is small in code.

- **A is less to build.** It is the right choice if P1 stays at one and nobody needs to be told *who* holds a declaration and since when.
- **B costs one recorded fact and one field more.** It gives an explanation to the user, satisfies R8, places the idle-release rule where O2 will be decided, and makes every likely transition additive.
- **C** is sound at this scale and has the worst exit.
- **D** is a bet that should be written as one.

`[S]` The choice between A and B turns on two things the business must supply: whether further kinds of hold are foreseen (P1's trend), and whether a declarant is entitled to know what is holding their declaration (P7). D4.8 added a third observation: the recording decisions that make B cheap later can be taken under A now. A team that chooses A and records *SubmissionHeld(by, version)* as a fact has kept B open at almost no cost.

This is a trade-off, stated with its deciding factors. It is not a recommendation, because two of the deciding factors are not known.

---

## G.6 A validation plan

| Step | Tool | What it would establish |
|---|---|---|
| 1 | The Decider explorer (E.2), with one declaration, two assessors, two protocols, time in days | I1–I5 in every reachable state; option to complete; shortest traces to S2, S3, S5 |
| 2 | The same, with each option for O1 and O2 substituted | Which combinations of options are sound. Some will not be: "all assessors" with "unlimited hold" fails option to complete |
| 3 | A two-connection test forcing S1 | That I1 and the ordering for O4 hold in the real store |
| 4 | Model-based property testing (E.3) | That handlers, store and reactions agree with the Decider |

Step 2 deserves emphasis. The explorer cannot choose among the business's options. It can eliminate combinations that are unsound, before the stakeholders spend a meeting on them.

---

## G.7 The guarantee statement, applied

Part F's twenty questions, asked of the evolved model as it stands.

| Questions | Status | Blocked by |
|---|---|---|
| 1, 3, 4, 5, 7, 9, 13, 18 | Answerable | — |
| 2 (exits from every state) | Not yet | O2; the fifth gap |
| 6 (simultaneous change) | Mechanism known; rule not | O4 |
| 8 (hold released if holder never acts) | Not yet | O2 |
| 10, 11, 12 (time rules) | Partly | The open cells of the time-rule cards |
| 14 (judgement when the subject changes) | Not yet | O4, third option; resubmission after *Parandamisele* |
| 15 (events reaching several entities) | Answerable only because I1 keeps "the protocol" unique | — |
| 16, 17 (sequences of steps) | Answerable under candidates A–D: the steps are atomic | — |
| 19 (assumed parameter values) | Partly | P5, P7 |
| 20 (decisions left to the business) | **Answerable in full** | — |

Question 20 is the one this Part exists to answer. The decisions are listed, each has a place in the model, each has its options and consequences, and the order in which to take them is known. What the system does until they are made remains for the business to say.

---

## G.8 What transfers

The case is small. The procedure that was applied to it is not specific to it. `[S]`

| Step | Action | Part |
|---|---|---|
| 1 | Classify: which of the seven classes are present? | 0 |
| 2 | Write entities, facts, commands, guards, invariants, time rules. Leave the screen for last | A.10 |
| 3 | Run the catalogue. Record "does not apply, because…" where it does not | B, F.1 |
| 4 | Produce the tables. Count the open cells | E.6 |
| 5 | Turn every open cell into a scenario and a named decision | E.6 |
| 6 | Establish the parameter values; mark the unknown ones | C.3 |
| 7 | Order the decisions by dependency and by how hard they are to change | D4, G.4 |
| 8 | Take a position in each group of alternatives; test each mechanism against a parameter | C.4, D |
| 9 | Make the recording decisions that keep the other positions open | D4.5 |
| 10 | Explore the model; eliminate unsound combinations of options | E.2 |
| 11 | Answer the guarantee statement; list what blocks each unanswered question | F.3 |

In a larger system each step yields more rows. The steps do not change. Their order matters: steps 1 to 7 are analysis and cost days; step 8 is the first that commits to machinery.

---

## Glossary (Part G)

| Term | Definition |
|---|---|
| Candidate A–D | The four designs compared in G.5 |
| Fifth gap | The unstated consequence of the correction deadline passing (scenario S5) |
| Open cell | A cell of an analyst's table that the requirements do not determine |
| Unsound combination | A set of options for the open decisions under which the model violates soundness |
