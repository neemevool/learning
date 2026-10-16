# Code and schema signatures

Concrete forms the collapses and principle violations take in real code. Use during audits. Examples lean .NET / EF Core / PostgreSQL / SQL Server because that is where these systems usually live, but every signature is language-neutral in substance.

A signature is **evidence, not a verdict**. Several are legitimate under the right parameter values. Report the construct, the parameter that would justify it, and whether that parameter value is actually present.

## S1 — Mutable next-run pointer (Job ≡ Occurrence)

**Look for:** columns named `NextRunAt`, `NextFireTime`, `LastRunAt`, `NextOccurrence` on a job/schedule/trigger table; code that advances such a column after a run.

```
grep -rniE "next_?(run|fire|occurrence|execution)_?(at|time|utc)?" --include=*.cs --include=*.sql
```

**Also:** an EF entity with both the schedule definition and execution state on one class; a single `Jobs` table with a `Cron` column and a `LastRun` column.

**Ask:** can this system answer "which firings did we miss during the outage on the 3rd?" If not, occurrences are not first-class.

## S2 — Read-then-act instead of a conditional update

The single most important signature. Read-then-act is **not** a coordination primitive, however careful the surrounding code.

**Look for:** a `SELECT`/query followed by an `UPDATE`/`SaveChanges` in separate statements, with the decision made in application code.

```csharp
// SIGNATURE — not a claim
var unit = await db.Units.FirstOrDefaultAsync(u => u.State == "pending");
if (unit is not null) { unit.State = "claimed"; unit.Owner = me; await db.SaveChangesAsync(); }
```

EF Core makes this the path of least resistance, so expect it. Two acceptable repairs:

- Raw conditional update (`ExecuteUpdateAsync` with the predicate, or `FromSqlRaw`), checking rows-affected.
- EF optimistic concurrency (`[Timestamp]` / `IsConcurrencyToken`) with a caught `DbUpdateConcurrencyException` — this *is* a CAS, expressed as an exception rather than a row count. Acceptable if the exception is actually handled as "someone else won", not logged as an error.

**Red flag inside the repair:** `ExecuteUpdateAsync` whose `WHERE` does not include the state predicate. Then it is an unconditional write wearing CAS clothing.

## S3 — Missing uniqueness constraint on derived identity

**Look for:** an outbox, occurrence, or unit table with no unique index on the business key. Deduplication is a *constraint*, not a code path — code-path deduplication is a read-then-act (S2).

```
grep -rniE "CREATE (UNIQUE )?INDEX|HasIndex|IsUnique" --include=*.sql --include=*.cs
```

Check that the unique key is the **derived** identity, not a surrogate.

## S4 — Random or surrogate idempotency key

**Look for:** `Guid.NewGuid()`, `Ulid.NewUlid()`, an identity column, or a broker-assigned message id used as the idempotency key or dedup key.

A random key makes the *row* unique and the *effect* undeduplicable, which is the exact failure the entity exists to prevent. The key must be `f(occurrence_id, partition_key)` — computable by another party that never saw your row.

```
grep -rniE "idempotenc|dedup|IdempotencyKey|MessageId" --include=*.cs
```

Then check where that value comes from.

## S5 — Clock read inside occurrence derivation

**Look for:** `DateTime.UtcNow`, `DateTimeOffset.Now`, `SYSUTCDATETIME()`, `now()` inside a recurrence generator, cron expansion, or "what is due" computation that is supposed to be a pure function of `(job, t0, t1)`.

Derivation must be reproducible: two nodes, or one node at two times, must produce identical sets. A clock read inside it makes the occurrence set non-deterministic and silently reintroduces coordination.

Clock reads are correct at the *call site* (choosing `t0` and `t1`) and inside lease arithmetic. They are wrong inside the generator.

## S6 — External call inside a transaction (Attempt ≡ Effect)

**Look for:** `HttpClient`, `SmtpClient`, an SDK call, or a message publish inside a `TransactionScope`, `BeginTransaction`, or between `SaveChanges` calls in one unit of work.

```
grep -rniE "BeginTransaction|TransactionScope" -A 30 --include=*.cs | grep -iE "HttpClient|SendAsync|Smtp|Publish|Produce"
```

Also look for the reverse shape: `await SendEmail(); unit.Sent = true; await SaveChangesAsync();` — the same dual write with no transaction at all.

**And the near-miss:** `state = "sending"` → send → `state = "sent"`. This narrows the duplicate window without closing it. It is an outbox with the durability removed; report it as such rather than as a solution.

## S7 — Lease without a fence

**Look for:** `LeaseExpiresAt`, `VisibleAfter`, `LockedUntil`, `InvisibleUntil` on a unit table, with no monotonic counter alongside, and no fence value passed into subsequent writes or outbound calls.

**Check the follow-through:** even where a `Fence`/`Version` column exists, verify it appears in the `WHERE` of the *completion* update and, where possible, in the outbound request. A fence that is written but never checked is decoration.

## S8 — In-memory fan-out (Occurrence ≡ Unit of work)

**Look for:** a job handler that loads a collection and loops, with no per-element durable row.

```csharp
// SIGNATURE
var users = await db.Users.Where(u => u.Active).ToListAsync();
foreach (var user in users) { await SendReminder(user); }   // 7000 iterations, no unit rows
```

**Ask:** if this crashes at element 6,000, what happens on restart? If the answer is "it starts over", the unit of work does not exist.

## S9 — Resolved UTC for a zoned schedule

**Look for:** a `DateTime`/`timestamptz` column storing the fire time, with a zone named anywhere in the job definition (or a business calendar in play), and no civil-datetime column.

Also: `TimeZoneInfo.ConvertTimeToUtc` at *write* time rather than at *derivation* time; absence of any handling for `IsInvalidTime` / `IsAmbiguousTime`.

**Ask:** what happened on the last DST transition, and what happens when the tzdb ships a rule change for a zone you use?

## S10 — Concurrency flag used as a capacity strategy

**Look for:** `[DisableConcurrentExecution]`, `concurrencyPolicy: Forbid`, `@DisallowConcurrentExecution`, or a global "one instance" lock, presented as the answer to "the batch overlaps".

This is A.5: overlap is a utilisation problem. A mutex converts a visible overload into an invisible one — the backlog still grows, you have stopped observing it.

**Ask for the number:** what is `U = C/T` for this job? If nobody can produce it, that is the finding.

**Then check the combination:** "do not overlap" + "fire all missed" is unstable under sustained overload. See `capacity-and-policy.md`.

## S11 — Policy that exists only in code

**Look for:** misfire and overload behaviour implemented as control flow — an `if (missed > threshold) continue;`, a hardcoded lookback, a `TimeSpan.FromMinutes(15)` grace constant — with no corresponding column or configuration on the job.

These are business decisions. "What happens if we are down for a day?" should be a readable configuration value, not an archaeological expedition.

## S12 — Watcher stack

**Look for:** a health-check sidecar, a supervisor job, and a monitor for the supervisor, all deployed in the same namespace/cluster/pipeline.

Redundancy buys availability only across an uncorrelated boundary. Ask what the terminal anchor is and whether it sits outside the deployment. Usually the correct finding is: *delete two layers, add one external dead-man's switch.*

## S13 — Claim and state in different systems

**Look for:** a broker or cache holding the in-flight lease (SQS visibility timeout, Redis lock, RabbitMQ ack) while business state lives in the relational store.

This is a dual write between two systems. The symptom appears during incidents as divergence between "the broker thinks this is in flight" and "my data says pending".

## S14 — Missing observables

Check for the four. Their absence is a finding in itself, because a policy that fires silently is a policy nobody knows the system has.

1. **Backlog age** — nominal instant of the oldest non-terminal unit. The best single health signal; it rises before anything breaks.
2. **Skipped and shed counts**, per policy, per job.
3. **Measured `U`** per job.
4. **Duplicate-effect rate** at the boundary, or an explicit record that the boundary cannot report it.

## Quick sweep

A first pass on an unfamiliar repository:

```bash
rg -niE "next_?(run|fire)|last_?run|cron|schedule" --type-add 'src:*.{cs,sql,py,ts,java}' -tsrc -l
rg -niE "DisableConcurrentExecution|DisallowConcurrentExecution|concurrencyPolicy" -l
rg -niE "idempotenc|dedup|fence|lease|visibility" -l
rg -niE "TransactionScope|BeginTransaction" -l
rg -niE "outbox|inbox|relay" -l
```

Then read the dispatch loop and the effect boundary in full. Those two files usually contain most findings.
