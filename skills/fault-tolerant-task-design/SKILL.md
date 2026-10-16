---
name: fault-tolerant-task-design
description: Design, review, and audit scheduled and background task execution systems for correctness under failure. Use this whenever the user is working on cron jobs, recurring jobs, batch windows, job schedulers, background workers, outbox or relay processing, scheduled notifications and email sends, or Quartz/Hangfire/Celery/Sidekiq/Kubernetes CronJob setups. Also use it when the user reports or asks about missed runs, duplicate sends, overlapping runs, stuck jobs, "exactly-once", idempotency keys, leases, fencing tokens, or "why did this job run twice" — and when reviewing a schema or codebase that contains a jobs, schedules, occurrences, outbox, or queue table, even if the user only asked for a general code review.
---

# Fault-tolerant timed task execution

A scheduled task system is two problems wearing one name. Treating them as one is the root cause of most defects in this area.

- **Time → firing** is a data-structure problem. Solved, non-distributed, no coordination needed.
- **Firing → effect** is a fault-tolerance problem. This is where duplicate sends, missed runs, overlapping batches and stuck jobs live.

Your job with this skill is to keep those separate, then make the second one's guarantees explicit. The deliverable is never "it works" — it is a **statement of what the system guarantees and where its limits are**.

Two failure modes to name when you find them:

- **Over-engineering** — machinery whose justifying parameter value the system does not have. Usually coordination infrastructure sized for a high-rate scheduler, deployed on a job that runs once a day.
- **Incompleteness** — a decision that has no home in the design, so it was made accidentally in code by whoever wrote the loop.

## Decide which mode you are in

**Audit mode** — existing code, schema, or a reported symptom ("this sent twice", "we missed a day", "the batch overlaps"). Go to *Audit workflow*.

**Design mode** — new or substantially reworked system. Go to *Design workflow*.

If the user reports a symptom, still audit the whole thing. Symptoms in this area are almost always downstream of an entity collapse, and fixing the symptom without fixing the collapse produces a second symptom later.

## Step 0 in both modes: establish the regime

Compute or estimate:

```
g = period / durable-write-latency
```

If `g < 1` (sub-millisecond scheduling, thousands of firings per second), **most of this skill does not apply.** That regime cannot durably record each firing; it uses in-memory timer wheels and recovers by recomputing from the specification. Say so and stop applying the entity model.

If `g >> 1` — anything from seconds upward, and certainly a daily job at `g ≈ 10⁷` — continue. Everything below assumes this.

Then establish the six selection parameters. A variation of the system is fully specified by these; everything else (storage engine, language, framework) is substitution *below* them.

| Parameter | Range | What it forces |
|---|---|---|
| `g` = period / durability latency | `<1` … `10⁷` | in-memory recomputation vs. durable per-occurrence state machine |
| Fan-out cardinality | 1 … 10⁷ | whether the unit-of-work layer exists at all |
| Effect boundary control | none / idempotency key / transactional | exactly-once effect achievable, or reconcile-only |
| Misfire semantics | skip / immediate / coalesce / backfill | how occurrence derivation handles gaps |
| Utilisation `U` | ≪1 … >1 | overlap policy, shedding, backpressure |
| Skew | uniform … heavy-tailed | static partitioning vs. queue vs. over-partitioning |

Ask for values you cannot infer. Do not proceed to recommendations with blanks — a recommendation made against an unknown parameter is a guess presented as advice.

Two tests to apply once the table is filled:

- For each subsystem present, which parameter value makes it necessary? No answer means over-engineering.
- For each parameter, where in the system is its value written down? No home means the decision was made accidentally.

## The entity model

Four core entities. Most implementations collapse them into one table, and that collapse destroys information that no later implementation quality can recover.

| Entity | Identity | Nature | Cardinality |
|---|---|---|---|
| **Job** | assigned | a *specification*: temporal expression, payload template, policies | 1 |
| **Occurrence** | `(job, job_version, nominal_instant)` — **derived** | a *fact about time*: work is owed | 1 per firing |
| **Unit of work** | `(occurrence, partition_key)` — **derived** | an element of the fan-out; unit of durable progress and retry scope | N per occurrence |
| **Attempt** | assigned | one interaction with the world | M per unit |

Four conditional entities, each needed under a condition you should check rather than assume: **Claim/Lease**, **Effect record (outbox)**, **Job version**, **Temporal context**.

The load-bearing principle:

> **Deduplication is impossible without a canonical name that all parties can independently derive.**

Identity is prior to idempotence. Idempotence is not something you add to a handler by writing careful code; it becomes *available* once the unit has a derived name. Coordination cannot substitute — consensus establishes *agreement*, not *identity*. If you see a design reaching for a distributed lock, leader election, or a consensus service to prevent duplicates, that is the substitution error, and the fix is a derived key plus a uniqueness constraint.

Read `references/entities-and-collapses.md` for the full model, the four conditional entities, and each collapse with its unrepairable consequence.

## Audit workflow

**1. Locate the system.** Find the schedule/job definitions, the dispatch loop, the worker, and the effect boundary (the outbound call). Note the store and its isolation level.

**2. Map what exists onto the four entities.** Draw the actual mapping, including merges. Name each merge explicitly — this is where most findings come from.

**3. Run the collapse checks.** For each, see `references/entities-and-collapses.md` for the consequence and the repair:

- Job ≡ Occurrence — mutable "next run at" on the job row
- Occurrence ≡ Attempt — a single "last run at", or one table meaning both "was due" and "was executed"
- Occurrence ≡ Unit of work — fan-out lives in memory for the duration of the run
- Attempt ≡ Effect — the outbound call and the state write are not one atomic act
- Claim ≡ Unit state without a fencing token
- Nominal instant ≡ absolute instant — resolved UTC stored for a zoned schedule

Only one merge is benign: occurrence ≡ unit of work when there is genuinely no fan-out.

**4. Scan for code-level signatures.** Read `references/code-signatures.md` and check each. These are the concrete, greppable forms the collapses take in real code — read-then-act instead of a conditional update, random idempotency keys, clock reads inside a recurrence generator, HTTP calls inside a transaction, missing unique constraints.

**5. Check the seven non-negotiables** (below).

**6. Produce findings.** Use `assets/design-record-template.md`. Order findings by *irrecoverability*, not by severity felt: a collapse that destroys information ranks above a bug that merely misbehaves, because the second is fixable later and the first is not.

For each finding give: the observed construct, which entity or principle it violates, the failure it produces, and the repair. Distinguish clearly between *this is wrong* and *this is a trade you may have made deliberately, but it is not written down*.

## Design workflow

**1. Fill the parameter table.** Ask for what you cannot infer.

**2. Define the entity model** for this system, including which conditional entities are needed and why, and which merges are legitimate given the parameters.

**3. Specify the identity functions** concretely:

```
occurrence_id = f(job_id, job_version, nominal_instant)
unit_id       = f(occurrence_id, partition_key)
```

Check the partition key is *derivable from the domain* and *stable across derivations*. An auto-increment id fails the first; "row number in the result set" fails the second.

**4. Choose the policies** — misfire, overload, time-zone resolution, retry, effect boundary contract — and place each as data on the job, not in code. See `references/capacity-and-policy.md`, which also covers why some combinations are unstable.

**5. Specify the mechanisms.** See `references/patterns.md` for the occurrence derivation algorithm, the CAS claim (PostgreSQL and SQL Server), the outbox, and partitioning strategies.

**6. Write the design record**, ending with the guarantee statement.

## The seven non-negotiables

For the `g >> 1` regime. Anything less has a gap; anything beyond needs a justifying parameter value.

1. **Separate job, occurrence, unit of work, attempt.**
2. **Derived identity** for occurrences and units — computable by any node without asking anyone.
3. **A uniqueness constraint** on those identities in a linearizable store. Not a code path — a constraint.
4. **Level-triggered derivation**, run periodically and unconditionally: `missing = derive(job, t0, t1) \ materialised(job, t0, t1)`, materialised idempotently. This is what replaces the watcher hierarchy, because a node that boots late repairs itself.
5. **Compare-and-swap claim** per unit, carrying a lease expiry and a monotonic fencing token.
6. **An effect record separate from the attempt** (outbox) whenever the effect crosses a system boundary.
7. **One external reliability anchor** — a dead-man's switch outside the deployment, not a second watcher inside it.

## The guarantee statement

This is the output. A system that can answer these six without hedging understands its own limits, whatever it looks like structurally. An unanswerable question is where the next incident comes from.

1. What is the misfire policy, per job?
2. Is occurrence and unit identity deterministic and independently computable?
3. Where exactly is the effect boundary, and does it deduplicate? If not, what is the observable duplicate rate?
4. Under false suspicion of a live worker, which property breaks — liveness or safety?
5. What is `U`, and what happens at `U > 1`?
6. What is the terminal reliability anchor, and is its failure mode uncorrelated with the system it watches?

## Things to be plain about

**Never promise exactly-once execution.** It does not exist in an asynchronous system with crash faults — this is a theorem, not a difficulty. What exists is *exactly-once effect*: at-least-once execution plus an idempotent receiver keyed by derived identity, **and only if the effect boundary participates**. If the far end offers no idempotency key, the system does not have the property, and the design document should say so in those words. A stated limit is an engineering artifact; an unstated one is a future incident.

**Do not let safety depend on a failure detector.** No correct failure detector exists in the asynchronous model — a slow worker and a dead one are indistinguishable. Design so that a wrong detector costs *liveness* (wasted work, delay), never *safety* (duplicate effect). The mechanical test: at each point where the system decides "that worker is dead", ask whether a wrong answer in either direction violates a safety property on a finite prefix. If yes, safety is resting on a timeout.

**A lease is not mutual exclusion of effect.** It bounds intent only, because process pauses are unbounded. Only a fencing token checked *at the resource*, or name-based deduplication at the resource, excludes the effect.

**Overlap is a capacity question, not a locking question.** If `U > 1`, no lock, watcher or retry policy helps. A mutex applied to an overload converts a visible overload into an invisible one.

**Resist the watcher stack.** Redundancy buys availability only across a boundary where failure modes are uncorrelated. Two replicas in one cluster share the pipeline, the config, the time-zone database and the memory limit; the third layer measurably buys nothing. Depth 1 across a real boundary beats depth 3 inside the cluster.

When the user pushes back on any of these, engage with the argument rather than restating the rule. Several are genuinely trade-offs — particularly localising consensus to a single database primary, which buys simplicity at the cost of availability under partition, and is a judgement about requirements rather than a theorem.

## Reference files

Read these as needed; do not load them all up front.

| File | Read it when |
|---|---|
| `references/entities-and-collapses.md` | Mapping an existing system, or defining a new entity model. Contains all six collapses with consequences and repairs. |
| `references/code-signatures.md` | Auditing code or a schema. Concrete detectable forms, with .NET / EF Core / SQL examples. |
| `references/patterns.md` | Specifying mechanisms: occurrence derivation, CAS claim (PostgreSQL + SQL Server), outbox and relay, partitioning. |
| `references/capacity-and-policy.md` | Sizing a batch window, or choosing misfire and overload policy. Includes the unstable combinations. |
| `references/component-gaps.md` | The user is using or choosing Quartz, Hangfire, Celery, a cloud scheduler, or Kubernetes CronJob. |
| `references/theory.md` | The user asks *why* — impossibility results, liveness vs safety, failure detectors, Herlihy's hierarchy, and the citations. |

`assets/design-record-template.md` is the output format for both modes.
