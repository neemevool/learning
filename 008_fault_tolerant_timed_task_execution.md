# 008 — Fault-Tolerant Timed Task Execution

**Audience:** medium-to-senior developers who design or maintain scheduling and background-processing systems.

**Purpose:** to give a platform-neutral foundation for reasoning about timed task execution, so that you can (a) state what your system actually guarantees, (b) recognise over-engineering, and (c) identify incomplete designs before they fail in production.

**How to read this.** Part A is the theory and is the point of the document. Part B is the minimal checklist. Part C is what off-the-shelf components leave to you. Part D is a standalone deep dive that Part A refers to. Part E is the reading list.

---

## Preface: this is not one problem

"Scheduling" names two problems that share a word and have almost nothing in common.

**Time → firing** is a data-structure problem. Given temporal specifications and a clock, produce firings. It is solved, non-distributed, and requires no coordination: heaps, hierarchical timing wheels, bucketed indexes. It dominates when periods are short.

**Firing → effect** is a fault-tolerance problem. It is where duplicate emails, missed runs, overlapping batches and stuck jobs live. It dominates when periods are long.

The parameter that separates the regimes is

```
g = period / durable-write-latency
```

If `g < 1` you cannot durably record each firing. High-rate schedulers are therefore in-memory, non-durable, and recover by *recomputing from the specification*, never by replaying a log. If `g >> 1` — a daily job gives `g ≈ 10⁷` — you can afford several durable state transitions per firing, and per-occurrence exactly-once *effects* become affordable.

No single system serves both regimes well. Attempts to build one are a common source of over-engineering: machinery justified by the high-rate regime, applied to a job that runs once a day.

**Everything below assumes `g >> 1`.**

---

# A. Principles

## A.1 The four basic entities

Most implementations collapse four distinct entities into one table. That collapse is the single largest source of undiagnosable behaviour. Keep them separate.

| Entity | Identity | Nature | Cardinality |
|---|---|---|---|
| **Job** | assigned | a *specification*: temporal expression, payload template, policies | 1 |
| **Occurrence** | `(job, nominal_instant)` — **derived** | a *fact about time*: work is owed | 1 per firing |
| **Unit of work** | `(occurrence, partition_key)` — **derived** | an element of the fan-out; the unit of progress and retry scope | N per occurrence |
| **Attempt** | assigned | one interaction with the world | M per unit |

Relations: Job 1→N Occurrence, Occurrence 1→N Unit of work, Unit of work 1→N Attempt.

### Job

A pure specification. Contains no execution state. Answers "what should happen, and when, and under which policies". A job should be readable as data and should never mutate as a side effect of running.

The temporal specification is a *generator*, not a timestamp. It exposes two operations: "does this civil datetime match?" and "what is the next matching civil datetime after X?". Critically, the generator **must not read the clock**. Two nodes, or one node at two different times, must produce identical output for identical inputs. A generator that consults "now" internally silently reintroduces the coordination problem you were trying to avoid.

### Occurrence

A firing is **derived, not received.**

This is the most consequential decision in the entire design, so it is worth stating twice. If a firing is an *event you receive*, then missing it destroys information permanently, and the only defence is another party that noticed the loss — which needs its own watcher, and so on. If a firing is a *value you compute*, then a node that boots three hours late computes the same set and repairs itself. The regress does not terminate; it never starts.

The occurrence set is a pure function:

```
occurrences(job_version, t0, t1) → ordered set of nominal instants
```

over a half-open window `[t0, t1)`. Reconciliation is then a set difference:

```
missing = derive(job, t0, t1) \ materialised(job, t0, t1)
```

Materialising each missing occurrence under its deterministic identity is idempotent, safe to run concurrently on every node, and safe to run at any frequency. That is the entire self-healing core of the system, and it is three lines of concept.

**Deriving occurrences — the algorithm.** The industrial reference semantics are RFC 5545 recurrence rules; the pattern-level treatment is the Temporal Expression pattern. The shape is:

1. **Anchor** at a start point expressed as a *civil datetime plus a named time zone* — never as an absolute instant.
2. **Expand coarse to fine.** Start from the base frequency and iterate periods. Apply each constraint. Each constraint is either *expanding* (multiplies candidates) or *limiting* (filters them), and which one it is depends on the base frequency. This classification is the non-obvious part and is tabulated in RFC 5545.
3. **Filter and select.** Apply limiting rules, then positional selection ("last working day of the month"), then count/until bounds.
4. **Resolve** each civil datetime to an absolute instant using the zone rules in force *for that instant*. Two pathologies require explicit, job-level policy:
   - *Nonexistent* local time (spring-forward gap): skip the occurrence / shift forward past the gap / shift back.
   - *Ambiguous* local time (autumn fold): take the first / take the second / take both.
5. **Yield** those falling in `[t0, t1)`.

**Complexity warning.** Naive expansion is pathological for sparse rules — "29 February falling on a Monday" scans decades of candidates. Cost should be O(occurrences in window), not O(candidates examined). Bound the search horizon explicitly, or accept an unbounded loop in production.

**Choosing `t0` is the misfire policy in disguise.** Two options:
- *Watermark*: `t0 = last_reconciled_instant`. Recovers everything; a two-week outage produces two weeks of backfill at once.
- *Bounded lookback*: `t0 = now − Δ`. Bounds the backfill; silently discards anything older than Δ.

Δ is not a technical constant. "If we are down for three days, do those reminders go out when we return?" is a business question, and Δ is its answer. See A.9.

### Unit of work

The element of the fan-out — one recipient, one account, one file. It is the unit of **durable progress** and the scope of **retry**.

Its `partition_key` must satisfy two properties that are easy to violate:

1. **Derivable from the domain**, not assigned by whoever fanned out first. An auto-increment identifier fails this.
2. **Stable across derivations.** "Row number in the result set" fails this, because the result set changes.

If a job has no fan-out, `partition_key` is a constant and the unit of work collapses into the occurrence *legitimately*. This is the one benign collapse in the model.

### Attempt

One interaction with the world. Note that unlike occurrences and units, an attempt's identity **cannot** be derived — it is a fact about the past, not about the schedule. Attempts record what happened: when, by whom, with what outcome, with what fencing token.

Keeping attempts separate from units is what makes "did this send twice, once, or not at all?" an answerable question after the fact.

### Identity is prior to idempotence

> **Deduplication is impossible without a canonical name that all parties can independently derive.**

This is the load-bearing sentence of the whole document.

Idempotence is not a property you add to a handler by writing careful code. It is a property that becomes *available* once the unit of work has a name that any node can compute without asking anyone. Given such a name, a uniqueness constraint on a single linearizable store performs deduplication. Without it, no amount of coordination helps — and the reason is worth being precise about, because "just add consensus" is the most common wrong turn in this area.

Consensus lets a set of processes agree on a *value*. Deduplication requires deciding whether a proposed action is *equivalent* to one already performed. "Equivalent" is an equivalence relation on actions, and consensus does not supply it. Concretely: if node A generates an action labelled `a7f3` and node B independently generates "the reminder to user 42 for the 2026-09-01 run" labelled `b91c`, all nodes can agree perfectly that the set of actions is `{a7f3, b91c}`. Consensus succeeded. Deduplication failed. The missing ingredient is a canonical naming function, which is a **domain** artifact, not a distributed-systems one.

There is a sharper second form. Even given a naming function, deduplication must be enforced **where the effect becomes visible**. Agreement among your own processes about what was sent is not the same as the world having received it once.

So consensus is **neither necessary nor sufficient** for deduplication:
- *not necessary* — a derived name plus a uniqueness constraint on one linearizable store suffices;
- *not sufficient* — the effect boundary can duplicate regardless of what your nodes agreed.

**Classical attempts to substitute coordination for naming, and how each fails:**

| Attempt | Failure mode |
|---|---|
| Distributed lock across nodes | A garbage-collection pause or clock skew produces two holders. The accepted repair is a fencing token — which *is* a monotonic name checked at the resource. |
| Leader election, "only the leader acts" | Leadership is a claim about the past by the time you act. During a transition two leaders overlap, and the old leader's in-flight request can land after the new leader's. The classical repair is a sequencer — again, a name. |
| Two-phase commit between store and external service | The external service has no prepare phase. Even where one exists, 2PC blocks on coordinator failure. Observable symptom: "marked sent but never sent", or the reverse, indefinitely. |
| Total-order broadcast ("put everything through consensus") | Agreeing the sequence is fine, but the consumer must record its read position *atomically with the effect*. The dual write returns. Streaming platforms achieve exactly-once only because offset commit and produce live in the *same* transactional system; the property evaporates the moment the effect is external. |
| Quorum read before acting | Read-then-act is not atomic. Both nodes read "not done", both act. You need a *conditional write*. |
| Serializable isolation as deduplication | Correct *within* the store. Fails the moment the reasoning is extended to cover the external effect, which it cannot reach. |

The pattern in every row is the same: coordination is being asked to establish **identity**, and it can only establish **agreement**.

---

## A.2 The four conditional entities

The four basic entities are minimal but not sufficient. Four more are required under conditions that you should evaluate explicitly rather than by default.

### Claim / Lease

`(unit of work, worker, expiry, fencing token)` — the assertion that a particular worker is currently responsible for a unit.

*May be folded into the unit of work as columns* when the store is single and linearizable.

*May not be folded* when the claim lives in a different system from the unit state. A message broker's visibility timeout is a claim held by the broker while the unit state lives in your database. That is a dual write, and it will diverge.

A lease is not a lock. A lock has no time bound; a lease does. But a lease's safety depends on bounded clock drift *and* bounded process pauses, and the asynchronous model provides neither — a 40-second pause is indistinguishable from a crash. Therefore:

> **A lease gives mutual exclusion of *intent*, never of *effect*.**

To obtain exclusion at the effect boundary you need a monotonic **fencing token** that the resource itself checks, or you fall back on name-based deduplication at the resource. Tightening the lease duration does not remove the window; it only changes its probability.

### Effect record

The *intent* to act externally, recorded separately from the attempt that carries it out.

Attempt = what you did. Effect record = what you promised to do. The transactional outbox pattern is exactly this entity.

*Droppable only* if the effect boundary participates in your store's transaction. For anything crossing a network to a third party, it never does. See A.6.

### Job version

What happens to already-derived occurrences when somebody edits the schedule?

Without this entity the question has no answer, and the observable behaviour is that historical occurrences silently change meaning under you. *Droppable* if jobs are immutable — which is a design choice available to you, and often the cheaper one.

### Temporal context

Zone, business/holiday calendar, and the *version* of the time-zone database in force.

*Droppable* if everything is UTC and no business calendar exists. This is rarer than teams assume: "the first working day of the month" is a business calendar, and business calendars change retroactively.

**Summary:** four core entities, four conditional. Which conditionals you need is determined by the selection parameters in A.7 — not by taste, and not by what the framework happens to offer.

---

## A.3 Collapses, and why they cannot be repaired later

Each collapse below is common, and each destroys information. The distinguishing feature of a destroyed-information bug is that **no amount of implementation quality compensates for it**, because the fix requires data you never wrote down.

### Job ≡ Occurrence

*Shape:* one row per job with a mutable "next run at", advanced after each firing.

*Consequence:* history is destroyed on advance. Backfill is impossible, because you never named the occurrences you skipped. The misfire policy is therefore permanently restricted to "skip" or "fire once immediately", and can never be "fire all". Concurrent workers race on one row, so that row becomes a global lock and the job cannot fan out.

*Why unrepairable:* you cannot reconstruct a set of occurrences that were never materialised, once the derivation anchor has moved past them. No index, isolation level or retry policy recovers a name that was never assigned.

### Occurrence ≡ Attempt

*Shape:* a single "last run at" timestamp; or a runs table where a row means both "was due" and "was executed".

*Consequence:* you cannot distinguish "not yet run" from "ran and failed" from "ran, outcome unknown". Retry and scheduling become the same mechanism, so retry policy and misfire policy cannot be configured independently.

*Why unrepairable:* the distinction is information that was never recorded. The observable symptom is that "did this send twice or zero times?" is unanswerable after the fact — which is precisely the question you will be asked.

### Occurrence ≡ Unit of work

*Shape:* the fan-out lives in memory for the duration of the run.

*Consequence:* partial progress is not durable. A crash at 90% forces a full redo, which forces the effect to be idempotent anyway — so you pay the cost of idempotence without gaining resumability. Utilisation is computed over the whole batch, so "does it fit the window?" becomes all-or-nothing rather than a progress question.

*Why unrepairable at scale:* recovery time is bounded below by full batch duration. As N grows, recovery becomes impossible within the period — utilisation exceeds 1 by construction under any nonzero crash rate.

### Attempt ≡ Effect

*Shape:* performing the external action inside the transaction; or setting "done" immediately before or after the action with no separate record.

*Consequence:* a dual write.

*Why unrepairable:* this is Skeen's result directly (A.6). Serializable isolation does not help, because the external effect is not a participant in the transaction. The usual compensation — "mark sending, send, mark sent" — reduces the duplicate window but does not close it, and is in fact an outbox with the durability removed.

### Claim ≡ Unit state, without a fencing token

*Consequence:* mutual exclusion of intent, not of effect. A worker that pauses for 40 seconds resumes believing it holds a lease that expired 30 seconds ago.

*Why unrepairable locally:* the resource must reject the stale actor. Nothing you do on the worker side removes the window.

### Nominal instant ≡ absolute instant

*Shape:* storing only a UTC timestamp for "09:00 in a named zone".

*Consequence:* daylight-saving transitions and time-zone database updates silently move, duplicate or delete occurrences. On the spring-forward day, 03:30 local does not exist; on the autumn day it exists twice.

*Why unrepairable:* once resolved and stored, you cannot re-resolve under corrected rules, and you can no longer identify which stored instants were affected. The repair is to store the civil datetime, the zone, and the resolution policy, treating the absolute instant as derived.

---

## A.4 Assignment strategies

Assignment answers: which worker processes which unit of work?

### The three families

**1. Deterministic partitioning.** Each worker owns a partition computed from the key. Zero coordination on the common path, replayable, and unit identity remains derivable. Weaknesses: skew (one partition holds far more work), stragglers, and rebalancing when the worker count changes. Use rendezvous hashing or consistent hashing with virtual nodes so that a change in N relocates roughly 1/N of keys rather than nearly all.

**2. Queue / work-stealing.** Optimal load balancing and skew tolerance, at the price of a coordination point and non-deterministic assignment — which means identity **must** travel inside the work item.

**3. Compare-and-swap per unit.** A conditional update: "claim this unit if and only if it is unclaimed." Both assignment and mutual exclusion in one atomic operation.

The axis is **determinism versus adaptivity**. Deterministic assignment is free but brittle under skew. Adaptive assignment costs a coordination point but degrades gracefully.

### The hybrid: deterministic partitioning with queue overflow

Each worker processes its own partition against a deadline budget, tracking progress rate and projecting completion. When the projection exceeds the deadline times a safety factor, it *releases* the tail of its partition into a shared queue from which any worker may claim.

What makes this safe:
- Release is a state transition on the unit rows in a single transaction, so a unit is never simultaneously owned and queued.
- A claim from the queue carries a lease and a monotonically increasing fencing token; on expiry the unit returns to the queue.
- Because unit identity is still derived, requeue is idempotent. A zombie original owner that resumes will collide on the uniqueness constraint or fail the fencing check at the resource.

**Tuning note.** Spilling one large chunk at a threshold is a poor design: the code path runs rarely and is therefore untested at the moment you most need it. Continuous spilling of small chunks makes the queue a continuous tail balancer and exercises the path constantly.

**Simpler alternative, usually better: over-partitioning.** Make the partition count much larger than the worker count — say 64 partitions per worker — and assign whole partitions to workers dynamically. You obtain most of the load balancing with a *coarse-grained* coordination point (partition assignment, changing rarely) instead of a per-unit one. Prefer this, and add the spill only after measuring tail latency that it would actually fix. The hybrid is legitimate engineering, but it is a second code path exercised under exactly the conditions where you least want surprises.

### Why compare-and-swap matters (short version; Part D is the long one)

Herlihy's consensus hierarchy classifies synchronisation primitives by the largest number of processes for which they can solve consensus **wait-free** — that is, where every process finishes in a finite number of *its own* steps regardless of whether others are slow or dead.

| Primitive | Consensus number |
|---|---|
| plain read/write registers | 1 |
| test-and-set, fetch-and-add, FIFO queue | 2 |
| compare-and-swap | ∞ |

Two consequences matter here.

**First**, plain reads and writes cannot solve wait-free consensus for even two processes. Read-then-act is not a coordination primitive, no matter how carefully written. This is a theorem, not a matter of skill.

**Second**, compare-and-swap solves it for any number of processes, and by Herlihy's *universal construction*, anything solvable wait-free is solvable given consensus. So a single linearizable compare-and-swap object is **sufficient for safety**: no additional coordination service can give you a safety property you could not already obtain.

The honest qualification, which matters for architecture decisions:

- **Sufficient for safety.** True.
- **Not sufficient for availability.** Your scheduler's availability is bounded above by that of the store providing the compare-and-swap.
- **It relocates the impossibility, it does not remove it.** In an asynchronous message-passing system a wait-free compare-and-swap object cannot be implemented at all — that would solve consensus, contradicting FLP. A single-master transactional store gives you a genuine consensus-number-∞ object *for as long as it is up*. Consensus has been localised to one node, and the price is availability under partition.

For `g >> 1` this is almost always the right trade: you accept a bounded outage, level-triggered derivation makes the outage self-healing, and you avoid an entire coordination subsystem. For a system that must fire *during* a partition, it is the wrong trade and you need replicated consensus. **This is a judgement about availability requirements, not a theorem.**

**Practical reading:** a conditional update on a unique key in a transactional store is a compare-and-swap. Most systems do not need a dedicated coordination service; they need one linearizable register per unit of work.

---

## A.5 Overlap prevention is a utilisation problem, not a locking problem

"Do not start the next run before the previous one finishes" is the real-time-systems constraint *deadline ≤ period*. It is a capacity question wearing a concurrency costume.

**The capacity model.** With per-job cost `Cᵢ` and period `Tᵢ`, utilisation is

```
U = Σ (Cᵢ / Tᵢ)
```

Earliest-deadline-first scheduling is feasible if and only if `U ≤ 1`. Fixed-priority rate-monotonic scheduling guarantees feasibility only up to `n(2^(1/n) − 1)`, which tends to `ln 2 ≈ 0.693`. That gap is worth knowing: a fixed-priority system can miss deadlines at 70% utilisation while a deadline-driven one is still fine.

**If `U > 1`, no lock, watcher or retry policy saves you.** The backlog grows without bound. The only genuine options are: shed work, coalesce firings, reduce `C` (partition and parallelise), or increase `T`.

> A mutex applied to an overload converts a visible overload into an invisible one. The queue still grows; you have merely stopped observing it.

**What the queueing results actually say.** Three distinct results are usually conflated:

1. **Stability condition, `ρ = λ/μ < 1`.** This is what makes the backlog diverge when you exceed capacity.

2. **Little's Law, `L = λW`.** Over a long interval in a stable system, the average number of items in the system equals arrival rate times average time in system. It needs almost no assumptions — no distributional assumptions, any queue discipline, any number of servers — only stability and existence of the long-run averages. It is an *accounting identity*, not a cause of blowup. Its two practical uses:
   - It tells you the **resource cost of latency**: in-flight count grows linearly with time-in-system, so memory, connection-pool slots, held locks and live leases all grow with `W`.
   - It is a **lie detector**: measure `L`, `λ` and `W` independently; if they do not satisfy the identity, one measurement is wrong or the system is not stable.

3. **Kingman's heavy-traffic approximation** gives the shape near saturation. For a general single-server queue,

   ```
   W ≈ ( ρ / (1−ρ) ) · ( (c_a² + c_s²) / 2 ) · τ
   ```

   where `c_a` and `c_s` are the coefficients of variation of interarrival and service times, and `τ` is mean service time.

Two things to read off Kingman that matter for batch design:

- The `ρ/(1−ρ)` factor: latency at 90% utilisation is nine times that at 50%; at 99% it is ninety-nine times. Planning to run a batch window at high utilisation is planning for latency to be dominated by queueing rather than by work.
- The variance term is **multiplicative with, and symmetric to, utilisation**. Halving service-time variance buys as much as adding substantial headroom. Per-unit calls to external systems are the dominant source of service-time variance, which makes timeouts, hedging and bulkheads *capacity* measures, not merely reliability measures.

---

## A.6 Exactly-once does not exist

Not "is hard to achieve". Does not exist, in an asynchronous system with crash faults.

### The elementary argument

You have local state and an external effect. You must order two things: performing the effect, and recording that you performed it.

- **Record, then act.** Crash in between → the effect never happens but is recorded as done. **At-most-once**, with silent loss.
- **Act, then record.** Crash in between → the effect happens and is repeated on recovery. **At-least-once**, with duplicates.

A third option requires an atomic commit spanning your store and the external effect. There is no such thing to reach for.

### The results underneath

**Skeen (1981): no non-blocking atomic commitment protocol exists in the asynchronous model.** Atomic commitment is the problem of getting a set of participants to agree unanimously on commit or abort, where any participant may veto. *Non-blocking* means that correct participants reach a decision even when others fail. Skeen's result says you must choose: either the protocol blocks when a participant (particularly the coordinator) fails, or it is not atomic.

Two-phase commit exists and is atomic — and it blocks. When the coordinator fails after participants have voted, participants hold their locks and wait, indefinitely, because they cannot distinguish "coordinator crashed before deciding" from "coordinator decided and will tell us shortly". Three-phase commit reduces blocking but requires synchrony assumptions that the asynchronous model does not grant.

Beneath Skeen sit two more:
- **FLP (1985):** no deterministic protocol solves consensus in an asynchronous system with even one crash fault. Atomic commitment is a consensus problem, so the impossibility is inherited.
- **Two Generals:** no protocol achieves agreement over a lossy channel, because the last message is always unacknowledged.

And in practice a third obstacle, independent of theory: **external services do not offer a prepare phase.** Even if you were willing to block, mail transport, payment endpoints and third-party APIs give you `send`, not `prepare`/`commit`.

### What *does* exist: exactly-once effect

```
at-least-once execution + idempotent receiver keyed by derived identity = exactly-once effect
```

Note the load-bearing condition: **the effect boundary must participate.** Either the receiver deduplicates by a key you supply, or the resource verifies a fencing token, or you do not have the property. This is not something you can add on your side.

**Worked through for mail.** Mail transport is at-least-once by design at the protocol level — retries are specified behaviour — and delivery confirmation is out of band. End-to-end exactly-once mail is therefore **not achievable in principle**. What *is* achievable, and what your design document should state:

- **at-most-one recorded intent** (uniqueness constraint on derived identity),
- **at-least-once attempt** (retry until acknowledged),
- **deduplication at the provider** via an idempotency key or message identifier.

If your provider offers no idempotency key, you do not have exactly-once, and no amount of local engineering will produce it. Say so in the design document rather than implying otherwise. A stated limit is an engineering artifact; an unstated one is a future incident.

### The practical resolution: outbox

The transactional outbox converts "atomic across two systems" — impossible — into three achievable pieces:

1. atomicity **within one system** (write business state and effect record in one transaction),
2. **at-least-once transfer** from the effect record to the external service,
3. **idempotent receipt** at the far end, keyed by derived identity.

The impossibility has not been defeated. It has been pushed to step 3, where it is the receiver's responsibility, and where — unlike in your process — it can actually be discharged.

---

## A.7 Design selection parameters

A variation of the system is fully specified by roughly six parameters. Everything else — storage engine, language, framework — is substitution *below* these choices, not a design decision at this level.

| Parameter | Range | What it forces |
|---|---|---|
| `g` = period / durability latency | `<1` … `10⁷` | in-memory recomputation vs. durable per-occurrence state machine |
| Fan-out cardinality | 1 … 10⁷ | whether the unit-of-work layer exists at all |
| Effect boundary control | none / idempotency key / transactional | exactly-once effect achievable, or reconcile-only |
| Misfire semantics | skip / immediate / coalesce / backfill | how occurrence derivation handles gaps; the value of Δ |
| Utilisation `U` | ≪1 … >1 | overlap policy, shedding, backpressure |
| Skew | uniform … heavy-tailed | static partitioning vs. queue vs. over-partitioning |

**How to use this table.** Fill it in *before* choosing components. Two systems with different values in this table are different systems and should not share an implementation, however similar their requirements documents look. Conversely, if two jobs agree on all six, they do not need two mechanisms.

**The over-engineering test.** For each subsystem, ask which parameter value makes it necessary. Machinery whose justifying parameter value you do not have is over-engineering — most commonly, coordination infrastructure sized for `g < 1` deployed on a job with `g ≈ 10⁷`.

**The incompleteness test.** For each parameter, ask where in the system its value is written down. A parameter with no home in the design is a decision made accidentally, in code, by whoever wrote the loop.

---

## A.8 Liveness versus safety

The definitions are precise, not intuitive.

- A **safety** property says *nothing bad ever happens*. Formally, it can be violated by a **finite prefix** of an execution. Once violated, no continuation repairs it.
- A **liveness** property says *something good eventually happens*. It can never be violated by a finite prefix; any finite execution can still be extended to satisfy it.
- **Alpern & Schneider's theorem:** every property is the intersection of a safety property and a liveness property. So the classification is exhaustive — every requirement you write decomposes into these two.

For a timed task system:

| | Property |
|---|---|
| **Safety** | no unit's effect occurs more than once; no effect occurs for an occurrence that was not due |
| **Liveness** | every due unit eventually reaches a terminal state |

### The design rule

> **Build so that a wrong failure detector costs liveness, not safety.**

A failure detector is whatever decides "that worker is dead" — a heartbeat timeout, a lease expiry, a health check. It has two error modes:

- **False positive** (a live worker is suspected). Another worker is dispatched for the same unit. If safety depended on "only one worker was ever dispatched", you have violated safety on a finite prefix, irrecoverably. If instead safety comes from derived identity + uniqueness constraint + fencing token, the second dispatch is *wasted work* — a cost in efficiency and latency, which is liveness-class.
- **False negative** (a dead worker is not suspected). The unit stalls until the lease expires. Pure liveness cost by construction.

### The test you can apply mechanically

At every point where the system consults a failure detector, ask:

> *If this answer is wrong — in either direction — does some finite prefix now violate a safety property?*

If yes, you have made the detector safety-critical. Since no correct failure detector exists in the asynchronous model (A.10), you now have a system whose safety guarantee is unachievable. You are betting on timeouts and calling it a guarantee.

The three constructions that move you to the safe side:

1. **Derived unit identity + uniqueness constraint** in a linearizable store — deduplicates *intent*.
2. **Fencing tokens verified at the resource** — deduplicates *effect*.
3. **Idempotent effects** (provider idempotency keys) where 2 is unavailable.

### Why this dissolves the watcher regress

Once the detector cannot break safety, it is *permitted to be crude*. A crude detector does not need a supervisor to be **correct**; it needs one only to be **timely**. Supervision has been demoted from a correctness requirement to an availability optimisation with measurable, diminishing returns.

That is why the regress terminates. Not because you stopped adding layers, but because the property that would have forced you to keep adding them was never made to depend on them.

### And why the layers have a hard floor anyway

This is reliability engineering rather than computer science, and it is the quantitative half of the argument.

*The naive reasoning:* component A has unavailability `q_A`, watcher B has `q_B`. If failures were independent, both are down only with probability `q_A · q_B`, and k layers give `q^k` — geometric decay. This is the reasoning that produces watcher stacks.

*Why it is wrong:* failures are not independent. The standard model is the **beta-factor model**, used in functional-safety and probabilistic risk assessment: a fraction β of each component's failure rate arises from a *common cause* that takes down all redundant copies simultaneously. Total unavailability is approximately

```
q_total ≈ q_independent^k + β·q
```

As `k → ∞`, `q_total → β·q`. **There is a floor, and it is independent of depth.** Published β values for redundant hardware sharing an environment run at 1–10%. For identical software on identical hosts it is far worse, because a logic defect is 100% correlated by construction: your watcher has the same time-zone database, the same connection-pool exhaustion bug, the same memory limit, and was shipped by the same pipeline that just pushed the bad configuration.

*The rule that follows:* redundancy buys availability only across a dimension where failure modes are genuinely uncorrelated. Each additional layer must **cross a boundary you can name**: different process → different host → different cluster → different provider → different implementation → different organisation and different human. "Two replicas" and "a watchdog next to the process" cross almost nothing, and their measured improvement is close to zero.

*The terminal anchor:* something whose failure is uncorrelated with your entire deployment. An external heartbeat service configured as a dead-man's switch — *expect a signal every N minutes, alert a human if absent* — crosses provider, network and code boundaries at once. Depth 1 across a real boundary beats depth 3 inside your cluster by a wide margin. It also has the correct terminal property: its failure mode is *fail-loud to a human*, and a human is an agent outside the formal system, which is the only way a regress of this kind can actually end.

*One caveat on diversity:* the classic experimental result on independently developed versions of the same specification is that they still fail together far more often than independence predicts, because the inputs that are hard are hard for everyone. Do not over-invest in "write the watcher in a different language". The correlation you are trying to break is usually in the **specification**, not the implementation.

---

## A.9 Overload policy and misfire policy

Both answer "what do we do when the ideal schedule cannot be met". Both are business decisions. Both get made accidentally, in code, by whoever wrote the loop.

### Misfire policy

What to do about an occurrence whose nominal instant has passed and which was never started:

- **Skip** silently.
- **Fire once immediately**, collapsing all missed firings into one.
- **Fire all**, backfilling each in order.
- **Fire if within grace window Δ**, else skip.
- **Escalate to a human**, decide nothing automatically.

This policy *is* the choice of `t0` in occurrence derivation (A.1). It should be a field on the job, not a property of the code path.

### Overload policy

What to do when work arrives faster than it can be processed (`U ≥ 1`), including the case where the previous run has not finished:

- **Serialize** — skip the new firing while one is in flight. This is "do not overlap".
- **Overlap with bounded concurrency k.**
- **Shed** — drop the lowest-priority units; admission control.
- **Degrade** — reduce per-unit work; skip expensive enrichment.
- **Backpressure upstream** — usually unavailable for time-triggered work, because *time does not accept backpressure*. This is exactly why time-triggered systems must be able to shed.
- **Scale out** — helps only if your workers are the bottleneck rather than a shared external dependency.

### Why they must be stated together

They interact, and the interaction is where systems fail:

| Combination | Behaviour |
|---|---|
| "Do not overlap" + "fire all missed" | **Unstable** under sustained overload. Serializing accumulates firings; backfilling all of them adds the accumulated work to an already-saturated pipeline. A transient becomes a permanent, growing backlog. |
| "Do not overlap" + "skip" | Stable, but silently discards work. |
| "Overlap with concurrency k" + "fire all missed" | Stable **if and only if** `k·μ > λ` — a check nobody performs. |

None of these is wrong. Each must be **chosen**, per job rather than globally, and expressed as data on the job entity, so that "what happens if we are down for a day?" is a readable configuration value rather than an archaeological expedition through source code.

### Observability is part of the policy

Both policies must be **observable**: count of skipped occurrences, count of shed units, backlog age, oldest un-terminal unit. A policy that fires silently is a policy nobody knows the system has, which is functionally identical to not having decided.

---

## A.10 Chandra–Toueg: completeness and accuracy

### The setting

The **asynchronous model** assumes: no bound on message delay, no bound on relative process speed, no synchronised clocks. Its defining consequence is that **a crashed process and a slow process are indistinguishable**. This is the intuition behind FLP.

Chandra and Toueg's move was not to strengthen the model with timing assumptions, but to add an **oracle**: a *failure detector* module at each process that outputs the set of processes it currently suspects. It is explicitly allowed to be wrong. Detectors are then classified by two orthogonal properties.

### Completeness — about crashed processes

*Does the detector eventually notice real failures?*

- **Strong completeness:** eventually every crashed process is permanently suspected **by every** correct process.
- **Weak completeness:** eventually every crashed process is permanently suspected **by at least one** correct process.

Completeness is the cheap property. A heartbeat with any finite timeout provides strong completeness: a dead process stops sending, so eventually everyone times out on it.

### Accuracy — about correct processes

*Does the detector avoid suspecting the living?*

- **Strong accuracy:** **no** correct process is **ever** suspected.
- **Weak accuracy:** **some** correct process is never suspected.
- **Eventual strong accuracy (◇):** after some unknown finite time, no correct process is suspected.
- **Eventual weak accuracy (◇):** after some unknown finite time, some correct process is never suspected.

Accuracy is the expensive property, and in the asynchronous model perfect accuracy is unobtainable — a message delayed for an hour is indistinguishable from one never sent.

### The classes and the key results

The named classes are the cross product: **P** (perfect: strong completeness + strong accuracy), **S**, **W**, and the eventual variants **◇P**, **◇S**, **◇W**.

- Consensus is solvable with **◇S** given a majority of correct processes.
- **◇W is the weakest failure detector for consensus**: any detector that solves consensus can be used to implement ◇W.

### Why the eventual classes are the practically important ones

The "◇" prefix permits an **arbitrary but finite** period of arbitrarily wrong suspicion. That is exactly what a heartbeat timeout gives you: wrong during a network hiccup, eventually right if the network eventually behaves. Your timeout-based detector is *not* correct in the asynchronous model, but it satisfies ◇S under the assumption that the system is *eventually synchronous* — and that is enough for consensus.

### Two engineering corollaries

1. **Timeouts should be adaptive.** A fixed timeout has a fixed and *unmeasured* false-positive rate. Failure detection has a measurable quality of service — detection time, mistake rate, mistake duration — and should be treated as a tunable component rather than a constant. Accrual detectors, which output a continuous suspicion level rather than a boolean, let each consumer choose its own threshold; a system may want an aggressive threshold for "start a backup worker" and a conservative one for "declare data loss".

2. **False suspicions must be survivable.** Which is A.8. The two sections are the same result seen from opposite ends: Chandra–Toueg says your detector will be wrong for an unbounded finite period, and A.8 says therefore your safety must not depend on it being right.

---

# B. Elements of a minimal timed task execution system

This is the non-negotiable set for the `g >> 1` regime. Anything less has a gap; anything beyond this needs a justifying parameter value from A.7.

## B.1 The seven non-negotiables

**1. Separate entities for job, occurrence, unit of work, attempt.**
Four tables, or four clearly separated concepts. The one benign merge is occurrence ≡ unit of work when there is no fan-out.

**2. Derived identity for occurrences and units of work.**
```
occurrence_id = f(job_id, job_version, nominal_instant)
unit_id       = f(occurrence_id, partition_key)
```
Computable by any node without asking anyone. No sequences, no generated keys, no "first writer decides". This is what makes everything else possible.

**3. A uniqueness constraint on those identities, in a linearizable store.**
This is the deduplication mechanism. Not a code path — a constraint.

**4. Level-triggered derivation, run periodically and unconditionally.**
```
missing = derive(job, t0, t1) \ materialised(job, t0, t1)
```
Materialise the missing ones idempotently. Safe to run concurrently, at any frequency, from any node. This replaces the watcher hierarchy, because a late node repairs itself.

**5. Compare-and-swap claim per unit of work**

A conditional update that transitions a unit from unclaimed to claimed, returning success only to one caller. Carries a lease expiry and a monotonic fencing token.

**This is compare-and-swap in its most common production form, and the table is the central registry.** The `WHERE` clause is the *compare*, the `SET` is the *swap*, and the affected row count is the return value — zero means another caller won. Part D's abstract CAS object and this statement are the same primitive; a single-statement conditional `UPDATE` against one row is linearizable, which is exactly what gives it consensus number ∞ for as long as the database is up.

### PostgreSQL

```sql
UPDATE unit_of_work
SET    state            = 'claimed',
       owner            = $worker,
       lease_expires_at = now() + interval '5 minutes',
       fence            = fence + 1
WHERE  unit_id = $unit_id
  AND  (state = 'pending'
        OR (state = 'claimed' AND lease_expires_at < now()))
RETURNING fence;
```

Zero rows returned = you lost, do nothing. One row = you own the unit, and `fence` is your token.

Batch claim, for pulling a chunk of a fan-out:

```sql
UPDATE unit_of_work u
SET    state = 'claimed', owner = $worker,
       lease_expires_at = now() + interval '5 minutes',
       fence = u.fence + 1
FROM (
  SELECT unit_id
  FROM   unit_of_work
  WHERE  occurrence_id = $occurrence_id
    AND  (state = 'pending'
          OR (state = 'claimed' AND lease_expires_at < now()))
  ORDER  BY unit_id
  FOR UPDATE SKIP LOCKED
  LIMIT  100
) AS candidate
WHERE  u.unit_id = candidate.unit_id
RETURNING u.unit_id, u.fence;
```

### SQL Server

```sql
UPDATE dbo.UnitOfWork
SET    State          = 'claimed',
       Owner          = @worker,
       LeaseExpiresAt = DATEADD(minute, 5, SYSUTCDATETIME()),
       Fence          = Fence + 1
OUTPUT inserted.UnitId, inserted.Fence
WHERE  UnitId = @unitId
  AND  (State = 'pending'
        OR (State = 'claimed' AND LeaseExpiresAt < SYSUTCDATETIME()));
```

`@@ROWCOUNT = 0` means you lost. Batch form, the canonical queue-table pattern:

```sql
UPDATE TOP (100) u
SET    State = 'claimed', Owner = @worker,
       LeaseExpiresAt = DATEADD(minute, 5, SYSUTCDATETIME()),
       Fence = u.Fence + 1
OUTPUT inserted.UnitId, inserted.Fence
FROM   dbo.UnitOfWork AS u WITH (READPAST, UPDLOCK, ROWLOCK)
WHERE  u.OccurrenceId = @occurrenceId
  AND  (u.State = 'pending'
        OR (u.State = 'claimed' AND u.LeaseExpiresAt < SYSUTCDATETIME()));
```

`UPDLOCK` forces the locking read that `READPAST` then skips — necessary because under read-committed snapshot isolation readers do not take locks and `READPAST` would otherwise have nothing to skip. Verify the interaction on your version and isolation level; this is one of the details that has moved between releases.

### Why these specific properties matter

**Never split this into `SELECT` then `UPDATE`.** Read-then-act is not a coordination primitive — this is precisely the register-versus-CAS distinction of Part D, and no amount of care in the application layer repairs it. The compare and the swap must be one statement.

**Serializable isolation is not required, and is worse here.** Under read committed, a losing concurrent updater blocks on the row lock, re-evaluates the predicate against the committed row, and updates zero rows. That is clean CAS semantics with a clean return value. Under repeatable read or serializable, PostgreSQL instead raises a serialization failure (`40001`) that you must catch and retry — the same outcome expressed as an exception rather than a row count. Choose read committed for the claim, and reserve serializable for occurrence materialisation where you actually want the conflict surfaced.

**Lease arithmetic belongs in the database, not the worker.** `now()` / `SYSUTCDATETIME()` is evaluated by one node, so cross-node clock skew is eliminated from the lease mechanism entirely. Note what this does *not* fix: process pauses. A worker that stalls for 40 seconds still resumes believing it holds an expired lease. Only the fencing token addresses that.

**Expiry in the `WHERE` clause makes reclaim implicit.** No reaper job is needed for correctness — the next claimant simply matches the expired row. A separate sweeper is still worth having for *observability* (counting reclaims is a leading indicator of worker instability), but it should not be load-bearing.

**Fence scope must match resource scope.** A per-row `fence + 1` is monotonic per unit, which is correct when the fenced resource *is* the unit. If several units contend for one shared external resource, the token must be globally monotonic — a PostgreSQL sequence (`nextval`) or a SQL Server `SEQUENCE` object. Getting this wrong produces a token that looks like fencing and fences nothing.

### Alternatives, and what they cost

**Advisory locks** — `pg_advisory_xact_lock(key)` in PostgreSQL, `sp_getapplock` in SQL Server. Cheaper than a row update and useful for coarse mutual exclusion, such as "only one node runs occurrence derivation right now". But they hold no state, produce no token, and survive nothing: they are *leases without fencing*, giving mutual exclusion of intent only (A.2). Acceptable for the derivation loop, which is idempotent anyway; not acceptable as the claim mechanism for units with external effects.

**A broker's visibility timeout** — moves the claim into a second system while unit state stays in the database. That is Gap 5 of Part C: a dual write, with all of A.6 applying. If you use a broker, let it carry the *trigger*, and keep the claim in the same store as the state.

**The availability bound, stated plainly.** Localising consensus to a single primary is the trade described in A.4. Your scheduler's availability is now bounded above by the database's, and during a failover nothing claims. For `g >> 1` this is nearly always correct — level-triggered derivation makes the outage self-healing — but it belongs in the design document as a stated limit, not as an assumption.

**6. An effect record separate from the attempt (outbox), whenever the effect crosses a system boundary**

Business state and effect record written in one transaction; a separate transfer step; idempotent receipt at the far end.

**The outbox table is the same central registry and the same CAS primitive applied a second time** — once to claim units of work, once to claim effect records for dispatch. Recognising this is useful: it is one mechanism, not two, and it should be built once.

### The transactional write

```sql
BEGIN;

UPDATE unit_of_work
SET    state = 'effect_recorded'
WHERE  unit_id = $unit_id
  AND  owner   = $worker
  AND  fence   = $fence;          -- the fencing check, not decoration

INSERT INTO outbox (unit_id, idempotency_key, destination, payload, created_at)
VALUES ($unit_id, $derived_unit_identity, 'mail', $payload, now());

COMMIT;
```

with

```sql
ALTER TABLE outbox ADD CONSTRAINT outbox_idem_uk UNIQUE (idempotency_key);
```

Two things carry the weight here. First, `idempotency_key` is the **derived unit identity** from B.1.2 — not a generated identifier. A random key makes the row unique and the *effect* undeduplicable, which is the whole failure mode this entity exists to prevent. Second, the fence predicate in the `UPDATE` is what stops a zombie worker with an expired lease from recording an effect; without it the outbox is merely an ordered log of everything anyone ever intended.

The unique constraint also makes the transaction itself safely retryable: a repeat after an ambiguous commit collides rather than duplicating.

### The transfer step

Claim outbox rows with the same conditional update as B.1.5 — same lease, same fence, same zero-rows-means-lost semantics. In PostgreSQL, `FOR UPDATE SKIP LOCKED`; in SQL Server, `READPAST, UPDLOCK`.

**Ordering caveat:** skip-locked fetching deliberately abandons ordering. If per-recipient or per-aggregate ordering matters, partition the outbox by that key and allow one in-flight row per partition. Do not assume a queue preserves order merely because it looks like a queue.

**Retention:** deleting on success destroys the record of what was sent, and worse, releases the idempotency key. Move completed rows to an archive table or mark and partition-prune. The key's uniqueness must outlive your longest retry and reconciliation window, which is usually longer than people assume. In PostgreSQL an unarchived high-churn outbox is also a bloat and autovacuum problem; daily partitions with partition drops are the usual answer. In SQL Server, a filtered index on unsent rows keeps the dispatch query cheap as the table grows.

### Relay alternatives

**Polling publisher.** The conditional-update claim on a schedule. Simplest, one mechanism, no extra infrastructure. Costs a floor of query load and a latency floor of the poll interval.

**Log tailing / change data capture.** PostgreSQL logical replication with a publication on the outbox table (`pgoutput`, or `wal2json` if you want readable output); SQL Server CDC or Change Tracking. Debezium is the common off-the-shelf reader for both. Advantages: no polling load, and the write-ahead log gives ordering for free. Disadvantages: real operational weight, replication-slot management (an abandoned PostgreSQL slot will fill your disk), and it is *still at-least-once* — CDC does not deliver a guarantee the polling version lacks. Justify it with throughput or latency numbers, not with the word "exactly-once".

**PostgreSQL `LISTEN`/`NOTIFY` as a latency hint.** `NOTIFY` is transactional — delivered on commit, never before — which makes it correct as a wake-up signal. It is not durable: a disconnected listener misses the notification permanently. This makes it an excellent worked example of the level-triggered principle: use it to reduce latency from the poll interval to milliseconds, and let the poll remain the source of truth. Never as the only path.

**SQL Server Service Broker.** A genuinely transactional queue, so the enqueue really is atomic with the business write. It relocates the outbox rather than removing it, because the effect boundary is still external and the far end still has to deduplicate. Worth considering if you are already operating it; not worth adopting for this alone.

### The far end

Supply `idempotency_key` to the provider as its idempotency header, or as the message identifier where the protocol has one. Record the provider's response and its returned identifier in the **attempt** row, which is a different entity (A.1) — the outbox row is the promise, the attempt is what happened.

If the provider offers no deduplication mechanism, you do not have exactly-once effect, and the design document should say so in those words. A stated limit is an engineering artifact; an unstated one is a future incident.

**And the reminder that keeps this honest:** the outbox does not defeat the impossibility of A.6. It converts one impossible requirement into three achievable ones — atomicity within a single system, at-least-once transfer, idempotent receipt — and pushes the residue to the third, where it is the receiver's responsibility and can actually be discharged.

**7. One external reliability anchor.**
A dead-man's switch outside your deployment. Not a second watcher inside it.

## B.2 The five decisions that must be written down as data

Not as code. As fields on the job, readable by someone who has never seen the source.

1. **Misfire policy** and the grace window Δ.
2. **Overload policy** and the concurrency bound k.
3. **Time-zone resolution policy** for nonexistent and ambiguous local times.
4. **Retry policy** — bounds, backoff, and the terminal state after exhaustion. Note this is *separate* from the misfire policy; conflating them is the Occurrence ≡ Attempt collapse.
5. **Effect boundary contract** — what the far end deduplicates on, or an explicit statement that it does not.

## B.3 The four required observables

1. **Backlog age** — the nominal instant of the oldest non-terminal unit. This is the single best health signal; it rises before anything else breaks.
2. **Skipped and shed counts**, per policy, per job. A policy that fires silently is a policy nobody knows about.
3. **Utilisation `U`** per job — measured, not assumed. If you cannot produce this number, you cannot know whether A.5 applies to you.
4. **Duplicate-effect rate** at the boundary, where the boundary can report it. If it cannot, record that fact as a known unknown.

## B.4 The guarantee statement

The test of whether an implementation understands its own limits is whether these six questions can be answered without hedging. Put the answers in the design document.

1. What is the misfire policy, per job?
2. Is occurrence and unit identity deterministic and independently computable?
3. Where exactly is the effect boundary, and does it deduplicate? If not, what is the observable duplicate rate?
4. Under false suspicion of a live worker, which property breaks — liveness or safety?
5. What is `U`, and what happens at `U > 1`?
6. What is the terminal reliability anchor, and is its failure mode uncorrelated with the system it watches?

If all six have answers, the system is neither over-engineered nor incompletely specified, whatever it looks like structurally. If any is unanswerable, that is where the next incident will come from.

---

# C. What existing components do not offer

This part is about *categories* of gap, not about any product's current release. Specific behaviours change between versions and configurations — **verify against the version you are running**. The value here is knowing which questions to ask of any component, because the gaps recur across all of them for structural reasons.

The general shape: **mature schedulers solve time → firing very well, and stop at the boundary of firing → effect.** That is not a defect. The half they omit is domain-specific and cannot be supplied by a library, because it depends on your identity function and your effect boundary. The defect is *assuming* the library covered it.

## C.1 The recurring gaps

### Gap 1 — Occurrences are usually not first-class

The dominant implementation is a mutable "next fire time" advanced after each firing: the **Job ≡ Occurrence** collapse (A.3). Some products materialise a row per execution, which is closer, but that row is typically created *at dispatch time* rather than derived — so occurrences that were never dispatched still do not exist.

**Consequences:** backfill beyond the built-in misfire handling is impossible; you cannot answer "which firings did we miss during the outage?"; and the misfire policy is restricted to what the product implemented.

**What to design differently:** keep your own occurrence table with derived identity. You may still let the component *trigger* your reconciliation, but the occurrence set must be yours and must be derivable.

### Gap 2 — The unit of work is yours, always

Essentially no general-purpose scheduler models the fan-out. A job that must reach 7,000 recipients is one job to the scheduler, and the 7,000 units are an implementation detail inside your handler — the **Occurrence ≡ Unit of work** collapse.

**Consequences:** no durable partial progress; no per-unit retry; recovery time bounded below by full batch duration; utilisation is all-or-nothing.

**What to design differently:** the fan-out must be materialised durably before work begins. This is the single most common missing piece in otherwise competent implementations.

### Gap 3 — At-least-once, and the deduplication key is not supplied

Reliable-fetch implementations are at-least-once by construction: a worker takes an invisible lease, and if it dies the item reappears. This is correct behaviour and the only thing achievable (A.6). What the component does **not** supply is a *stable, domain-derived key* for the work. Retry identity is usually the internal job identifier, which is not derivable by another party and not meaningful to your effect boundary.

**Consequences:** the component's deduplication protects its own bookkeeping, not your effect. Duplicate sends remain possible and are your problem.

**What to design differently:** carry your derived unit identity inside the payload and enforce uniqueness in your own store, plus at the provider. Never treat the component's internal identifier as an idempotency key.

### Gap 4 — Leases without fencing tokens

Visibility timeouts and lease-based claims are near-universal. Monotonic fencing tokens exposed to the *resource* are near-absent.

**Consequences:** mutual exclusion of intent, not of effect (A.2). A paused worker resumes and acts under an expired lease.

**What to design differently:** derive a fencing token yourself — a monotonic counter on the unit, incremented on each claim — and either pass it to the resource or use it in conditional writes on your own state.

### Gap 5 — The claim lives in a different system from the state

If the component holds the lease in its own store while your business state lives in your database, that is a dual write across two systems, with all of A.6 applying.

**Consequences:** divergence between "the component thinks this is in flight" and "my data says this is pending". Usually discovered during an incident.

**What to design differently:** keep claim and unit state in the same transactional store, and let the component be a *trigger*, not a *state owner*.

### Gap 6 — Misfire handling exists, but is coarse and often global

Better products do offer misfire policies — this is a genuine strength worth crediting, and more than most hand-rolled systems have. The limitations are that the options are those the product implemented, the choice is often set per trigger type rather than per business rule, "fire all missed" is rarely available because occurrences were never materialised, and there is typically a hard cutoff after which the component simply gives up and logs.

**What to design differently:** treat the component's misfire handling as a *latency optimisation*, and put the real policy in your reconciliation window `t0` (A.1, A.9).

### Gap 7 — No overload policy

Overlap prevention is commonly available as a flag. Shedding, degradation, admission control and priority are essentially never available, because they require domain knowledge of which work is droppable.

**Consequences:** the "do not overlap" flag plus a backfill-style misfire policy is the unstable combination from A.9, and it is reachable through configuration alone, with no warning.

**What to design differently:** measure `U`; implement shedding in your own layer; never rely on a concurrency flag as a capacity strategy.

### Gap 8 — Time-zone semantics are underspecified

Handling of nonexistent and ambiguous local times, and behaviour when the time-zone database is updated, is frequently undocumented and version-dependent. Storing resolved absolute instants is common — the **Nominal instant ≡ absolute instant** collapse.

**What to design differently:** store civil datetime + zone + resolution policy; treat the absolute instant as derived; re-derive after time-zone database updates.

### Gap 9 — Single points of coordination, undocumented as such

Many designs elect one active scheduler process — sometimes explicitly, sometimes as an emergent property of a database lock. This is often the *right* trade (A.4), but it is a real availability bound that rarely appears in the documentation and almost never in the consuming team's design document.

**What to design differently:** find the coordination point, write it down, and state its availability as your scheduler's upper bound.

### Gap 10 — In-process schedulers inherit the host's lifecycle

A scheduler embedded in an application process is subject to that process's deployment cadence, memory limits and shutdown behaviour. Rolling deployments during a firing window are a routine cause of missed and duplicated firings.

**What to design differently:** level-triggered derivation makes this survivable — a restarted process recomputes what is owed. Without it, deployment becomes a correctness hazard.

## C.2 What they do well, and should be used for

State this too, or the document reads as an argument for building everything yourself, which would be wrong.

- Timer management, calendar arithmetic and recurrence expansion — genuinely hard, well tested, and not worth reimplementing.
- Durable trigger storage and restart recovery of the *trigger*.
- Worker pools, retry with backoff, dashboards and operational tooling.
- Leader election among scheduler instances, sufficient for triggering.

**The correct division of labour:** let the component answer *when*, and own *what and exactly-once-effect* yourself. Use it as a **level-triggered trigger source** — its firing invokes your reconciliation, and if a firing is lost, the next one repairs the gap. Never let it be the *system of record* for what is owed.

## C.3 Questions to ask of any component

A portable checklist, derived from the gaps above:

1. Are occurrences materialised, or is there a mutable next-fire-time?
2. Can I supply my own identity for a scheduled unit?
3. Is the fan-out mine? (Assume yes.)
4. Where does the claim live relative to my business state?
5. Is there a fencing token, and does anything verify it?
6. What are the misfire options, and are they per-job?
7. What happens at `U > 1` besides the overlap flag?
8. How are nonexistent and ambiguous local times resolved, and what happens on a time-zone database update?
9. What is the coordination point, and what is its availability?
10. What does the component guarantee if the host process is killed mid-execution — precisely?

Any answer of the form "it retries" is an answer about *at-least-once*, and therefore an answer about *your* deduplication responsibility.

---

# D. Herlihy's consensus hierarchy

Part A.4 asserted that compare-and-swap is sufficient for safety and that plain reads and writes are not. This part establishes both. It is self-contained.

The result is usually presented in a compressed dialect. The three things that most often block understanding are: (1) consensus looks trivially easy, so the theorem sounds absurd; (2) *wait-freedom* is not internalised as a hard constraint, so one mentally retains the right to spin and retry, under which everything works; (3) consensus looks like an arbitrary yardstick. All three are addressed below.

## D.1 The problem at its smallest

Two processes, P₀ with input 0 and P₁ with input 1. They share memory. Each must **decide** a value:

- **Agreement** — they decide the same value.
- **Validity** — the decided value is one of the inputs. (This rules out "always decide 0", which would trivialise the problem.)
- **Wait-freedom** — each process decides after a finite number of **its own** steps, no matter what the other does, *including that the other has crashed and will never take another step*.

The third condition is where the entire subject lives. Its consequence, stated bluntly:

> **You may never wait for the other process. Ever. Not once.**

A slow process is indistinguishable from a dead one, and you must decide even if it is dead. Every "loop until the other responds" is illegal. Every "retry until it works" is illegal. There is no timeout, because a timeout is a synchrony assumption and we have none.

If waiting were permitted, plain registers would suffice — mutual exclusion is achievable with registers alone, and from mutual exclusion you can build anything — and there would be no hierarchy at all. Hold onto this: **the hierarchy measures fault-tolerance, not computability.**

## D.2 Try it, and watch it fail

You have atomic read/write registers, as many as you like, of any size. Give each process a register and let them publish everything.

**Attempt 1.** Each Pᵢ writes vᵢ to Rᵢ, then reads the other register. If it sees ⊥, decide own value; otherwise decide the minimum.
*Break it:* P₁ writes, reads ⊥, decides 1. Then P₀ writes, reads 1, decides min(0,1) = 0. Disagreement.

**Attempt 2.** Decide the *other's* value if visible.
*Break it:* both write, then both read. P₀ sees 1 and decides 1; P₁ sees 0 and decides 0. They swapped. Disagreement.

**Attempt 3.** Break symmetry by fiat: "P₀'s value always wins."
*Break it:* run P₁ alone with P₀ crashed before writing. P₁ reads ⊥ and must decide in finite time; validity forces 1. Now P₀ wakes and decides 0. Disagreement.

You can continue indefinitely. The reason is worth stating exactly:

> The only thing that would resolve this is knowing **who wrote first** — and a write does not tell you whether you were first.

Verify that this would suffice: if each process could learn "was I first?", then the first mover decides its own value, and the second mover knows the first has already published (it moved earlier) and so reads that register and adopts it. Agreement, validity, three steps, wait-free.

So the difficulty is **not communication**. Registers give perfect communication. The difficulty is **ordering**, and a plain write is *oblivious*: the writer learns nothing by writing.

## D.3 The vocabulary

The impossibility proof uses a compressed jargon. Here it is unpacked, because almost every word means something narrower than its English sense.

### Fix a protocol

The mathematician's *fix*, as in "fix ε > 0". Let one be given and hold it constant. A **protocol** is the algorithm every process runs, assumed:

- **deterministic** — given local state and the value just read, the next action is fully determined (drop this and the theorem is false; randomised consensus using only registers exists);
- **correct** — satisfies agreement, validity and wait-freedom, for all inputs and all schedules.

The proof is a contradiction over the *whole space of protocols*. Nothing else about the protocol is assumed, so the conclusion applies to all of them.

### Configuration

A complete snapshot: contents of every shared register; and for each process its input, program counter, local variables, and whether it has decided and what. Complete in the technical sense — it determines the future. Two configurations agreeing on all of this *are* the same configuration.

### Step

One process performs one atomic shared-memory operation (a read or a write) and updates its local state. Steps never overlap; the system executes one at a time.

### Schedule

A sequence of process identifiers naming who moves next: `(0, 0, 1, 0, 1, 1, …)`.

This is the **only** source of nondeterminism in the system. Processes are deterministic, so **configuration + schedule ⟹ the entire execution**, mechanically. Everything the adversary controls, it controls through the schedule. Asynchrony means total freedom: it may run one process a million steps while another takes none.

**A crash is not a separate concept.** It is a schedule in which a process's identifier never appears again after some point. Nothing is severed; the process simply stops being given steps.

Notation: `C·σ` is the configuration reached by applying schedule σ to configuration C.

### Reachable

D is **reachable** from C if some finite schedule σ satisfies `C·σ = D`. Unqualified, it means reachable from the initial configuration.

Example, for the CAS protocol (`CAS(⊥, my_value)`, read, decide what you read), P₀ holding 0 and P₁ holding 1:

- *Reachable:* register = 0, P₁ has not moved.
- *Reachable:* register = 0, both decided 0.
- *Not reachable:* register = 7 — nobody has 7.
- *Not reachable:* register = ⊥ and P₀ decided 1 — P₀ decides only what it reads.
- *Not reachable:* register = 1 with P₁ never having stepped — only P₁ writes 1.

Only reachable configurations matter, because unreachable ones are fictions no adversary can produce.

### The game tree

From a configuration, the **future schedules** form a tree:

- **nodes** = configurations
- **edges** = single steps (one outgoing edge per process: "P₀ moves next", "P₁ moves next")
- **root** = initial configuration
- **paths** = schedules
- **leaves** = configurations where every non-crashed process has decided

Wait-freedom guarantees every path terminates in finitely many steps, so every branch bottoms out. Agreement guarantees every leaf carries a single label, 0 or 1.

Unlike a chess tree there is only **one player**. The processes choose nothing — they are deterministic. The adversary alone picks the path.

### Valency

For a configuration C:

> **val(C) = { the label of L : L is a leaf in the subtree rooted at C }**

The set of outcomes still achievable over all continuations. Non-empty, and a subset of {0, 1}:

| val(C) | Name | Meaning |
|---|---|---|
| {0} | **0-valent** | every continuation ends in 0; the answer is sealed |
| {1} | **1-valent** | every continuation ends in 1; sealed |
| {0,1} | **bivalent** | the adversary can still steer to either |

**"0 is reachable from C"** means: *there exists a schedule σ such that in `C·σ` the processes have decided 0*. Note carefully — "0" is an **outcome**, a leaf label. It is not a state you might arrive at. The reachability is about the *outcome of the run*, not about arriving somewhere.

**Univalent** = 0-valent or 1-valent: fate already sealed.

### Worked example — watching valency change

CAS protocol, P₀ input 0, P₁ input 1.

**C_init** — register ⊥, nobody has moved.
Schedule (0,0,…): P₀'s CAS succeeds, register = 0, both read 0, decide **0**.
Schedule (1,1,…): P₁'s CAS succeeds, register = 1, both read 1, decide **1**.
Both labels occur below C_init, so val = {0,1}: **bivalent**.

**C₀ = C_init·(0)** — P₀ has taken one step; register = 0; *nobody has decided anything*.
Every continuation: P₁'s CAS finds 0 rather than ⊥ and fails, changing nothing. Both read 0 and decide 0.
val = {0}: **0-valent**.

Two observations that are the whole point:

1. At C₀ **nobody has decided**, yet the outcome is fixed. Valency measures *fate*, not current decisions. A configuration can be univalent long before anyone commits.
2. The transition from bivalent to 0-valent happened at **one atomic step by one process**. That is precisely what CAS buys and what a plain write cannot do — and it is what the impossibility proof exploits.

### Two facts that follow from agreement alone

- **If anyone has decided, the configuration is univalent.** If some process decided 0, agreement forces every process that ever decides in any continuation to decide 0. So every leaf below is labelled 0.
- **Bivalent ⟹ nobody has decided yet.** The contrapositive. Not an extra assumption.

## D.4 The lower bound: registers have consensus number 1

Assume a correct wait-free consensus protocol for two processes using only read/write registers.

### Step 1 — some initial configuration is bivalent

Input (0,0) must decide 0 by validity; (1,1) must decide 1. Walk from one to the other by flipping one process's input at a time. If every initial configuration were univalent, then somewhere along that walk two adjacent configurations differ in exactly one process's input, one 0-valent and one 1-valent. **Give steps only to the other process.** It sees literally identical circumstances in both cases, so it produces the identical execution and the identical decision — contradicting that one is 0-valent and the other 1-valent. Hence some initial configuration is bivalent.

### Step 2 — a critical configuration is reachable

From a bivalent configuration, if some process's next step leaves us bivalent, take it — cycling through processes so that everyone keeps moving.

If we could do this forever, we would have an infinite execution in which nobody ever decides, and in which some process takes infinitely many steps without deciding. **That violates wait-freedom.** So we must eventually reach a configuration C that is bivalent but where *every* process's next step makes it univalent. Call C **critical**.

This is the exact point where wait-freedom does its work, and it is the step people nod past. Under a weaker requirement — "some process eventually decides" — one process could spin forever and the argument would break. Which it must, since consensus *is* solvable with registers if blocking is permitted.

### Step 3 — the critical configuration cannot exist

At C, say P₀'s next step leads to a 0-valent configuration and P₁'s to a 1-valent one. Each is about to perform one register operation. Enumerate the cases.

**Both about to read.** Reads leave shared memory untouched. Let P₀ take its read, reaching C₀ (0-valent). Now give steps only to P₁, until it decides. P₁ sees exactly the shared memory it would have seen at C, and its own local state is unchanged, so it runs exactly as it would have from C and decides 1. But it is running from a 0-valent configuration. Contradiction.

**P₀ reads, P₁ writes.** Compare
A = (P₁ writes, then P₀ reads) and B = (P₀ reads, then P₁ writes).
Shared memory is identical in A and B — one write happened; the read changed nothing. P₁'s local state is identical. The **only** difference is inside P₀: it read a different value. So give steps only to P₁ until it decides. Same memory, same local state, same deterministic code, therefore the same decision. But A descends from C₁ and is 1-valent, and B descends from C₀ and is 0-valent. Contradiction.

**Both write, to different registers.** The writes commute. Either order yields a configuration that is *literally identical* in every component. That configuration descends from a 0-valent and a 1-valent configuration simultaneously. Contradiction, with no crashing needed.

**Both write, to the same register.** Compare
A = (P₀ writes, then P₁ writes) and C₁ = (P₁ writes alone).
P₁ clobbered P₀'s value, so shared memory is identical and P₁'s local state is identical. Only P₀ knows the difference. Give steps only to P₁: same decision in both. But A is 0-valent and C₁ is 1-valent. Contradiction.

Every case dies. **No wait-free consensus protocol for two processes exists using only read/write registers. Consensus number of a register: 1.**

### The engine of the proof, and a note on the word "crash"

Every case used the same move:

> Construct two configurations that some process **cannot distinguish**, then give steps **only to that process** until it decides. It must decide identically in both, while the two configurations demand different decisions.

The literature phrases this as "crash the processes that could tell them apart", and that phrasing is worth deconstructing, because it suggests a mechanism the model does not contain. **There is no "ask another process" operation.** A register is a passive cell; a read notifies nobody and records nothing. Processes never interact — they leave marks in a shared store and look at marks.

So what does the crash actually accomplish? Not severing a channel. **Removing a future writer.**

Indistinguishability at one instant is worthless. The argument needs it to persist for the entire remainder of the survivor's execution, and that requires the difference never to leak into shared memory. If P₀ stays alive and ten steps later writes the value it read, P₁ *can* see the difference and the argument collapses. Crashing P₀ seals the difference inside P₀ permanently — not because it stops P₁ from asking, but because it stops P₀ from ever telling.

The formulation used above — *"give steps only to P₁"* — avoids the metaphor entirely and is more faithful to the model. Crashing is a schedule, and it was permitted all along. The literature keeps the word because the same technique must also work in message-passing settings, where crashing genuinely is a distinct modelling primitive.

## D.5 Where the numbers come from

The hierarchy is a *measured* quantity, not an assigned one. Watching a number be forced is what makes it concrete.

### FIFO queue: consensus number exactly 2

**Construction for 2.** Pre-fill a queue with `[WIN, LOSE]`, plus registers R₀, R₁.
Each Pᵢ: write vᵢ to Rᵢ, then dequeue. On `WIN`, decide own value. On `LOSE`, read the other register and decide that.

*Correct:* if I dequeued LOSE, the other dequeued WIN, so its dequeue preceded mine, so its write preceded that — the value is there. Both decide the winner's input. Wait-free in constant steps.

The queue did what a register could not: **it told the caller its position in the order.**

**Why it fails at 3.** The natural repair is `[WIN, LOSE, LOSE]` — and that ranking is perfectly correct; exactly one process gets WIN. The problem is what a LOSE *tells you*:

> The queue tells a loser **that a winner exists and has already dequeued**, but not **which process it was**.

With two processes that is not a gap: "a winner exists" ∧ "it is not me" ⟹ "it is the other one". Identification by elimination is complete because there is exactly one candidate. With three, elimination leaves **two** candidates, and one bit of "you were not first" does not distinguish them.

*The concrete failure.* The winner must decide immediately on dequeuing WIN — it cannot wait for anyone.

- *Scenario A:* P₁ writes, P₂ writes, P₁ dequeues WIN and decides v₁ then stops, P₂ dequeues LOSE then stops. P₀ writes, dequeues LOSE, reads all registers: sees v₀, v₁, v₂.
- *Scenario B:* P₂ writes, P₁ writes, P₂ dequeues WIN and decides v₂ then stops, P₁ dequeues LOSE then stops. P₀ writes, dequeues LOSE, reads all registers: sees v₀, v₁, v₂.

P₀'s view is **identical**: same dequeue result, same three register values, same local state, same code. The queue is empty in both, so dequeuing again yields nothing. Being deterministic, P₀ decides the same in A as in B. It must be v₁ (agreement with P₁ in A) and v₂ (agreement with P₂ in B). Choose v₁ ≠ v₂. Contradiction.

**The queue was destroyed in the act of consulting it.** Both scenarios consumed WIN and one LOSE; the queue cannot testify to which process took which.

*Why patches do not help:*
- *"Let the winner announce itself in a register."* The adversary stops it between the dequeue and the write. The losers know from their LOSE tokens that a winner exists and has already committed, but not to what. Making the winner decide *after* announcing does not help either: then the losers cannot distinguish "winner stopped before deciding" (they are free) from "winner decided and stopped" (they are bound).
- *"Let losers dequeue again."* The queue is empty.
- *"Encode more structure in the tokens."* Any pre-filled queue tells each process only **its own rank**. Rank is information about *yourself*; what you need is information about *someone else's identity*.
- *"Run a tournament: P₀ vs P₁, then the winner vs P₂."* A knockout bracket shrinks because losers are eliminated — and **elimination means stopping and waiting, which wait-freedom forbids**. If P₀ loses round 1 and stops, then P₁ stopping immediately afterwards leaves P₀ hanging forever. So P₀ must proceed to round 2 as well, and round 2 has three participants: the problem you started with. The bracket never narrows.

**What a consensus number is, then:** it counts how many processes can be left as a witness after removing everyone whose local state records the ambiguity. Two dequeuers create the ambiguity; a third process is one witness too many. This is why the values come out as small integers.

**Test-and-set is also 2**, with an even sharper intuition: it returns "first" to one caller and "not first" to the rest. With two processes the loser knows exactly who won — there is only one candidate. With three, the loser learns *that* it lost but not *to whom*, so it does not know whose register to read. Fetch-and-add is the same: it tells you your rank, and knowing you were third does not tell you who was first.

### The readable meaning of the table

| Object | What it tells the caller | Consensus number |
|---|---|---|
| read/write register | nothing about order | 1 |
| test-and-set, FIFO queue, fetch-and-add | *that* you were not first | 2 |
| atomic m-register assignment | partial ordering across m locations | 2m − 2 |
| compare-and-swap, load-linked/store-conditional | *whether* you were first, **and what the first value was** | ∞ |

> An object's consensus number measures **how much ordering information it discloses to the operations that modify it**.

### Why CAS is ∞

One register, initialised ⊥. Every process performs `CAS(⊥, my_value)`, then reads the register and decides what it finds.

- *Termination:* two steps, no waiting — wait-free for any n.
- *Agreement:* one linearizable register; all readers see the same value.
- *Validity:* the value came from some process's proposal.
- *Uniformity:* nothing in the construction mentions n.

Hence ∞. **CAS is exactly a write that reports whether you were first, and leaves the first value permanently readable — fused into one atomic step.** That single property is the entire distance from 1 to ∞, which is why the gap is a chasm rather than a gradient.

### The illuminating counterfactual: queue with peek

Suppose the queue had a `peek` — read the front element without removing it. Then:

> Every process enqueues its own value, then peeks.

Nobody dequeues, so the head never changes: it is whichever value was enqueued first. Everyone peeks and sees the same value. Agreement ✓, validity ✓, two operations and no waiting ✓ — and **nothing mentions n**.

A queue *with* peek has consensus number ∞. A queue *without* it has consensus number 2. The entire difference is that **dequeue destroys the record of who was first, and peek preserves it.** Adding more LOSE tokens adds more ranks; it does not stop the destruction.

## D.6 Why consensus is the right yardstick

Without this, the hierarchy is trivia. The answer is Herlihy's **universal construction**, in the same 1991 paper.

**Theorem.** Given consensus objects for n processes plus ordinary registers, you can implement **any** sequential object specification — a queue, a set, a balanced tree, an account, anything expressible as a deterministic state machine — as a wait-free concurrent object for n processes.

The construction is state-machine replication. Represent the object as a state machine and maintain a shared list of invocations. To apply an operation, a process proposes it into the next consensus instance in the chain; the winner's operation is appended; losers move to the next cell and retry. Any process can compute the current state by replaying the agreed list. Every process finishes in a bounded number of its own steps, because each round appends *someone's* operation, so a given process can lose only finitely often before its own is appended.

Therefore:

> **consensus number ≥ n** means "sufficient to build *anything* wait-free for n processes".
> **consensus number < n** means "there exists something you cannot build wait-free for n processes" — namely consensus itself.

This is structurally identical to NP-completeness. Boolean satisfiability is not intrinsically interesting; it is interesting because everything reduces to it, which makes "can you solve it" a complete characterisation of a class. Consensus plays the same role for wait-free synchronisation. The hierarchy is a **completeness result**, which is why it is *the* classification rather than *a* classification.

It also explains hardware. Processor architects converged on compare-and-swap and load-linked/store-conditional not merely because they are convenient, but because they are the minimum needed to be **universal** — and the theorem says anything weaker provably is not.

## D.7 What the theorem does not say

Four boundaries. Knowing them is what keeps the result from being over-applied.

**1. It is about wait-freedom, not about possibility.** Lamport's bakery algorithm achieves mutual exclusion using nothing but read/write registers, and from mutual exclusion you can build anything. No contradiction: the bakery algorithm **blocks**. A process that halts inside its critical section stops everyone forever. So the correct reading of "register = 1" is:

> **Registers are fully expressive as long as nothing fails. The hierarchy measures fault-tolerance, not computability.**

Every consensus number above 1 is a statement about surviving failures. This is the sentence to carry into design discussions.

**2. Determinism is assumed.** Randomised consensus using only registers exists, terminating with probability 1 (expected finite steps, no finite bound). Randomisation escapes both this hierarchy and FLP.

**3. The model is shared memory, with the object assumed to exist.** In asynchronous message passing you cannot *implement* a wait-free CAS at all — that would solve consensus, contradicting FLP. Read/write registers you *can* implement, via majority quorums. CAS you cannot. So "a conditional update in my database is a CAS" is true only while the database is reachable and up. The impossibility has not been beaten, only **relocated into that availability assumption** — which is exactly the qualification in A.4.

**4. Robustness is not settled.** Whether combining objects with consensus numbers below n can exceed their maximum is false for certain object definitions. It does not affect the practical claims, but you will meet it if you read further.

## D.8 What to carry away into design

1. **Read-then-act is not a coordination primitive.** No care in writing it changes this. Registers have consensus number 1.
2. **A conditional update on a unique key is a CAS**, and a CAS is universal. One linearizable register per unit of work is theoretically sufficient coordination for safety.
3. **Therefore no coordination service can give you a safety property you could not obtain from your transactional store** — while it is up. What such services buy is *availability*, not *safety*. That is a real thing to buy, but it is a different thing, and confusing the two is the origin of a great deal of over-engineering in this area.
4. **The gap between 1 and ∞ is about who was first, not about who said what.** When a design feels stuck, ask what ordering information is being destroyed, and by which operation.

---

# E. References

Grouped by the field each belongs to. The problem area — call it *fault-tolerant timed task execution* — is not a recognised research field, which is precisely why it is badly served by any single literature.

## Deterministic scheduling theory (operations research)

*Contributes: assignment and packing; the vocabulary for "does this fit".*

- Graham, Lawler, Lenstra, Rinnooy Kan. *Optimization and Approximation in Deterministic Sequencing and Scheduling: A Survey*. Annals of Discrete Mathematics, 1979. — origin of the α|β|γ notation.
- Pinedo. *Scheduling: Theory, Algorithms, and Systems*. — the standard textbook.

## Real-time systems and schedulability

*Contributes: capacity bounds, deadline semantics, periodic vs. sporadic task models. Section A.5.*

- Liu & Layland. *Scheduling Algorithms for Multiprogramming in a Hard-Real-Time Environment*. JACM, 1973.
- Dertouzos. *Control Robotics: The Procedural Control of Physical Processes*. 1974. — EDF optimality.
- Buttazzo. *Hard Real-Time Computing Systems*. — modern treatment.

## Queueing theory and applied probability

*Contributes: backlog behaviour, latency under load, variance effects. Section A.5.*

- Little. *A Proof for the Queuing Formula: L = λW*. Operations Research, 1961.
- Kleinrock. *Queueing Systems, Volume 1: Theory*. 1975.
- Kingman. *The Single Server Queue in Heavy Traffic*. 1961. — the heavy-traffic approximation.

## Distributed computing theory and fault tolerance

*The hard core of the problem. Sections A.6, A.8, A.10, D.*

- Fischer, Lynch, Paterson. *Impossibility of Distributed Consensus with One Faulty Process*. JACM, 1985.
- Chandra & Toueg. *Unreliable Failure Detectors for Reliable Distributed Systems*. JACM 43(2):225–267, 1996.
- Chandra, Hadzilacos, Toueg. *The Weakest Failure Detector for Solving Consensus*. JACM 43(4):685–722, 1996.
- Dwork, Lynch, Stockmeyer. *Consensus in the Presence of Partial Synchrony*. JACM, 1988.
- Attiya, Bar-Noy, Dolev. *Sharing Memory Robustly in Message-Passing Systems*. JACM, 1995. — the ABD algorithm; why registers are implementable and CAS is not.
- Ben-Or. *Another Advantage of Free Choice: Completely Asynchronous Agreement Protocols*. PODC, 1983. — randomisation escapes FLP.
- Chen, Toueg, Aguilera. *On the Quality of Service of Failure Detectors*. IEEE Transactions on Computers, 2002.
- Hayashibara, Défago, Yared, Katayama. *The φ Accrual Failure Detector*. SRDS, 2004.
- Alpern & Schneider. *Defining Liveness*. Information Processing Letters, 1985. — section A.8.
- Lamport. *Proving the Correctness of Multiprocess Programs*. IEEE TSE, 1977. — origin of the safety/liveness distinction.
- Gilbert & Lynch. *Brewer's Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services*. SIGACT News, 2002.
- Lynch. *Distributed Algorithms*. 1996. — the comprehensive reference.
- Cachin, Guerraoui, Rodrigues. *Introduction to Reliable and Secure Distributed Programming*. 2011. — **the readable one; start here.** Chapters 2 and 5 cover failure detectors and consensus.

## Transactions, atomic commitment, idempotence

*Sections A.2, A.6.*

- Skeen. *Nonblocking Commit Protocols*. SIGMOD, 1981.
- Bernstein, Hadzilacos, Goodman. *Concurrency Control and Recovery in Database Systems*. 1987. — freely available online.
- Helland. *Life Beyond Distributed Transactions: an Apostate's Opinion*. CIDR, 2007.
- Helland. *Idempotence Is Not a Medical Condition*. ACM Queue, 2012.

## Shared-memory synchronisation theory

*Section D.*

- Herlihy. *Wait-Free Synchronization*. ACM TOPLAS 13(1), 1991. — **the paper; short, and the construction is the whole argument.**
- Herlihy & Wing. *Linearizability: A Correctness Condition for Concurrent Objects*. ACM TOPLAS, 1990.
- Jayanti. *On the Robustness of Herlihy's Hierarchy*. PODC, 1993. — the robustness caveat.
- Lamport. *A New Solution of Dijkstra's Concurrent Programming Problem*. CACM, 1974. — the bakery algorithm; why registers suffice when blocking is allowed.

## Temporal representation

*Section A.1. The part almost nobody reads, and the source of the most silent production defects.*

- Allen. *Maintaining Knowledge about Temporal Intervals*. CACM, 1983. — interval algebra.
- Snodgrass. *Developing Time-Oriented Database Applications in SQL*. 1999. — freely available; valid time vs. transaction time.
- RFC 5545, §3.3.10. — recurrence rule semantics, including the expand/limit classification.
- Fowler & Foemmel. *Recurring Events for Calendars*. 1997. — the Temporal Expression pattern.

## Self-stabilisation and control

*Section A.1, level-triggered design.*

- Dijkstra. *Self-stabilizing Systems in Spite of Distributed Control*. CACM, 1974.
- Dolev. *Self-Stabilization*. MIT Press, 2000.
- Åström & Murray. *Feedback Systems: An Introduction for Scientists and Engineers*. — freely available.

## Load balancing and partitioning

*Section A.4.*

- Karger et al. *Consistent Hashing and Random Trees*. STOC, 1997.
- Thaler & Ravishankar. *Using Name-Based Mappings to Increase Hit Rates*. IEEE/ACM ToN, 1998. — rendezvous hashing.
- Azar, Broder, Karlin, Upfal. *Balanced Allocations*. STOC, 1994. — the power of two choices.
- Blumofe & Leiserson. *Scheduling Multithreaded Computations by Work Stealing*. FOCS, 1994.

## Reliability engineering (not computer science)

*Section A.8, the watcher regress.*

- Fleming. *A Reliability Model for Common Mode Failure in Redundant Safety Systems*. 1975. — the beta-factor model.
- IEC 61508 Part 6. — common-cause failure in practice.
- Knight & Leveson. *An Experimental Evaluation of the Assumption of Independence in Multiversion Programming*. IEEE TSE, 1986. — why design diversity underdelivers.
