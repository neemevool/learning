# Mechanisms

## 1. Occurrence derivation

The temporal expression is a generator with `matches(civil_datetime)` and `next(after)`. It must not read the clock.

**Expansion algorithm** (RFC 5545 recurrence-rule semantics; Fowler's Temporal Expression at pattern level):

1. **Anchor** at a start point expressed as *civil datetime + named zone* — never an absolute instant.
2. **Expand coarse to fine.** Start from the base frequency, iterate periods, apply each constraint. Each constraint is either *expanding* (multiplies candidates) or *limiting* (filters them), and which one depends on the base frequency. This classification is the non-obvious part and is tabulated in RFC 5545.
3. **Filter and select.** Limiting rules, then positional selection ("last working day"), then count/until bounds.
4. **Resolve** each civil datetime using the zone rules in force *for that instant*. Two pathologies need explicit job-level policy:
   - *Nonexistent* local time (spring-forward gap): skip / shift forward past the gap / shift back.
   - *Ambiguous* local time (autumn fold): first / second / both.
5. **Yield** those in `[t0, t1)`.

**Complexity warning.** Naive expansion is pathological for sparse rules — "29 February falling on a Monday" scans decades of candidates. Cost should be O(occurrences in window), not O(candidates examined). Bound the search horizon explicitly or accept an unbounded loop in production.

**Reconciliation:**

```
missing = derive(job, t0, t1) \ materialised(job, t0, t1)
```

Materialise with `INSERT ... ON CONFLICT DO NOTHING` (PostgreSQL) or `MERGE` / `INSERT ... WHERE NOT EXISTS` with a unique constraint (SQL Server). Idempotent, concurrency-safe, runnable at any frequency from any node. Run it on a timer, on startup, and after any job edit — the timer is a latency hint, not the source of truth.

`t0` is the misfire policy. Watermark recovers everything; `now − Δ` bounds the backfill and discards the rest.

## 2. The CAS claim

**This is compare-and-swap in its most common production form, and the table is the central registry.** The `WHERE` clause is the *compare*, the `SET` is the *swap*, and the affected row count is the return value — zero means another caller won. A single-statement conditional `UPDATE` against one row is linearizable, which is what gives it consensus number ∞ for as long as the database is up.

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

Batch claim:

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

Batch form:

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

`UPDLOCK` forces the locking read that `READPAST` then skips — necessary because under read-committed snapshot isolation readers take no locks and `READPAST` would have nothing to skip. Verify on the version in use; this detail has moved between releases.

### Properties that matter

**Never split into `SELECT` then `UPDATE`.** Read-then-act is not a coordination primitive; no care in the application layer repairs it. Compare and swap must be one statement.

**Serializable isolation is not required and is worse here.** Under read committed, a losing updater blocks on the row lock, re-evaluates the predicate against the committed row, and updates zero rows — clean CAS semantics with a clean return value. Under repeatable read or serializable, PostgreSQL raises a serialization failure (`40001`) you must catch and retry: the same outcome as an exception rather than a row count. Use read committed for the claim; reserve serializable for occurrence materialisation where you want the conflict surfaced.

**Lease arithmetic belongs in the database.** `now()` / `SYSUTCDATETIME()` is evaluated on one node, eliminating cross-node clock skew from the lease mechanism. It does **not** fix process pauses — a worker stalled 40 seconds still resumes believing it holds an expired lease. Only the fencing token addresses that.

**Expiry in the `WHERE` makes reclaim implicit.** No reaper is needed for correctness; the next claimant matches the expired row. Keep a sweeper for *observability* (reclaim counts are a leading indicator of worker instability), not as load-bearing machinery.

**Fence scope must match resource scope.** Per-row `fence + 1` is monotonic per unit, correct when the fenced resource *is* the unit. If several units contend for one shared external resource, the token must be globally monotonic — a PostgreSQL sequence or SQL Server `SEQUENCE`. Getting this wrong produces a token that looks like fencing and fences nothing.

### Alternatives

**Advisory locks** — `pg_advisory_xact_lock`, `sp_getapplock`. Cheaper than a row update, useful for coarse exclusion such as "only one node runs derivation now". But they hold no state, produce no token, and survive nothing: *leases without fencing*, giving exclusion of intent only. Fine for the derivation loop, which is idempotent anyway; not acceptable as the claim mechanism for units with external effects.

**A broker's visibility timeout** — moves the claim into a second system while state stays in the database. A dual write. Let the broker carry the *trigger*; keep the claim with the state.

**The availability bound, stated plainly.** Localising consensus to a single primary means scheduler availability is bounded above by database availability, and nothing claims during a failover. For `g >> 1` this is nearly always correct — level-triggered derivation makes the outage self-healing — but it belongs in the design document as a stated limit, not an assumption.

## 3. Outbox and relay

The outbox table is the same registry and the same CAS primitive applied a second time: once to claim units, once to claim effect records for dispatch. One mechanism, not two.

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

```sql
ALTER TABLE outbox ADD CONSTRAINT outbox_idem_uk UNIQUE (idempotency_key);
```

Two things carry the weight. `idempotency_key` is the **derived unit identity**, not a generated id — a random key makes the row unique and the effect undeduplicable. And the fence predicate stops a zombie worker with an expired lease from recording an effect; without it the outbox is merely an ordered log of everything anyone ever intended.

The unique constraint also makes the transaction safely retryable after an ambiguous commit.

### The transfer step

Claim outbox rows with the same conditional update — same lease, same fence, same zero-rows-means-lost. `FOR UPDATE SKIP LOCKED` / `READPAST, UPDLOCK`.

**Ordering:** skip-locked fetching deliberately abandons ordering. If per-recipient or per-aggregate ordering matters, partition the outbox by that key and allow one in-flight row per partition. Do not assume a queue preserves order because it looks like a queue.

**Retention:** deleting on success destroys the record of what was sent and, worse, releases the idempotency key. Archive or mark-and-partition-prune. The key's uniqueness must outlive the longest retry and reconciliation window. In PostgreSQL an unarchived high-churn outbox is also a bloat and autovacuum problem — daily partitions with drops are the usual answer. In SQL Server, a filtered index on unsent rows keeps the dispatch query cheap as the table grows.

### Relay alternatives

**Polling publisher.** The conditional-update claim on a schedule. Simplest, one mechanism, no extra infrastructure. Costs a query-load floor and a latency floor of the poll interval.

**Log tailing / CDC.** PostgreSQL logical replication with a publication on the outbox (`pgoutput`, or `wal2json`); SQL Server CDC or Change Tracking; Debezium as the common reader. No polling load, and the WAL gives ordering. Costs real operational weight and replication-slot management — an abandoned PostgreSQL slot will fill the disk. It is **still at-least-once**; CDC delivers no guarantee the polling version lacks. Justify it with throughput or latency numbers, never with the word "exactly-once".

**PostgreSQL `LISTEN`/`NOTIFY` as a latency hint.** `NOTIFY` is transactional — delivered on commit, never before — so it is correct as a wake-up signal. It is not durable: a disconnected listener misses it permanently. An excellent worked example of the level-triggered principle: use it to cut latency from the poll interval to milliseconds, and let the poll remain the source of truth. Never as the only path.

**SQL Server Service Broker.** A genuinely transactional queue, so the enqueue really is atomic with the business write. It relocates the outbox rather than removing it — the effect boundary is still external and the far end still must deduplicate. Worth considering if you already operate it; not worth adopting for this alone.

### The far end

Supply `idempotency_key` as the provider's idempotency header, or as the message identifier where the protocol has one. Record the provider's response and returned identifier in the **attempt** row — a different entity. The outbox row is the promise; the attempt is what happened.

If the provider offers no deduplication mechanism, the system does not have exactly-once effect, and the design document should say so in those words.

**The outbox does not defeat the impossibility.** It converts one impossible requirement into three achievable ones — atomicity within a single system, at-least-once transfer, idempotent receipt — and pushes the residue to the third, where it is the receiver's responsibility and can actually be discharged.

## 4. Partitioning and assignment

Three families, on an axis of **determinism vs adaptivity**:

1. **Deterministic partitioning.** Each worker owns a partition computed from the key. Zero coordination on the common path, replayable, identity stays derivable. Weak against skew and stragglers; needs rebalancing when worker count changes. Use rendezvous hashing or consistent hashing with virtual nodes so a change in N relocates ~1/N of keys rather than nearly all.

2. **Queue / work-stealing.** Optimal load balancing and skew tolerance, at the cost of a coordination point and non-deterministic assignment — so identity **must** travel inside the work item.

3. **CAS per unit.** Assignment and mutual exclusion in one atomic operation. Section 2 above.

**Preferred default: over-partitioning.** Make the partition count much larger than the worker count (say 64 per worker) and assign whole partitions dynamically. Most of the load balancing, with a *coarse-grained* coordination point that changes rarely rather than a per-unit one.

**Hybrid — deterministic partitioning with queue overflow.** Each worker processes its partition against a deadline budget, projecting completion from observed rate; when the projection exceeds the deadline times a safety factor it releases the tail into a shared queue. Safe because release is a single-transaction state change (never simultaneously owned and queued), claims carry lease and fence, and derived identity makes requeue idempotent.

Spill continuously in small chunks rather than once at a threshold — a rarely-run code path is an untested one, and it will run for the first time during an incident. But prefer over-partitioning first, and add the spill only after measuring tail latency it would actually fix.
