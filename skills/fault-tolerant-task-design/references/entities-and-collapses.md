# Entities, identity, and collapses

## The four core entities

| Entity | Identity | Nature | Cardinality |
|---|---|---|---|
| **Job** | assigned | a *specification*: temporal expression, payload template, policies | 1 |
| **Occurrence** | `(job, job_version, nominal_instant)` — **derived** | a *fact about time*: work is owed | 1 per firing |
| **Unit of work** | `(occurrence, partition_key)` — **derived** | an element of the fan-out; unit of durable progress and retry scope | N per occurrence |
| **Attempt** | assigned | one interaction with the world | M per unit |

Relations: Job 1→N Occurrence, Occurrence 1→N Unit of work, Unit of work 1→N Attempt.

### Job

A pure specification containing no execution state. It answers "what should happen, when, under which policies". A job should be readable as data and must never mutate as a side effect of running.

The temporal specification is a **generator**, not a timestamp. It exposes "does this civil datetime match?" and "what is the next match after X?". It **must not read the clock**. Two nodes, or one node at two times, must produce identical output for identical inputs. A generator that consults "now" internally silently reintroduces the coordination problem.

### Occurrence

**A firing is derived, not received.** This is the most consequential decision in the design.

If a firing is an *event you receive*, missing it destroys information permanently, and the only defence is another party that noticed the loss — which needs its own watcher, and so on. If a firing is a *value you compute*, a node that boots three hours late computes the same set and repairs itself. The regress does not terminate; it never starts.

```
occurrences(job_version, t0, t1) → ordered set of nominal instants   -- pure function
missing = derive(job, t0, t1) \ materialised(job, t0, t1)            -- reconciliation
```

Materialising the missing set under derived identity is idempotent, safe to run concurrently from every node, at any frequency. That is the entire self-healing core.

The choice of `t0` **is** the misfire policy: a watermark (`last_reconciled_instant`) recovers everything and can produce a two-week backfill; a bounded lookback (`now − Δ`) bounds the backfill and silently discards older work. Δ answers a business question, not a technical one.

### Unit of work

The element of the fan-out — one recipient, one account, one file. It is the unit of **durable progress** and the scope of **retry**.

The `partition_key` must be:
1. **Derivable from the domain**, not assigned by whoever fanned out first. An auto-increment identifier fails this.
2. **Stable across derivations.** "Row number in the result set" fails this.

If there is no fan-out, `partition_key` is a constant and the unit collapses into the occurrence **legitimately**. This is the one benign merge in the model.

### Attempt

One interaction with the world: when, by whom, with what outcome, with what fencing token. Unlike occurrences and units, an attempt's identity **cannot** be derived — it is a fact about the past, not about the schedule.

Keeping attempts separate from units is what makes "did this send twice, once, or not at all?" answerable after the fact.

## Identity is prior to idempotence

> **Deduplication is impossible without a canonical name that all parties can independently derive.**

Idempotence is not a property you add to a handler by writing careful code. It becomes *available* once the unit has a name any node can compute without asking anyone. Given such a name, a uniqueness constraint on a single linearizable store performs the deduplication.

**Why coordination cannot substitute.** Consensus lets processes agree on a *value*. Deduplication requires deciding whether a proposed action is *equivalent* to one already performed — an equivalence relation on actions, which consensus does not supply. If node A generates an action labelled `a7f3` and node B independently generates "the reminder to user 42 for the 2026-09-01 run" labelled `b91c`, all nodes can agree perfectly that the action set is `{a7f3, b91c}`. Consensus succeeded; deduplication failed. The missing ingredient is a canonical naming function, which is a **domain** artifact.

A sharper second form: even given a naming function, deduplication must be enforced **where the effect becomes visible**. Agreement among your processes about what was sent is not the world having received it once.

So consensus is **neither necessary nor sufficient**: not necessary, because a derived name plus a uniqueness constraint suffices; not sufficient, because the effect boundary can duplicate regardless.

### Substitution errors to recognise

| Attempt | Failure mode |
|---|---|
| Distributed lock across nodes | A GC pause or clock skew produces two holders. The accepted repair is a fencing token — which *is* a monotonic name checked at the resource. |
| Leader election, "only the leader acts" | Leadership is a claim about the past by the time you act. During a transition two leaders overlap and the old leader's in-flight request can land after the new leader's. |
| 2PC between store and external service | The external service has no prepare phase; even where one exists, 2PC blocks on coordinator failure. |
| Total-order broadcast / "put it all through consensus" | The consumer must record its read position *atomically with the effect*. The dual write returns. Streaming platforms achieve exactly-once only because offset commit and produce share one transactional system. |
| Quorum read before acting | Read-then-act is not atomic. Both nodes read "not done", both act. You need a *conditional write*. |
| Serializable isolation as deduplication | Correct *within* the store; cannot reach the external effect. |

In every row, coordination is being asked to establish **identity** and can only establish **agreement**.

## The four conditional entities

Needed under conditions to check explicitly, not by default.

### Claim / Lease
`(unit, worker, expiry, fencing token)`.

*Foldable* into the unit as columns when the store is single and linearizable. *Not foldable* when the claim lives in a different system from the unit state — a broker's visibility timeout is a claim held by the broker while state lives in your database. That is a dual write and it will diverge.

A lease is not a lock. Its safety depends on bounded clock drift **and** bounded process pauses, and the asynchronous model provides neither: a 40-second pause is indistinguishable from a crash. Therefore **a lease gives mutual exclusion of *intent*, never of *effect***. Exclusion at the effect boundary requires a monotonic fencing token the resource checks, or name-based deduplication at the resource. Shortening the lease does not remove the window, only its probability.

### Effect record (outbox)
The *intent* to act externally, recorded separately from the attempt that carries it out. Attempt = what you did; effect record = what you promised to do.

*Droppable only* if the effect boundary participates in your store's transaction. For anything crossing a network to a third party, it never does.

### Job version
What happens to already-derived occurrences when someone edits the schedule? Without this entity the question has no answer and historical occurrences silently change meaning. *Droppable* if jobs are immutable — often the cheaper design.

### Temporal context
Zone, business/holiday calendar, and the **version** of the time-zone database in force. *Droppable* if everything is UTC and no business calendar exists — rarer than teams assume, since "the first working day of the month" is a business calendar and those change retroactively.

## The collapses

Each destroys information. The distinguishing feature is that **no amount of implementation quality compensates**, because the repair needs data that was never written down.

### Job ≡ Occurrence
**Shape:** one row per job with a mutable "next run at", advanced after each firing.

**Consequence:** history is destroyed on advance. Backfill is impossible because the skipped occurrences were never named. The misfire policy is permanently restricted to "skip" or "fire once immediately" and can never be "fire all". Concurrent workers race on one row, so that row becomes a global lock and the job cannot fan out.

**Why unrepairable:** you cannot reconstruct occurrences never materialised once the anchor has moved past them. No index, isolation level or retry recovers a name never assigned.

**Repair:** keep your own occurrence table with derived identity, materialised by level-triggered derivation. A scheduler component may still *trigger* the derivation; it must not be the system of record for what is owed.

### Occurrence ≡ Attempt
**Shape:** a single "last run at" timestamp; or a runs table where a row means both "was due" and "was executed".

**Consequence:** you cannot distinguish "not yet run" from "ran and failed" from "ran, outcome unknown". Retry and scheduling become one mechanism, so retry policy and misfire policy cannot be configured independently.

**Why unrepairable:** the distinction was never recorded. The symptom is that "did this send twice or zero times?" is unanswerable — precisely the question you will be asked.

**Repair:** separate tables. Occurrence rows are created by derivation (before any execution); attempt rows are created by execution.

### Occurrence ≡ Unit of work
**Shape:** the fan-out lives in memory for the duration of the run — a loop over recipients inside the job handler.

**Consequence:** partial progress is not durable. A crash at 90% forces full redo, which forces the effect to be idempotent anyway — so you pay the cost of idempotence without gaining resumability. Utilisation becomes all-or-nothing rather than a progress question.

**Why unrepairable at scale:** recovery time is bounded below by full batch duration. As N grows, recovery becomes impossible within the period — utilisation exceeds 1 by construction under any nonzero crash rate.

**Repair:** materialise the fan-out durably *before* work begins. This is the most common missing piece in otherwise competent implementations.

### Attempt ≡ Effect
**Shape:** performing the external action inside the transaction; or setting "done" immediately before or after the action with no separate record.

**Consequence:** a dual write.

**Why unrepairable:** no non-blocking atomic commitment protocol exists in the asynchronous model, and external services offer no prepare phase. Serializable isolation does not help — the external effect is not a transaction participant. The usual compensation "mark sending, send, mark sent" narrows the duplicate window but does not close it, and is an outbox with the durability removed.

**Repair:** transactional outbox. See `patterns.md`.

### Claim ≡ Unit state, without a fencing token
**Consequence:** mutual exclusion of intent, not of effect. A worker that pauses for 40 seconds resumes believing it holds a lease that expired 30 seconds ago.

**Why unrepairable locally:** the resource must reject the stale actor. Nothing on the worker side removes the window.

**Repair:** a monotonic `fence` on the unit, incremented on each claim, carried into every subsequent conditional write and passed to the resource where the resource can check it.

### Nominal instant ≡ absolute instant
**Shape:** storing only a UTC timestamp for "09:00 in a named zone".

**Consequence:** DST transitions and time-zone database updates silently move, duplicate or delete occurrences. On the spring-forward day 03:30 local does not exist; on the autumn day it exists twice.

**Why unrepairable:** once resolved and stored you cannot re-resolve under corrected rules, and can no longer identify which stored instants were affected.

**Repair:** store civil datetime + zone + resolution policy; treat the absolute instant as derived; re-derive after tzdb updates.
