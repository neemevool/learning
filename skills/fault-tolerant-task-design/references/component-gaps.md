# What existing components do not offer

About *categories* of gap, not any product's current release. Specific behaviours change between versions and configurations — **verify against the version in use**. The value is knowing which questions to ask, because the gaps recur across all of them for structural reasons.

The general shape: **mature schedulers solve time → firing very well, and stop at the boundary of firing → effect.** That is not a defect — the omitted half is domain-specific and cannot be supplied by a library, because it depends on your identity function and your effect boundary. The defect is *assuming* the library covered it.

## The recurring gaps

**1. Occurrences are usually not first-class.** The dominant implementation is a mutable "next fire time" advanced after each firing. Some products materialise a row per execution, but typically at *dispatch* time rather than by derivation — so occurrences never dispatched still do not exist. Consequence: backfill beyond the built-in misfire handling is impossible; "which firings did we miss during the outage?" is unanswerable. *Design differently:* keep your own occurrence table with derived identity; let the component trigger reconciliation, not own the record of what is owed.

**2. The unit of work is yours, always.** Essentially no general-purpose scheduler models the fan-out. 7,000 recipients is one job to the scheduler. Consequence: no durable partial progress, no per-unit retry, recovery bounded below by full batch duration. *Design differently:* materialise the fan-out durably before work begins. This is the most common missing piece in otherwise competent implementations.

**3. At-least-once, and the deduplication key is not supplied.** Reliable-fetch implementations are at-least-once by construction and correctly so. What they do not supply is a stable, domain-derived key. Retry identity is usually the internal job id — not derivable by another party, not meaningful to your effect boundary. *Design differently:* carry your derived unit identity inside the payload; enforce uniqueness in your own store and at the provider. Never treat the component's internal id as an idempotency key.

**4. Leases without fencing tokens.** Visibility timeouts are near-universal; monotonic fencing tokens exposed to the *resource* are near-absent. *Design differently:* derive a fence yourself and use it in conditional writes and outbound requests.

**5. The claim lives in a different system from the state.** A dual write, with all the atomic-commitment impossibility applying. *Design differently:* keep claim and state in one transactional store; let the component be a trigger, not a state owner.

**6. Misfire handling exists, but is coarse.** Better products do offer misfire policies — a genuine strength, and more than most hand-rolled systems have. Limits: the options are those the product implemented; the choice is often per trigger type rather than per business rule; "fire all missed" is rarely available because occurrences were never materialised; and there is usually a hard cutoff after which the component gives up and logs. *Design differently:* treat the component's misfire handling as a latency optimisation and put the real policy in your reconciliation window `t0`.

**7. No overload policy.** Overlap prevention is commonly a flag. Shedding, degradation, admission control and priority essentially never are, because they need domain knowledge of what is droppable. Consequence: "do not overlap" plus a backfill misfire policy is the unstable combination, reachable through configuration alone with no warning. *Design differently:* measure `U`; implement shedding in your own layer; never treat a concurrency flag as a capacity strategy.

**8. Time-zone semantics are underspecified.** Handling of nonexistent and ambiguous local times, and behaviour on tzdb updates, is frequently undocumented and version-dependent. Storing resolved absolute instants is common. *Design differently:* store civil datetime + zone + resolution policy; re-derive after tzdb updates.

**9. Single points of coordination, undocumented as such.** Many designs elect one active scheduler — sometimes explicitly, sometimes as an emergent property of a database lock. Often the right trade, but a real availability bound that rarely appears in the documentation and almost never in the consuming team's design document. *Design differently:* find it, write it down, state it as your scheduler's upper bound.

**10. In-process schedulers inherit the host's lifecycle.** Subject to deployment cadence, memory limits and shutdown behaviour. Rolling deployments during a firing window are a routine cause of missed and duplicated firings. Level-triggered derivation makes this survivable; without it, deployment is a correctness hazard.

## What they do well

Say this too, or the analysis reads as an argument for building your own scheduler, which would be wrong.

- Timer management, calendar arithmetic and recurrence expansion — genuinely hard, well tested, not worth reimplementing.
- Durable trigger storage and restart recovery of the *trigger*.
- Worker pools, retry with backoff, dashboards, operational tooling.
- Leader election among scheduler instances, sufficient for triggering.

**The correct division of labour:** let the component answer *when*; own *what* and *exactly-once-effect* yourself. Use it as a **level-triggered trigger source** — its firing invokes your reconciliation, and a lost firing is repaired by the next one. Never let it be the system of record for what is owed.

## Questions to ask of any component

1. Are occurrences materialised, or is there a mutable next-fire-time?
2. Can I supply my own identity for a scheduled unit?
3. Is the fan-out mine? (Assume yes.)
4. Where does the claim live relative to my business state?
5. Is there a fencing token, and does anything verify it?
6. What are the misfire options, and are they per-job?
7. What happens at `U > 1` besides the overlap flag?
8. How are nonexistent and ambiguous local times resolved, and what happens on a tzdb update?
9. What is the coordination point, and what is its availability?
10. What does the component guarantee if the host process is killed mid-execution — precisely?

Any answer of the form "it retries" is an answer about *at-least-once*, and therefore an answer about **your** deduplication responsibility.
