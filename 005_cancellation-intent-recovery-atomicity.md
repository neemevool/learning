# Cancellation, Intent, and Atomicity: What "Stop" Actually Means

*Understanding the Difference Between a Dropped Connection and a User Decision*

**Internal Learning Material for the .NET Team**
ASP.NET Core • CancellationToken • Distributed Writes • CPU-Level Atomicity

---

## Table of Contents

*This document is organized into four parts. Parts 1–2 are conceptual and framework-agnostic. Part 3 is .NET/ASP.NET Core-specific. Part 4 is a short standalone piece on low-level atomicity.*

**Part 1 — Intent Is the Thing the Machine Cannot See**

1. The Mistake That Starts Everything: Mechanism Before Meaning
2. A Token Is Not an Intent
3. Reads and Writes Have Opposite Defaults
4. Why the AI Coding Agent Cannot Close This Gap For You
5. The Question to Ask Before Any Cancellation Design

**Part 2 — From Intent to Recovery: Completing What Was Started**

6. Record the Intent First
7. The Operation Is the Intent, Not the Writes
8. The Three (and Only Three) Ways to Handle a Fault
9. Roll Forward by Default, Roll Back Only When Forced
10. Atomicity Is Not Isolation
11. Isolation Without a Transaction: The Immutable-Artifact + Single Pivot Pattern
12. Don't Hand-Roll the Orchestrator Without Deciding to

**Part 3 — .NET Specifics: CancellationToken and OperationCanceledException**

13. Why Cancellation Is Delivered as an Exception (The Historical Reason)
14. The Three Terminal States of a Task
15. The One-Keystroke Bug: Conflating Cancellation With Failure
16. The Rule of Thumb, Fully Qualified
17. Severing the Mutating Core From the Request Token
18. Uncancellable Is Not the Same as Durable

**Part 4 — For Completeness: Atomicity Is Not What It Looks Like**

19. `i = i + 10` Is Not Atomic
20. What "Atomic" Actually Requires
21. How Atomicity Is Really Achieved
22. Things That Look Atomic But Are Not

---

# Part 1 — Intent Is the Thing the Machine Cannot See

Before any discussion of tokens, exceptions, transactions, or sagas, there is a prior question that determines whether any of that machinery is even relevant. That question is about **intent**, and it is the one part of this entire document that no library, framework, or code generator can answer for you.

## 1. The Mistake That Starts Everything: Mechanism Before Meaning

The most common cancellation bug is not a bug in code. It is a bug in ordering — the order in which decisions get made.

A developer sees that ASP.NET Core supplies a `CancellationToken` on every action. The framework offers it; the obvious, tidy, consistent thing to do is thread it through everything — reads, writes, everything. This feels like good hygiene. It looks like consistency. And for the read-heavy majority of endpoints it is even correct.

But threading that token into a state-mutating operation is not a technical default. It is a **product decision in disguise**. Passing `RequestAborted` into a POST asserts something specific to the user:

> "If this user's network connection drops, they would prefer that this operation not happen."

That assertion is being made silently, by plumbing convention, without anyone checking whether it is true. For most write operations it is false.

The tell that it is a disguised product decision is this: the developer usually cannot defend it in user terms. Ask *"why does a dropped connection mean this payment should not complete?"* and the honest answer is not grounded in anything the user wanted — it is "that's what the token is for." But the token does not know what the user wanted. It knows that a TCP connection went away. Equating those two things is the category error at the root of the entire topic.

> ⚠ *Consistency in the mechanism ("I pass the token everywhere") can mask an inconsistency in the meaning ("for reads this means 'nobody's listening, stop'; for writes it silently means 'undo the user's request if their wifi hiccups'"). Uniform plumbing is not the same as uniform semantics.*

## 2. A Token Is Not an Intent

The single most important idea in Part 1: **cancellation safety is a property of the operation, not of the token.**

The `CancellationToken` from `RequestAborted` is a generic "the HTTP connection died" signal. It carries zero knowledge of whether the work behind it is safe to abandon. It conflates two things that have nothing to do with each other:

| The token fires because... | For a read this means... | For a write this means... |
|---|---|---|
| The caller no longer wants the result | Stop; no harm done | Possibly: stop; no harm done |
| The transport that would carry the result went away | Stop; no harm done | **Nothing about whether the write should complete** |

For a read, those two collapse into the same action: nobody is listening, so stop working, and there is no observable effect from stopping. A `GET` is *cancellation-safe* because abandoning it midflight leaves no trace.

For a write, they come apart hard. A `POST` that debits an account, enqueues a side effect, and writes an audit row is *not* cancellation-safe. Abandoning it midflight can leave torn state. And crucially, the "user intent" the token supposedly represents was never intent about that operation's atomicity in the first place. It was just TCP.

> ✓ *Mental model: the token is a smoke alarm wired to the front door. It tells you the door opened, not whether the house is on fire. For some rooms (reads) an open door does mean "leave." For others (writes) it means nothing at all about whether you should finish what you're doing.*

## 3. Reads and Writes Have Opposite Defaults

Because cancellation safety is a property of the operation, the correct default is **inverted between reads and writes.**

- **For reads:** honoring `RequestAborted` is the safe default. Opting out is the rare exception. If the caller is gone, stop the query; it is cheap and correct.
- **For state-mutating operations:** *not* honoring connection-death should be the default. Honoring it should be the deliberate, justified exception.

The reason is what the common user intent actually is. When a user asks the system to *do a thing*, the overwhelmingly common intent is "do the thing." "Abandon it if my connection hiccups" is the rare case that needs a specific reason. Even when the operation takes longer than expected, the user typically prefers it to reach the intended end state rather than to be told, cheerfully, that everything was reverted.

The developer who threads the token uniformly into writes has the polarity backwards for exactly the operations where getting it wrong is most costly — and they arrived there by letting a framework affordance stand in for a product judgment.

> ⚠ *"Should a dropped connection abort this?" has a different answer for a search box, for "generate this 40-second report," and for "submit my tax return." Only the use case tells you which. The framework default — thread the token through everything — happens to be right for the first, defensible for the second, and quietly wrong for the third.*

## 4. Why the AI Coding Agent Cannot Close This Gap For You

This point deserves its own section because it is increasingly the difference between a correct system and a plausible-looking one.

When an AI coding agent generates a handler, it will thread the `CancellationToken` through everything. It does this because that is the statistically dominant pattern in its training data, and because — locally, syntactically — it is correct. The code compiles. It looks idiomatic. It passes review by anyone who is also reasoning locally.

But the agent is answering a mechanism question ("how do I wire a token through this call chain?") when the real question is a meaning question ("should this operation be abandonable at all?"). The meaning question can only be answered by someone who knows:

- What this operation does to the world (does it move money, send an email, allocate inventory?).
- What the user actually wants to happen if they walk away midflight.
- What the business considers an acceptable outcome for a half-finished operation.

**None of that is in the code.** It is in the user, the domain, and the product. The agent has no access to the user. It cannot ask the customer what they meant. It cannot know that "abandon on disconnect" is catastrophic for a settlement but fine for a search. It infers intent from surrounding tokens of text, and intent is precisely the thing that is not written down.

> ✓ *The division of labor in the AI-assisted era: the agent is very good at the mechanism — call chains, token propagation, exception wiring, boilerplate. The human is responsible for the globally correct solution — the intent, the boundaries, the "should this even be cancellable." The agent produces code that is locally correct and globally unaccountable. Someone has to be globally accountable, and that someone has the user in reach. The agent never does.*

This is not an argument against using the agent. It is an argument about where your attention has to go. The agent removes the mechanical burden, which means the *only* thing left for you to get right is the part it cannot see. If you also delegate the meaning question — if you accept "the token is threaded everywhere" as though it were a decision — then nobody made the decision at all.

## 5. The Question to Ask Before Any Cancellation Design

Before reaching for any of the machinery in Part 2 or Part 3, answer this, per operation:

> **If the user walks away midflight, what does the user want to have happen?**

The answer sorts every operation into one of three buckets:

| Answer | Cancellation is a... | What to do |
|---|---|---|
| "Don't bother finishing — I'm gone" | **feature** | Honor the token everywhere. Done. |
| "Doesn't matter either way" | **irrelevance** | Honor the token; it's harmless and cheap. |
| "Finish what I asked for" | **bug, if honored** | Sever the mutation from the token (Part 3), and design for completion/recovery (Part 2). |

Only after this question is answered does it make sense to ask *how*. Everything in the rest of this document is downstream of it. If the answer is "cancellation is a feature," you can stop reading after Part 3 — you will never need sagas or outboxes. The heavy machinery earns its complexity only for the operations whose use case says "this should reach its intended state regardless of who is still watching."

---

# Part 2 — From Intent to Recovery: Completing What Was Started

Once an operation is in the "finish what I asked for" bucket, and once it touches more than one store, the naive instinct is to make the whole sequence of writes atomic — to somehow wrap everything in a transaction. That instinct does not scale, and coordinated multi-store rollback is genuinely hard. The way out is a reframing.

## 6. Record the Intent First

The load-bearing move is this: **before doing any of the work, durably record what the user asked for, in a single atomic write.**

That record — the intent — is the source of truth for the operation. It is not a log entry. It is the operation itself, in its most durable form. The subsequent writes to various stores are not *the operation*; they are a currently-observed approximation of what the intent demands.

This is the generalization of the technical outbox pattern. The outbox is one instance of it: record the intent to send a message atomically with your local transaction, then let a separate process make it true. But the idea is broader than messaging. Any operation that must survive a flaky connection, a process restart, or a partial failure benefits from the same shape: **persist the intent atomically, then derive every concrete action from it.**

## 7. The Operation Is the Intent, Not the Writes

This reframing inverts the usual mental model, and the inversion is the whole point.

- **Naive model:** the operation *is* the sequence of writes. Reliability means making that sequence atomic. (This does not scale across stores.)
- **Intent model:** the operation *is* the durably-recorded intent. Each store's state is *provisional* — a snapshot of how far the system has gotten toward satisfying the intent. Reliability means an orchestrator that drives the gap between "what the intent requires" and "what the stores currently show" toward zero.

Under the intent model, there are exactly two stable resting states, and the orchestrator's only job is to reach one of them:

1. **Everything is as it was before the operation started** (fully reverted), or
2. **The operation is fully completed** (intent satisfied).

Anything in between is a transient state the orchestrator must move *out of*. It never rests there.

> ✓ *This is the reconciliation-loop model that underlies Kubernetes controllers. The most reliable distributed system most of us touch every day is built on exactly this shape — a desired state (intent) and a loop that drives observed state toward it — rather than on distributed transactions. That is not a coincidence. It is the pattern that actually survives partial failure.*

## 8. The Three (and Only Three) Ways to Handle a Fault

When a step in the orchestration fails, there are exactly three tools. There is no fourth.

| Tool | What it does | When it applies |
|---|---|---|
| **Idempotent retry** | Re-run the step safely; a replay is recognized and no-ops | The step can be completed forward, safely, more than once |
| **Transaction** | The platform makes the step all-or-nothing for free | The whole step lives in one ACID store |
| **Compensation (reversibility)** | Run an inverse operation to undo a completed step | The step cannot be completed forward and must be unwound |

These are not peers. They compose in a specific hierarchy.

**Idempotent retry is the primary tool.** It is the only one that handles the *ambiguous failure* — the failure that actually dominates in practice. You called the second store, the call timed out, and **you do not know whether it succeeded.** You cannot revert (maybe there is nothing there to revert). You cannot assume success. The only escape is "call again, safely," which requires idempotency keyed on something stable from the intent — a command ID — so the store can recognize the replay and no-op it. Without idempotency, ambiguous failures are unrecoverable and you are reduced to guessing.

**Transaction is the degenerate best case.** When a whole step happens to live in one ACID store, you get atomicity for free and need neither of the other two for that step. Use it everywhere the platform hands it to you — but understand it as an optimization for a special case, not the general mechanism. This is precisely why "wrap everything in a transaction" does not scale: transactions are the lucky case, not the rule.

**Compensation is the fallback.** For genuinely irreversible-forward steps, where retry cannot complete them and you must instead unwind, you run an inverse operation. It is the weakest tool because coordinated multi-store reverting is brutally hard, and because a compensation is *itself* an operation that can fail — so it too must be durable and idempotently retriable. Compensation that is not tracked and retriable just moves the reliability problem down one level.

## 9. Roll Forward by Default, Roll Back Only When Forced

The hierarchy above yields a clear default:

> **Prefer retry-to-completion (roll forward). Fall back to compensation (roll back) only when forward completion is impossible. Use transactions to collapse any step the platform makes trivial.**

A saga is exactly this: an orchestrator that, per the intent's progress, chooses forward (idempotent retry) or backward (compensation), where every step in either direction is durable and idempotent. The "endless effort" of trying to wrap everything in transactions dissolves once you accept that transactions are the special case and the general effort goes into **idempotency keys and compensation logic**, not into stretching ACID across stores it does not span.

## 10. Atomicity Is Not Isolation

Here is the part most homegrown orchestrators get quietly wrong. The intent-and-reconciliation model gives you **atomicity** — the operation reaches one of the two stable end states. It says nothing, by default, about **isolation** — whether anyone can observe the unstable middle.

These are separate problems. A saga that is mid-flight has real, *committed*, visible intermediate state in each store. That is the price of giving up distributed ACID. Anyone reading store B between step 2 and step 3 sees a world that never logically existed — a debit with no matching credit, an order with no inventory reservation.

> ⚠ *A saga provides A, C, and D but not I. There is no isolation between a saga's steps unless you build it. This is the saga's fundamental weakness, and it is invisible in the happy path and in single-threaded tests. It surfaces as "impossible" data that a concurrent reader saw for 40 milliseconds.*

With SQL you rarely think about this, because the engine's own isolation levels plus a status column do most of the work. The hard case is stores with no native isolation — files being the canonical example.

The remedies are all application-level countermeasures:

- **Semantic lock.** The intent, in its first durable step, writes a marker on every record it will touch (`"pending settlement"`, `"reorganizing"`). Readers that encounter the marker must decide, per business rule, whether to block, skip, read the last stable version, or fail. This is the cooperative equivalent of a row lock — it only works if every reader honors it.
- **Commutative updates.** Design operations so the order of observation cannot produce a wrong answer (increment/decrement rather than set-absolute), so an interleaved read is stale but not incoherent.
- **Reread / versioned value.** Keep the pre-operation version available so a reader can be handed the last stable snapshot instead of the torn intermediate.

## 11. Isolation Without a Transaction: The Immutable-Artifact + Single Pivot Pattern

For stores that give you no isolation primitive at all — the filesystem, object storage, dumb blobs — you have to build one. The unifying technique is:

> **When a store cannot provide isolation natively, do not try to make that store transactional. Keep its artifacts immutable, and relocate the isolation boundary to a single store that *is* atomic.**

You never need N stores to coordinate isolation. You need N stores to hold immutable data, and *one* atomic pivot that decides which version of the world is currently visible.

Concrete techniques for files:

- **Atomic publish via rename.** Never mutate a visible file in place. Write to a temp path, `fsync`, then `rename()` onto the target. On POSIX, a same-filesystem rename is atomic: a reader sees either the whole old file or the whole new one, never a half-written one. *(Caveats: same filesystem only; durability of the rename itself requires a directory `fsync`, or a crash can lose it.)*
- **Immutable version + pointer swap.** Write each new version to a new versioned or content-addressed path, then flip a single pointer — a symlink, or a row in a small SQL "manifest" table — to the new version atomically. Now the *pointer's* store provides the isolation, and the files themselves are append-only and never observed torn.
- **Marker / lock file** as the semantic lock — a sibling `.lock` or a status field in the manifest that readers must check. Cooperative, with the same catch as any semantic lock.

> ✓ *This is how object stores and table formats like Delta Lake and Apache Iceberg get transactional semantics over dumb blob storage: the blobs are immutable, and a transactional log or manifest is the single point of isolation. The blobs never change; only the pointer to "which set of blobs is current" moves, atomically.*

Note the symmetry with Section 6. "Record the intent" makes a single atomic write the source of truth for *what should happen*. "Single pivot" makes a single atomic write the source of truth for *what is currently visible*. In both cases the trick is the same: concentrate the thing that must be atomic into one place that can actually be atomic, and let everything around it be provisional or immutable.

## 12. Don't Hand-Roll the Orchestrator Without Deciding to

A caution, because the failure mode here belongs specifically to people who understand this material well.

Everything above — intent persistence, idempotent retry, compensation, the reconciliation loop — is genuinely expensive to build correctly. The isolation problem alone, especially over files, is enough work to justify not also owning the durable-execution layer underneath it. The characteristic mistake of a strong team is to build a bespoke saga/reconciliation engine when a durable-workflow substrate (a workflow engine, a durable-execution framework, an existing outbox/inbox library) would have supplied the intent-persistence, retry, and compensation scaffolding for free.

> ⚠ *Before hand-rolling the orchestrator, decide deliberately whether this machinery is your product's differentiator or just table stakes you are re-implementing. "We accidentally wrote a worse Temporal because each step looked small" is a real and common outcome.*

---

# Part 3 — .NET Specifics: CancellationToken and OperationCanceledException

Now the mechanism. This part assumes you have already answered the Part 1 question and know *whether* a given operation should be cancellable. Here we cover *how* .NET delivers cancellation, why it chose to deliver it the way it did, and the specific bug that delivery choice makes easy.

## 13. Why Cancellation Is Delivered as an Exception (The Historical Reason)

The frequent objection: cancellation is semantically just a message — *"I don't care anymore."* It is not an error that happened during the action. So why is it delivered as an `OperationCanceledException`? Why does a non-error travel on the error channel?

The answer separates two things the objection fuses together: the **signal** ("I don't care anymore") and the **control-flow requirement the signal creates** ("stop what you are doing, wherever you are in the call stack, run all cleanup, and do not produce a result"). The exception does not model the signal. It models the second thing. And for that job, cancellation is operationally indistinguishable from an error, even though semantically nobody did anything wrong.

Consider what cancellation must actually accomplish. You are fifteen frames deep in an async computation — a repository call inside a service call inside a handler — and each frame holds something: an open connection, a half-written buffer, a lock, some partially mutated state. The token trips. Now every one of those frames must (a) stop, (b) run its cleanup, and (c) not return a value it can no longer produce. That is *exactly* the machinery exceptions exist for: non-local transfer of control that unwinds the stack and runs every `finally` and `using` on the way out.

The alternatives all fail this test:

| Alternative | Why it fails |
|---|---|
| Return values / `TryXxx` | Does not compose. Every method in the chain must return and check a status; one missed check silently kills cancellation. Every signature is polluted. This is essentially the Go model (`ctx.Err()` propagated up manually) — and it works there *only because Go has no exceptions and no stack unwinding at all.* It is a consequence of Go's design, not an endorsement of it. |
| Nullable / sentinel result | Conflates cancellation with a legitimate null, loses the "why," and still does not unwind the stack or run cleanup. |
| Separate `OnCancelled` callback | Breaks the moment you have sequential `await`s. You cannot express "cancel out of the middle of a straight-line async method" with a callback without inverting the whole method into a state machine — which is the thing `async/await` exists to spare you. |

There is also a hard historical constraint. The TPL (`Task`, `CancellationToken`) shipped in .NET 4.0 (2010). `async/await` did not arrive until C# 5 (2012). So when cancellation was designed, **exceptions and `Task` were the only building blocks on hand.** A parallel, non-exception structured-unwinding primitive would have been a language-level invention that did not exist and could not have been assumed. The design is therefore partly principled (exceptions genuinely are the right shape for guaranteed-cleanup stack unwinding) and partly path-dependent (they were also the only tool available). Both are worth remembering before treating it as the platonically perfect answer.

> ✓ *An exception in .NET is not synonymous with "error." It is a non-local control transfer signaling that normal completion is not possible. Errors are one reason for that. Cancellation is another. .NET is not alone here — Python uses full exception machinery for `StopIteration` to signal end-of-iteration, which is about as far from an "error" as it gets. Same pattern: exceptions as the language's abnormal-termination plumbing, reused for a non-error condition because the control-flow shape matches.*

## 14. The Three Terminal States of a Task

The reason "cancellation is delivered as an exception" does *not* mean "cancellation is an error" is baked into the type system, and most people miss it.

A `Task` has **three** terminal states, not two:

| State | Meaning |
|---|---|
| `RanToCompletion` | Produced its result |
| `Faulted` | Threw an error |
| `Canceled` | Abandoned its promise via cancellation — **distinct from Faulted** |

The runtime enforces the distinction. When an async method throws an `OperationCanceledException` whose token **matches** the one the operation was given, the TPL transitions the task to `Canceled`, *not* `Faulted`. Throw any other exception — or an `OperationCanceledException` carrying a *non-matching* token — and you get `Faulted`.

So at the state-machine level, .NET explicitly does **not** say "cancellation is an error." It preserves the exact semantic distinction the objection in Section 13 was worried about. The exception appears only at the `await` point, and there it is purely the *delivery mechanism*: `await`'s contract is "give me the `T`." When the task is `Canceled`, there is no `T` — the operation abandoned its promise — so `await` must transfer control abnormally, and the only tool for that is throwing. The throw is not a claim that something went wrong. It is the only honest thing `await` can do when asked for a value that does not exist.

Frameworks lean on this distinction downstream, which is the tell that "cancellation = error" was never the design intent. ASP.NET Core inspects for `OperationCanceledException` on client disconnect and does not log it as a 500; it recognizes it as "caller walked away," not a fault. The exception type carries the semantics; the machinery is borrowed.

## 15. The One-Keystroke Bug: Conflating Cancellation With Failure

Because cancellation is *delivered* as an exception, it is syntactically catchable by `catch (Exception)`. That makes the conflation a one-keystroke mistake — and an extremely common one:

```csharp
try {
    await DoWorkAsync(ct);
} catch (Exception ex) {
    throw new MyDomainException("Work failed", ex);
}
```

This silently reclassifies a `Canceled` outcome as a `Faulted` one. The token tripped, the operation correctly abandoned — and now the upper layer sees a domain fault. Everything that relied on the three-state distinction breaks: the task ends up `Faulted` instead of `Canceled`, ASP.NET Core logs a 500 for what was a client disconnect, retry logic retries a cancellation, `Task.WhenAny` race patterns misfire.

The type system does not stop you, because at the delivery layer cancellation and errors share a base type. .NET gave you a distinct terminal *state* but not a distinct *catch surface*. Preserving the distinction is therefore a discipline you must apply, not something the compiler enforces. **This is the weakest seam in the whole design.**

The fix is to catch cancellation first and separately, and only wrap genuine faults:

```csharp
try {
    await DoWorkAsync(ct);
}
catch (OperationCanceledException) {
    throw;  // preserve Canceled semantics — never wrap
}
catch (Exception ex) {
    throw new MyDomainException("Work failed", ex);
}
```

Order matters: `catch` is first-match, and `OperationCanceledException` derives from `Exception`, so a bare `catch (Exception)` placed above would win and reintroduce the bug.

Two subtleties:

**Token matching.** A bare `catch (OperationCanceledException)` swallows *any* OCE, including one from a different token than the one you were given. To rethrow only *your* cancellation and treat a foreign OCE as a genuine fault, filter on the token:

```csharp
catch (OperationCanceledException ex) when (ex.CancellationToken == ct) {
    throw;
}
```

At an outer boundary, "any cancellation is cancellation" is usually fine. Deep in a library, where a stray OCE from an unrelated inner operation might indicate a bug, the filter is the more honest choice. In practice the token on the exception is not always populated reliably, so many codebases match on type alone and accept the small imprecision.

**Filter instead of catch-and-rethrow.** If all you want is "let cancellation pass through untouched, wrap everything else," an exception filter on the *fault* branch avoids entering the OCE frame at all:

```csharp
try {
    await DoWorkAsync(ct);
}
catch (Exception ex) when (ex is not OperationCanceledException) {
    throw new MyDomainException("Work failed", ex);
}
```

This is the cleanest form of the wrap-faults pattern: one catch block, cancellation is never entered, and intent is explicit in the filter. The two-catch version is equally correct; pick one and be consistent.

## 16. The Rule of Thumb, Fully Qualified

The naive rule — *"if you pass a `CancellationToken`, handle the possible `OperationCanceledException`"* — is close, but it needs tightening in three ways.

**The trigger is not "you passed a token." It is "an OCE can propagate through this `catch`."** The token can be passed *below* you and the OCE still surfaces through your `catch` even though your method never names a token — you called something that did. The real check is broader: *can an OCE come up through here?*

**"Handle" is the wrong verb.** It invites people to *do something* in the OCE catch, which is usually itself the mistake. The default correct action is to **not catch it** — let it propagate. You add an explicit `catch (OperationCanceledException) { throw; }` only when a broader `catch` below it would otherwise swallow it.

**There is one legitimate exception:** a layer that deliberately *absorbs* cancellation and returns normally — a per-item loop that cancels one item and continues, or a "best-effort, cancellation means stop early and return what I have" boundary. There, catching the OCE and *not* rethrowing is correct — but you return a normal result. You never reshape it into a fault.

Put together:

> **If a `catch` in your method could intercept an `OperationCanceledException`, it must let that exception propagate unchanged — not swallow it, not wrap it, not reshape it — unless this layer is genuinely the place that decides to stop cancelling and resume normal work.**

The fully-qualified operational form:

- **Default:** do not touch OCE — propagate.
- **When a wider `catch` sits in the path:** add an explicit cancellation catch above it that rethrows, so faults get wrapped but cancellation passes through.
- **Only when this layer is the deliberate stop-point:** absorb the OCE and return a normal value — never a wrapped exception.

The thing that is *never* correct is turning `Canceled` into `Faulted`.

> ✓ *There is no built-in Roslyn analyzer for "you wrapped an OCE," but it is a straightforward custom analyzer to write. If this pattern is widespread across a team, an analyzer enforces it more reliably than code review can.*

## 17. Severing the Mutating Core From the Request Token

This is where Part 1's intent question meets Part 3's mechanism. Once you have decided (per Section 5) that an operation should complete-through, the implementation is to **sever the mutating core from `RequestAborted` entirely.**

The handler splits into a cancellable pre-phase and an uncancellable commit phase:

```csharp
public async Task Handle(Command cmd, CancellationToken requestAborted)
{
    // Cancellable: safe to abandon if the caller is gone.
    await _validator.ValidateAsync(cmd, requestAborted);
    var entity = await _repo.LoadAsync(cmd.Id, requestAborted);

    // Point of no return. The client's connection is now irrelevant
    // to whether this should complete.
    await _repo.CommitAsync(entity, CancellationToken.None);
}
```

That single swap — `requestAborted` above the line, `CancellationToken.None` below it — **is** the "point of no return" made explicit in code. Validation, authorization, loading, any read that gates the write all take `RequestAborted` and cancel freely; if the client is gone before anything is committed, dropping out is correct and cheap. Once you cross into the mutation, you stop passing the client's token down. The commit runs under its own lifetime — `CancellationToken.None`, or a token tied to *server* concerns (app shutdown, an operation-level timeout you actually chose), never the client's connection.

The type system will not draw this line for you. It is the same seam from Section 15 — there is no distinct token type for "safe" versus "unsafe" cancellation — so the boundary is one you assert by hand.

## 18. Uncancellable Is Not the Same as Durable

A critical caveat, or Section 17 becomes a worse bug than the one it fixes.

Swapping to `CancellationToken.None` stops *cooperative* cancellation. It does **nothing** about the process dying — pod eviction, OOM kill, deploy rollout, `SIGKILL`. If your commit spans multiple stores (a DB write plus a queue publish plus an external call), "don't cancel" still leaves you exposed to a crash between step one and step two.

So the honest version of the instinct is not "make the write uncancellable." It is **"make the write atomic or recoverable."**

- **Single-store write:** a transaction gives you atomicity for free. It commits or it does not, token or no token. Uncancellability is barely relevant.
- **Multi-store or truly irreversible write:** uncancellability buys you almost nothing. The real answer is a durability pattern — this is exactly where Part 2 comes in. Record the intent atomically (Section 6), then let the orchestration drive to a stable state with idempotent retry and, where needed, compensation.

The strongest version inverts the problem entirely: instead of protecting a long mutation from a flaky connection, shrink the connection-dependent part to a *single atomic "record the intent" write*, and move the irreversible effect to a separate consumer with its own retry and idempotency. Then the request can be cancelled all it likes — the intent is already persisted, and the effect happens exactly once regardless of who is still connected.

| Operation shape | Correct handling of connection-death |
|---|---|
| Pure read | Honor `RequestAborted` everywhere. Cheap, correct, done. |
| Single-store write | Cancel freely up to the transaction; run the transaction under `None`. Atomicity covers you. |
| Multi-store / irreversible write | Do not lean on uncancellability. Reduce the synchronous part to one atomic "record the intent" write; make the irreversible effect durable and idempotent behind it. |

> ⚠ *`CancellationToken.None` protects an operation from cooperative cancellation. It does not protect it from the process ceasing to exist. If correctness depends on the operation surviving a crash — not just surviving a disconnect — you need durability, not merely uncancellability.*

---

# Part 4 — For Completeness: Atomicity Is Not What It Looks Like

The word "atomic" has appeared throughout this document at the level of operations and transactions. It is worth closing with the low-level meaning, because a widespread misconception about CPU-level atomicity quietly undermines multithreaded code. This part stands alone.

## 19. `i = i + 10` Is Not Atomic

A very common belief:

```csharp
int i = 10;
i = i + 10;   // "this is a single operation, surely it's atomic"
```

It is not. That single line of C# compiles to (at least) three distinct steps at the machine level:

1. **Read** the current value of `i` from memory into a register.
2. **Add** 10 to the register.
3. **Write** the register back to `i`'s memory location.

This is a *read-modify-write* sequence, and any of the three steps can be interleaved with another thread doing the same thing. Two threads each running `i = i + 10` against a shared `i` can both read 10, both compute 20, and both write 20 — so `i` ends at 20 instead of 30. One increment is silently lost.

> ⚠ *The number of C# statements, or even the visual "simplicity" of an expression, tells you nothing about atomicity. `i++`, `i += 10`, and `i = i + 10` are all read-modify-write. All three are non-atomic on shared state. Compactness in the source is not atomicity at the hardware level.*

Even a plain assignment is not automatically safe. `long` and `double` writes are only *guaranteed* atomic on 64-bit runtimes; the CLI spec guarantees atomic reads/writes for types up to the native word size and for references, but not for a 64-bit value on a 32-bit platform, and not for larger structs at all. A `struct` assignment copies field by field and is never atomic.

## 20. What "Atomic" Actually Requires

An operation is atomic if, from the perspective of every other thread, it happens **all at once or not at all** — there is no observable intermediate state, and it cannot be interleaved partway through.

Two properties are needed, and people usually remember only the first:

- **Indivisibility:** no other thread can observe a partial result.
- **Visibility / ordering:** once it completes, the result is actually visible to other threads, and not reordered around by the compiler, JIT, or CPU. A value can be written atomically and still sit in a core-local cache or register where another thread never sees it. Atomicity without a memory barrier is not enough for correctness.

This is why "is this atomic?" is really two questions — "can it be torn?" *and* "can another thread see the new value in the right order?" — and why the tools that provide atomicity almost always provide a memory barrier as well.

## 21. How Atomicity Is Really Achieved

At the bottom, atomicity is a **hardware** capability that higher layers expose. Nothing above the CPU can manufacture it from thin air.

- **CPU atomic instructions.** Modern processors provide instructions like compare-and-swap (`CMPXCHG` on x86) and atomic add/exchange, plus a `LOCK` prefix that makes a read-modify-write indivisible against other cores. These are the primitive on which everything else is built.
- **`System.Threading.Interlocked`.** The .NET surface over those instructions. `Interlocked.Add`, `Increment`, `Exchange`, and `CompareExchange` perform the whole read-modify-write atomically and impose a full barrier. This is how you make the Section 19 example correct:

  ```csharp
  Interlocked.Add(ref i, 10);   // the read-modify-write is now indivisible
  ```

- **`volatile` / `Volatile.Read`/`Write`.** These address *only the visibility/ordering half*, not indivisibility. `volatile` does **not** make `i++` atomic — a common and dangerous misreading. It prevents certain reorderings and ensures a fresh read/write, nothing more.
- **Locks (`lock` / `Monitor`).** The general-purpose tool. A `lock` makes an arbitrary *block* of operations atomic with respect to other threads that take the same lock, and provides barriers on entry and exit. It is heavier than `Interlocked` but works for compound operations that no single atomic instruction covers ("if the dictionary lacks this key, compute and insert it").

The ascending cost/generality ladder: a single `Interlocked` call is cheapest and covers one variable; `volatile` covers visibility only; a `lock` covers arbitrary compound sequences at higher cost. Reach for the lightest tool that actually covers the operation you need to make indivisible.

> ✓ *Atomicity is not a property you can add by wishing, by writing fewer statements, or by marking something `volatile`. It is a hardware primitive surfaced by specific constructs — `Interlocked`, `lock`, and the concurrent collections built on them. If your compound operation is not wrapped by one of those, assume it can be interleaved.*

## 22. Things That Look Atomic But Are Not

A checklist of constructs that developers routinely assume are atomic and are not:

| Looks atomic | Actually is... | Why |
|---|---|---|
| `i++`, `i += n`, `i = i + n` | read-modify-write, **not atomic** | Three machine steps; interleavable |
| `longField = value` on 32-bit | possibly **torn** | 64-bit write is not guaranteed atomic below native word size |
| `myStruct = otherStruct` | field-by-field copy, **not atomic** | Multi-field copy; another thread can see it half-updated |
| `if (dict.ContainsKey(k)) dict[k] = ...` | **not atomic** | Two operations; the key's state can change between them (check-then-act) |
| `if (_instance == null) _instance = new()` | **not atomic** | Classic race; two threads both see null (needs `Lazy<T>` or double-checked locking with a barrier) |
| `list.Add(x)` on `List<T>` | **not thread-safe** | Not designed for concurrent writers; can corrupt internal state |
| `volatile int i; i++;` | **still not atomic** | `volatile` fixes visibility, not indivisibility |
| `Dictionary<K,V>` concurrent access | **not safe** | Use `ConcurrentDictionary`; even then, `GetOrAdd`'s factory can run more than once |

The single most useful reflex: **any check-then-act or read-modify-write on shared state is non-atomic until proven otherwise.** The proof is that the whole sequence is wrapped by a `lock`, expressed as one `Interlocked` call, or delegated to a concurrent collection whose contract explicitly covers the operation you are performing — and even those contracts have edges (`ConcurrentDictionary.GetOrAdd` is atomic in its result but may invoke your value factory multiple times under contention).

---

# Summary: The Baseline

1. **Answer the intent question first.** Per operation: if the user walks away midflight, what do they want to have happen? Mechanism comes after meaning, never before.
2. **A token is not an intent.** `RequestAborted` means "the connection died," not "the user wants this undone." Cancellation safety is a property of the operation, not the token.
3. **Reads and writes have opposite defaults.** Honor the token everywhere for reads; treat honoring it on a write as a deliberate exception that needs a reason.
4. **The AI agent cannot answer the intent question.** It has no user in reach. It supplies locally-correct mechanism; you supply the globally-correct decision. If you delegate the decision too, nobody made it.
5. **For completion-critical multi-store work, record the intent first.** The operation *is* the durably-persisted intent; store states are provisional; an orchestrator drives toward one of two stable ends.
6. **Three fault tools, in order:** idempotent retry (primary — the only thing that handles ambiguous failure), transaction (the lucky single-store case), compensation (the hard fallback). Roll forward by default; roll back only when forced.
7. **Atomicity is not isolation.** A saga gives you A/C/D but not I. Build isolation with semantic locks, or with immutable artifacts plus a single atomic pivot.
8. **Never turn `Canceled` into `Faulted`.** Catch `OperationCanceledException` first, rethrow it unchanged, wrap only genuine faults. The default action for cancellation is to not catch it at all.
9. **Sever the mutating core from the request token** when the operation must complete — `RequestAborted` above the point of no return, `CancellationToken.None` below it.
10. **Uncancellable is not durable.** `None` survives a disconnect, not a crash. If correctness must survive process death, you need a durability pattern, not just an uncancellable call.
11. **Nothing simple-looking is atomic by default.** `i = i + 10` is a read-modify-write. Atomicity is a hardware primitive surfaced by `Interlocked`, `lock`, and concurrent collections — not by brevity, and not by `volatile`.

These are not aspirational. They are the baseline that separates a system that is correct from one that merely looks correct in the happy path and in single-threaded tests.

---

*— End of Document —*
