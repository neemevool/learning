# 012 — Interacting Entities: State, Invariants, Coordination and Time

## Part F — Checklists

Three instruments, condensed from Parts A to E.

| Instrument | For | Used when |
|---|---|---|
| F.1 Requirements-review checklist | Analysts | Before requirements leave the analyst |
| F.2 Design checklist | Architects | Before a design is accepted |
| F.3 Guarantee statement | Both | Before the system is called finished |

Each item cites the issue (Part B), rule (R1–R16) or section it comes from, so that a "no" can be followed back to its explanation.

**How to use them.** An item is answered *yes*, *no*, or *does not apply, because…*. The third answer is legitimate and common (C.1): for a small entity most items will not apply. The reason must be written. An item silently skipped is indistinguishable from one forgotten.

**Limit.** A checklist detects the defects somebody has already catalogued. It does not find new kinds. Parts A and B are what find those.

---

## F.1 Analyst's requirements-review checklist

### Entities and statuses

| # | Question | Source |
|---|---|---|
| 1 | Is every status attached to the entity whose permitted actions it changes? | Issue 1, R1 |
| 2 | Does every status name have exactly one definition, and is every name shared by two entities always written with its entity? | Issue 2, R2 |
| 3 | For every status: is it stated what the entity accepts and refuses in it? | A.1 |
| 4 | Are there two statuses with the same permitted actions? If so, is the difference a reason, which belongs in data? | Issue 11 |
| 5 | Can two statuses in one list both be true at once? If so, are they separated into aspects? | Issue 12, R6 |
| 6 | Is every status named after someone else's activity ("under assessment", "blocked") examined as a possible constraint, with its source? | Issue 13, R13 |

### Derived values

| # | Question | Source |
|---|---|---|
| 7 | For every status: is it *recorded* by an actor, or *concluded* from other facts? Never both? | Issue 18, R3 |
| 8 | For every concluded status: does the combinations table (none, one of each, each mixed pair) give exactly one value per row? | Issue 3, R3 |
| 9 | Is every displayed value traceable to a recorded fact or a stated definition? | A.10 |

### Transitions

| # | Question | Source |
|---|---|---|
| 10 | Does every transition name its cause: a command and its actor, a fact recorded elsewhere, or a time rule? No passive voice? | Issue 17, R5 |
| 11 | For every reaction to another entity's fact: is it stated whether it happens in the same step or afterwards? | Issue 17 |
| 12 | Does every non-final state have an exit? | Issue 5, R4 |
| 13 | Does every non-final state have an exit that does not depend on one party choosing to act? | Issue 5, R4 |
| 14 | Is every state reachable from the start? | A.7 |

### Several entities

| # | Question | Source |
|---|---|---|
| 15 | For every "the X" where X is a child: can there be none? More than one? If so, are scope and precedence stated? | Issue 4, R9 |
| 16 | For every event on a parent that affects children: is the effect stated for each child state? | Issue 4 |
| 17 | For every rule that mentions two entities: is it stated what happens if the other one changes at that moment, and what the loser is told? | Issue 7, A.9 |
| 18 | For every judgement, approval or signature: of which version? And what if the subject changes before, during, or after? | Issue 10, R7 |
| 19 | For every "all of", "any of", "the first": is the completeness condition stated, including what becomes of the others? | Issue 14, R14; D3.6 |

### Locks and constraints

| # | Question | Source |
|---|---|---|
| 20 | For every lock or block: how many things can place it? If more than one, what happens when one of them lifts it? | Issue 8, R10 |
| 21 | For every lock or block: who placed it, what does it prevent, and what ends it? | R11 |
| 22 | For every lock or block: what ends it if the holder does nothing, for ever? | Issue 9, R11 |
| 23 | Where several parties can allow or prevent an action: is it stated which prevails? | A.6 |

### Time

| # | Question | Source |
|---|---|---|
| 24 | Does every duration have a completed time-rule card: start, unit and calendar, reset, pause, scope, consequence, late command, clock? | Issue 6, R12 |
| 25 | For every "eventually" or "will be": is there a bound and a consequence when it passes? | A.2 |

### Rules

| # | Question | Source |
|---|---|---|
| 26 | Is every rule classified as hard, overridable or advisory? For overridable rules, who may override? | Issue 15, R15 |
| 27 | Is every "never" rule in the invariant list, and every "eventually" rule in the liveness list with its assumption? | A.2, E.6 |
| 28 | For every pair of features that can be active together: is the combination described somewhere? | Issue 16, R16 |

### Deliverables present

| # | Artefact | Source |
|---|---|---|
| 29 | Transition table per entity, no empty actor | E.6 |
| 30 | Capability matrix | E.6 |
| 31 | Invariant list, safety and liveness | E.6 |
| 32 | Event vocabulary between entities | E.6 |
| 33 | Counterexample scenarios for every open decision | E.6 |
| 34 | Values for parameters P1, P2, P3, P5, P6, P7, P8, or "unknown" with an owner | C.3 |

---

## F.2 Architect's design checklist

### Justification

| # | Question | Source |
|---|---|---|
| 1 | For every mechanism: which invariant does it protect, and which parameter value justifies it? | C.4, over-engineering test |
| 2 | For every mechanism justified by the future: is it written as a bet, with parameter, trigger, cost now and cost later? | C.4 |
| 3 | For every hard invariant that can only be broken jointly: which mechanism enforces it, and at which of the three scales? | C.4, under-engineering test; issue 7 |
| 4 | For every parameter: is its value recorded, with an owner and a trigger for review? | C.4, incompleteness test |
| 5 | For every piece of literature-derived guidance applied: does its premise hold here? | C.2 |

### Structure

| # | Question | Source |
|---|---|---|
| 6 | Is the position in each group explicit: structure (D1), boundary (D2), coordination (D3)? | D1 |
| 7 | Where patterns are combined: is the combination named as a composition, with its parts? | Part 0 |
| 8 | Do guards read only the entity's own data, or data changed atomically with it? | R8, R15 |
| 9 | Does any guard read a projection, a cache or the screen? | Issue 7 |
| 10 | Is authorisation (who may attempt) separated from validity (is it valid now)? | D1.4; 009 |
| 11 | Is every display status derived, and read by no guard? | Move 8 |

### Concurrency and time

| # | Question | Source |
|---|---|---|
| 12 | For every decision that reads data it does not write: is that data's version checked too? | D2.2; A.4 |
| 13 | Is every deadline a function of recorded facts, with the current time as an input? | A.5; move 7 |
| 14 | Does correctness hold if a timer fires late, twice or never? | A.5; 008 |
| 15 | For every hold lasting longer than a transaction: is it a recorded fact with a source, a version and an idle-release rule? | R11; P8 |
| 16 | For every expiring grant: what rejects an action that arrives after expiry? | Issue 9; 008 |
| 17 | For every multi-step sequence: what is true between the steps, and what repairs a sequence that stops half way? | D3.2 |

### Evolution

| # | Question | Source |
|---|---|---|
| 18 | Are state changes recorded as facts with actor, time and cause? | Move 1 |
| 19 | Does every event carry the identifiers of all entities it concerns? | Move 2 |
| 20 | Does every hold carry its source, and every judgement its version? | Moves 3, 4 |
| 21 | Is the domain logic a pure function, hosted by infrastructure? | Move 5 |
| 22 | Does the invariant register state what each invariant's enforcement depends on? | Move 9; 009 |
| 23 | Which likely transitions are meaning-changing or one-way, and are those decisions recorded? | D4.7; 009 |
| 24 | For every changeable rule: what happens to instances in flight? | D4.3 |

### Validation

| # | Question | Source |
|---|---|---|
| 25 | Has the model been explored exhaustively at small scope for safety and for option to complete? | E.2 |
| 26 | Is there a deterministic two-connection test for each jointly-breakable invariant? | E.4 |
| 27 | Is the implementation compared against the model on generated command sequences? | E.3 |
| 28 | Is every liveness claim accompanied by its assumption? | E.0 |

---

## F.3 Guarantee statement

In the spirit of 008 B.4: questions that must be answerable about the finished system **without hedging**. "Usually", "should", "in practice" and "unless something goes wrong" are hedges. An answer of the form "No, and here is what happens instead" is not a hedge. It is a stated limit.

### About any entity

1. For each of its states, which commands does it accept, and which does it refuse?
2. From each non-final state, what are the exits, and who or what causes each?
3. Which of its statuses are recorded and which are concluded, and from what?

### About any rule

4. Is it hard, overridable or advisory?
5. If hard: where is it enforced, and is that check atomic with the change it guards?
6. If it reads another entity: what happens when that entity changes at the same moment?

### About any hold

7. Who placed it, what does it prevent, and what ends it?
8. What ends it if its holder never acts again?
9. If two parties hold the same thing and one releases, what is the state?

### About any time rule

10. From which recorded fact is the period counted, in what unit, and what restarts or pauses it?
11. What does the system do with a command that arrives after the deadline but before anything has reacted to it?
12. What happens if the timer does not fire?

### About any judgement

13. Of which version was it made?
14. What becomes of it when the subject changes?

### About any event that reaches several entities

15. Which ones, in what order, and what is observable while only some have been reached?

### About any sequence of steps

16. What is true between the steps?
17. If it stops after any given step, what restores a consistent condition, and who is told?

### About the design as a whole

18. Which invariants depend on the entities sharing one store?
19. Which parameter values does the design assume, and what event would invalidate each?
20. Which decisions were left to the business, who owns each, and what does the system do until they are made?

A system for which all twenty can be answered plainly may still be wrong. A system for which they cannot is not yet understood.

---

## Glossary (Part F)

| Term | Definition |
|---|---|
| Does not apply, because… | A legitimate checklist answer, valid only with its reason |
| Guarantee statement | A set of questions about a finished system that must be answerable without hedging |
| Hedge | A qualifier that makes a claim unfalsifiable: "usually", "should", "in practice" |
| Stated limit | An explicit statement of what the system does not guarantee and what happens instead |
