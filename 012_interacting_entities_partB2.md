# 012 — Interacting Entities: State, Invariants, Coordination and Time

## Part B2 — Catalogue of Issues: Interaction Defects

B1 covered defects visible in a model of one moment. B2 covers those that appear only when entities act on each other: when one event reaches many, when two actors move together, when time passes, and when several parties constrain the same thing.

The template is the same as in B1: symptom, business reading, technical reading, name and source, detection heuristic, resolution options, in the case. Resolution options here point forward to the alternatives of Part D, which treats each in depth.

B2 treats issues 4 and 16, then 7 and 8, then 6 and 9, then 13, 14 and 15.

---

# Group IV — Scope and precedence

## Issue 4 — Fan-out: a parent-level event acting on N children

**Symptom.** The definite article in the singular, where the data model allows many. "On resubmission, the protocol is closed." "When the deadline expires, the protocol's status changes."

**Business reading.** "On the tenant's death the lease terminates." The tenant held three leases, one of them jointly. A sentence that was clear while the author pictured one lease is now three questions: which leases, in what order, and what of the one that has already ended?

**Technical reading.** `[T]` Russell (1905) analysed the definite description: "the X is P" asserts that an X exists, that there is only one, and that it is P. A requirement using "the protocol" therefore makes two unstated claims about cardinality. When either is false, the sentence has no defined meaning.

An event on a parent that affects children must state five things.

| Aspect | Question |
|---|---|
| **Scope** | Which children: all, those not yet final, the latest, those bound to the superseded version? |
| **Effect per child state** | What happens to a child in each of its states? Usually nothing for final ones, but that must be said |
| **Atomicity** | Do all children change in one step, or one after another? If the latter, a partly-applied condition is observable |
| **Precedence** | If effects on different children conflict, or the parent event conflicts with a child's own pending transition, which prevails? |
| **Late joiners** | What of a child created while the fan-out is under way? |

**Name and source.** `[T]` Russell's theory of descriptions for the logical defect. `[P]` "Fan-out" is the messaging term for one message reaching many receivers. No canonical name exists for the requirements defect.

**Detection heuristic.** Underline every "the X" where X is a child entity. For each, ask: *can there be none? can there be more than one?* If either answer is yes, the sentence is incomplete.

**Resolution options.**

| Option | Consequence |
|---|---|
| State a selector and a per-state effect table | Explicit. The table has one row per child state |
| Guarantee uniqueness by an invariant ("at most one unconfirmed protocol per declaration"), then "the unconfirmed protocol" is well defined | Simplest sentences. The invariant is not confluent (A.8) and must actually be enforced; if enforcement fails, every sentence relying on it fails with it |
| The parent records one fact; each child reacts to it by its own rules | Children own their reactions. Atomicity is given up: children change at different moments |
| A coordinator applies the effect to each child and tracks completion | Central control and visibility of partial progress; one more moving part (issue 14) |

**In the case.** Resubmission and deadline expiry were said to act on "the protocol" with several protocols present. The evolved model's rule "a new protocol only if none is unconfirmed" is the second option. It makes "the unconfirmed protocol" meaningful, and it is exactly the rule that deadlocked with *Kontroll jäi pooleli* (issue 5). The two issues are coupled: uniqueness invariants make fan-out simple and make missing exits fatal.

---

## Issue 16 — Feature interaction

**Symptom.** Each section of the requirements is correct on its own. No section describes two of them at once. Reviewers approve section by section.

**Business reading.** The classic example is from telephony. *Call waiting* says: when the line is busy, signal the subscriber. *Call forwarding on busy* says: when the line is busy, redirect the call. A subscriber has both. The line is busy. Each feature's specification is unambiguous; together they prescribe two different things.

**Technical reading.** `[T]` The **feature interaction problem** was identified in telecommunications (Bowen et al. 1989; Zave 1993) and surveyed by Calder et al. (2003). Features are specified and verified independently; each meets its specification alone; their composition violates one of them or is nondeterministic. Three properties make it hard.

- The number of pairs grows quadratically with the number of features.
- The interaction is in no single specification, so no single author is responsible for it.
- `[T]` There is no general solution. The literature classifies approaches as offline *detection* (analyse pairs before deployment), *avoidance* (an architecture that restricts how features compose), and runtime *resolution* (priorities).

**Name and source.** As above. The term is established.

**Detection heuristic.** List the features: every time rule, every lock, every editing right, every automatic transition. Draw the triangular matrix of pairs. For each pair ask: *can both be active for the same entity at the same time? If so, where is that situation described?* An empty cell where the answer is "yes, nowhere" is a defect.

**Limit.** `[P]` Pairwise analysis is not complete: interactions among three features exist that no pair exhibits. In practice pairs find most of them, and the matrix is affordable. Part E describes exhaustive exploration for when it is not enough.

**Resolution options.**

| Option | Consequence |
|---|---|
| Write an explicit joint rule for the pair | Precise; the number of rules grows with the pairs |
| Declare a precedence among features | Compact; may give unintended results for pairs nobody considered |
| Make the features mutually exclusive: activating one suspends the other | Removes the interaction; the suspension is itself a rule (pause or restart? A.5) |
| Adopt an architecture with a default combination, such as holds under deny-overrides | Every pair has a defined outcome from the start; it may not be the desired one, but it is never undefined |

**In the case.** Three features: voluntary editing for 90 days; assessment, which locks submission; publication of the last submitted version. O2 is the interaction of the first two. O3 is the interaction of an open working copy with confirmation. They were not found by reading any one section, because neither is in any one section.

---

# Group V — Concurrency

## Issue 7 — Cross-entity guards evaluated read-then-act

**Symptom.** "X may be done only if Y is (not) in state S", where X is a command on one entity and Y is another entity.

**Business reading.** The two clerks of A.4. Each consults the other's register, sees nothing in the way, and proceeds.

**Technical reading.** The guard is read at one moment and acted on at a later one. A.4 showed that this is write skew, and 008 Part D showed why no care in the acting step repairs it. The window between read and act exists at three scales, and they are the same defect.

| Where the guard is read | Typical window | What closes it |
|---|---|---|
| On the screen (a button shown or hidden) | Seconds to days | Nothing; the screen is always advisory (issue 15) |
| In a read model that lags the source | Milliseconds to seconds | Reading the source instead |
| In the same transaction as the write, without serializable isolation or an explicit lock | Microseconds to milliseconds | A coordination mechanism |

Closing only the largest windows makes the failure rarer and therefore harder to reproduce. It does not make the rule hold.

**Name and source.** `[T]` Write skew (Berenson et al. 1995). `[T]` Time-of-check to time-of-use (Bishop and Dilger 1996), from security. `[P]` Check-then-act.

**Detection heuristic.** Mark every guard that mentions another entity. For each ask: *if the other thing changes at that very moment, what should happen?* and *where is the condition actually checked?* If the first has no answer, a business rule is missing (A.9). If the second is "on the screen" or "in the list view", the guard is not enforced.

**The underlying rule.** `[S]` The defect arises because the guard reads another entity's *state*, which can change. A *fact* about the other entity cannot: "protocol P was started against version 3 at time *t*" stays true forever. If the declaration records its receipt of that fact as a constraint of its own, then the guard on *submit* reads only the declaration's own data. The contention has not vanished; it has moved to one place, where one entity orders "submit" and "constraint placed" against each other atomically. This is rule R8 below.

**Resolution options.** Each is an alternative of Part D.

| Option | Idea | Part |
|---|---|---|
| One boundary | Put both entities in one aggregate, or change both in one serializable transaction | D2 |
| Materialise the conflict | Make both operations write a common record, so that ordinary write-conflict detection sees them | D2 |
| Hold placed as a fact | The acting party places a constraint on the other entity; that entity then guards on its own data | D1 |
| Decision-scoped consistency | Check at append time that no relevant fact has appeared since the read | D2 (DCB) |
| Reservation | Ask first, receive a time-limited promise, then act | D3 |
| Detect and compensate | Let both proceed; find the violation afterwards; apologise | D3 |

**In the case.** *Submit* is guarded by "no protocol is open"; *start protocol* is guarded by "the declaration is submitted". Each reads the other. This is O4. The model isolates it as one question: when both arrive together, which is ordered first, and what is the other party told?

---

## Issue 8 — The lost lock: first release wins

**Symptom.** "X is locked when A begins and unlocked when A ends", in a system where more than one A, or an A and a B, can lock the same X.

**Business reading.** The account with a single "blocked" tick-box of A.6. The fraud department ticks it. The court order finds it already ticked. The fraud department finishes and unticks it. The court's hold has disappeared without anyone lifting it.

**Technical reading.** One concern, several possible holders, one boolean. The sequence *lock(A), lock(B), unlock(A)* leaves the flag clear while B still requires it set.

Two repairs exist and they are not equivalent.

| Representation | Behaviour | Weakness |
|---|---|---|
| **Counter** | Lock increments, unlock decrements; free at zero | Anonymous: cannot say who holds. Not idempotent: a repeated unlock message releases someone else's hold |
| **Set keyed by source** | Lock adds the source; unlock removes it; free when empty | None of the above. Adding or removing twice is harmless |

`[S]` The set is preferable wherever messages can be repeated, which 006 and 008 establish as the normal condition.

**Name and source.** `[T]` The counter is Dijkstra's counting semaphore. `[T]` The set under "free when empty" is deny-overrides (A.6). `[S]` "Lost lock" is this article's name for the requirements defect; none is established.

**Detection heuristic.** For every lock, block or freeze: *how many different things can switch this on? If two can, what happens when one of them switches it off?*

**Resolution options.**

| Option | Consequence |
|---|---|
| A set of holds keyed by source | Correct for any number of sources. Requires each source to have an identity and a release rule (issue 9) |
| Enforce at most one source by an invariant | A boolean is then enough. Adding a second kind of source later is a meaning-changing transition (Part D4) |
| Store nothing; derive "locked" from the sources' own states | No flag to lose. Every guarded command becomes a cross-entity read (issue 7) |

**In the case.** "Starting a Protokoll locks submission." While "at most one unconfirmed protocol" holds, there is one source and a flag suffices. The requirement already contains a second source, however: a correction request carries its own restrictions, and any future legal or supervisory hold would be a third.

---

# Group VI — Time

## Issue 6 — Timers without unit, start point, reset or scope

**Symptom.** "After 14 days." "Within 90 days of submission."

**Business reading.** A.5 gave the legal vocabulary: from when, in what unit, what interrupts, what suspends. A limitation statute that said only "three years" would be unusable. Statutes say three years *from the date on which the claimant knew*, *excluding periods during which…*, *ending at the close of the last day*.

**Technical reading.** A time rule is complete when eight fields are filled.

| Field | Question | Typical omission |
|---|---|---|
| Start event | Which recorded fact starts the clock? | "Submission": the first, or each one? |
| Unit and calendar | Calendar or working days? Which time zone? Inclusive of the last day? | All of it |
| Reset events | What sets the clock back to zero? | Whether resubmission restarts the period |
| Pause events | What stops it, and what resumes it? | Whether a lock on the entity suspends the period |
| Scope | In which states does the clock mean anything? What if the entity leaves and returns? | Behaviour "while in other states" |
| Consequence | On expiry: a transition, a guard that starts refusing, or only an indicator? | Which of the three |
| Late command | What of a command that arrives after expiry but before the system has reacted? | Always |
| Clock | Whose time: the server's at receipt, or a time claimed by the sender? | Always |

The sixth field deserves emphasis. "After 14 days without change the check is *left unfinished*" was written as a transition. As an indicator it would have created no state and no deadlock (issues 5, 11).

> **Technical box — a deadline as a function of facts**
>
> ```csharp
> // Pure: no clock access. 'now' is an input to every decision.
> static Instant? EditWindowEnd(DeclarationState s, Calendar cal) =>
>     s.FirstSubmittedAt is { } t ? cal.AddDays(t, 90) : null;
>
> static Result Decide(DeclarationState s, EditVoluntarily cmd, Instant now) =>
>     EditWindowEnd(s, Calendar.Tallinn) is { } end && now <= end
>         ? Accept(new WorkingCopyOpened(cmd.By, now))
>         : Refuse("edit window closed");
> ```
>
> The guard is evaluated on every command. A timer, if present, only prompts. `FirstSubmittedAt` embodies one answer to the reset question; it is shown as an example of where the answer lives, not as the answer.

**Name and source.** `[T]` Timed automata (Alur and Dill 1994). `[T]` BPMN 2.0 distinguishes timer events that interrupt the activity they are attached to from those that do not, which is the *consequence* field. `[S]` The eight-field card is this article's.

**Detection heuristic.** Fill the card for every sentence containing a duration. A blank field is a defect.

**Resolution options (for the consequence).**

| Option | Consequence |
|---|---|
| Guard only: commands after the deadline are refused | Robust to timer failure. Nothing happens visibly at expiry |
| Transition by timer | Visible change at expiry. Correctness depends on the timer (008) unless combined with the guard |
| Guard plus timer as prompt | Both robust and visible. The recommended default `[S]`, by A.5 |
| Indicator only | No behaviour changes; a derived flag for attention |

**In the case.** Ninety days: from first submission or from each? If each, a declarant who resubmits every 89 days edits indefinitely. Fourteen days "without change": change of what? Neither is answered here; the card shows where each answer goes.

---

## Issue 9 — The idle lock: holds without a release condition

**Symptom.** A lock is placed when an activity starts and removed when it completes. Nothing is said about an activity that does not complete.

**Business reading.** A library reserves a book for a reader. If the reader never collects it, the reservation lapses after a week. A property "under offer" does not stay so for ever. Every institutional hold on someone else's freedom of action has an expiry, an escalation, or a remedy for the party held. An unconditional, unlimited hold exists only by oversight.

**Technical reading.** `[T]` Gray and Cheriton (1989) introduced the **lease**: a grant valid for a bounded time, which the holder must renew. Expiry releases the resource without the holder's cooperation, which is the point: it restores liveness when the holder has failed or gone away.

A lease has a known cost. `[T]` The holder may act believing its lease is still valid after it has expired. 008 treats the remedy, **fencing**: the resource rejects actions carrying an outdated token. At human scale the same thing happens. An assessor whose protocol has lapsed submits a judgement the next morning. Issue 10 supplies the fencing token: the judgement is bound to a version, or to the protocol's epoch, and is rejected or reclassified if that has moved on.

Seen from the entity that is locked, an idle lock is a hostage state (issue 5).

**Name and source.** `[T]` Leases (Gray and Cheriton 1989). `[P]` Lock timeout; orphaned lock.

**Detection heuristic.** For every hold: *what releases this if the holder does nothing, for ever?*

**Resolution options.** The options differ mainly in who bears the cost of the holder's inaction.

| Option | Who bears the cost | Consequence |
|---|---|---|
| Lease: the hold expires unless renewed by activity | The holder, whose work may be invalidated | Needs the fencing rule above |
| Escalation: the hold stays; responsibility moves to another person | The holder's organisation | The locked party still waits, but someone is now obliged to act |
| Compensation: the hold stays; the locked party's clocks pause | Nobody loses time; the process lengthens | A stopwatch (A.5); the larger requirement |
| No lock: bind judgements to versions instead | The holder, who may judge a superseded version | Issue 10, second option |
| Unlimited hold, by explicit decision | The locked party | Legitimate only when written down and owned |

**In the case.** This is O2. A protocol is started and nothing further happens. Does the declarant's 90-day window run on, pause, or extend? The table is the menu; the choice is a matter of fairness between citizen and authority and is not the designer's to make.

---

# Group VII — The structure of constraints

## Issue 13 — Intrinsic lifecycle versus extrinsic constraints

**Symptom.** Statuses named after another party's activity or decision: "under assessment", "blocked", "frozen", "on hold".

**Business reading.** In an ERP system a sales order has its own progress: open, delivered, invoiced. Separately it can carry blocks: a delivery block from logistics, a billing block from finance, a credit block from risk. Each has a reason code and an owner. No ERP has a status "delivered but billing-blocked and credit-blocked"; the blocks sit beside the lifecycle.

**Technical reading.** A.6 drew the distinction.

| | Intrinsic lifecycle | Extrinsic constraint |
|---|---|---|
| Origin | The entity's own history | Another party's act |
| Identity | One current state | Many, each keyed by its source |
| Lifetime | Until the entity's next transition | Until its source releases it, or it expires |
| Combination | Not applicable: one state per region | By a stated algorithm, typically deny-overrides |
| Effect | Defines which commands exist | Denies (a hold) or permits (a grant) specific commands |

A **grant** is the dual of a hold: a permission added from outside, such as an extension of a deadline granted by the authority.

Folding extrinsic constraints into the lifecycle causes three of the defects already catalogued: state explosion (12), the lost lock (8), and the category error in reverse (1), where the entity carries a state that describes someone else's activity.

**Name and source.** `[T]` Combining algorithms (XACML 3.0). `[P]` Holds and blocks in banking and ERP practice. `[S]` The intrinsic/extrinsic split as a modelling rule is this article's synthesis; it applies Harel's orthogonality to the question of *who* causes a condition.

**Detection heuristic.** Three questions about a status. *Did the entity arrive here by its own progress, or because someone did something to it? Can it be in this condition while in several of its other states? Could there be two reasons for it at once?* One "someone else" or one "yes" suggests a constraint.

**Resolution options.**

| Option | Fits when |
|---|---|
| Hold/grant set beside the lifecycle | Several sources, or several lifecycle states in which the constraint can apply |
| An orthogonal region | Exactly one source, with a small lifecycle of its own |
| A lifecycle state | One source, applicable in one state, changing most of what the entity accepts. Entirely reasonable in a small system (Part C) |

**In the case.** "Submission locked by a started protocol" is plainly extrinsic. *Parandamisel* is less clear, and the difficulty is instructive. It is caused by the authority, which argues for a constraint. But it also changes what the declarant is *obliged* to do and starts a deadline, which is more than a denial. Part D1 works through both readings.

---

## Issue 14 — Correlation logic absorbed into an entity

**Symptom.** An entity's rules count or match things belonging to others: "confirmed when all assessors have assessed". The entity acquires fields that describe waiting: *awaiting X*, *received Y*.

**Business reading.** In a property sale, a closing agent collects the documents: the buyer's funds, the seller's signature, the lender's release. The agent knows what is outstanding and declares completion. The title deed itself does not keep a checklist of who has sent what.

**Technical reading.** `[P]` Hohpe and Woolf (2003) describe two relevant patterns.

- The **Aggregator** collects related messages and emits one result. It needs three things: a *correlation* rule (which messages belong together), a *completeness condition* (when enough have arrived), and an *aggregation algorithm* (how to combine them).
- The **Process Manager** keeps the state of a multi-step process and decides the next step from intermediate results.

When this logic lives inside a domain entity, the entity changes for coordination reasons that have nothing to do with its meaning, and a change of completeness policy becomes a change to the entity. Helland's *activity* (A.3) is the same idea: per-partner progress kept apart from the entity's own data.

**A necessary qualification.** `[S]` Sometimes the collector *is* a domain entity. The test is institutional: does the business name it, sign it, archive it? A protocol of assessment is a legal record. Its job is aggregation, and that is legitimate. What remains valid from the pattern is that its completeness condition should be a named, separable policy.

**Name and source.** `[P]` Aggregator and Process Manager (Hohpe and Woolf 2003). `[T]` Activities (Helland 2007).

**Detection heuristic.** Look for "all of", "any of", "the first", "at least *n*" over other entities, and for fields that record what is awaited. Then ask whether the thing doing the counting has a name in the business.

**Resolution options.**

| Option | Consequence |
|---|---|
| An explicit process manager, separate from the entities | Entities stay simple. One more component with its own state and failure modes (Part D3) |
| A first-class domain entity that aggregates, with the completeness condition as a named policy | Matches the business when the record exists institutionally |
| Leave it in the entity | Acceptable for one stable correlation |

> **Technical box — the gate as one replaceable function**
>
> ```csharp
> delegate bool Completeness(IReadOnlySet<AssessorId> assigned,
>                            IReadOnlyCollection<Assessment> recorded);
>
> static readonly Completeness First = (_, r) => r.Count >= 1;
> static readonly Completeness All   = (a, r) => a.SetEquals(r.Select(x => x.By));
> ```
>
> Nothing else in the Protokoll depends on which is chosen. That is what "the model isolates the decision" means.

**In the case.** The Protokoll aggregates Assessments. O1, the gates, is the Aggregator's completeness condition: the first assessor, all of them, or variants (all within a time limit; a quorum).

---

## Issue 15 — Advisory rules versus hard invariants

**Symptom.** Every rule is written with the same "must". Or: validation is described as something the form does.

**Business reading.** A pharmacist warns that two medicines interact; the doctor may proceed. The law forbids dispensing without a prescription; nobody may proceed. Between them: a rule that may be set aside by a named senior person who records why. Three kinds of rule, three kinds of consequence. Requirements that do not distinguish them force the developer to guess, and the guess is usually "block everything on the form".

**Technical reading.** Three kinds, with different permissible places of evaluation.

| Kind | If violated | Where it may be evaluated | Data it needs |
|---|---|---|---|
| **Hard invariant** | Must never happen | Only where the check is atomic with the change | Current |
| **Overridable rule** | May happen if an authorised actor decides so; the override is recorded as a fact | At the point of change | Current, plus the override |
| **Advisory rule** | Happens; someone is informed | Anywhere, including the screen and lagging read models | Possibly stale |

`[S]` Two consequences.

- A hard invariant checked on the screen is not checked. The screen may *also* show it, as a courtesy, but that display is advisory by nature (issue 7).
- An advisory rule enforced as a hard one creates blocks nobody asked for, and is a common source of hostage states (issue 5).

009 separates the point that enforces a decision from the point that makes it, and recommends an invariant register. This issue adds one column to that register: the kind of rule.

**Name and source.** `[T]` Hard and soft constraints, in constraint satisfaction. `[T]` RFC 2119's MUST and SHOULD (Bradner 1997). `[T]` XACML 3.0 distinguishes *obligations*, which the enforcement point must carry out, from *advice*, which it may ignore.

**Detection heuristic.** For each rule: *what happens if it is broken? Is there anyone who may proceed regardless? Would it matter if the rule were checked against yesterday's data?*

**Resolution options.** A rule register with four columns: the rule, its kind, its evaluation point, and for overridable rules the actor who may override. The alternatives lie in the classification of each rule, which is a business decision; the register is not optional.

**In the case.** "A new protocol only if none is unconfirmed" was treated as hard. "Fourteen days without change" was written as a state change but has the character of an advisory indicator. Much of the original deadlock came from giving an advisory observation the force of a hard rule.

---

# Rules that emerge from B2

This article's synthesis `[S]`, continuing the numbering of B1.

| Rule | Statement | Support | Issues |
|---|---|---|---|
| **R8** | Entities depend on facts about each other, never on each other's states | Helland 2007; Berenson et al. 1995 | 7 |
| **R9** | Every "the X" denotes exactly one X by an enforced invariant, or the sentence states scope and precedence | Russell 1905 | 4 |
| **R10** | A concern that several sources can hold is a set keyed by source, never a flag | XACML 3.0; Dijkstra's semaphore as the weaker alternative | 8 |
| **R11** | Every hold names its source, its scope, and what releases it if the holder does nothing | Gray & Cheriton 1989 | 9 |
| **R12** | Every time rule states start, unit, reset, pause, scope and consequence. A deadline is a fact; a timer is a prompt | Alur & Dill 1994; 008 | 6 |
| **R13** | What an entity is, and what is imposed on it, are modelled separately | Harel 1987; XACML 3.0 | 13 |
| **R14** | A correlation's completeness condition is a named policy, separable from the entity that applies it | Hohpe & Woolf 2003 | 14 |
| **R15** | A rule's kind determines where it may be evaluated; a hard invariant only where the check is atomic with the change | 009; XACML 3.0 | 15 |
| **R16** | Features that can be active together are specified together | Calder et al. 2003 | 16 |

**Limit.** As in B1: the rules detect defects. R8 and R13 in particular are defaults with a cost. Part C states when the cost exceeds the benefit.

## The whole catalogue

| # | Issue | Class (Part 0) | Rule | One-line test |
|---|---|---|---|---|
| 1 | State on the wrong entity | 1 | R1 | Whose permitted actions change? |
| 2 | Duplicate or conflicting definitions | 1, 6 | R2 | One definition per term? |
| 3 | Derived status not a function | 6 | R3 | One value per row of the combinations table? |
| 4 | Fan-out without scope | 2, 5 | R9 | Can there be none, or several? |
| 5 | Dead states, missing exits | 1, 5 | R4 | Who causes each exit? |
| 6 | Incomplete time rules | 4 | R12 | Are all eight fields filled? |
| 7 | Read-then-act guards | 2, 3 | R8 | What if it changes at that moment? |
| 8 | Lost lock | 7 | R10 | What if one of two sources releases? |
| 9 | Idle lock | 4, 7 | R11 | What releases it if the holder does nothing? |
| 10 | Judgement not bound to a version | 3 | R7 | A judgement of what, exactly? |
| 11 | History encoded as state | 1 | R1 | Two identical capability rows? |
| 12 | Flat enumeration | 1 | R6 | Can two statuses hold at once? |
| 13 | Extrinsic constraint as lifecycle state | 1, 7 | R13 | Own progress, or done to it? |
| 14 | Correlation inside an entity | 5 | R14 | Who is counting, and does the business name them? |
| 15 | Advisory versus hard | 2, 7 | R15 | What if it is broken? |
| 16 | Feature interaction | all | R16 | Where are both described together? |
| 17 | Transition without cause | 1, 4 | R5 | Is the actor column filled? |
| 18 | Stored status disagreeing with facts | 6 | R3 | If they differ, which is right? |

---

## Glossary (Part B2)

| Term | Definition |
|---|---|
| Advisory rule | A rule whose violation is reported, not prevented |
| Aggregator | A component that collects related messages and emits one result (Hohpe & Woolf) |
| Completeness condition | The rule deciding when an aggregator has received enough |
| Correlation | The rule deciding which messages or facts belong together |
| Definite description | A phrase "the X", asserting that exactly one X exists (Russell) |
| Fan-out | One event affecting many receivers |
| Feature interaction | Independently correct features that conflict when active together |
| Fencing | Rejecting an action that carries an outdated token (008) |
| Grant | An extrinsic permission, keyed by source; the dual of a hold |
| Hard invariant | A rule that must never be violated |
| Hold | An extrinsic denial of specific commands, keyed by source |
| Idle lock | A hold whose holder is doing nothing and which has no other release |
| Late joiner | A child created while a fan-out is in progress |
| Lease | A grant valid for a bounded time unless renewed (Gray & Cheriton) |
| Lost lock | A shared flag cleared by one source while another still requires it |
| Overridable rule | A rule an authorised actor may set aside, with the override recorded |
| Process manager | A component holding the state of a multi-step process and deciding its next step |
| Time-rule card | The eight fields that make a time rule complete |
| TOCTOU | Time-of-check to time-of-use: acting on a condition checked earlier |
| R8–R16 | The rules emerging from Part B2 |
