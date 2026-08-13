# Temporal and Lifetime Coupling: Who Has to Be Running, and Who Has to Survive

*Why Dependency Injection Removes the Cheap Dependency and Leaves the Expensive One*

**Internal Learning Material for the .NET Team**
Publish/Subscribe • async/await • Channels • Dataflow • Rx • Outbox • Kubernetes

---

## Table of Contents

*This document is organized into four parts. Parts 1–2 are conceptual and framework-agnostic. Part 3 is the .NET/ASP.NET Core deep dive and is the core of the document. Part 4 is the concrete toolbox.*

**Part 1 — What Is Actually Being Coupled**

1. Four Dependencies Hiding Inside One Word
2. DI Removes One of Them, and It Is Not the Expensive One
3. You Cannot Remove a Dependency — Only Relocate It
4. The Five Intents That Send People Looking for Decoupling
5. The Question to Ask First: "If the Subscriber Never Runs, What Breaks?"
6. Backpressure: The Dependency Reasserting Itself
7. The Handoff Point Is the Whole Design

**Part 2 — Solutions in Platform-Neutral Form**

8. The Intermediary Catalogue
9. The Axes That Actually Distinguish Them
10. The Dual-Write Problem and Why the Outbox Exists
11. Delivery Guarantees: Why Exactly-Once Is Not on the Menu
12. Push and Pull: The Family That Has No Handoff
13. Decoupling Creates a Distribution Problem

**Part 3 — .NET Specifics: Where Temporal Coupling Physically Lives**

14. Three Different Things Can Be Waiting
15. A Call Is a Stack Frame: The Baseline Coupling
16. `await` Frees the Thread, Not the Caller
17. `event` and Multicast Delegates: Sequential, Fragile, Fully Coupled
18. `async void` and the Illusion of Decoupling
19. Why `Task.Run` Fire-and-Forget Is Not an Option (Precisely)
20. The Scoped-Service Trap
21. Sync-over-Async: Coupling a Thread to a Wait
22. The Process Is the Lifetime Boundary
23. What Actually Happens to an In-Memory Queue When a Pod Is Evicted

**Part 4 — The .NET Toolbox**

24. `System.Threading.Channels`: The Default Answer
25. TPL Dataflow
26. System.Reactive
27. Comparing the Three
28. The Transactional Outbox on PostgreSQL
29. Brokers and Message-Bus Libraries
30. Draining a Shared Buffer From Multiple Pods
31. Idempotency Is Mandatory, Not Optional
32. Graceful Shutdown Is Part of the Design
33. A Decision Path

**Appendix A — The Intermediary Worksheet**

---

# Part 1 — What Is Actually Being Coupled

Before any discussion of Channels, Dataflow, Rx, outboxes, or brokers, there is a prior question that determines which of them is even relevant. The word "coupling" is doing far too much work in most conversations, and the machinery you reach for depends entirely on *which* coupling you are trying to remove.

## 1. Four Dependencies Hiding Inside One Word

When component **A** causes component **B** to do something, at least four independent dependencies exist between them. They are usually discussed as if they were one.

| Dependency | The statement it makes | Removed by |
|---|---|---|
| **Referential** (type / implementation) | "A must name B's type to compile." | Interfaces, DI, events, plugin discovery |
| **Temporal** | "B must be running and reachable *at the instant* A acts, and A cannot proceed until B has progressed." | An intermediary with a buffer |
| **Lifetime** | "The work survives only as long as the shared container (request, process, pod) survives." | Durability |
| **Location** | "A and B must share an address space, or A must know where B is." | A broker, a registry, an addressable transport |

There are more if you want them — format coupling (both sides must agree on a schema), transactional coupling (both must participate in one atomic unit) — but these four carry the weight.

The critical property: **they are independent.** You can remove any one without touching the others. Systems that feel badly coupled despite a clean architecture diagram are almost always systems where referential coupling was removed and the other three were left untouched.

## 2. DI Removes One of Them, and It Is Not the Expensive One

This is the observation that starts the whole topic, and it is worth stating bluntly.

```csharp
public class OrderService(IOrderNotifier notifier)
{
    public async Task PlaceAsync(Order order)
    {
        await _repo.SaveAsync(order);
        await notifier.NotifyAsync(order);   // <- what did DI actually buy us here?
    }
}
```

`OrderService` no longer names `SmtpOrderNotifier`. The container decides. Tests substitute a fake. The dependency arrow in the architecture diagram now points at an interface. All of that is real and worth having.

None of it changes what happens at 14:32:07 when `PlaceAsync` executes. At that instant:

- The concrete notifier **must exist**, in this process, in this pod.
- `PlaceAsync` **cannot return** until `NotifyAsync` completes.
- If the notifier takes 4 seconds, `PlaceAsync` takes 4 seconds.
- If the notifier throws, `PlaceAsync` throws.
- If the pod dies between the two lines, the notification is lost with no trace.

DI removed the *compile-time* arrow and left the *runtime* arrow exactly where it was. The compile-time arrow was the cheap one; it costs a rebuild. The runtime arrow costs latency, availability, and lost work.

> ⚠ *"We injected an interface, so the components are decoupled" is the single most common false confidence in this area. Referential decoupling is necessary and nearly free. Temporal decoupling is neither. Being able to swap the implementation says nothing about whether the caller has to wait for it.*

The same holds for C# `event`. An event removes referential coupling in the *other* direction — the publisher no longer names any subscriber at all — and this makes it feel like the strongest decoupling available. It is not. As Section 17 shows in detail, raising an event is a synchronous, sequential, in-order invocation of every handler on the raising thread. It is the tightest temporal coupling in the language, wearing the loosest referential clothing.

## 3. You Cannot Remove a Dependency — Only Relocate It

The second load-bearing idea:

> **There is no technique that makes a dependency disappear. Every "decoupling" technique introduces an intermediary that absorbs the dependency. The properties of that intermediary become your new dependency.**

A queue between publisher and subscriber does not delete the relationship. It replaces "A depends on B" with:

- A depends on **the intermediary's availability** (can I hand off?)
- A depends on **the intermediary's capacity** (is there room?)
- The work depends on **the intermediary's durability** (does it survive a crash?)
- The outcome depends on **the intermediary's delivery guarantee** (will B ever see this?)

This reframing is what makes the whole design space tractable. Every option in Parts 2 and 4 is the same shape — publisher hands off to an intermediary — and the *only* things that differ are the four properties above. Once you internalize that, "should I use Channels or Dataflow or Rx or RabbitMQ?" stops being a question about libraries and becomes a question about which guarantees you are buying.

It also explains why the naive escapes fail. `Task.Run(() => Handle(evt))` looks like it removed the dependency because the publisher returns immediately. In reality it chose an intermediary — the thread pool queue — with the worst possible properties: unbounded capacity, zero durability, no delivery guarantee, no completion signal, and no owner. The dependency was not removed. It was relocated somewhere nobody is watching.

> ✓ *Mental model: decoupling is a change of creditor, not a debt forgiveness. Ask what the new creditor guarantees. If the answer is "nothing," you did not decouple — you defaulted.*

## 4. The Five Intents That Send People Looking for Decoupling

"I want to decouple the publisher from the subscriber" is never the real goal. It is a mechanism people reach for. There are five distinct goals underneath it, and they are *not* satisfied by the same solutions.

| # | Intent | The real requirement | Satisfied by |
|---|---|---|---|
| 1 | **Extensibility** | Add a subscriber without editing the publisher | Referential decoupling alone — DI, events, handler discovery |
| 2 | **Latency** | The caller must return before the work finishes | Any in-memory buffer |
| 3 | **Load smoothing** | Absorb bursts; run the work at a rate the downstream can take | A buffer *with backpressure or a drop policy* |
| 4 | **Fault isolation** | A failing subscriber must not fail the publisher | A buffer **plus** an error policy: retry, DLQ, and durability |
| 5 | **Independent scaling / deployment** | Consumer scales, deploys, and restarts on its own schedule | Location decoupling — a broker or a shared durable store |

The characteristic mistake is solving for intent 2 and believing you have solved for intent 4. An in-memory `Channel` genuinely gives the publisher its latency back. It does *not* isolate you from subscriber failure — it converts a loud, immediate, attributable failure (the POST returns 500) into a silent one (the message sits in a dead consumer's buffer and vanishes at the next deploy). For a metrics update that is a fine trade. For "send the invoice" it is strictly worse than the coupled version, because the coupled version at least told somebody.

> ⚠ *Naming the intent is not a formality. Intents 1 and 2 are cheap and in-process. Intents 4 and 5 require durability and usually a broker or an outbox. If you cannot say which of the five you are buying, you will buy the cheap mechanism and assume the expensive guarantee.*

## 5. The Question to Ask First: "If the Subscriber Never Runs, What Breaks?"

Per event type, answer this before choosing any mechanism:

> **If this event is silently dropped — never delivered, never processed, no error raised anywhere — what is the consequence?**

The answer sorts every event into one of three buckets, and the bucket determines the minimum acceptable intermediary.

| Answer | The event is | Minimum intermediary |
|---|---|---|
| Nothing of value is lost. A cache stays cold, a counter is off by one, a dashboard lags. | **Best-effort** | In-memory buffer. Dropping under pressure is acceptable and should be *explicit*. |
| A user-visible promise is silently broken. The confirmation email never arrives; the report is never generated. | **Required** | Durable store. The work must survive process death and be retried. |
| The system is now internally inconsistent. The order is paid but never marked paid; the inventory is reserved but the reservation is never released. | **Constitutive** | Durable store, written **atomically with the state change that produced it** (Section 10). |

Most teams have all three kinds and use one mechanism for all of them. The visible symptom is either over-engineering (a broker round-trip to update a cache) or, far more often, quiet data loss in the third bucket that surfaces months later as an unexplainable reconciliation discrepancy.

Note the parallel to the cancellation material: there, the first question was *"if the user walks away midflight, what do they want to have happen?"* Here it is *"if the subscriber never runs, what breaks?"* Both are product questions wearing technical clothing, and in both cases the framework's default answer is a mechanism, not a decision.

## 6. Backpressure: The Dependency Reasserting Itself

There is a conservation law here that no library repeals:

> **Over any sustained interval, the consumer's throughput must equal the producer's throughput. A buffer changes *when* work happens, never *how much* work is possible.**

If the producer sustains 1000 msg/s and the consumer sustains 400 msg/s, the buffer grows by 600 items every second, forever. There are exactly three possible outcomes, and the system will pick one whether or not you did:

1. **Block the producer** — the buffer is bounded and the producer waits for room. The temporal coupling is *rebuilt*, deliberately, in a controlled form. The producer is now coupled to the consumer's *rate* but not to its *latency* — that is a genuine and usually excellent trade.
2. **Drop** — the buffer is bounded and something is discarded (oldest, newest, or the write itself). Explicit, principled loss.
3. **Grow without bound** — the buffer is unbounded. Latency rises steadily (Little's Law: with queue length *L* and arrival rate *λ*, waiting time *W = L/λ*), memory rises steadily, and eventually the pod is OOM-killed and loses *everything* in the buffer, not just the excess.

Option 3 is what you get by default from an unbounded channel, from `Task.Run`, and from Rx's schedulers. It is not a strategy; it is the absence of one, and its failure mode is the worst of the three because the loss is total rather than proportional.

> ✓ *Choosing a bounded capacity is not a tuning detail — it is the declaration of which of the three outcomes you want. Every buffer in the system should have an answer to "what happens when this is full?" written down. `BoundedChannelFullMode.Wait` and `BoundedChannelFullMode.DropOldest` are two different products.*

## 7. The Handoff Point Is the Whole Design

Pulling Sections 3–6 together into a single organizing idea:

> **Design the moment at which the publisher's responsibility ends. Everything else follows from it.**

When `PlaceAsync` returns, what has the system promised? There are five distinct answers, and they form a ladder:

| Handoff point | Publisher returns when… | Survives subscriber slowness? | Survives subscriber failure? | Survives process death? |
|---|---|---|---|---|
| **Direct call** | the subscriber has finished | ✗ | ✗ | ✗ (nothing to survive — no promise was made) |
| **Fire-and-forget** | the work was queued to *nobody in particular* | ✓ | ✗ (silently) | ✗ (silently) |
| **In-memory buffer** | an owned, bounded buffer accepted it | ✓ | partially — retry is possible while the process lives | ✗ |
| **Durable store (outbox)** | a durable, transactional store accepted it | ✓ | ✓ | ✓ |
| **Broker** | the broker acknowledged it | ✓ | ✓ | ✓ (+ location decoupling) |

Two observations about this ladder.

First, **row 2 is not a step up from row 1** — it is off the ladder entirely. Rows 3–5 each make a *weaker but honest* promise than the row above. Fire-and-forget makes no promise while appearing to make one. That is the precise reason it is unacceptable, and Section 19 spells out the mechanics.

Second, **the ladder is per-event, not per-system.** The same service can legitimately use row 1 for a validation call, row 3 for cache invalidation, and row 4 for the payment confirmation. Uniformity here is not a virtue; the whole point of Section 5 is that the buckets differ.

---

# Part 2 — Solutions in Platform-Neutral Form

Every solution in this space is "put an intermediary between the two parties." This part enumerates the intermediaries and the properties that distinguish them, without reference to any specific library.

## 8. The Intermediary Catalogue

**a. No intermediary — direct synchronous invocation.** The baseline. Strongest possible guarantee (the caller *knows* the outcome), zero infrastructure, full temporal coupling. Correct far more often than architecture fashion suggests: if the subscriber's work is fast, must succeed for the operation to be meaningful, and lives in the same transaction, calling it directly is not a design failure.

**b. In-memory queue.** A bounded or unbounded buffer in the process heap, with one or more consumers draining it. Removes temporal coupling; leaves lifetime coupling completely intact. This is the workhorse for intents 2 and 3.

**c. In-memory dataflow mesh.** The same as (b), but composed as a graph of buffered stages with per-stage concurrency and ordering rules. Same guarantees, richer topology.

**d. Reactive stream.** Composition over *time-shaped* events — windowing, debouncing, coalescing, joining by time. Note this is a different axis: it is about transforming the event stream, not primarily about decoupling. Decoupling is available but must be requested explicitly.

**e. Durable local queue (the outbox).** A table in the same database as your business state. The event is written *inside the business transaction*; a separate dispatcher drains it. Removes temporal *and* lifetime coupling, and — uniquely — makes the event atomic with the state change that caused it.

**f. Broker.** An external, durable, addressable intermediary. Adds location decoupling, cross-process fan-out, retry policy, dead-lettering, and consumer groups. Costs an operational dependency.

**g. Shared durable log / change feed.** Instead of pushing, the publisher simply appends to a log (or the DB's own change stream) and consumers read from it at their own pace, tracking their own position. See Section 12 — this family is qualitatively different.

**h. Scheduler / deferred job.** "Do this at time T" rather than "do this soon." A queue with a time dimension. Often the honest form of what people build with `Task.Delay` and fire-and-forget.

## 9. The Axes That Actually Distinguish Them

Libraries multiply and go out of fashion; these seven properties do not. Any intermediary you will ever be offered — Channels, Dataflow, Rx, an outbox, RabbitMQ, Kafka, whatever a vendor invented last quarter — is fully described, *for design purposes*, by where it sits on these axes. The point is to replace "which library should we use?" with "which guarantees do we need?"

| Axis | The question | Possible values | Why it bites |
|---|---|---|---|
| **1. Durability** | Does the item survive process death? | none (heap) · durable on accept · durable + retained for replay | Gating axis. Decides whether this can carry "Required"/"Constitutive" events at all |
| **2. Atomicity with state** | Can the event be committed in the same transaction as the state change? | yes (same store) · no (external system) · n/a (the event *is* the state) | The dual-write problem, Section 10 |
| **3. Capacity & backpressure** | Bounded? What happens when full? | unbounded · bounded+block · bounded+drop · bounded+reject to caller | Section 6 — the failure mode under load |
| **4. Delivery guarantee** | At-most-once or at-least-once? | those two only (Section 11) | Decides whether every downstream handler *must* be idempotent |
| **5. Ordering** | Global, per-key, or none? | global · per-key · none | Per-key is almost always the real requirement; global costs you a single consumer, forever |
| **6. Fan-out semantics** | Competing consumers (one wins) or broadcast (all get it)? | competing · broadcast · broadcast, latest-only | Opposite behaviours; mixing them up means duplicate work or silent starvation |
| **7. Observability & replay** | Can you see the backlog? Re-run a failed batch? | nothing · depth metric · inspectable items · replay from an arbitrary position | Decides whether a production incident is diagnosable at all |

They are axes rather than a checklist because each varies **independently**. Durability without ordering (an outbox drained by four pods). Ordering without durability (a single-reader channel). Backpressure without durability (a bounded channel). Broadcast without replay (Rx). If they moved together, one question would do.

Two distinctions worth drawing explicitly, because they are the ones that get collapsed:

- **Durability is not atomicity with state.** Kafka is extremely durable and has exactly zero atomicity with your PostgreSQL write. A durable-but-not-atomic intermediary still leaves the dual-write window open.
- **Bounded-and-blocking is not a compromise.** It deliberately reintroduces coupling to the consumer's *rate* while leaving you free of its *latency*. That is usually the correct answer, not a fallback.

Independent does not mean unordered. There is a dependency structure worth following in a review:

```
Durability (1) ─┬─→ enables Atomicity-with-state (2)
                └─→ forces at-least-once (4) ──→ mandates consumer idempotency

Capacity (3) ───→ parallel consumers ─────────→ destroys global Ordering (5)

Fan-out (6) ────→ constrains Ordering (5)      [broadcast has no single sequence]
```

So: answer 1 first, since it gates 2 and 4. Settle 6 early, since it constrains 5. Treat 3 and 7 as things you must *state* rather than discover, because their failure modes only appear under load or after a scale-out.

The discipline that makes this operational: **when someone proposes a mechanism, ask them to fill in the worksheet.** Appendix A gives the form and a worked example. If any cell comes back "I don't know," that cell is where the incident will come from.

## 10. The Dual-Write Problem and Why the Outbox Exists

This is the single most important structural problem in the whole area, and it is invisible until it bites.

```
1. BEGIN TRANSACTION
2.   UPDATE orders SET status = 'Paid' WHERE id = 42
3. COMMIT
4. broker.Publish(new OrderPaid(42))     // <- separate system, separate failure domain
```

Between line 3 and line 4 the process can die. Result: the order is paid and nobody downstream will ever know. Reverse the order and you get the opposite defect: the event is published, the commit fails, and downstream systems act on an order that was never paid.

There is no ordering of these two lines that is safe, because **two independent systems cannot be committed atomically without a distributed transaction**, and distributed transactions across a database and a broker are either unavailable, unsupported, or operationally unacceptable in practice.

The escape is to notice that you do not need two systems at commit time. You need *one* commit, plus a way to make the second thing true afterwards:

```
1. BEGIN TRANSACTION
2.   UPDATE orders SET status = 'Paid' WHERE id = 42
3.   INSERT INTO outbox (id, type, payload, status) VALUES (…, 'OrderPaid', …, 'pending')
4. COMMIT                                 // both facts are now durable, atomically
--- separately, later, possibly after a restart ---
5. dispatcher: claim pending rows → publish → mark done
```

This is exactly the "record the intent first" pattern from the cancellation material, specialized to messaging. The outbox row *is* the durable intent; the actual publish is a provisional attempt to satisfy it. If the process dies at any point after step 4, the intent survives and a later dispatcher completes it.

The cost is that step 5 will sometimes publish a message twice — it can publish and then die before marking the row done. The outbox converts *silent loss* (unrecoverable) into *duplicate delivery* (recoverable, if consumers are idempotent). That trade is the entire value proposition.

> ✓ *The outbox is not a messaging optimization. It is the only way to make "the state changed" and "the world was told" a single atomic fact when they live in different systems. If your events are "Constitutive" by the Section 5 test, you need it regardless of which transport you eventually publish to.*

## 11. Delivery Guarantees: Why Exactly-Once Is Not on the Menu

Three guarantees are discussed; only two exist.

- **At-most-once.** Send, do not retry. Loss is possible; duplicates are not. This is what fire-and-forget and in-memory buffers give you.
- **At-least-once.** Retry until acknowledged. Duplicates are certain over a long enough horizon; loss is not. This is what every durable system gives you.
- **Exactly-once *delivery*.** Not achievable across a process boundary. The Two Generals problem: the sender cannot distinguish "the receiver never got it" from "the receiver got it and the acknowledgement was lost." Faced with that ambiguity it must either resend (→ possible duplicate) or not (→ possible loss). There is no third option.

What products market as exactly-once is **at-least-once delivery plus deduplication at the consumer** — sometimes with framework help (a transactional read-process-write within one system), usually not. The important consequence is architectural, not semantic:

> ⚠ *The moment you introduce durability, you have chosen at-least-once, and consumer idempotency stops being a nice-to-have. It becomes a correctness requirement of every handler. See Section 31.*

Note the asymmetry with the failure model. The failure that actually dominates in production is not "it failed" — it is **"I do not know whether it succeeded"**: the call timed out, the connection dropped mid-acknowledgement, the pod was killed between the side effect and the bookkeeping. Only idempotent retry handles the ambiguous case. Compensation cannot (you may be undoing something that never happened); transactions cannot (the ambiguity is across the boundary a transaction cannot span).

## 12. Push and Pull: The Family That Has No Handoff

Everything so far assumes a **push** model: the publisher actively hands work to an intermediary that will deliver it. There is an entirely different family where nothing is handed anywhere.

In the **pull** model, the publisher just writes its own state — an append-only log, an event stream, or simply its normal tables — and consumers read from it, at their own pace, tracking their own position:

- **Event-sourced stream.** The event log *is* the state. Projections read forward from a stored checkpoint.
- **Change data capture.** Consumers read the database's replication stream. The publisher writes nothing special at all.
- **Polled change feed.** Consumers query "everything with a version greater than my checkpoint."

The properties are attractive and worth knowing about:

- **No dual-write problem.** The event and the state are the same write, by construction. This is why event sourcing sidesteps Section 10 rather than solving it.
- **Consumers are fully independent.** Each has its own checkpoint. A slow consumer inconveniences nobody; a broken one is repaired by resetting its checkpoint and replaying.
- **Replay is free.** Adding a new consumer six months later means starting it at position zero. Under a push model, that history no longer exists anywhere.
- **The publisher has no delivery obligation whatsoever.** There is no handoff, so there is nothing to fail.

The costs: latency is bounded below by the polling interval (or by the CDC lag); the log must be retained and eventually compacted; and consumer checkpoint management becomes your problem. Also, "at-least-once" still applies — a consumer can process a record and die before advancing its checkpoint.

> ✓ *If the system is already event-sourced, ask whether the pub/sub problem you are solving is actually a projection problem you have already solved. Building a message queue on top of an event log is a common and avoidable duplication.*

## 13. Decoupling Creates a Distribution Problem

The last platform-neutral point, and the one that catches most teams by surprise: **the intermediary is now shared state, and as soon as you run more than one instance of anything, you have a coordination problem you did not have before.**

Two independent questions arise, and they are frequently conflated:

**Fan-out semantics — competing consumers vs. broadcast.** If five consumer instances attach to one queue, do all five get every message (broadcast) or does exactly one get each (competing consumers)? These are opposite behaviours and the mechanisms differ. Getting it backwards means either five duplicate emails or four consumers that never see anything.

**Work distribution among peers.** If three replicas of the *same* consumer drain one shared buffer, what stops all three from grabbing the same item? Nothing, unless something arbitrates. The four structural answers:

1. **Eliminate the concurrency** — exactly one instance drains (static singleton or leader election). Simple, preserves global ordering, throughput-limited, has a failover gap.
2. **Arbitrate per item** — all instances work; the store hands each item to exactly one claimant. Scales with instance count.
3. **Partition the work** — each instance owns a disjoint slice of the key space. Preserves per-key ordering, but rebalancing on scale-up is nontrivial.
4. **Delegate to a broker** — which implements 2 and 3 for you.

Section 30 makes all four concrete. The point here is conceptual: an in-process buffer with one owner has no coordination problem, and the coordination problem appears *the moment you scale out*, which is precisely when you were not thinking about it.

> ⚠ *A `BackgroundService` polling a table is correct with one replica and quietly wrong with two. Since scaling out is the reason you built the buffer in the first place, treat single-replica correctness as a temporary state, not a design.*

---

# Part 3 — .NET Specifics: Where Temporal Coupling Physically Lives

This is the core of the document. Everything above is true of any platform. What follows is about what actually happens in a running .NET Core process — which objects hold which references, which thread executes what, and where in the runtime the coupling physically resides.

The reason to go this deep is that the .NET-specific confusions in this area are not conceptual gaps. They are misreadings of specific mechanisms: what `await` does, what raising an `event` does, and what the thread pool guarantees. Each misreading produces code that looks decoupled and is not.

## 14. Three Different Things Can Be Waiting

Almost all the confusion in this area comes from fusing three distinct waits into one word. Separate them and most of the rest is straightforward.

| # | What is waiting | Freed by | Cost of not freeing it |
|---|---|---|---|
| 1 | **The OS thread** | `await` over genuine async I/O | Thread pool exhaustion, starvation, latency cliffs |
| 2 | **The logical caller** — the operation that cannot complete until the callee completes | An intermediary with a buffer | Latency composition, fault propagation |
| 3 | **The user's connection** — the HTTP request held open | Returning `202 Accepted` plus a status resource | Client timeouts, retries, poor UX on slow work |

These are orthogonal. You can free (1) and not (2): that is what every `await` in your codebase does. You can free (2) and not (3): the handler hands off to a channel but then polls for the result before responding. You can free (3) and not (1) or (2): return 202 and then block a thread doing the work anyway.

> ✓ *When someone says "we made it async," ask which number they mean. In .NET the answer is almost always 1, and the person asking about decoupling almost always meant 2. That single ambiguity accounts for most disagreements in design reviews on this topic.*

## 15. A Call Is a Stack Frame: The Baseline Coupling

Start at the bottom, because it explains why no amount of cleverness helps at this level.

```csharp
var result = _subscriber.Handle(evt);
```

At the machine level this pushes a return address and jumps. The caller's *next instruction* is, physically, the callee's return target. There is no representation in the CPU for "proceed past this call while the call is still in progress." The instruction pointer is single-valued.

This is worth stating explicitly because it establishes the floor: **temporal coupling is the default of the machine, not a design choice.** Decoupling is always something added. Everything in Part 4 is a strategy for arranging that the thing on the stack is a cheap handoff — an enqueue — rather than the actual work.

It also explains why changing `Handle` to return `Task` accomplishes nothing on its own. The method still runs on the caller's stack until its first suspension point, and a `Task`-returning method with no real await in the hot path is a synchronous method with an allocation attached.

## 16. `await` Frees the Thread, Not the Caller

This is the central .NET-specific misconception, and it deserves the mechanism in full.

```csharp
public async Task PlaceAsync(Order order)
{
    await _repo.SaveAsync(order);
    await _notifier.NotifyAsync(order);
    _logger.LogInformation("done");
}
```

The compiler rewrites this into a state machine — a struct implementing `IAsyncStateMachine`, with an `int _state`, hoisted locals, awaiter fields, and an `AsyncTaskMethodBuilder`. Roughly:

```csharp
void MoveNext()
{
    switch (_state)
    {
        case -1:
            _awaiter1 = _repo.SaveAsync(_order).GetAwaiter();
            if (!_awaiter1.IsCompleted)
            {
                _state = 0;
                _builder.AwaitUnsafeOnCompleted(ref _awaiter1, ref this);  // (A)
                return;                                                    // (B)
            }
            goto case 0;
        case 0:
            _awaiter1.GetResult();
            _awaiter2 = _notifier.NotifyAsync(_order).GetAwaiter();
            // … same shape …
        case 1:
            _awaiter2.GetResult();
            _logger.LogInformation("done");
            _builder.SetResult();                                          // (C)
            return;
    }
}
```

Three lines matter.

**(B) — the `return`.** This is what "frees the thread." The physical stack frame unwinds; the thread returns to the pool and can serve another request. In a synchronous version that thread would have sat blocked in a kernel wait. This is a genuine and enormous resource win — it is why ASP.NET Core can hold tens of thousands of concurrent in-flight requests on a handful of threads.

**(A) — the continuation registration.** Before returning, the builder boxes the state machine onto the heap and registers `MoveNext` as a continuation **on the awaited `Task`**. Concretely, that delegate ends up stored in the callee's `Task` object (the `m_continuationObject` field). Read that again:

> **The caller's remaining work is now stored inside the callee's Task object.**

The dependency did not disappear. It *inverted direction* and became a heap reference. The only thing in the entire process that will ever resume `PlaceAsync` is the completion of `SaveAsync`'s task invoking that continuation.

**(C) — `SetResult`.** `PlaceAsync`'s own returned `Task` transitions to `RanToCompletion` only here, on the final leg of `MoveNext`. So it cannot complete until `NotifyAsync` completes. So anyone awaiting `PlaceAsync` cannot proceed either. The chain is unbroken from the HTTP request all the way down.

Precisely:

| `await` does | `await` does not do |
|---|---|
| Release the OS thread during the wait (wait #1) | Release the logical caller (wait #2) |
| Let the process scale under I/O concurrency | Make the publisher independent of the subscriber |
| Reduce thread pool pressure | Change latency composition or fault propagation |

The operational consequences follow directly:

- **Latency composes additively.** The endpoint's p99 is the sum of every awaited subscriber's p99. Adding a sixth subscriber changes the publisher's SLO without a single line changing in the publisher.
- **Faults propagate.** An exception in `NotifyAsync` surfaces at the `await` in `PlaceAsync` and, unhandled, becomes a 500 on an operation whose primary purpose already succeeded.
- **Availability multiplies.** Five awaited subscribers at 99.9% each compose to roughly 99.5%. Every added subscriber monotonically lowers the publisher's availability.

> ⚠ *"Make it async" and "decouple it" are different projects that share a vocabulary. Async is a thread-efficiency property. Decoupling is a topology property. A fully `async`/`await` codebase can be — and usually is — completely temporally coupled end to end.*

## 17. `event` and Multicast Delegates: Sequential, Fragile, Fully Coupled

C# `event` is the language's built-in publish/subscribe, and it removes referential coupling completely — the publisher names no subscriber at all. That is exactly why its runtime behaviour surprises people.

```csharp
public event EventHandler<OrderPlaced>? OrderPlaced;
…
OrderPlaced?.Invoke(this, new OrderPlaced(order.Id));
```

`OrderPlaced` is a `MulticastDelegate`. Its `Invoke` walks an internal invocation list and calls each target **synchronously, in subscription order, on the raising thread**. In practice:

**Latency is the sum, not the max.** Handlers do not run in parallel. Five handlers at 200 ms each cost the raiser a full second. The raiser has no visibility into how many handlers exist or what they cost.

**The first exception aborts the remainder.** This is the one that surprises people most. If handler 2 of 5 throws, handlers 3, 4 and 5 **never run**, and the exception propagates out of `Invoke` into the raiser. One unrelated subscriber can both fail the publisher *and* silently deprive its peers of the event. There is no isolation between subscribers whatsoever.

**There is no async story.** `EventHandler<T>` returns `void`. A handler that needs to await something has two options: block the raiser (Section 21) or become `async void` (Section 18). Both are bad, and the type system pushes you toward the second.

**Subscribers are rooted by the publisher.** The delegate holds a reference to each subscriber's target instance. A short-lived subscriber that forgets to unsubscribe is kept alive by a long-lived publisher for the process lifetime — the classic lapsed-listener leak. This is lifetime coupling in its most literal, GC-visible form: the *subscriber's* lifetime is now determined by the *publisher's*.

Writing a resilient raiser by hand is possible, and is what people do next:

```csharp
foreach (var h in OrderPlaced?.GetInvocationList() ?? [])
{
    try { ((EventHandler<OrderPlaced>)h)(this, evt); }
    catch (Exception ex) { _logger.LogError(ex, "handler failed"); }
}
```

That fixes subscriber isolation and nothing else. Still synchronous, still additive in latency, still `void`, still rooting subscribers. At this point you are hand-building the Part 2 intermediary badly; use a real one.

> ✓ *`event` is maximal referential decoupling with minimal temporal decoupling. That inversion is precisely why it feels like a solution to this problem and is not one.*

## 18. `async void` and the Illusion of Decoupling

Because event handlers must return `void`, this appears:

```csharp
private async void OnOrderPlaced(object? sender, OrderPlaced e)
{
    await _mailer.SendAsync(e.OrderId);
}
```

The raiser calls it, execution reaches the first suspension point, and the handler **returns immediately**. To the raiser it looks like fire-and-forget worked. It did not.

`async void` compiles against `AsyncVoidMethodBuilder` rather than `AsyncTaskMethodBuilder`. The difference is total:

- **No `Task` is produced.** Nothing to await, nothing to observe, no completion signal, no way to know whether the work finished, failed, or is still running.
- **Exceptions are rethrown on the ambient `SynchronizationContext`** — or, when there is none, and ASP.NET Core has none, on a thread pool thread as an unhandled exception. That **terminates the process.**

Consider the asymmetry. An unobserved exception on a `Task` is swallowed (Section 19). An exception from `async void` crashes the host. The construct that gives you the least information about the outcome also gives you the most catastrophic failure mode.

There is a further trap specific to ASP.NET Core: the handler returned, so the request completes, so the DI scope is disposed — while the handler's continuation is still running and still holding scoped services. See Section 20.

> ⚠ *`async void` outside a genuine UI event handler is a defect, not a style choice. If you find one attached to a domain event, the fix is not to change it to `async Task` — the raiser still cannot await it. The fix is to replace the event with an intermediary that owns the work.*

## 19. Why `Task.Run` Fire-and-Forget Is Not an Option (Precisely)

```csharp
_ = Task.Run(() => _notifier.NotifyAsync(order));   // publisher returns immediately
```

Worth taking apart precisely, because "it's careless" is a conclusion, not an argument — and the *specific* failures are what a correct alternative must fix.

**1. The work is unowned.** `Task.Run` queues a work item to the thread pool, a process-wide static resource with no relationship to your host, your DI container, or your shutdown sequence. Nothing in the application knows this work exists. You cannot count it, drain it, cancel it, or wait for it.

**2. Failures are silent.** Since .NET 4.5, an exception in a `Task` that nobody observes does **not** crash the process. It is captured in the `Task`; if that `Task` is finalized with nobody having read `.Exception`, `TaskScheduler.UnobservedTaskException` fires — at an unpredictable time, during finalization, and non-fatally by default. In practice: nothing is logged, nothing alerts, the notification simply never happened. Compare with the coupled version, which would have produced a 500 and an entry in your error tracker. You did not isolate the fault; you deleted the evidence of it.

**3. There is no backpressure.** Every call allocates and queues unconditionally. A traffic burst becomes an unbounded pile of queued work items, with the thread pool's own queue as the accidental intermediary — unbounded, unmonitored, and impossible to reject into.

**4. Thread pool threads are background threads.** They do not keep the process alive. At shutdown the runtime does not wait for pending work items. Whatever was queued or mid-flight is discarded.

**5. Shutdown does not reach it.** `ApplicationStopping` fires, hosted services get `StopAsync`, and none of it touches your work item, because nothing registered it. Every ordinary deploy silently discards in-flight work.

**6. Captured scoped services are already disposed.** Section 20.

**7. No retry, no ordering, no dead-lettering, no metrics.** All the things a real intermediary provides.

Now read that list as a *specification*. A correct in-process solution must supply: an owner, an observable failure path, bounded capacity, host-integrated shutdown, and a fresh DI scope. `Channel<T>` plus a `BackgroundService` supplies all five and is barely more code (Section 24).

> ✓ *The problem with fire-and-forget is not that the work runs in the background. It is that nothing owns it. "Background" is a scheduling property; "owned" is an accountability property. You want the first without giving up the second.*

## 20. The Scoped-Service Trap

This is where referential decoupling (DI) and temporal coupling collide most concretely, and it is the most common runtime bug when a team first tries to detach work.

```csharp
public class OrderController(AppDbContext db)   // db is Scoped
{
    public async Task<IActionResult> Place(OrderDto dto)
    {
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        _ = Task.Run(async () => {
            var o = await db.Orders.FindAsync(order.Id);   // ObjectDisposedException
            …
        });

        return Ok();
    }
}
```

`AppDbContext` is registered `Scoped`. Its scope is the HTTP request, and ASP.NET Core disposes that scope when the response completes. The background work outlives the request, so by the time it touches `db` the context is disposed. And per Section 19 point 2, the resulting `ObjectDisposedException` is *silently swallowed*.

Worse, it is timing-dependent. Under light load the background work often wins the race and everything appears to work. It fails under load, in production, intermittently.

The rule: **detached work must create its own scope.**

```csharp
public class OrderProcessor(IServiceScopeFactory scopeFactory, ChannelReader<int> reader)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var orderId in reader.ReadAllAsync(stoppingToken))
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            …
        }
    }
}
```

Note the corollary, which is more important than the scope itself: **only data crosses the handoff, never services and never entity instances.** A tracked EF entity belongs to one specific `DbContext` and is meaningless outside it. Push an ID or an immutable DTO through the channel and re-load inside the consumer's own scope. A `BackgroundService` is a singleton and therefore *cannot* inject a scoped service directly — that compile-time constraint is the framework telling you exactly this.

> ⚠ *`IServiceScopeFactory`, not `IServiceProvider`, in singletons. Resolving a scoped service from the root provider either throws or — worse, when validation is off — hands you a `DbContext` with singleton lifetime shared across every consumer, which is a different and nastier bug.*

## 21. Sync-over-Async: Coupling a Thread to a Wait

The other half of wait #1, and the reason it matters operationally.

```csharp
var result = _notifier.NotifyAsync(order).Result;   // or .Wait(), or .GetAwaiter().GetResult()
```

This blocks the calling thread until the task completes. ASP.NET Core has no `SynchronizationContext`, so the classic deadlock does not occur — but the resource problem does, and it is worse than most people assume.

The thread pool starts with `MinThreads` threads (by default, the processor count). Beyond that it injects new threads via a hill-climbing algorithm at a deliberately throttled rate — on the order of one or two threads per second. A burst of blocked calls consumes the available threads almost instantly, and recovery is measured in *seconds per thread*. The result is a latency cliff: the system is fine, then abruptly it is not, and the metric that moves is queue time rather than handler time. Diagnosis after the fact is unpleasant, because the endpoint that appears slow is usually not the one doing the blocking.

Note the framing. `.Result` is temporal coupling made maximally expensive: you kept the dependency — the caller still waits for the callee — *and* paid a thread for the privilege. Every `await` in the codebase exists to avoid exactly this, and a single `.Result` in a hot path can consume the benefit of all of them.

## 22. The Process Is the Lifetime Boundary

Now the lifetime half of the title. In .NET an in-memory intermediary is heap. Heap belongs to the process. The process belongs to the pod. Therefore:

> **Every in-memory decoupling mechanism has a durability horizon exactly equal to the pod's lifetime.**

The machinery that governs that horizon:

- **`IHostedService` / `BackgroundService`.** The host's owned background work. `StartAsync` runs in registration order; `BackgroundService.ExecuteAsync` receives a `stoppingToken`.
- **The shutdown sequence.** SIGTERM (or `StopApplication`) triggers: `ApplicationStopping` fires → the `stoppingToken` is signalled → hosted services get `StopAsync` in *reverse* registration order → `ApplicationStopped`. The whole sequence is bounded by `HostOptions.ShutdownTimeout` — 30 seconds by default in current .NET, but 5 seconds before .NET 6, a difference that has surprised people mid-upgrade. When the timeout expires the host stops waiting and the process exits regardless of what is in flight.
- **`BackgroundServiceExceptionBehavior`.** Since .NET 6 the default is `StopHost`: an unhandled exception escaping `ExecuteAsync` takes down the entire host. Under the previous `Ignore` default your consumer would die silently while the app kept serving requests and the buffer filled forever. Both behaviours have failure modes; what matters is knowing which you are running, and catching per-item exceptions *inside* the loop so a single poison message never reaches this level.

Kubernetes then adds its own bounds on top:

- **SIGTERM, then `terminationGracePeriodSeconds`** (default 30), then SIGKILL. SIGKILL is not catchable; nothing drains.
- **Endpoint removal races with SIGTERM.** Removal from the Service's endpoints and delivery of SIGTERM happen concurrently, so requests can still arrive after shutdown has begun. A `preStop` sleep of a few seconds is the standard remedy.
- **Involuntary termination.** OOM kill, node pressure eviction, spot reclamation, node failure — some of which give no grace period at all.

For your buffer to survive shutdown, `ShutdownTimeout` must exceed worst-case drain time, *and* `terminationGracePeriodSeconds` must exceed `ShutdownTimeout`, *and* the termination must be voluntary. Three conditions, one of which you do not control.

## 23. What Actually Happens to an In-Memory Queue When a Pod Is Evicted

Made fully concrete, because this is the moment where abstract "lifetime coupling" becomes an incident.

State at T=0: a `Channel<OrderPlaced>` holds 500 unprocessed items; one more is mid-flight in the consumer. The node comes under memory pressure.

| T | Event | Consequence for the 500 items |
|---|---|---|
| 0 s | kubelet decides to evict; SIGTERM sent | Nothing yet |
| 0 s | Endpoint removal begins, *concurrently* | New requests may still arrive and enqueue more |
| 0 s | `ApplicationStopping` fires; `stoppingToken` signalled | `ReadAllAsync(stoppingToken)` throws `OperationCanceledException` — **the loop exits with 499 items still sitting in the channel** |
| ~0 s | The in-flight item's own token trips, if `stoppingToken` was passed down into it | That item is abandoned partway. If it had written to one store and not another, you now have torn state |
| ≤30 s | Hosted services stop; host exits | Heap is released. **500 items cease to exist. No log line, no metric, no alert.** |
| — | Kubernetes reschedules the pod | The new pod starts with an empty channel and no knowledge that anything was lost |

Two details deserve emphasis.

**The naive drain is backwards.** Passing `stoppingToken` straight into `ReadAllAsync` means shutdown *stops reading* — the exact opposite of draining. The correct shape is to stop *writing* on `ApplicationStopping`, call `writer.Complete()`, and let the reader run to natural completion (`ReadAllAsync` ends when the channel is completed and empty), with a separate hard deadline as a backstop.

**The loss is invisible.** No exception, no failed request, no error-rate spike. From every observability surface you have, the pod shut down cleanly. This is the defining hazard of in-memory decoupling: it converts loud failures into silent ones, and it does so precisely at deploy time, when nobody is watching the graphs for *missing* work.

> ⚠ *In a Kubernetes deployment, a rolling update is a routine, frequent, deliberate destruction of every in-memory buffer in the system. If an event type cannot tolerate that — if it is "Required" or "Constitutive" by the Section 5 test — no in-process mechanism is sufficient, however carefully it is drained. You need durability, not a longer timeout.*

---

# Part 4 — The .NET Toolbox

Now the concrete options, evaluated against the axes from Section 9. Every one of these is an *intermediary*; the only interesting question is what it guarantees.

## 24. `System.Threading.Channels`: The Default Answer

For plain "the publisher should not wait for the subscriber," this is usually the right in-process choice. It is the minimal primitive: a producer/consumer queue with async read and write, real backpressure, and clean completion.

```csharp
// Registration
builder.Services.AddSingleton(Channel.CreateBounded<int>(new BoundedChannelOptions(1000)
{
    FullMode = BoundedChannelFullMode.Wait,   // or DropOldest / DropNewest / DropWrite
    SingleReader = false,
    SingleWriter = false
}));
builder.Services.AddHostedService<OrderProcessor>();

// Publisher
await _channel.Writer.WriteAsync(order.Id, ct);   // returns as soon as there is room
```

What it gives you, mapped to Section 19's specification: an **owner** (the `BackgroundService`), an **observable failure path** (a try/catch inside the loop with logging and metrics), **bounded capacity** with an explicit full-policy, **host-integrated shutdown**, and a place to **create a fresh DI scope** per item.

Choose the reader shape deliberately. One `await foreach` over `ReadAllAsync` gives sequential, ordered processing. N parallel reader loops give throughput at the cost of ordering. If you need per-key ordering with parallelism, run N readers over N channels and route by `hash(key) % N` — the in-process version of Section 13's partitioning.

Cost: it is only a queue. No retry policy, no dead-lettering, no visibility beyond what you instrument. For "Best-effort" events that is exactly right; for anything else you will end up growing it toward one of the options below.

## 25. TPL Dataflow

An actor/pipeline library. Every block owns an input buffer by construction, so `Post()` returns immediately and the producer is genuinely released — decoupling is the default behaviour rather than something you arrange.

```csharp
var transform = new TransformBlock<int, Invoice>(
    id => BuildInvoiceAsync(id),
    new ExecutionDataflowBlockOptions { BoundedCapacity = 100, MaxDegreeOfParallelism = 4 });

var send = new ActionBlock<Invoice>(SendAsync,
    new ExecutionDataflowBlockOptions { BoundedCapacity = 50, MaxDegreeOfParallelism = 8 });

transform.LinkTo(send, new DataflowLinkOptions { PropagateCompletion = true });
```

Where it earns its weight over Channels: **multi-stage pipelines with different concurrency and ordering per stage**. `BoundedCapacity` plus `SendAsync` gives per-stage backpressure that propagates naturally upstream. `MaxDegreeOfParallelism` and `EnsureOrdered` let each stage make its own trade. `BatchBlock` and `JoinBlock` handle aggregation. `Complete()` plus `await Completion` drains the whole mesh cleanly.

Two sharp edges. `LinkTo` is **competing consumers** — the first linked target that accepts wins — which is not what people expect when they wire up "fan-out." True broadcast requires `BroadcastBlock`, and `BroadcastBlock` retains only the *latest* item, so a slow consumer silently misses messages. And a faulted block stops permanently: it will accept nothing further, and unless you observe its `Completion` task the pipeline goes quiet with no error surfaced.

Verdict: reach for it when the topology is genuinely a graph. For a single producer/consumer hop it is more machinery than the job needs.

## 26. System.Reactive

Rx is an **event composition** library, not a decoupling library, and this is the most common misconception about it.

```csharp
subject.OnNext(evt);   // invokes EVERY observer synchronously, on the calling thread
```

A `Subject<T>` is a multicast delegate with an OnNext/OnError/OnCompleted protocol and a LINQ algebra over it. By default it has exactly the same temporal coupling as a C# `event` (Section 17). You get decoupling only by explicitly inserting a scheduler boundary — `ObserveOn`, `Delay`, `Buffer` — and the queue that appears there is **unbounded**.

Two failure modes worth knowing before you deploy it as a message bus:

- **No backpressure model at all.** A fast producer plus `ObserveOn` is an unbounded memory leak under load. Rx has no equivalent of `BoundedCapacity`; the closest you get is lossy operators like `Sample` or `Throttle`, which is a different thing.
- **`OnError` is terminal.** A subject that sees an error is dead — it stops delivering, permanently and silently. One badly-behaved handler can take your entire event stream offline for the life of the process. Any Rx pipeline used as infrastructure needs `Catch`/`Retry` and per-subscriber isolation deliberately built in.

Where Rx is genuinely excellent, and where nothing else comes close: when the **temporal shape of the stream** is the problem. Debouncing user input, coalescing bursts, sliding windows, `CombineLatest` across streams, `Throttle`, `Timeout` with `Retry`, time-based joins. That operator vocabulary is its real value, and it composes beautifully.

## 27. Comparing the Three

| | Channels | TPL Dataflow | System.Reactive |
|---|---|---|---|
| Mental model | A queue | A mesh of buffered actors | Sequences over time |
| Decoupling | By construction | By construction | **Opt-in**, via schedulers |
| Buffer | Explicit, bounded or not | Per block | Implicit, unbounded |
| Backpressure | `BoundedChannelFullMode` | `BoundedCapacity` + `SendAsync` | **None** |
| Concurrency control | Your reader loops | `MaxDegreeOfParallelism`, `EnsureOrdered` | Scheduler choice only |
| Fan-out | One consumer per item | `LinkTo` = competing; `BroadcastBlock` = latest-only | Broadcast is natural |
| Error semantics | Yours to define in the loop | Faulted block stops permanently | `OnError` is terminal |
| Operator surface | None | Thin (Transform, Batch, Join) | Very large, time-oriented |
| Best at | Simple producer/consumer | Multi-stage throughput pipelines | Time-shaped event composition |

All three are **in-memory only**. None survives process death. All three give you Section 7 row 3 and nothing more.

Worth ruling out explicitly: **MediatR** and similar in-process mediators. Default dispatch is synchronous and awaited. They solve the referential half you had already solved with DI, and leave the runtime half untouched. Using one does not make anything asynchronous.

## 28. The Transactional Outbox on PostgreSQL

When an event is "Required" or "Constitutive," this is the first durable step and it needs no new infrastructure.

```csharp
await using var tx = await db.Database.BeginTransactionAsync(ct);

order.Status = OrderStatus.Paid;
db.Outbox.Add(new OutboxMessage {
    Id = Guid.NewGuid(),
    Type = nameof(OrderPaid),
    Payload = JsonSerializer.Serialize(new OrderPaid(order.Id)),
    AvailableAt = DateTimeOffset.UtcNow
});

await db.SaveChangesAsync(ct);   // one atomic commit: state + intent
await tx.CommitAsync(ct);
```

The publisher's obligation ends at `COMMIT`. A dispatcher — a `BackgroundService` — drains the table afterwards, possibly minutes later, possibly in a different pod after a restart.

Practical notes for a PostgreSQL deployment:

- **Wake the dispatcher with `LISTEN`/`NOTIFY`** to cut latency from "polling interval" to "milliseconds," but keep a slow poll as a fallback: `NOTIFY` is fire-and-forget and is lost when nobody is listening. Add jitter, because a `NOTIFY` wakes *every* dispatcher at once.
- **Backoff and poison handling** are not optional: an `Attempts` counter, exponential backoff written into `AvailableAt`, and a threshold past which the row moves to a dead-letter state. Without this, one unprocessable message is retried forever by every pod in turn.
- **Prune aggressively.** A never-pruned outbox becomes the largest table in the database and the dispatcher's index scans degrade with it.
- **Consider the ordering requirement now**, not later — see Section 30.

The trade you accepted, restated: the outbox converts silent loss into occasional duplicate delivery. That is only a good trade if consumers are idempotent (Section 31).

## 29. Brokers and Message-Bus Libraries

When subscribers live in other processes, or must survive the publisher entirely, you need location decoupling:

- **RabbitMQ** — competing consumers on a queue, `prefetch` for flow control, per-queue DLX for dead-lettering. The default for command-style work distribution.
- **Kafka** — a durable partitioned log. Consumer groups implement Section 13's partitioning with automatic rebalancing; retention enables replay; per-partition ordering is guaranteed. Heavier operationally, and the right answer when replay and high fan-out matter.
- **Azure Service Bus** — `PeekLock` with a visibility timeout, sessions for per-key FIFO, built-in DLQ.

On top of any of these, **MassTransit**, **Wolverine**, **NServiceBus**, or **Rebus** supply the retry policies, dead-lettering, inbox deduplication, saga state machines, and — importantly — outbox integration. Most of Sections 28, 30, and 31 come pre-built.

The point that gets missed: **a broker does not remove the need for the outbox.** You still cannot atomically commit a database transaction and a broker publish. The outbox bridges that gap; the broker distributes afterwards. They compose; they are not alternatives.

## 30. Draining a Shared Buffer From Multiple Pods

The moment you run more than one replica, a naive `BackgroundService` polling a table becomes N pods racing for the same rows. Section 13's four structural answers, made concrete.

**A. Eliminate the concurrency.**

*Static singleton:* split the dispatcher into its own `Deployment` with `replicas: 1`. The API scales to 20 pods; the drainer does not. Often entirely sufficient — the outbox is usually far cheaper to drain than the requests filling it are to serve. Caveat: `replicas: 1` is not mutual exclusion. During a rolling update, or a node partition, you can transiently have two. A single-replica `StatefulSet` gives stronger at-most-one semantics, at the cost of a downtime gap on every deploy.

*Leader election:* every pod runs the same code, one holds a lease and works, the rest stand by.

- **Kubernetes `Lease`** via `KubernetesClient`'s `LeaderElector` + `LeaseLock`. Native to the platform, inspectable with `kubectl get leases`, needs RBAC.
- **PostgreSQL advisory lock** — `pg_try_advisory_lock(key)`, held for the session and released automatically when the connection drops. Zero extra infrastructure. `DistributedLock.Postgres` wraps it behind `IDistributedLock`. Risk: a hung-but-alive pod holds it indefinitely; the connection has to actually break.
- **Lease row with expiry** — `UPDATE leader SET owner=@me, expires_at=now()+interval '30s' WHERE expires_at < now() OR owner=@me`. Explicit, debuggable, failover behaviour tunable by you.

Trade-offs: a single-consumer throughput ceiling, a failover gap equal to the lease TTL, and an unavoidable split-brain window — the old leader may still be mid-batch when its lease expires and a new one starts.

**B. Arbitrate per row — `FOR UPDATE SKIP LOCKED`.** The canonical PostgreSQL answer:

```sql
UPDATE outbox SET status = 'processing', locked_by = @pod, locked_at = now()
WHERE id IN (
    SELECT id FROM outbox
    WHERE status = 'pending' AND available_at <= now()
    ORDER BY id
    LIMIT 20
    FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

`SKIP LOCKED` means contending readers step *over* locked rows instead of blocking, so N pods pull N disjoint batches with no coordination and no failed transactions. It scales close to linearly for a reasonable number of workers.

Two shapes to choose between:

- *Long transaction* — hold the lock for the whole processing and commit at the end. Cleanest semantics: a crash rolls the row straight back to pending. But you are holding a DB transaction open across network I/O, which pins a connection, blocks vacuum, and turns a slow downstream into database pressure. Fine for short local work only.
- *Claim-then-process (visibility timeout)* — the `UPDATE` commits immediately, marking rows claimed with a `locked_at`; processing happens outside any transaction; a reaper resets rows whose `locked_at` has aged out. This is what SQS and Service Bus do internally, and it is the right shape for outbox dispatching. The cost is that a slow-but-alive pod's messages get re-dispatched.

**C. Partition the work.** Store `partition = hashtext(aggregate_id) % 64` and give each pod a set of partitions. Guarantees per-aggregate ordering, since one key only ever lands on one worker. A `StatefulSet` gives stable ordinals so `partition % replicas == ordinal` needs no coordination at all — brittle, because scaling changes the divisor and a dead pod's partitions go unserved. Kafka consumer groups are this with automatic rebalancing, which is the main thing Kafka offers that a Postgres outbox does not.

**D. Delegate to a broker.** RabbitMQ and Service Bus implement B and C for you, with DLQ and retry included.

**On ordering.** Anything that lets multiple pods work in parallel breaks *global* ordering. Ask whether you need it. Usually the real requirement is **per-aggregate** ordering, which C gives directly and which B gives if you claim by aggregate rather than by row (`SELECT DISTINCT aggregate_id … FOR UPDATE SKIP LOCKED`, then drain that aggregate in order). Global total ordering means one consumer, full stop — that is option A, and it is a throughput ceiling you accept deliberately.

## 31. Idempotency Is Mandatory, Not Optional

Every durable option above gives at-least-once (Section 11). Even with perfect row claiming, a pod can complete the side effect and die before recording that it did — the lease expires and someone else re-processes. The crash-after-effect window always exists. Therefore every consumer needs one of:

- **Natural idempotency** — the operation is a set, not an increment. `UPDATE status = 'Shipped'` is safe; `UPDATE count = count + 1` is not.
- **An inbox / dedup table** — `INSERT INTO processed_messages (message_id)` with a unique constraint, **in the same transaction as the side effect**. Duplicate key means already handled; discard. This is the general-purpose answer and it is cheap in PostgreSQL.
- **A monotonic version check** — `WHERE version < @incoming`. A natural fit if you are already event-sourced.

> ⚠ *Get this right and the choice in Section 30 becomes a performance and ordering question. Get it wrong and no amount of locking saves you, because the crash-after-side-effect window is not closable by locking.*

## 32. Graceful Shutdown Is Part of the Design

Regardless of mechanism, wire this up or every deploy manufactures either lost work or timed-out leases:

- Register on `IHostApplicationLifetime.ApplicationStopping`: **stop accepting** new items, then `writer.Complete()` and let the reader drain to natural completion. Do not simply cancel the read loop (Section 23).
- Honour `stoppingToken` at the *batch boundary*, not inside a half-finished item. Finish or explicitly release the current item.
- Set `HostOptions.ShutdownTimeout` above your worst-case drain, and `terminationGracePeriodSeconds` above that.
- Add a `preStop` sleep of a few seconds so in-flight requests are not still arriving after shutdown starts.
- **Monitor lag, not throughput.** Oldest-pending-message age and claimed-but-unfinished count are the metrics that tell you something is wrong. Messages per second looks healthy right up until it does not.

## 33. A Decision Path

Answer Section 5's question per event type, then follow through:

1. **"Nothing breaks if it is dropped."** → `Channel<T>` + `BackgroundService`, bounded, with an explicit drop policy. Done. Do not add a broker.
2. **"A user-visible promise breaks."** → Outbox table + dispatcher. Add a broker only when subscribers live in other processes.
3. **"The system becomes inconsistent."** → Outbox written in the same transaction as the state change, plus consumer-side idempotency, plus dead-lettering. Non-negotiable.
4. **Multi-stage pipeline with per-stage concurrency?** → Dataflow over the in-memory hop.
5. **The problem is the stream's shape in time — debounce, window, coalesce?** → Rx, deliberately, with backpressure and error isolation designed in.
6. **More than one replica draining anything shared?** → Section 30 before you scale, not after.

And the reflex worth carrying out of this document: when someone proposes a mechanism, ask what the intermediary guarantees. If the answer is "nothing," the dependency did not go away — it just stopped being visible.

---


# Appendix A — The Intermediary Worksheet

A one-page artifact for design reviews. It turns Section 9 from a list you nod at into a form that produces a decision.

## The form

Three columns, not two. The proposal's properties alone tell you nothing; the argument happens in the **gap** between what the event requires and what the mechanism provides.

| Axis | **Required** (from the event) | **Provided** (by the proposal) | **Gap → decision** |
|---|---|---|---|
| 1. Durability | | | |
| 2. Atomicity with state | | | |
| 3. Capacity & backpressure | | | |
| 4. Delivery guarantee | | | |
| 5. Ordering | | | |
| 6. Fan-out | | | |
| 7. Observability & replay | | | |

Two rules make it work:

**Fill the "Required" column before anyone names a mechanism.** If the proposal is on the table first, the requirements column gets quietly written to match it. This is the same failure as Section 1's mechanism-before-meaning, one level up.

**"I don't know" is a finding, not a blank.** Every unknown cell is a future incident. In practice the unknowns cluster in rows 3, 5, and 7, because those are the ones that only fail under load or after someone scales out.

## Worked example

Event: `OrderPaid`. Consumer: sends the invoice email. Proposal: *"publish it on a bounded `Channel<T>` and drain it with a `BackgroundService`."*

| Axis | Required | Provided | Gap → decision |
|---|---|---|---|
| **1. Durability** | **Must survive pod restart.** A customer paid and expects an invoice | None; heap only | **Blocking.** Every rolling deploy silently drops invoices → outbox |
| **2. Atomicity with state** | Must never email for an order whose payment commit rolled back | None; the write and the enqueue are separate steps | **Blocking.** → outbox row written in the same transaction |
| **3. Capacity & backpressure** | Burst-tolerant; must never reject or stall the payment endpoint | Bounded 1000, `FullMode.Wait` | Blocking the payment path on a full buffer is the wrong trade → the outbox insert *is* the bound; never block the caller |
| **4. Delivery guarantee** | At-least-once acceptable **if** deduplicated | At-most-once | Duplicate emails are customer-visible → dedup on `(order_id, 'invoice')` in the inbox table |
| **5. Ordering** | None. Invoices are independent per order | Single reader ⇒ total order | Over-provided. Recording it as *not required* is what makes parallel readers safe later |
| **6. Fan-out** | Competing — exactly one email per order | Competing | OK |
| **7. Observability & replay** | Must be able to answer "which invoices failed to send yesterday?" | Nothing | **Blocking.** No in-memory mechanism can answer this → the outbox gives it for free via `SELECT` |

The proposal dies on rows 1, 2, and 7 — and the table says so in ninety seconds, without anyone arguing about libraries. The revised design writes itself from the gap column: outbox row in the payment transaction, dispatcher drains it, inbox dedup on the consumer side.

> ⚠ *Do not treat the "over-provided" row as free budget to spend. Single-reader total ordering is currently protecting you from an ordering bug nobody has had to think about. The value of writing "not required" in that cell is that it makes the future change safe and deliberate rather than accidental.*

## The same worksheet, filled for a different event

Event: `ProductViewed`. Consumer: increments a popularity counter. Same team, same service, same day.

| Axis | Required | Provided by a bounded `Channel<T>` | Verdict |
|---|---|---|---|
| 1. Durability | None — losing a page view is invisible | None | OK |
| 2. Atomicity with state | None | None | OK |
| 3. Capacity & backpressure | Must never slow the page render | Bounded 10 000, `DropOldest` | OK, and drop is the *correct* policy here |
| 4. Delivery guarantee | At-most-once fine | At-most-once | OK |
| 5. Ordering | None | Whatever | OK |
| 6. Fan-out | Competing | Competing | OK |
| 7. Observability & replay | Backlog depth metric is enough | Channel count metric | OK |

Seven greens, no infrastructure, done. This is the point of Section 5's buckets: the *same* mechanism that was disqualified on the previous page is exactly right here, and the worksheet is what tells the two cases apart without either over-engineering the counter or under-engineering the invoice.

---

# Summary: The Baseline

1. **"Coupling" is four independent dependencies.** Referential, temporal, lifetime, location. DI removes only the first, and it is the cheapest of the four.
2. **You cannot remove a dependency, only relocate it.** Every decoupling technique introduces an intermediary. The intermediary's guarantees are your new dependency. If it guarantees nothing, you did not decouple.
3. **Name the intent.** Extensibility, latency, load smoothing, fault isolation, independent scaling — five different goals with five different correct answers. Solving for latency and assuming you bought fault isolation is the characteristic mistake.
4. **Ask what breaks if the subscriber never runs.** Best-effort, Required, or Constitutive. The bucket determines the minimum intermediary, and most systems have all three kinds while using one mechanism for all of them.
5. **A buffer changes when work happens, never how much is possible.** Bounded-and-blocking, bounded-and-dropping, or unbounded-and-eventually-OOM. Every buffer needs an explicit answer to "what happens when this is full?"
6. **`await` frees the thread, not the caller.** The caller's continuation is physically stored inside the callee's `Task`. Async is a thread-efficiency property; decoupling is a topology property. A fully async codebase is usually fully temporally coupled.
7. **`event` is maximal referential decoupling with minimal temporal decoupling.** Synchronous, sequential, additive in latency, one throwing handler silences the rest, and subscribers are rooted by the publisher for the process lifetime.
8. **Fire-and-forget's defect is not backgrounding — it is that nothing owns the work.** No completion signal, silent exceptions, no backpressure, no shutdown integration, disposed scoped services. Read that list as the specification for the replacement.
9. **The process is the durability horizon.** Every in-memory mechanism dies with the pod, and in Kubernetes a routine rolling update destroys them all — silently, with no error to observe.
10. **Two systems cannot be committed atomically.** Record the intent in one transaction (the outbox) and make it true afterwards. This converts silent loss into duplicate delivery, which is only a good trade if consumers are idempotent.
11. **Durability means at-least-once, which makes consumer idempotency a correctness requirement.** Exactly-once delivery does not exist across a process boundary; the ambiguous failure — "I do not know whether it succeeded" — is the case that dominates in production.
12. **Scaling out turns your buffer into shared state.** Singleton, per-row arbitration, partitioning, or a broker. A `BackgroundService` polling a table is correct with one replica and quietly wrong with two.

These are not aspirational. They are the difference between a system that is decoupled and one that has merely hidden where the dependency went.

---

*— End of Document —*
