# Capacity, misfire policy, and overload policy

## Overlap is a utilisation problem, not a locking problem

"Do not start the next run before the previous finishes" is the real-time constraint *deadline ≤ period*. It is a capacity question wearing a concurrency costume.

```
U = Σ (Cᵢ / Tᵢ)
```

Earliest-deadline-first is feasible iff `U ≤ 1`. Fixed-priority rate-monotonic guarantees feasibility only up to `n(2^(1/n) − 1) → ln 2 ≈ 0.693`. That gap matters: a fixed-priority system can miss deadlines at 70% utilisation while a deadline-driven one is fine.

**If `U > 1`, no lock, watcher or retry policy helps.** The backlog grows without bound. The only real options: shed, coalesce, reduce `C` (partition and parallelise), or increase `T`.

> A mutex applied to an overload converts a visible overload into an invisible one. The queue still grows; you have merely stopped observing it.

### The three queueing results, kept separate

They are routinely conflated, and the conflation hides which one is doing the work.

1. **Stability condition `ρ = λ/μ < 1`.** *This* is what makes the backlog diverge past capacity.

2. **Little's Law `L = λW`.** An accounting identity, not a cause of blowup. Needs almost no assumptions — no distributional assumptions, any discipline, any number of servers — only stability and existence of long-run averages. Two uses:
   - The **resource cost of latency**: in-flight count grows linearly with time-in-system, so memory, pool slots, held locks and live leases all grow with `W`.
   - A **lie detector**: measure `L`, `λ`, `W` independently; if they do not satisfy the identity, one measurement is wrong or the system is not stable.

3. **Kingman's heavy-traffic approximation** gives the shape near saturation:

   ```
   W ≈ ( ρ / (1−ρ) ) · ( (c_a² + c_s²) / 2 ) · τ
   ```

   Two readings that matter for batch design:
   - `ρ/(1−ρ)`: latency at 90% utilisation is 9× that at 50%; at 99% it is 99×. Planning a batch window at high utilisation is planning for latency dominated by queueing rather than work.
   - The variance term is **multiplicative with, and symmetric to, utilisation**. Halving service-time variance buys as much as adding substantial headroom. Per-unit calls to external systems are the dominant variance source, which makes timeouts, hedging and bulkheads *capacity* measures, not merely reliability measures.

## Misfire policy

What to do about an occurrence whose nominal instant has passed and which was never started:

- **Skip** silently
- **Fire once immediately**, collapsing all missed firings into one
- **Fire all**, backfilling each in order
- **Fire if within grace window Δ**, else skip
- **Escalate to a human**, decide nothing automatically

This policy **is** the choice of `t0` in occurrence derivation. It belongs as a field on the job, not as a property of a code path.

## Overload policy

What to do when work arrives faster than it can be processed (`U ≥ 1`), including the case where the previous run has not finished:

- **Serialize** — skip the new firing while one is in flight. This is "do not overlap".
- **Overlap with bounded concurrency k.**
- **Shed** — drop lowest-priority units; admission control.
- **Degrade** — reduce per-unit work; skip expensive enrichment.
- **Backpressure upstream** — usually unavailable for time-triggered work, because *time does not accept backpressure*. This is exactly why time-triggered systems must be able to shed.
- **Scale out** — helps only if workers are the bottleneck rather than a shared external dependency.

## Why they must be stated together

| Combination | Behaviour |
|---|---|
| "Do not overlap" + "fire all missed" | **Unstable** under sustained overload. Serializing accumulates firings; backfilling adds the accumulation to an already-saturated pipeline. A transient becomes a permanent, growing backlog. |
| "Do not overlap" + "skip" | Stable, but silently discards work. |
| "Overlap with concurrency k" + "fire all missed" | Stable **iff** `k·μ > λ` — a check nobody performs. |

None is wrong. Each must be **chosen**, per job rather than globally, and expressed as data, so "what happens if we are down for a day?" is a readable configuration value.

The first row is reachable through configuration alone, in most schedulers, with no warning. When auditing, check for it specifically.

## Observability is part of the policy

Both policies must be observable: skipped-occurrence count, shed-unit count, backlog age, oldest non-terminal unit. **A policy that fires silently is a policy nobody knows the system has**, which is functionally identical to not having decided.

Backlog age — the nominal instant of the oldest non-terminal unit — is the single best health signal. It rises before anything else breaks.
