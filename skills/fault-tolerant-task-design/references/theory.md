# Why: the results underneath

Read this when the user asks *why*, or when a recommendation is being resisted and the argument needs to be made rather than asserted. Do not lead with theory — lead with the finding, and reach here when the finding is challenged.

## Exactly-once does not exist

Not "is hard". Does not exist, in an asynchronous system with crash faults.

**The elementary argument.** You must order two things: performing the effect, and recording that you performed it.
- *Record, then act.* Crash between → the effect never happens but is recorded as done. **At-most-once**, with silent loss.
- *Act, then record.* Crash between → the effect happens and is repeated on recovery. **At-least-once**, with duplicates.

A third option requires atomic commit spanning your store and the external effect. There is nothing to reach for.

**Skeen (1981): no non-blocking atomic commitment protocol exists in the asynchronous model.** Either the protocol blocks when a participant fails, or it is not atomic. 2PC is atomic and blocks — when the coordinator fails after votes are cast, participants hold locks indefinitely, because they cannot distinguish "coordinator crashed before deciding" from "coordinator decided and will tell us shortly". 3PC reduces blocking but requires synchrony assumptions the model does not grant.

Beneath it: **FLP (1985)** — no deterministic protocol solves consensus in an asynchronous system with even one crash fault; atomic commitment is a consensus problem and inherits the impossibility. **Two Generals** — no agreement over a lossy channel, because the last message is always unacknowledged.

And a practical obstacle independent of theory: **external services offer no prepare phase.** Even if you would accept blocking, mail transport and third-party APIs give you `send`, not `prepare`/`commit`.

**What does exist:**

```
at-least-once execution + idempotent receiver keyed by derived identity = exactly-once effect
```

The load-bearing condition is that **the effect boundary must participate**. Not something you can add on your side.

Worked through for mail: transport is at-least-once by protocol design, and delivery confirmation is out of band, so end-to-end exactly-once mail is **not achievable in principle**. What is achievable, and what the design document should state: at-most-one recorded intent (uniqueness constraint on derived identity); at-least-once attempt; deduplication at the provider via idempotency key or message identifier.

## Safety and liveness

Precise definitions, not intuitive ones:

- **Safety** — nothing bad ever happens. Violated by a **finite prefix**. Once violated, no continuation repairs it.
- **Liveness** — something good eventually happens. Never violated by a finite prefix; any finite execution can still be extended to satisfy it.
- **Alpern & Schneider:** every property is the intersection of a safety property and a liveness property. The classification is exhaustive.

For a task system:

| | Property |
|---|---|
| **Safety** | no unit's effect occurs more than once; no effect occurs for an occurrence that was not due |
| **Liveness** | every due unit eventually reaches a terminal state |

### The design rule

> **Build so that a wrong failure detector costs liveness, not safety.**

- **False positive** (live worker suspected). Another worker is dispatched for the same unit. If safety depended on "only one worker was ever dispatched", safety is violated on a finite prefix, irrecoverably. If safety instead comes from derived identity + uniqueness constraint + fencing token, the second dispatch is *wasted work* — a liveness-class cost.
- **False negative** (dead worker not suspected). The unit stalls until the lease expires. Pure liveness cost by construction.

**The mechanical test.** At every point where the system consults a failure detector, ask: *if this answer is wrong, in either direction, does some finite prefix now violate a safety property?* If yes, safety rests on a timeout — and no correct failure detector exists in the asynchronous model, so the guarantee is unachievable.

The three constructions that move you to the safe side: derived identity + uniqueness constraint (deduplicates *intent*); fencing tokens verified at the resource (deduplicates *effect*); idempotent effects via provider keys where the second is unavailable.

**Why this dissolves the watcher regress.** Once the detector cannot break safety, it is permitted to be crude. A crude detector needs a supervisor to be *timely*, not to be *correct*. Supervision is demoted from a correctness requirement to an availability optimisation with diminishing returns. The regress terminates not because you stopped adding layers, but because the property that would have forced you to keep adding them was never made to depend on them.

## Failure detectors (Chandra–Toueg)

The **asynchronous model**: no bound on message delay, no bound on relative process speed, no synchronised clocks. Its defining consequence is that **a crashed process and a slow process are indistinguishable**.

Rather than adding timing assumptions, add an oracle: a failure detector at each process outputting a set of suspects, explicitly allowed to be wrong. Classify by two orthogonal properties.

**Completeness — about crashed processes.** *Strong*: eventually every crashed process is permanently suspected by every correct process. *Weak*: by at least one. Completeness is cheap — any finite heartbeat timeout provides it.

**Accuracy — about correct processes.** *Strong*: no correct process is ever suspected. *Weak*: some correct process is never suspected. *Eventual* (◇) variants: the property holds after some unknown finite time. Accuracy is expensive, and perfect accuracy is unobtainable in the model.

Key results: consensus is solvable with **◇S** given a majority of correct processes; **◇W is the weakest failure detector for consensus**.

The eventual classes matter practically because "◇" permits an **arbitrary but finite** period of arbitrarily wrong suspicion — exactly what a heartbeat timeout gives you. Your detector is not correct in the asynchronous model, but satisfies ◇S under eventual synchrony, and that is enough.

Two engineering corollaries: **timeouts should be adaptive** (a fixed timeout has a fixed, unmeasured false-positive rate; accrual detectors output a continuous suspicion level so each consumer picks its own threshold), and **false suspicions must be survivable**, which is the design rule above. The two sections are the same result from opposite ends.

## Herlihy's consensus hierarchy

**Setting:** asynchronous shared memory, **wait-free** — every process completes in a finite number of *its own* steps regardless of how slow others are or whether they crash. Strictly stronger than lock-free; rules out any solution where one process waits for another.

**Consensus number** of an object type T: the largest n for which you can solve wait-free binary consensus among n processes using instances of T plus read/write registers. Unbounded → ∞.

| Consensus number | Objects |
|---|---|
| 1 | atomic read/write registers |
| 2 | test-and-set, swap, fetch-and-add, FIFO queues, stacks |
| 2m − 2 | atomic m-register assignment |
| ∞ | compare-and-swap, load-linked/store-conditional |

**Registers are 1.** You cannot build wait-free consensus for even two processes out of plain reads and writes. The proof is a bivalence argument: from a *critical* configuration (bivalent, one step from univalent), enumerate what the two next operations can be — both read, one reads one writes, both write different registers, both write the same register — and in every case construct two continuations that a surviving process cannot distinguish, then give steps only to that process until it decides. It must decide identically in configurations that demand different decisions.

The engine of the proof, worth internalising because it recurs: *construct two configurations some process cannot distinguish, then schedule only that process.* Crashing is not a separate primitive — it is a schedule in which an identifier stops appearing. What "crashing the witnesses" accomplishes is not severing a channel (there is no *ask another process* operation; a register is a passive cell) but **removing a future writer**, so the difference can never leak into shared memory.

**CAS is ∞**, and the construction is one line: a single register initialised ⊥; each process performs `CAS(⊥, my_proposal)`, then reads and decides what it finds. Termination (two steps, no waiting), agreement (one linearizable register), validity (the value is someone's proposal), and nothing mentions n.

**The illuminating counterfactual.** A FIFO queue is 2. A queue *with peek* is ∞ — everyone enqueues their value, then peeks; the head never changes, so all see the first-enqueued value. The entire difference is that **dequeue destroys the record of who was first, and peek preserves it.** An object's consensus number measures how much *ordering information* it discloses.

**Why consensus is the right yardstick.** Herlihy's **universal construction**: given consensus objects for n processes plus registers, you can implement *any* sequential object specification as a wait-free concurrent object for n processes, via state-machine replication over a chain of consensus instances. So consensus number ≥ n means "sufficient to build anything wait-free for n processes". This is a completeness result, structurally identical to NP-completeness — which is why it is *the* classification rather than *a* classification.

### What it does not say

1. **It is about wait-freedom, not possibility.** Lamport's bakery algorithm achieves mutual exclusion with registers alone, and from mutual exclusion you can build anything — but it *blocks*. So "register = 1" means: **registers are fully expressive as long as nothing fails. The hierarchy measures fault-tolerance, not computability.** This is the sentence to carry into design discussions.
2. **Determinism is assumed.** Randomised consensus using only registers exists (terminating with probability 1). Randomisation escapes both this hierarchy and FLP.
3. **The model is shared memory, with the object assumed to exist.** In asynchronous message passing you cannot *implement* a wait-free CAS at all — that would solve consensus, contradicting FLP. Registers you can (ABD, majority quorums); CAS you cannot. So "a conditional update in my database is a CAS" holds only while the database is up. The impossibility is **relocated into that availability assumption**, not removed.
4. **Robustness is not settled** — whether combining sub-n objects can exceed their maximum is false for certain object definitions.

### Carry into design

- **Read-then-act is not a coordination primitive.** No care in writing it changes this.
- **A conditional update on a unique key is a CAS**, and CAS is universal. One linearizable register per unit is theoretically sufficient coordination for safety.
- **Therefore no coordination service gives you a safety property your transactional store could not** — while it is up. Such services buy *availability*, not *safety*. Confusing the two is the origin of much over-engineering here.
- **The gap between 1 and ∞ is about who was first, not who said what.** When a design feels stuck, ask what ordering information is being destroyed, and by which operation.

## Correlated failure

*The naive reasoning:* if failures were independent, k watcher layers give `q^k` — geometric decay.

*Why it is wrong:* the **beta-factor model** (functional safety, probabilistic risk assessment) says a fraction β of each component's failure rate is a *common cause* taking down all copies at once:

```
q_total ≈ q_independent^k + β·q      →      β·q   as k → ∞
```

**There is a floor, independent of depth.** Published β for redundant hardware sharing an environment runs 1–10%. For identical software on identical hosts it is far worse — a logic defect is 100% correlated by construction: the watcher has the same tzdb, the same pool-exhaustion bug, the same memory limit, shipped by the pipeline that just pushed the bad config.

*The rule:* each additional layer must **cross a boundary you can name** — different process → host → cluster → provider → implementation → organisation and human. "Two replicas" and "a watchdog sidecar" cross almost nothing, and their measured improvement is near zero.

*The terminal anchor:* an external dead-man's switch — expect a signal every N minutes, alert a human if absent — crosses provider, network and code boundaries at once. Its failure mode is *fail-loud to a human*, and a human is an agent outside the formal system, which is the only way a regress of this kind ends.

*Caveat on diversity:* independently developed versions of one specification still fail together far more often than independence predicts, because hard inputs are hard for everyone. Do not over-invest in "write the watcher in a different language" — the correlation is usually in the **specification**.

## References

**Distributed computing and fault tolerance**
- Fischer, Lynch, Paterson. *Impossibility of Distributed Consensus with One Faulty Process*. JACM, 1985.
- Chandra & Toueg. *Unreliable Failure Detectors for Reliable Distributed Systems*. JACM 43(2), 1996.
- Chandra, Hadzilacos, Toueg. *The Weakest Failure Detector for Solving Consensus*. JACM 43(4), 1996.
- Dwork, Lynch, Stockmeyer. *Consensus in the Presence of Partial Synchrony*. JACM, 1988.
- Attiya, Bar-Noy, Dolev. *Sharing Memory Robustly in Message-Passing Systems*. JACM, 1995.
- Ben-Or. *Another Advantage of Free Choice*. PODC, 1983.
- Chen, Toueg, Aguilera. *On the Quality of Service of Failure Detectors*. IEEE TC, 2002.
- Hayashibara et al. *The φ Accrual Failure Detector*. SRDS, 2004.
- Alpern & Schneider. *Defining Liveness*. IPL, 1985.
- Gilbert & Lynch. *Brewer's Conjecture...*. SIGACT News, 2002.
- Cachin, Guerraoui, Rodrigues. *Introduction to Reliable and Secure Distributed Programming*, 2011. — **the readable one; start here.**

**Transactions and idempotence**
- Skeen. *Nonblocking Commit Protocols*. SIGMOD, 1981.
- Bernstein, Hadzilacos, Goodman. *Concurrency Control and Recovery in Database Systems*, 1987.
- Helland. *Life Beyond Distributed Transactions*. CIDR, 2007; *Idempotence Is Not a Medical Condition*. ACM Queue, 2012.

**Shared-memory synchronisation**
- Herlihy. *Wait-Free Synchronization*. ACM TOPLAS 13(1), 1991. — **the paper; short.**
- Herlihy & Wing. *Linearizability*. ACM TOPLAS, 1990.
- Jayanti. *On the Robustness of Herlihy's Hierarchy*. PODC, 1993.
- Lamport. *A New Solution of Dijkstra's Concurrent Programming Problem*. CACM, 1974.

**Real-time and queueing**
- Liu & Layland. *Scheduling Algorithms for Multiprogramming in a Hard-Real-Time Environment*. JACM, 1973.
- Buttazzo. *Hard Real-Time Computing Systems*.
- Little. *A Proof for the Queuing Formula: L = λW*. Operations Research, 1961.
- Kingman. *The Single Server Queue in Heavy Traffic*, 1961.

**Temporal representation**
- Snodgrass. *Developing Time-Oriented Database Applications in SQL*, 1999.
- RFC 5545 §3.3.10 — recurrence rule semantics, expand/limit classification.
- Fowler & Foemmel. *Recurring Events for Calendars*, 1997.

**Self-stabilisation and control**
- Dijkstra. *Self-stabilizing Systems in Spite of Distributed Control*. CACM, 1974.
- Åström & Murray. *Feedback Systems*.

**Partitioning**
- Karger et al. *Consistent Hashing and Random Trees*. STOC, 1997.
- Thaler & Ravishankar. *Using Name-Based Mappings to Increase Hit Rates*. IEEE/ACM ToN, 1998.
- Azar, Broder, Karlin, Upfal. *Balanced Allocations*. STOC, 1994.
- Blumofe & Leiserson. *Scheduling Multithreaded Computations by Work Stealing*. FOCS, 1994.

**Reliability engineering**
- Fleming. *A Reliability Model for Common Mode Failure in Redundant Safety Systems*, 1975.
- IEC 61508 Part 6.
- Knight & Leveson. *An Experimental Evaluation of the Assumption of Independence in Multiversion Programming*. IEEE TSE, 1986.
