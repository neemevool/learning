# 012 — Interacting Entities: State, Invariants, Coordination and Time

## Part E — Modelling and Validation

Parts A to D gave the means to describe a design and to choose one. This Part is about checking it: before it is built, while it is built, and by whom.

It has two halves. E.1 to E.4 are for architects and developers: tools that explore a model or an implementation mechanically. E.5 and E.6 are for analysts: tools they can use themselves, and the artefacts a requirements document should contain so that the mechanical checks have something to check.

Tool statements were checked in November 2026 where marked; others are from the author's knowledge. Verify all of them against the current version.

---

## E.0 What can be checked, and what cannot

### Business reading

A draft contract can be tested by asking "what if" until no question produces a surprise. A model checker does the same thing without getting tired: it asks every "what if" up to a stated size. What it examines is the draft, not the eventual conduct of the parties. And it answers only the questions somebody thought to write down.

### Technical reading

Four different things can be checked, by different means.

| Question | About | Checked by |
|---|---|---|
| Is the structure consistent? Can two unconfirmed protocols exist? | The data model | Alloy (E.1) |
| Does any ordering of actions break a rule or leave a case stuck? | The behaviour of the model | TLA+, Quint, P; a Decider explorer (E.1, E.2) |
| Do the time rules interact as intended? | The timed behaviour of the model | UPPAAL; an explicit tick (E.1, E.2) |
| Does the code behave as the model says? | The implementation | Model-based property testing; systematic concurrency testing (E.3, E.4) |

**Limits common to all of them.**

- `[T]` **The model is not the system.** A proof about a model says nothing about code that departs from it. E.3 and E.4 exist to narrow that gap; they do not close it.
- `[T]` **State explosion.** The number of states grows exponentially with the number of entities and actors. Checks are run on small instances.
- `[P]` **The small-scope hypothesis** (Jackson 2006): most design errors show up in small instances. This is an empirical observation that justifies the previous point. It is not a theorem.
- `[T]` **Liveness needs assumptions** (A.2). "Every protocol is eventually confirmed" is false of any model in which an assessor may do nothing. It can be checked only under a stated assumption: the assessor acts, *or* a deadline fires. Writing that assumption is frequently the most useful result of the exercise.

---

## E.1 Model checkers

| Tool | Formalism | Best at | Weak at | Who can read the model |
|---|---|---|---|---|
| **TLA+** with TLC | States and actions in temporal logic `[T]` (Lamport 1994, 2002) | Interleavings; safety and liveness with fairness; mature | Unfamiliar mathematical notation; real time only by an explicit tick | Trained engineers |
| **Quint** | The same logic with a typed, programming-style syntax `[P]` | The same problems, with a simulator and tests; easier adoption | Verification through Apalache is bounded by a step limit; younger | Developers |
| **P** | Communicating state machines `[T]` (Desai et al. 2013) | Designs that *are* message-passing machines: actors, process managers | Systematic testing, not exhaustive proof, by default | Developers |
| **Alloy** | Relational logic over a bounded universe `[T]` (Jackson 2006) | Structure: multiplicities, uniqueness, "can this configuration exist?" Since version 6, also behaviour over time | Long behaviours; arithmetic | Engineers; analysts with some training |
| **UPPAAL** | Networks of timed automata `[T]` (Larsen, Pettersson and Yi 1997) | Real-valued clocks, deadlines, timeouts racing each other | Rich data | Trained engineers |

Notes on each.

- **TLA+.** `[P]` The most widely reported industrial use is at Amazon Web Services (Newcombe et al. 2015), where it found design errors in systems already reviewed and tested. `[T]` Time can be modelled without special machinery by a variable for the current time and an action that advances it (Lamport 2005).
- **Quint** (checked November 2026). Specifications can be simulated, and verified either by transpiling to TLA+ for TLC or with the symbolic checker Apalache, which checks executions up to a bounded number of steps. A result of "no violation" under a bound means none exists *within that bound*.
- **Alloy** is the natural tool for Part B1's issues: it will produce, unprompted, an instance with two unconfirmed protocols if nothing forbids one.
- **UPPAAL** is the natural tool for issue 6 and for O2. It represents A.5 directly. Pausable clocks are supported with approximation (verify), which reflects the theoretical difficulty noted in A.5.

### Choosing

`[S]` The choice follows the class of the question, from Part 0.

| The doubt is about | Reach for |
|---|---|
| Where a status lives; cardinalities; whether "the X" is unique | Alloy |
| Races, lost locks, missing exits, fan-out order | TLA+ or Quint; or the explorer of E.2 |
| Deadlines against each other; pause versus restart | UPPAAL; or a tick in the above |
| A process manager's handling of reordered or duplicated messages | P; or TLA+ |

For a system of the case's size, the over-engineering test applies to verification too. A week of TLA+ is justified by an intricate protocol across stores. For three entities in one store, E.2 gives most of the benefit in the language the team already uses.

---

## E.2 A Decider-based exhaustive explorer

### Idea

D4.5 recommended that domain logic be a pure function (move 5). If it is, the production code can itself serve as the model. An explorer enumerates every reachable state by applying every command in every state, and checks the invariants in each.

**Business reading.** Play every possible game on the board of D3.6, for a board with one declaration and two assessors, and report any position that breaks a rule or from which the game cannot end.

### The Decider

`[P]` Chassaing (2021) names the shape:

| Function | Type | Role |
|---|---|---|
| `decide` | Command → State → Events | Accept or refuse; say what happened |
| `evolve` | State → Event → State | Apply one fact |
| `initialState` | State | The start |
| `isTerminal` | State → bool | Whether the lifecycle is over |

Several entities are explored together by taking the tuple of their states as the state, and routing each command to its entity. A reaction rule (D3.1) is an extra step applied after each event.

> **Technical box — sketch**
>
> ```csharp
> // S must have structural equality. C# records containing collections do not:
> // use a canonical form or a custom comparer.
> static Report Explore<S, C, E>(
>     S initial, IReadOnlyList<C> alphabet,
>     Func<C, S, IEnumerable<E>> decide, Func<S, E, S> evolve,
>     Func<S, bool> isTerminal, IEnumerable<(string Name, Func<S, bool> Holds)> invariants)
> {
>     var seen = new HashSet<S> { initial };
>     var edges = new List<(S From, C By, S To)>();
>     var queue = new Queue<S>([initial]);
>
>     while (queue.TryDequeue(out var s))
>     {
>         foreach (var (name, holds) in invariants)
>             if (!holds(s)) return Report.Violation(name, PathTo(s));
>
>         foreach (var c in alphabet)
>         {
>             var next = decide(c, s).Aggregate(s, evolve);
>             if (next.Equals(s)) continue;                  // refused or no effect
>             edges.Add((s, c, next));
>             if (seen.Add(next)) queue.Enqueue(next);
>         }
>     }
>
>     // Option to complete (A.7): every reachable state can reach a terminal one.
>     var canFinish = BackwardReachable(edges, seen.Where(isTerminal));
>     var stuck = seen.FirstOrDefault(s => !canFinish.Contains(s));
>     return stuck is null ? Report.Ok(seen.Count) : Report.Stuck(PathTo(stuck));
> }
> ```
>
> `PathTo` and `BackwardReachable` are ordinary graph routines and are omitted.

### Time as an explicit tick

The alphabet includes a command `Tick`, which advances a clock in the state. Two things keep the state space finite.

- Time is counted in the coarsest unit the rules distinguish: days.
- `[T]` A clock is capped at one more than the largest constant it is compared with. Beyond that value no guard can tell the difference. This is a crude form of the region construction that makes timed automata decidable (Alur and Dill 1994).

A paused clock (O2) is modelled by `Tick` not advancing it while a hold is present.

### What it checks, and what it does not

| Checks | Does not check |
|---|---|
| Safety: every invariant in every reachable state | Liveness under fairness |
| Deadlock and option to complete, as a graph property | Anything about the store, the handlers or the transport |
| Proper completion, written as an invariant on terminal states | Instances larger than the alphabet allows |
| Time rules, at tick granularity | Real-valued timing |

**A limit that matters.** Each command is applied atomically. The explorer therefore models the designs of D2 in which decisions *are* atomic. It will not find the read-then-act window of issue 7 unless that window is put into the model: the handler split into a "read" command and a "write" command with the stale value carried in the state. This is easy to do and easy to forget.

### In the case

With one declaration, two assessors and at most two protocols:

- the original requirements fail at once: a state with *Kontroll jäi pooleli* cannot reach a terminal state (issue 5);
- O3 appears as a violation of proper completion: a terminal *Kontrollitud* with a working copy still open;
- O2 appears as a trace in which the 90-day window closes while a hold is present and no assessor has acted.

For O2 and O3 the explorer does not say what should happen. It produces the shortest sequence of events that reaches the situation, which is what the business needs in order to decide.

---

## E.3 Model-based property testing

### Idea

Generate random sequences of commands. Run each sequence against the real implementation: handlers, store and all. Run it against a simple model as well. Compare. When they differ, shrink the sequence to the smallest one that still differs.

**Business reading.** Thousands of randomly invented case histories are put through the real office and through the rule book. Any history on which they disagree is reduced to its shortest form and handed over.

### Origin and source

`[T]` Property-based testing: QuickCheck (Claessen and Hughes 2000). `[P]` Its extension to stateful systems and the lessons of applying it: Hughes (2016). `[T]` Checking concurrent executions by asking whether the observed results match *some* sequential order: linearizability (Herlihy and Wing 1990).

`[P]` In .NET, CsCheck provides random generation with shrinking, model-based testing, and a parallel mode that runs operations concurrently and searches for a sequential explanation. The feature names were not re-checked for this article; verify.

### Relation to E.2

| | Explorer (E.2) | Property testing (E.3) |
|---|---|---|
| Runs | The pure decision logic | The real implementation |
| Coverage | Exhaustive, small scope | Random, larger scope |
| Finds | Design errors | Departures of code from design |
| Oracle | Invariants | The model, which may be the same Decider folded in memory |

They are complementary. Used together, the Decider is both the production logic and the oracle, and the test is of everything *around* it: loading, appending, version checks, reactions.

### Limit

Random testing finds what it happens to generate. It gives confidence that grows with running time and never becomes proof.

---

## E.4 Systematic concurrency testing

### Idea

Take control of the scheduler. Run a concurrent test many times, each time choosing a different interleaving of the asynchronous operations, and record the choices so that a failure can be replayed exactly.

**Business reading.** Have the two clerks of A.4 re-enact their morning under a director who decides, at every step, which of them moves next, and who tries every ordering that could matter.

### Origin and source

`[T]` Controlled scheduling of concurrent programs: CHESS (Musuvathi et al. 2008). `[T]` For C#: Coyote, from Microsoft Research (Deligiannis et al. 2023), which instruments compiled code so that its testing engine controls task scheduling.

### Maturity of Coyote (checked November 2026)

| | |
|---|---|
| Latest package version | 1.7.11 |
| Released | 18 March 2024 |
| Targets | .NET 6.0 and .NET Standard 2.0 |
| Releases since | None found |
| Repository status | Could not be read for this article |

The technique is sound and the tool has substantial industrial history. But a tool that rewrites compiled code is sensitive to changes in the runtime and compiler, and one without a release in more than two years should be proven on the project's target .NET version before a test strategy is built on it. Treat it as *usable with verification*, not as a dependable platform component.

### What it does and does not reach

| Reaches | Does not reach |
|---|---|
| Interleavings of async code within the process | Interleavings inside the database |
| Read-then-act in a handler, when the store is in-process or faked | The isolation behaviour of the real store |

`[P]` For races that live in the database, the dependable method is older and plainer: a deterministic test with two connections and explicit synchronisation points, forcing the interleaving of A.4's example and asserting the outcome. One such test per jointly-breakable invariant (the under-engineering test of C.4) is cheap and permanent.

---

## E.5 Tools an analyst can use

| Tool | What it is | Useful for | Limits |
|---|---|---|---|
| **A spreadsheet** | — | The transition table, capability matrix and combinations table of E.6 | No checking beyond what the eye catches. Still the most effective tool on this list `[S]` |
| **Decision tables (DMN)** | A standard notation with declared hit policies | Derived statuses and guards (issue 3); completeness and overlap can be checked by tooling | Decisions only, not lifecycles |
| **Stately Studio** | A visual editor and simulator for statecharts | Drawing regions and hierarchy; walking through a lifecycle with stakeholders | Simulation is not exhaustive. Guards over data are opaque to it. One machine at a time is natural; interacting entities are not |
| **prooph board** | A collaborative board for event modelling | The event vocabulary between entities; who issues which command | A modelling surface, not a checker |
| **Context Mapper** | A text language and tools for domain-driven strategic design | Where boundaries between contexts lie; which terms belong to which | Structure only; no behaviour |
| **Spectacle** | A browser-based explorer for TLA+ specifications | Stepping through a model an engineer has written, and sharing a counterexample by link | Needs the TLA+ model first; not built for exhaustive checking |

The products were described from the author's knowledge, except Spectacle (checked November 2026). Verify.

`[S]` A realistic division of labour: the analyst produces the tables of E.6; an engineer turns them into a Decider and runs E.2; counterexamples come back to the analyst as short scenarios in domain language. No tool on this list removes the middle step, and none needs to.

---

## E.6 What an analyst should deliver

Five artefacts. Each is a table. Each is shown with a fragment from the case, in which cells that the requirements leave open are marked, because **an empty cell that is visible is the purpose of the table**.

### 1. A transition table per entity

Columns: from, trigger, guard, to, actor. Rule R5: no empty actor.

Fragment for the Protokoll:

| From | Trigger | Guard | To | Actor |
|---|---|---|---|---|
| — | Start | Declaration has a submitted version; no unconfirmed protocol | Koostamisel | Kontrollija |
| Koostamisel | Record assessment | Assessor is assigned; version is the one held | Koostamisel | Kontrollija |
| Koostamisel | Request correction | Gate (O1) | Parandamisele | **Not stated** |
| Koostamisel | Confirm | Gate (O1) | Kinnitatud | **Not stated** |
| Koostamisel | Idle limit reached | O2 | **Not stated** | Time |
| Parandamisele | Declarant resubmits | — | **Not stated** | Reaction |

Four open cells in six rows. The table for the Deklaratsioon was given in D1.1.

### 2. A capability matrix

Rows: commands. Columns: every condition that can affect acceptance: lifecycle states, holds, time conditions. Cells: accepted, refused, or open. Two identical columns are one condition (issue 11).

Fragment for the Deklaratsioon:

| Command | Koostamisel | Esitatud, in window, no hold | Esitatud, in window, hold present | Esitatud, window closed | Parandamisel | Kontrollitud |
|---|---|---|---|---|---|---|
| Edit | ✓ | ✓ | **O2** | ✗ | ✓ | ✗ |
| Submit | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Place hold (by protocol start) | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ |
| Discard working copy | — | ✓ | **O3** | — | **Not stated** | **O3** |

The matrix is the analyst's version of the explorer's state space. Columns that the flat status list hides (the three variants of *Esitatud*) appear here because they differ in what is accepted.

### 3. An invariant list

Split into safety and liveness (A.2), with the kind of rule (issue 15) and whether one actor alone can keep it (A.8).

| # | Statement | Type | Kind | Keepable alone? |
|---|---|---|---|---|
| I1 | At most one unconfirmed protocol per declaration | Safety | Hard | No |
| I2 | Every assessment refers to the version its protocol holds | Safety | Hard | Yes |
| I3 | A confirmed protocol never becomes unconfirmed | Safety, on transitions | Hard | Yes |
| I4 | The public always sees a submitted version, never a working copy | Safety | Hard | Yes |
| I5 | No declaration is terminal with a working copy open | Safety | **O3** | — |
| L1 | Every started protocol is eventually confirmed, sent for correction, or released | Liveness | — | Assumes an assessor acts, or **O2** |
| L2 | Every submitted declaration can eventually be resubmitted or reach *Kontrollitud* | Liveness | — | Depends on L1 |

I1 is the only one that needs coordination. L1 cannot be asserted until O2 is decided, and L2 depends on L1: the table shows why O2 comes first.

### 4. The event vocabulary between entities

The facts that cross from one entity to another, and nothing else. Rule R8: facts, not states.

| Fact | Recorded by | Carries | Consumed by | Effect there |
|---|---|---|---|---|
| Submitted | Deklaratsioon | Version | Public view | Version becomes public |
| ProtocolStarted | Protokoll | Protocol, declaration, version | Deklaratsioon | A hold on *Submit* |
| CorrectionRequested | Protokoll | Protocol, version, reason | Deklaratsioon | → *Parandamisel*; hold released; deadline starts |
| ProtocolConfirmed | Protokoll | Protocol, version | Deklaratsioon | → *Kontrollitud*; hold released |
| ProtocolReleased | Protokoll or time | Protocol, cause | Deklaratsioon | Hold released (**O2**) |

Five facts. Everything else is internal to one entity. A short vocabulary is a sign that the entities are well separated.

### 5. Counterexample scenarios

Short concrete histories that end in a question. They are the form in which open decisions go to stakeholders, and the form in which the explorer's output returns.

| # | Scenario | Question | Decision |
|---|---|---|---|
| S1 | At 10:00:00 the declarant presses *Submit* on a new version. At the same second an assessor starts a protocol on the old one | Which stands? What does the other see? | O4 |
| S2 | Day 60 after submission: an assessor starts a protocol. Nothing further is recorded. Day 91 arrives | May the declarant still edit? From when is the 90 days counted now? | O2 |
| S3 | The declarant has a working copy open. The protocol is confirmed | What becomes of the working copy? | O3 |
| S4 | Three assessors are assigned. The first records "no objections". The second, a day later, records "correction needed" | What is the protocol's status after the first? After the second? | O1 |
| S5 | A protocol is in *Parandamisele*. The correction deadline passes with no resubmission | What changes, on which entity, caused by what? | Not stated in the requirements |

### Also required, from earlier Parts

| Artefact | From |
|---|---|
| A time-rule card per duration | B2, issue 6 |
| A hold register | D1.3 |
| A combinations table per derived status | B1, issue 3 |
| A feature-pair matrix | B2, issue 16 |
| The parameter record | C.4 |

---

## Glossary (Part E)

| Term | Definition |
|---|---|
| Alphabet | The finite set of commands an explorer applies in every state |
| Bounded model checking | Checking all executions up to a stated number of steps |
| Counterexample | A concrete sequence of events leading to a violation |
| Decider | The pair *decide* and *evolve*, with an initial state and a terminal test (Chassaing) |
| Explorer | A program that enumerates all reachable states of a model |
| Fairness assumption | An assumption that an enabled action is eventually taken |
| Model checker | A tool that examines every behaviour of a model against stated properties |
| Model-based testing | Testing an implementation by comparing it with a simpler model on generated inputs |
| Oracle | Whatever decides whether a test's outcome is correct |
| Property-based testing | Testing stated properties on randomly generated inputs |
| Shrinking | Reducing a failing input to a minimal one that still fails |
| Small-scope hypothesis | Most design errors appear in small instances (Jackson) |
| State explosion | Exponential growth of the number of states with the number of components |
| Systematic concurrency testing | Controlling the scheduler to explore interleavings and replay failures |
| Tick | A command that advances modelled time by one unit |
| I1–I5, L1–L2 | The case's safety invariants and liveness properties |
| S1–S5 | The case's counterexample scenarios |
