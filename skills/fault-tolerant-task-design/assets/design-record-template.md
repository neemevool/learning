# Design record template

Use for both design and audit output. Adapt headings, but do not drop the parameter table or the guarantee statement — they are the two artifacts that make the document useful a year later.

---

# <System name> — timed task execution design record

## 1. Regime and selection parameters

`g = period / durable-write-latency` = <value>. Regime: <`g >> 1` durable per-occurrence | `g < 1` in-memory recompute>

| Parameter | Value | Where it is written down |
|---|---|---|
| `g` | | |
| Fan-out cardinality | | |
| Effect boundary control | none / idempotency key / transactional | |
| Misfire semantics | skip / immediate / coalesce / backfill, Δ = | |
| Utilisation `U` | measured / estimated | |
| Skew | uniform / heavy-tailed | |

Any row with a blank "where" is a decision made accidentally in code. List those explicitly below.

## 2. Entity model

| Entity | Present as | Identity | Notes |
|---|---|---|---|
| Job | | | |
| Occurrence | | derived: `f(...)` | |
| Unit of work | | derived: `f(...)` | or legitimately merged (no fan-out) |
| Attempt | | | |
| Claim / Lease | needed? | | fence column, scope |
| Effect record | needed? | | idempotency key = |
| Job version | needed? | | |
| Temporal context | needed? | | zone, calendar, tzdb version |

Merges present, and whether each is legitimate given the parameters above.

## 3. Mechanisms

- **Occurrence derivation** — generator, `t0` selection, DST resolution policy, search-horizon bound.
- **Claim** — the conditional update, isolation level, lease duration, fence scope.
- **Effect** — outbox shape, relay strategy, retention and key lifetime, what the far end deduplicates on.
- **Partitioning** — strategy and rebalancing behaviour.
- **Reliability anchor** — what it is, and which boundary it crosses.

## 4. Policies (as data, per job)

| Policy | Value | Column / config key |
|---|---|---|
| Misfire | | |
| Overload, concurrency k | | |
| Time-zone resolution | | |
| Retry bounds and terminal state | | |
| Effect boundary contract | | |

**Stability check:** is the misfire × overload combination stable? "Do not overlap" + "fire all missed" is not, under sustained overload.

## 5. Observables

| Observable | Where |
|---|---|
| Backlog age (oldest non-terminal unit) | |
| Skipped / shed counts per job | |
| Measured `U` per job | |
| Duplicate-effect rate, or a record that the boundary cannot report it | |

## 6. Findings *(audit mode only)*

Ordered by irrecoverability first, then severity. A collapse that destroys information ranks above a bug that merely misbehaves, because the second is fixable later and the first is not.

| # | Observed construct | Violates | Failure it produces | Repair | Class |
|---|---|---|---|---|---|
| 1 | | | | | irrecoverable / fixable / undocumented trade |

Separate clearly:
- **Wrong** — violates a principle and produces a failure.
- **Undocumented trade** — defensible given the parameters, but not written down anywhere.
- **Over-engineering** — machinery with no justifying parameter value.

## 7. Guarantee statement

Answer all six without hedging. An unanswerable question is where the next incident comes from.

1. **Misfire policy, per job:**
2. **Is occurrence and unit identity deterministic and independently computable?**
3. **Where exactly is the effect boundary, and does it deduplicate?** If not, observable duplicate rate:
4. **Under false suspicion of a live worker, which property breaks — liveness or safety?**
5. **What is `U`, and what happens at `U > 1`?**
6. **Terminal reliability anchor, and is its failure mode uncorrelated with the system it watches?**

## 8. Stated limits

What this system does **not** guarantee, in plain words. At minimum, state the delivery semantics at the effect boundary and the availability bound imposed by the coordination point.

> A stated limit is an engineering artifact; an unstated one is a future incident.
