# Await, Threads, and Context: What Actually Executes Your Code

*From the `await` Keyword to the Kernel and Back*

**Internal Learning Material for the .NET Team**
Thread Pool • IOCP / epoll • State Machines • SynchronizationContext • ExecutionContext • Work Stealing

---

## Table of Contents

*This document is organized into four parts. Parts 1–2 are conceptual and framework-agnostic. Part 3 is the .NET deep dive and is the core of the document. Part 4 is the concrete toolbox. It is the mechanism underneath Article 006 §16 ("`await` Frees the Thread, Not the Caller") — that section established what `await` does and does not buy you; this document establishes how.*

**Part 1 — The Problem: Waiting Is Not Working**

1. Two Costs of Waiting, and Only One of Them Is Yours
2. The Thread Is the Only Unit the OS Schedules
3. Thread-Per-Request and Exactly Where It Breaks
4. The Intents That Send People to Async — and the One That Doesn't
5. The Question to Ask First: "What Is This Thread Waiting For?"

**Part 2 — Solutions in Platform-Neutral Form**

6. Every Solution Has the Same Shape: A Queue, a Loop, and a Continuation
7. Readiness and Completion: The Two Kernel Models
8. Four Ways a Runtime Can Resume Suspended Work
9. How Other Platforms Chose
10. Cooperative Scheduling and Its One Fatal Property
11. The Trade .NET Made, Stated Plainly

**Part 3 — .NET Specifics: From `await` to the Kernel and Back**

12. The One Object Everything Hangs Off
13. What "Registering a Continuation" Physically Is
14. Handing Work to the OS: Windows and IOCP
15. Handing Work to the OS: Linux and epoll
16. Where There Is No OS Async At All
17. Who Calls `MoveNext`, and On Which Thread
18. The Thread Pool Is a Queue and a Loop
19. Work Stealing: Why Local Is LIFO and Theft Is FIFO
20. Thread Injection, and the Shape of Starvation
21. `ExecutionContext` Is Not `SynchronizationContext`
22. What `SynchronizationContext` Actually Is
23. Message Pumps: The Other Queue Entirely
24. The Deadlock, Mechanically
25. `async void`: Where the Exception Physically Goes
26. What Keeps the Whole Thing Running

**Part 4 — The .NET Toolbox**

27. `ConfigureAwait`: What It Actually Waives
28. `TaskCompletionSource` and the Inline-Continuation Hazard
29. `ValueTask` and `IValueTaskSource`
30. Sync-over-Async: The Costs, Enumerated
31. `SetMinThreads` Is a Tourniquet, Not a Fix
32. Fire-and-Forget That Isn't `async void`
33. Diagnosing It: The Two Signatures
34. Analyzers Worth Enforcing
35. A Decision Path

**Appendix A — Experiments Worth Running**

---

# Part 1 — The Problem: Waiting Is Not Working

Before any discussion of state machines, completion ports, or contexts, it is worth being precise about what problem this machinery exists to solve. It is not "make code faster." Nothing in this document makes a single operation faster. It is about what a **process** does with itself while an operation it cannot influence is in progress.

## 1. Two Costs of Waiting, and Only One of Them Is Yours

When your code calls out to a database and waits 4 milliseconds for an answer, two entirely separate costs are incurred, and conflating them is the root of most confusion in this area.

| Cost | Who pays | Can you avoid it? |
|---|---|---|
| **The latency** — 4 ms will elapse before you can proceed | The logical operation | **No.** The database takes what it takes. |
| **The resource held during those 4 ms** — a thread, its stack, its scheduler slot | The process | **Yes.** This is the entire subject of this document. |

Async programming does nothing whatsoever about the first cost. Article 006 §16 made this point from the coupling angle: `await` frees the thread, not the caller. Here it is from the resource angle — `await` is a claim about **the second column only**.

This is why "make it async to speed it up" is a category error, and why a single-user load test of an async endpoint shows no improvement at all — often a slight regression, because you added state machine allocations and scheduling hops to a path that was never contended. The benefit is invisible until the resource being conserved becomes scarce.

> ⚠ *Async is not a latency optimization. It is a concurrency-density optimization. If your bottleneck is one slow query with one user waiting, async changes nothing except your allocation profile. Measure under concurrency or do not measure at all.*

## 2. The Thread Is the Only Unit the OS Schedules

Strip away every abstraction and a thread is four things: a **stack** (a reserved range of virtual address space, typically 1 MB on Windows, several MB on Linux, committed lazily), a saved **register context** (instruction pointer, stack pointer, general and vector registers), a **thread-local storage block**, and **scheduling metadata** (priority, affinity, state, accumulated quantum).

That is the whole object. A thread is *a saved place in a program, plus a stack to put frames on*.

Every thread in the system is, at any instant, in exactly one of three states:

```
    ┌─────────┐   scheduler selects it   ┌─────────┐
    │  READY  │ ───────────────────────► │ RUNNING │
    │ (queue) │ ◄─────────────────────── │         │
    └─────────┘   quantum expired, or    └─────────┘
         ▲        preempted                    │
         │                                     │  wait on a kernel object:
         │  the object it waited on            │  WaitForSingleObject / futex /
         │  was signalled                      │  blocking read() / lock contention
         │                                     ▼
         │                               ┌─────────┐
         └────────────────────────────── │ WAITING │
                                         └─────────┘
```

Three consequences follow immediately, and they explain nearly everything downstream:

- **Only `CoreCount` threads are RUNNING at any instant.** Everything else is READY or WAITING. Creating more threads never creates more CPU.
- **A WAITING thread costs zero CPU** but still holds its stack, its kernel structures, and its scheduler bookkeeping. It is cheap to have one and expensive to have thousands.
- **A context switch is not free.** Roughly 1–2 µs of direct cost, plus a substantially larger indirect cost from cold L1/L2 caches and TLB misses. At high switch rates the indirect cost dominates completely.

## 3. Thread-Per-Request and Exactly Where It Breaks

The simplest possible server design assigns one thread per in-flight request. The thread runs the handler top to bottom, blocking whenever it needs something, and is returned to a pool at the end. It is easy to reason about, debuggers show a complete stack, and thread-local state works.

It breaks for one reason: **the cost of a waiting request is one thread**, and threads are expensive in a way that scales badly.

| Concurrent in-flight requests | Threads needed (blocking model) | Address space for stacks | Context switches under load |
|---|---|---|---|
| 100 | 100 | ~100 MB reserved | fine |
| 1,000 | 1,000 | ~1 GB reserved | degrading |
| 10,000 | 10,000 | ~10 GB reserved | pathological |

But raw memory is the less interesting limit. The sharper one is **scheduler behaviour**: with 10,000 runnable-ish threads on 8 cores, the scheduler spends an increasing fraction of the machine deciding what to run, and each thread's working set is evicted from cache between its slices. Throughput does not plateau — it *declines*.

The critical observation is that in an I/O-bound service, almost all of those threads are in WAITING, doing nothing, holding a megabyte each, purely to remember a position in a program. **We are using a very expensive OS primitive as a bookmark.**

Async's entire proposition is: store that bookmark in something cheaper. A hundred bytes of heap, not a megabyte of stack.

> ✓ *Mental model: a blocking design pays for "a place in the program" with an OS thread. An async design pays for it with a heap object. Same information, three to four orders of magnitude apart in cost. Everything in Part 3 is the machinery for making a heap object work as well as a stack did.*

## 4. The Intents That Send People to Async — and the One That Doesn't

As with Article 006's five decoupling intents, the machinery only makes sense once you name what you actually want. There are four legitimate intents and one very common illegitimate one.

| Intent | What you actually want | Is async the answer? |
|---|---|---|
| **Concurrency density** | Serve N concurrent I/O-bound operations with far fewer than N threads | **Yes.** This is the core case. |
| **Responsiveness** | Never block a thread that must stay available (a UI thread, a message pump, a health endpoint) | **Yes**, but the mechanism is affinity, not density. |
| **Composability of waits** | `WhenAll`, `WhenAny`, timeouts, cancellation over multiple operations | **Yes.** Genuinely hard with raw threads. |
| **Backpressure-aware pipelines** | Producers and consumers that can suspend | **Yes** — see Article 006 §24 on Channels. |
| **Throughput of CPU-bound work** | Compute a thing faster using more cores | **No.** You want parallelism (`Parallel.For`, PLINQ, partitioning). |

The last row is the persistent confusion. `await` does not add cores and does not make computation concurrent. Wrapping CPU work in `Task.Run` and awaiting it moves the work to another thread — useful for keeping a UI responsive, useless for throughput on a server, where the thread pool was already the thing running your request.

> ⚠ *`async` and `parallel` solve different problems and share a vocabulary. Async is about not occupying a thread while waiting for something else to happen. Parallelism is about occupying several threads to make something happen faster. On a server, `Task.Run(() => Compute())` inside a request handler almost always makes things worse: same total CPU, one extra scheduling hop, one extra allocation, and thread pool queue pressure.*

## 5. The Question to Ask First: "What Is This Thread Waiting For?"

Before reaching for any mechanism, answer this per operation:

> **What is this thread waiting for, and can it be waited on without a thread?**

The answer sorts every wait into one of four buckets, and the bucket determines everything that follows.

| The thread is waiting for... | Bucket | Correct handling |
|---|---|---|
| An external I/O completion (network, disk, DB) | **Kernel-notifiable** | True async. No thread should be held. |
| A timer to elapse | **Kernel-notifiable** | True async (`Task.Delay`). No thread. |
| Another thread in this process to produce something | **In-process signal** | Async via `TaskCompletionSource` / `Channel` — still no thread. |
| A CPU to finish a computation | **Not a wait at all** | A thread is *correct*. Parallelism, not async. |

The first three all reduce to the same shape: *something else will eventually happen, and we need a way to be told, without standing here.* That shape is the whole of Part 2.

The fourth is the case where holding a thread is not waste — it is the point. A thread doing arithmetic is a thread doing its job.

---

# Part 2 — Solutions in Platform-Neutral Form

Every runtime that solves this problem — .NET, Node, Go, the JVM, Rust, Erlang — solves it with the same three ingredients arranged differently. Recognizing the common shape makes the .NET specifics in Part 3 read as one point in a design space rather than as arbitrary complexity.

## 6. Every Solution Has the Same Shape: A Queue, a Loop, and a Continuation

The universal pattern, in three parts:

**A continuation.** A representation of "the rest of the work," small enough to store cheaply and complete enough to resume from. It must capture where you were and every local you still need. This is the bookmark from §3.

**A queue.** Somewhere to put continuations that are ready to run. Not a scheduler, not a manager — a container.

**A loop.** One or more threads whose entire existence is: take an item from the queue, run it to completion, repeat. Forever.

```
             ┌──────────────────────────────────────────┐
             │                 QUEUE                    │
             │   [cont] [cont] [cont] [cont] ...        │
             └───▲──────────────────────────────┬───────┘
                 │                              │
      enqueued by│                              │dequeued by
                 │                              ▼
   ┌─────────────┴──────────┐        ┌──────────────────────┐
   │  whoever finished the  │        │   worker thread:     │
   │  thing being waited on │        │   while(true) {      │
   │  (I/O layer, timer,    │        │     item = Dequeue();│
   │   another thread)      │        │     item.Run();      │  ◄── your code
   └────────────────────────┘        │   }                  │
                                     └──────────────────────┘
```

That is the entire architecture. Everything in Part 3 is a specific choice of what the continuation object is, what the queue is, who drains it, and how a drainer is woken.

The crucial property: **there is no coordinator.** No component decides who runs what. A worker's habit *is* the loop; enqueuing is done by whoever happens to be finishing something. The system's behaviour is emergent, not directed.

> ✓ *If you can identify, for any given piece of running code, (a) which queue it came from, (b) which loop is running it, and (c) what enqueued it — you can answer every "why is this running here / not running at all" question in .NET. Part 3 is a catalogue of the queues.*

## 7. Readiness and Completion: The Two Kernel Models

At the boundary with the OS there are exactly two models for "tell me when I can proceed," and the difference propagates all the way up into observable behaviour.

**Readiness (`select`, `poll`, `epoll`, `kqueue`).** The kernel tells you *"this file descriptor will not block if you read it now."* You then perform the read yourself. Two steps: notification, then work. The data is copied when you ask for it.

**Completion (IOCP, io_uring, POSIX AIO).** You hand the kernel a buffer and an operation up front. The kernel performs the whole operation and tells you *"here is your data, it is already in your buffer."* One step. The data is copied before you are notified.

| | Readiness | Completion |
|---|---|---|
| Notification means | "you may now act" | "it is already done" |
| Buffer supplied | at read time | at submit time |
| Buffer pinned during wait | no | **yes, necessarily** |
| Syscalls per operation | ≥2 (wait + read) | 1 (+ amortized dequeue) |
| Works for regular files | **no** (files are always "ready") | yes |
| Natural fit for `await` | requires an emulation layer | direct |

The last two rows matter more than they look. Readiness models cannot express asynchronous *file* I/O at all, because a regular file is always readable — `epoll` will tell you "ready" instantly and the read will still block on the disk. This is why async file I/O on Linux has historically been a lie (see §16).

And "natural fit for `await`" is why .NET's Windows and Linux socket stacks look structurally different despite presenting an identical API.

## 8. Four Ways a Runtime Can Resume Suspended Work

Given the shape in §6, there are four ways to build the continuation. They are genuinely different trade-offs, not implementation details.

**(1) Explicit callbacks.** You write the continuation yourself as a lambda. Simple runtime, no compiler support, no magic. The cost is entirely on the developer: sequencing becomes nesting, error handling has to be manually threaded to every level, and loops become recursion. This is Node's original design and .NET's APM/EAP patterns (`BeginRead`/`EndRead`).

**(2) Fibers / green threads / stackful coroutines.** The runtime gives each logical operation a small, growable stack and switches between them in user space. Code looks fully synchronous; the runtime relocates stacks behind your back. Cheap (kilobytes, not megabytes) and no language changes needed. The cost: stack switching interacts very badly with native interop (a native frame cannot be moved), with thread-local state, and with debuggers and profilers that assume OS stacks.

**(3) A single-threaded event loop.** One thread, one queue, no concurrency at all within user code. Eliminates data races by construction. The cost is equally structural: one blocking or CPU-heavy operation stalls the entire process, and you cannot use more than one core without separate processes.

**(4) Compiler-generated state machines (stackless coroutines / CPS).** The compiler rewrites each async method into an object with an integer state field and hoisted locals. Code looks synchronous; the "stack" for a suspended operation becomes a chain of small heap objects. No stack relocation, so interop and tooling are unaffected. The costs: it is *viral* (async in the leaf forces async up the call chain), it needs real language support, and the physical call stack at a breakpoint no longer shows the logical caller.

| Approach | Code reads as | Cost of a pending op | Interop-safe | Multi-core | Viral |
|---|---|---|---|---|---|
| Callbacks | nested | one closure | yes | yes | yes (worse) |
| Fibers / green threads | linear | a small growable stack | **no** | yes | no |
| Event loop | callbacks or await | one closure | yes | **no** | yes |
| State machines | linear | one heap object | yes | yes | yes |

## 9. How Other Platforms Chose

Worth knowing, because it tells you which of .NET's properties are essential and which are choices.

| Platform | Model | Notable consequence |
|---|---|---|
| **Node.js** | single-threaded event loop, libuv over epoll/IOCP | No data races in user code; one CPU-bound function freezes everything; scaling means more processes |
| **Go** | goroutines: green threads, M:N over OS threads, runtime-scheduled | Blocking code is fine — the runtime detects a blocked goroutine and re-parks the OS thread. No function colouring, no `async` keyword. Price: a custom scheduler, growable stacks, and painful CGo interop |
| **Java (Loom, 21+)** | virtual threads: green threads that unmount on blocking calls | Retrofits the entire blocking `java.io` ecosystem without rewriting it — the biggest advantage of the stackful approach. Pinning problems inside `synchronized` blocks and native frames |
| **Rust** | stackless state machines, `Future` polled by an external executor | Zero-cost, no allocation required, but the runtime is not in the language — you choose tokio/async-std, and executors are not interchangeable |
| **.NET** | stackless state machines + a work-stealing multi-threaded pool | Multi-core by default, interop-safe, tooling-safe. Price: function colouring, `SynchronizationContext` complexity, and real deadlock hazards |

Note that Go and Java chose (2) and .NET and Rust chose (4), and the deciding factor in both directions was **interop and ecosystem**. .NET has to support P/Invoke into arbitrary native code with arbitrary stack expectations; moving stacks was never available. Java's Loom could take the other path precisely because it accepted the pinning limitations native frames impose.

> ✓ *"Why can't .NET just do what Go does?" has a concrete answer, not an aesthetic one: goroutine stacks are relocatable, and a stack containing native frames from a P/Invoke is not. CoreCLR shipped fibers in .NET 2.0 and removed them; a green-threads experiment ran around .NET 7 and was abandoned for the same class of reasons.*

## 10. Cooperative Scheduling and Its One Fatal Property

The OS scheduler is **preemptive**: it can interrupt any thread at any instruction and give the core to another. You do not have to cooperate.

Every mechanism in §8 is **cooperative**: a continuation runs until it voluntarily yields (by returning, or by suspending at an `await`). Nothing can interrupt it.

Cooperative scheduling buys enormous efficiency — no register save/restore, no kernel transition, no cache eviction. A continuation switch can be a few nanoseconds against a context switch's microseconds. It costs exactly one thing, and that one thing is responsible for most async pathology:

> **A continuation that does not yield stops everything sharing its loop.**

The severity depends on how many loops there are:

| Environment | Loops | One non-yielding continuation causes |
|---|---|---|
| Node.js | 1 | the entire process freezes |
| .NET UI message pump | 1 | the UI freezes; the app appears hung |
| .NET thread pool | ~ProcessorCount | one worker is lost; degradation, then starvation as more are lost |

This is the mechanical root of everything in §20 (starvation) and §24 (deadlock). Both are the same phenomenon at different scales: *a loop stopped draining its queue.*

## 11. The Trade .NET Made, Stated Plainly

Pulling Part 2 together, .NET's position in the design space is:

- **Stackless state machines** (interop-safe, tooling-safe, viral, requires language support).
- **A multi-threaded work-stealing pool**, not a single event loop (multi-core by default; user code is genuinely concurrent, so you own your own synchronization).
- **Completion-based I/O where the OS offers it** (Windows), **readiness-based with an emulation layer where it does not** (Linux).
- **An optional per-environment scheduling hook** (`SynchronizationContext`) so libraries can be written once and still resume correctly in a UI, a request, or a console.

Everything difficult about async in .NET is downstream of the second and fourth bullets. The second means you can have races. The fourth means you can have deadlocks. Neither exists in the Node model — which is also why the Node model cannot use your other seven cores.

---

# Part 3 — .NET Specifics: From `await` to the Kernel and Back

Now the mechanism. This part assumes the compiler transform is familiar — `[AsyncStateMachine]`, the `MoveNext` switch, hoisted locals, the builder — and Article 006 §16 covered it at the level needed there. What follows starts one layer below that and goes down to the kernel, then back up to the thread that runs your next line.

## 12. The One Object Everything Hangs Off

In release builds the generated state machine is a `struct`, living on the caller's stack. It stays there for as long as the method never suspends — which is the common case for a cached or already-completed operation, and is why a non-suspending async method can allocate nothing at all.

On the **first suspension**, `AwaitUnsafeOnCompleted` boxes it. Not into a plain `object`:

```csharp
// System.Runtime.CompilerServices.AsyncTaskMethodBuilder<TResult>
private sealed class AsyncStateMachineBox<TStateMachine> :
    Task<TResult>,                 // it IS the Task you returned
    IAsyncStateMachineBox,         // it holds the state machine
    IThreadPoolWorkItem            // it can be queued to the pool directly
    where TStateMachine : IAsyncStateMachine
{
    public TStateMachine StateMachine;   // your hoisted locals live in here
    public ExecutionContext? Context;
    private Action? _moveNextAction;     // cached; allocated at most once
}
```

One allocation is simultaneously **the returned `Task`**, **the continuation object**, **the thread pool work item**, and **the storage for your locals**.

This is the central design trick of modern .NET async, and it is worth appreciating how much it changed. In .NET Framework the same suspension cost four allocations: a `Task`, a boxed state machine, a `MoveNextRunner`, and an `Action` delegate. Today a suspending async method costs **one object**; a non-suspending one costs **zero**.

The practical consequence: the cost of "one operation in flight" is roughly *the size of your hoisted locals plus a Task header* — on the order of 100 bytes. Against a 1 MB thread stack, that is the four orders of magnitude promised in §3, and it is the entire reason ASP.NET Core holds tens of thousands of concurrent requests on a handful of threads.

For the rest of Part 3, "the box" means this object. The recurring question at every layer is: **who holds a reference to the box, and who eventually calls `MoveNext` on it, on which thread?**

## 13. What "Registering a Continuation" Physically Is

```csharp
var awaiter = task.GetAwaiter();
if (!awaiter.IsCompleted)
{
    _state = 0;
    _awaiter = awaiter;
    _builder.AwaitUnsafeOnCompleted(ref awaiter, ref this);   // the only interesting line
    return;                                                   // MoveNext returns. The thread is free.
}
result = awaiter.GetResult();
```

`AwaitUnsafeOnCompleted` does two things: obtain the box (creating it on first suspension, refreshing `box.Context = ExecutionContext.Capture()`), and register it with the awaited thing.

For a `TaskAwaiter`, "register" means a single interlocked write into the awaited `Task`'s `m_continuationObject` field. That field is a small masterpiece of allocation avoidance:

| Field value | Meaning |
|---|---|
| `null` | nothing registered yet |
| a single continuation object | stored **directly** — no list allocated |
| `List<object>` | promoted only when a second continuation registers |
| `Task.s_taskCompletionSentinel` | the task already completed; the registrant must invoke immediately |

The `Interlocked.CompareExchange` on that field is the **entire** synchronization between "I am about to suspend" and "I just completed." There is no lock on the common path. (Article 005 §21 covered why a CAS is the right primitive here and what it costs — this is that machinery doing load-bearing work in the hottest path in the framework.)

After `MoveNext` returns, the situation on the heap is:

```
your thread:  unwound completely, back in the pool's dispatch loop. Gone.

heap:         box (state machine + captured ExecutionContext)
                ▲
                │ referenced by m_continuationObject
                │
              the awaited Task
                ▲
                │ referenced by
                │
              the I/O object that will eventually complete it
                ▲
                │ referenced by
                │
              a pinned native structure the kernel knows about
```

Nothing is blocked. Nothing is polling. The operation exists as a chain of heap references terminating in something the OS has a handle on. **That chain is the handover.**

## 14. Handing Work to the OS: Windows and IOCP

Windows offers true completion-based I/O. Take `Socket.ReceiveAsync`.

**Step 1 — bind the handle to a completion port, once per handle.** The first time a `SafeSocketHandle` is used asynchronously, .NET calls `ThreadPoolBoundHandle.BindHandle`, which P/Invokes `CreateIoCompletionPort` to associate the handle with the **process-wide completion port owned by the thread pool**. From then on, every completed overlapped operation on that handle produces a completion packet on that port. Once per handle, not per operation.

**Step 2 — prepare a `NativeOverlapped`.** `SocketAsyncEventArgs` holds a `PreAllocatedOverlapped`, reused for its lifetime. Each operation allocates a `NativeOverlapped*` from it, which pins the user buffer and creates a `GCHandle` to the managed state.

**That pointer is the identity token.** It is the only thing that comes back from the kernel, and it is how a raw completion packet is turned back into a managed object graph. This is also why the buffer must be pinned: the kernel will write into it at a time when the GC could otherwise have moved it.

**Step 3 — the syscall.**

```csharp
Interop.Winsock.WSARecv(handle, buffers, count, out transferred, ref flags, overlapped, null);
// → SOCKET_ERROR / WSA_IO_PENDING
```

The managed thread returns immediately. The kernel now owns an IRP referencing the pinned buffer and the `OVERLAPPED`.

**At this instant, zero threads exist for this operation.** Not a blocked thread, not a polling thread — none. The operation is an IRP in the kernel and a pinned struct in your heap.

The return path:

```
NIC receives frame
  → DMA into the RX ring buffer
  → hardware interrupt → ISR schedules a DPC
  → DPC runs the NDIS / TCP-IP stack
  → data lands in the socket's receive buffer
  → afd.sys completes the pending IRP, copying into YOUR buffer (hence the pinning)
  → the I/O Manager posts a completion packet {overlapped*, bytes, status} to the port
  ─────────────────── kernel / user boundary ───────────────────
  → an I/O thread blocked in GetQueuedCompletionStatusEx returns
  → .NET maps overlapped* → GCHandle → the SocketAsyncEventArgs
  → the IOCompletionCallback runs
  → the SAEA completes its IValueTaskSource → invokes the stored continuation
  → box.MoveNext() → your code resumes after the await
```

Two properties deserve emphasis.

**The dequeue side is O(I/O threads), not O(pending operations).** A handful of threads service an unbounded number of in-flight operations. That is the entire point of the completion-port design.

**Those I/O threads must not run your code.** If a continuation ran on an I/O thread and blocked, completion dequeuing would stall for every socket in the process. So the socket layer defaults to `RunContinuationsAsynchronously`: the completion callback queues the box (which *is* an `IThreadPoolWorkItem`) to the worker pool rather than invoking it inline. There is an opt-out — `Socket.PreferInlineCompletions` / `DOTNET_SYSTEM_NET_SOCKETS_INLINE_COMPLETIONS` — trading safety for a real latency win when continuations are tiny and provably non-blocking.

> ⚠ *Implementation-detail caveat: whether the I/O threads come from the Win32 thread pool or .NET's own portable pool has changed across .NET 6–9 (`DOTNET_ThreadPool_UsePortableThreadPoolForIO`). The shape above is stable; the thread ownership is not. Do not build anything that depends on which pool a completion callback arrives on.*

## 15. Handing Work to the OS: Linux and epoll

Linux sockets are readiness-based (§7), so .NET must construct the completion illusion itself. The component is `System.Net.Sockets.SocketAsyncEngine`.

On first async socket use, N engines are created (N defaults to `Environment.ProcessorCount`, overridable via `DOTNET_SYSTEM_NET_SOCKETS_THREAD_COUNT`). Each engine creates an `epoll` instance and starts **one dedicated thread** running an event loop. That thread is deliberately *not* a pool thread — it blocks forever in `epoll_wait`, and a pool thread that never returns would be a leak. Each socket is set `O_NONBLOCK` and registered edge-triggered, with its `SocketAsyncContext` as the epoll user data.

```
your code: ReceiveAsync
  → SocketAsyncContext attempts recv() OPTIMISTICALLY, right now, on your thread
     ├─ success → the ValueTask completes synchronously; no suspension at all
     └─ EAGAIN → enqueue an AsyncOperation into the context's receive queue; return incomplete
  ...
NIC → softirq → TCP stack → the socket's receive queue becomes non-empty
  → epoll_wait returns in the engine thread
  → the engine maps the event back to the SocketAsyncContext
  → the pending AsyncOperation is dispatched (by default, to the thread pool)
  → on that thread, recv() is finally called for real          ◄── THE DIFFERENCE
  → the operation completes → continuation → box.MoveNext()
```

| | Windows (IOCP) | Linux (epoll) |
|---|---|---|
| Model | completion | readiness |
| Who copies the data | the kernel, before you are notified | you, after you are notified |
| Buffer pinned during the wait | **yes** | no |
| Dedicated waiting threads | I/O threads on a shared port | one per engine, in `epoll_wait` |
| Syscalls per operation | 1 (+ amortized dequeue) | 1 optimistic + 1 real (+ dequeue) |
| Optimistic inline attempt | no (the `WSARecv` *is* the attempt) | **yes, explicitly** |

That optimistic `recv()` on the calling thread is worth noticing: on a hot socket it succeeds, the `ValueTask` completes synchronously, and no state machine box is ever allocated. Under sustained load on Linux, a substantial fraction of "async" socket reads never suspend at all.

Note also that Linux does have permanently blocked threads here — but O(cores) of them, shared by every socket in the process. The "no thread per operation" property holds.

> ✓ *`io_uring` is Linux's completion-based answer and would collapse this asymmetry entirely. .NET has experimented with it; it is not the default socket path as of .NET 10. Worth tracking, not worth designing around.*

## 16. Where There Is No OS Async At All

Not every `await` reaches a completion port. Three categories matter operationally.

**Files on Unix.** `epoll` cannot express asynchronous file I/O (§7): a regular file is always "ready," and the read still blocks on the disk. POSIX AIO is not a viable general answer. So `FileStream.ReadAsync` on Linux is, in practice, a blocking `pread` executed on a thread pool thread, with per-stream serialization.

This is a genuine and under-appreciated portability trap. `await File.ReadAllTextAsync(path)`:

| | Windows (`FileOptions.Asynchronous`) | Linux |
|---|---|---|
| Mechanism | true overlapped I/O | blocking read on a pool thread |
| Threads held during the read | **0** | **1** |
| Contributes to pool starvation | no | **yes** |

A Windows service that reads many files concurrently and is then containerized onto Linux acquires a thread pool pressure profile it never had, with no code change and no error.

**Timers.** `Task.Delay` involves no I/O whatsoever. It creates a `TimerQueueTimer` in a `TimerQueue` (one per core), whose next-due-time is programmed into a native timer. When it fires, the callback completes the `Task`, the continuation is invoked, the box is queued to the pool. Same wake-up *shape*, entirely different source — a useful control case proving that the resumption mechanism is orthogonal to I/O.

**`TaskCompletionSource`.** The fully general case: another thread in your process calls `TrySetResult`. Same shape again.

The unifying statement, and the answer to "how does `await` talk to the OS":

> **`await` never talks to the OS. `await` talks to an awaiter.** The awaiter's job is to arrange for `MoveNext` to be called eventually, by whatever means it likes. IOCP, epoll, a timer, another thread, or nothing at all.

## 17. Who Calls `MoveNext`, and On Which Thread

The completion path, simplified but structurally accurate:

```csharp
// Task.FinishContinuations()
object? continuation = Interlocked.Exchange(ref m_continuationObject, s_taskCompletionSentinel);

if (continuation is IAsyncStateMachineBox box)
{
    ThreadPool.UnsafeQueueUserWorkItem(box, preferLocal: true);
    // ...or, when inlining is permitted and the stack is not too deep:
    // box.MoveNext();
}
else if (continuation is Action action) { ... }
else if (continuation is ITaskCompletionAction) { ... }
else if (continuation is List<object> list) { /* fan out */ }
```

And the box itself:

```csharp
void IThreadPoolWorkItem.Execute() => MoveNext(threadPoolWorkItem: this);

public void MoveNext(object? threadPoolWorkItem)
{
    ExecutionContext? context = Context;
    if (context is null)
        StateMachine.MoveNext();                                  // straight in
    else
        ExecutionContext.RunInternal(context, s_callback, this);  // restore AsyncLocals, then in
}
```

The resumption thread is decided by four questions, **evaluated at suspension time and applied at completion time**:

| # | Question (at suspension) | If yes, at completion |
|---|---|---|
| 1 | Did the awaiter capture a `SynchronizationContext`? (`ConfigureAwait(true)` and `Current != null`) | `context.Post(...)` — that context decides the thread (§22) |
| 2 | Otherwise, is `TaskScheduler.Current != TaskScheduler.Default`? | scheduled onto that `TaskScheduler` |
| 3 | Otherwise, is inlining permitted? | **runs synchronously on the completing thread** |
| 4 | Otherwise | queued to the pool, preferring the completing thread's local queue |

Case 3 is the one that bites, and it is not rare:

```csharp
var tcs = new TaskCompletionSource<int>();          // note: no RunContinuationsAsynchronously
_ = ConsumerAsync(tcs.Task);

lock (_gate)
{
    tcs.SetResult(42);   // the consumer's continuation may run RIGHT HERE, inline, under _gate
}
```

Arbitrary consumer code — possibly taking other locks, possibly blocking — executes on your thread, inside your lock. That is a lock-ordering deadlock waiting to happen and a reliable source of latency spikes in the producer. §28 covers the fix.

Note also what case 3 means for the "who wakes my code" question: sometimes *nobody schedules anything*. The thread that completed the operation simply keeps running, straight into your continuation. Stack-depth guards prevent unbounded recursion when a chain of continuations all complete synchronously.

## 18. The Thread Pool Is a Queue and a Loop

Where does that queued box actually go, and who takes it out?

The pool is not a manager. It is a set of queues and a set of threads each running one loop.

```csharp
internal sealed class ThreadPoolWorkQueue
{
    internal readonly ConcurrentQueue<object> workItems = new();   // global FIFO
    internal readonly WorkStealingQueueList _localQueues;          // one LIFO deque per worker
}
```

Enqueue:

```csharp
public void Enqueue(object callback, bool forceGlobal)
{
    ThreadPoolWorkQueueThreadLocals? tl = null;
    if (!forceGlobal)
        tl = ThreadPoolWorkQueueThreadLocals.threadLocals;   // null if not a pool thread

    if (tl != null) tl.workStealingQueue.LocalPush(callback); // no interlocked op in the fast path
    else            workItems.Enqueue(callback);

    EnsureThreadRequested();   // wake a worker, or create one
}
```

And the worker loop — this is where **all** of your code runs:

```csharp
// ThreadPoolWorkQueue.Dispatch(), heavily simplified
while (true)
{
    object? workItem = workQueue.Dequeue(tl, ref missedSteal);
    if (workItem == null) return true;                 // nothing left → sleep on the semaphore

    // ─────────── YOUR CODE RUNS HERE ───────────
    if (workItem is Task task) task.ExecuteFromThreadPool(currentThread);
    else Unsafe.As<IThreadPoolWorkItem>(workItem).Execute();
    // ───────────────────────────────────────────

    currentThread.ResetThreadPoolThread();   // clear SynchronizationContext, ExecutionContext,
                                             // name, priority, culture — user code may have dirtied them
    if (Environment.TickCount64 - startTicks >= DispatchQuantumMs)   // 30 ms
    {
        workQueue.EnsureThreadRequested();
        return true;                          // hand the thread back so the pool can rebalance
    }
}
```

Idle workers do not spin and do not `Sleep`. They block on a `LowLevelLifoSemaphore`:

```csharp
while (true)
{
    while (TakeActiveRequest()) Dispatch();
    if (!s_semaphore.Wait(ThreadPoolThreadTimeoutMs))   // 20 seconds
        if (TryRemoveWorkingWorker()) return;           // timed out with no work → the thread exits
}
```

Two design choices are worth understanding.

**LIFO semaphore.** The most recently blocked worker is released first — its stack pages are resident and its caches are warm. The corollary is the useful part: workers at the *bottom* of the LIFO stack are never woken, so they hit the 20-second timeout and retire. **The pool shrinks itself with no shrinking logic.**

**Spin before block.** Blocking and unblocking costs a syscall pair and a context switch. If work is likely within a microsecond, spinning wins outright.

So the complete mechanism by which a `Task.Run` body reaches a CPU is: `Enqueue` → `EnsureThreadRequested` → `semaphore.Release(1)` → the kernel moves a waiting thread to READY → the scheduler runs it → it returns from `Wait()` → `Dispatch()` → `Execute()` → **your code**.

A useful reflex follows: put a breakpoint anywhere in a controller action and read the **bottom** of the call stack. You will find `ThreadPoolWorkQueue.Dispatch` and `WorkerThread.WorkerThreadStart`. Every time.

## 19. Work Stealing: Why Local Is LIFO and Theft Is FIFO

```csharp
object? Dequeue(ThreadPoolWorkQueueThreadLocals tl, ref bool missedSteal)
{
    object? workItem = tl.workStealingQueue.LocalPop();          // 1. mine, LIFO
    if (workItem == null) workItems.TryDequeue(out workItem);    // 2. global, FIFO
    if (workItem == null)                                        // 3. steal, FIFO, random start
        foreach (var other in _localQueues.Queues)
            if (other != tl.workStealingQueue && other.TrySteal(out workItem, ref missedSteal))
                break;
    return workItem;
}
```

The orderings are not arbitrary.

**Local is LIFO** because if a pool thread queues work, that work almost certainly touches data the current thread just touched — hot in L1/L2. Popping the most recent item maximizes that locality. And `LocalPush`/`LocalPop` by the owner need no interlocked operation in the fast path. This is why `preferLocal: true` is the default for `await` continuations.

**Global is FIFO** for fairness to work arriving from outside the pool — an IOCP completion, a timer, your main thread calling `Task.Run`.

**Theft takes from the opposite end** of the victim's deque. The owner pops the newest (hottest); the thief takes the oldest (coldest, and least likely to be popped next by the owner). This simultaneously preserves locality and minimizes contention on the deque, since the two parties operate on ends that are usually far apart.

> ✓ *This is why "the thread pool" behaves differently depending on who queued the work. Work queued from inside a pool thread goes to a private LIFO deque and is likely to run on the same core with warm caches; work queued from outside goes to a shared FIFO queue. Same API, materially different scheduling.*

## 20. Thread Injection, and the Shape of Starvation

`MinThreads` defaults to `Environment.ProcessorCount` for workers. `MaxThreads` defaults absurdly high (~32767).

- **Below `MinThreads`:** a thread is created **immediately** on demand — and, notably, *by the enqueueing thread itself*, in your call stack.
- **Above `MinThreads`:** injection is governed by a **hill-climbing** controller that samples completed-work-items-per-unit-time, perturbs the thread count, and keeps changes that improve throughput. It adds threads slowly — on the order of one or two per second — supplemented by a heuristic that detects threads blocked in known-blocking APIs.

The slowness is deliberate. If the workload is CPU-bound, adding threads *reduces* throughput (§2), and the controller must measure to know which regime it is in.

There is one small exception to "the pool has no manager": the **gate thread**, which wakes roughly twice a second while the pool is active, never touches a work item, and exists purely to run the hill-climbing sampling and to detect the pathology of "the queue is growing but nothing is completing."

Now combine slow injection with a blocked worker:

```csharp
public IActionResult Get()
{
    var data = _service.GetDataAsync().Result;   // blocks a pool thread
    return Ok(data);
}
```

On 8 cores under load: all 8 workers block. New requests queue. The pool injects one thread per second. With 200 queued requests you are looking at minutes of latency for millisecond work — **at approximately 0% CPU**.

That signature is diagnostic and worth memorizing:

| Observed | Diagnosis |
|---|---|
| `threadpool-queue-length` rising, **CPU low** | starvation — something is blocking pool threads |
| `threadpool-queue-length` rising, **CPU high** | you are genuinely saturated; add capacity or optimize |

There is a nastier recursive form. `.Result` blocks a worker waiting on a `Task` whose continuation is queued **to that same pool**. If every worker is blocked this way, the continuations can never run, and injection is the only escape — which is why the symptom is a multi-minute stall that eventually, maddeningly, resolves. This is Article 006 §21's sync-over-async coupling, expressed as a resource deadlock.

> ⚠ *Thread pool starvation is not "the pool is too small." It is "work items are being held by threads that are not making progress." Raising `MinThreads` treats the symptom; the cause is always a blocking call on a pool thread, and it is almost always `.Result`, `.Wait()`, `.GetAwaiter().GetResult()`, or a synchronous file/DB API in an async path.*

## 21. `ExecutionContext` Is Not `SynchronizationContext`

These two are constantly conflated. Separating them is a prerequisite for §22.

| | `ExecutionContext` | `SynchronizationContext` |
|---|---|---|
| Answers | **what ambient state** travels with the logical flow | **where** the continuation runs |
| Carries | `AsyncLocal<T>` values, security context | a scheduling strategy |
| Flowed by | almost everything: `await`, `Task.Run`, `QueueUserWorkItem`, `Timer`, `new Thread` | **nothing implicitly** — captured only by awaiters |
| Suppressed by | `ExecutionContext.SuppressFlow()`, `Unsafe*` APIs | `ConfigureAwait(false)` |
| Affected by `ConfigureAwait(false)` | **no** — AsyncLocals still flow | yes — that is its entire job |
| Stored in | `Thread.CurrentThread._executionContext` | `Thread.CurrentThread._synchronizationContext` |
| Immutable | yes (copy-on-write) | no |

In .NET Framework, `SynchronizationContext` was a member of `ExecutionContext` and flowed with it. **In .NET Core they were deliberately separated** — `ExecutionContext.Run` does not restore a `SynchronizationContext`. That was a real behavioural break and a correct one: ambient data and scheduling are different concerns, and fusing them caused surprising context leaks.

The consequence to internalize:

```csharp
_correlationId.Value = "abc";                       // AsyncLocal<string>
await SomethingAsync().ConfigureAwait(false);
Console.WriteLine(_correlationId.Value);            // "abc" — still there
```

`ConfigureAwait(false)` does not lose your correlation ID, your logging scope, or your `Activity`. It only waives the scheduling hop. This is worth stating explicitly to any team member who believes otherwise, because the belief leads directly to *not* using `ConfigureAwait(false)` in library code for a reason that does not exist.

This is also why `[ThreadStatic]` is broken in ASP.NET Core and `AsyncLocal<T>` is not: a request is served by several different threads over its lifetime (§17), and the ambient state rides on the box, not on any thread.

## 22. What `SynchronizationContext` Actually Is

Strip away the mythology and it is this:

```csharp
public class SynchronizationContext
{
    public virtual void Post(SendOrPostCallback d, object? state)   // fire-and-forget
        => ThreadPool.QueueUserWorkItem(s => d(s), state);

    public virtual void Send(SendOrPostCallback d, object? state)   // synchronous, blocking
        => d(state);

    public virtual void OperationStarted()   { }
    public virtual void OperationCompleted() { }

    public static SynchronizationContext? Current { get; }   // Thread.CurrentThread._synchronizationContext
    public static void SetSynchronizationContext(SynchronizationContext? sc);
}
```

That is essentially the whole type. Note what is **not** there: no queue, no threads, no `Dequeue`, no `Take`. The API is **write-only**.

This is the single most clarifying observation about it. A `SynchronizationContext` **owns no storage and drains nothing**. It is a *doorway* onto a queue that belongs to the environment; the queue, the threads, and the loop that drains it are all supplied by the host and are not part of the abstraction. Something entirely outside the type — `Application.Run`, `Dispatcher.PushFrame`, the pool's `Dispatch` — does the consuming.

The base class's own `Post` is identical to "just use the thread pool," which is why the framework treats it as equivalent to no context at all:

```csharp
// TaskAwaiter.OnCompletedInternal
if (continueOnCapturedContext)
{
    SynchronizationContext? sc = SynchronizationContext.Current;
    if (sc != null && sc.GetType() != typeof(SynchronizationContext))   // EXACT type check
        // → SynchronizationContextAwaitTaskContinuation, which will Post()
    else if (TaskScheduler.Current != TaskScheduler.Default)
        // → TaskSchedulerAwaitTaskContinuation
    else
        // → plain: inline or thread pool
}
```

Who installs the real ones:

| Host | Type | `Post` does | Affinity |
|---|---|---|---|
| WinForms | `WindowsFormsSynchronizationContext` | `Control.BeginInvoke` → window message | one specific thread |
| WPF | `DispatcherSynchronizationContext` | `Dispatcher.BeginInvoke` → priority queue | one specific thread |
| ASP.NET (System.Web) | `AspNetSynchronizationContext` | serializes onto *some* pool thread | **none** — serialization only |
| **ASP.NET Core** | **none — `Current` is `null`** | — | — |
| Console / worker service | none | — | — |
| Blazor Server | `RendererSynchronizationContext` | posts into the circuit's work queue | none — serialization per circuit |
| Blazor WASM | dispatcher over the browser's single thread | posts to the JS event loop | one thread; **cannot block** |
| xUnit | `AsyncTestSyncContext` / `MaxConcurrencySyncContext` | tracks pending `async void`, caps parallelism | none |

Classic ASP.NET is the instructive entry: it has **no dedicated thread at all**. Its jobs are serialization (one continuation at a time per request, so `HttpContext` is never touched concurrently) and *lifetime tracking* via `OperationStarted`/`OperationCompleted` so the pipeline does not finish while `async void` work is outstanding. Thread affinity is one policy among several, not the definition.

So the accurate summary, which is narrower than the folklore:

> **`SynchronizationContext` is a uniform way to hand a piece of work into a particular execution environment — used by `await` to resume your code in the environment it left.**

The "in the environment it left" is the load-bearing part. If you merely wanted work run *somewhere*, `ThreadPool.QueueUserWorkItem` already does that with less ceremony. The type exists so a library can `await` without knowing whether it is running in a UI app, a request, a Blazor circuit, or a console — and be resumed correctly in all four.

> ✓ *ASP.NET Core installs no context deliberately. This removes the deadlock class in §24 entirely, removes a `Post` per continuation, and lets any pool thread continue any request. It also means `ConfigureAwait(false)` is irrelevant for **correctness** in ASP.NET Core application code — the reason to still write it in **library** code is that you do not know your consumer is not WinForms or Blazor Server.*

## 23. Message Pumps: The Other Queue Entirely

There are two mechanisms in the .NET world that both look like "a queue of work," and they share nothing but the shape.

| | Thread pool work items | Win32 window messages |
|---|---|---|
| Queue lives in | managed memory (`ThreadPoolWorkQueue`) | the kernel (per-thread queue in `win32k.sys`) |
| Item is | a managed object / delegate | a struct `{hwnd, msg, wParam, lParam}` |
| Drained by | N pool workers, with stealing | exactly **one** thread — the HWND owner |
| Ordering | LIFO local / FIFO global | FIFO with priority classes |
| Used by | `Task`, `await`, `QueueUserWorkItem` | WinForms/WPF `SynchronizationContext.Post` |

A UI thread is also just a worker running a loop over a queue. Its loop is:

```c
MSG msg;
while (GetMessage(&msg, NULL, 0, 0) > 0)   // BLOCKS here when the queue is empty
{
    TranslateMessage(&msg);
    DispatchMessage(&msg);                  // → the target HWND's WndProc
}
```

And `Control.BeginInvoke`, conceptually:

```csharp
public IAsyncResult BeginInvoke(Delegate method, object?[]? args)
{
    var entry = new ThreadMethodEntry(method, args);
    lock (_threadCallbackList) _threadCallbackList.Enqueue(entry);   // (1) the actual work
    PostMessage(Handle, s_threadCallbackMessage, 0, 0);              // (2) a doorbell
    return entry;
}
```

**The message carries no payload.** The delegate is already in a managed list on the control; the window message exists purely to make `GetMessage` return so the pump gets a chance to drain that list. Knock and delivery are separate steps — and if the consumer were already awake and looping, the knock would not even be necessary.

WPF is the same idea with a better queue: `DispatcherOperation` objects in a **priority** queue (`Send > Normal > Background > ContextIdle > SystemIdle`), woken by a private window message. Priorities are how WPF defers low-priority work until the UI is idle.

The property that matters, from §10: **the pump is a cooperative scheduler.** Nothing preempts a message handler. A handler that runs for two seconds freezes the interface for two seconds; a handler that never returns freezes it permanently.

## 24. The Deadlock, Mechanically

Everything above makes the classic deadlock unremarkable.

```csharp
private void Button_Click(object sender, EventArgs e)
{
    var result = GetAsync().Result;             // blocks the UI thread
}

private async Task<string> GetAsync()
{
    var s = await _http.GetStringAsync(url);    // captures WindowsFormsSynchronizationContext
    return s.ToUpper();                         // needs the UI thread
}
```

```
UI thread:   Application.Run → GetMessage → DispatchMessage → WndProc → Button_Click
                                                                            │
                                                                       .Result → WaitForSingleObject
                                                                            │
                                                              *** the thread is now WAITING ***
                                                              *** it is NOT in GetMessage ***

I/O thread:  response arrives → Post → list.Enqueue(continuation); PostMessage(hwnd, …)
                                        │
                                   the message sits in the kernel queue forever,
                                   because nobody is calling GetMessage.
```

Nothing is broken, lost, or misrouted. The continuation was delivered correctly to the right queue. **The only consumer of that queue removed itself from the loop.** The `Task` never completes, so `.Result` never returns, so the pump never resumes.

The shape generalizes, and recognizing the shape is more valuable than memorizing the WinForms case:

> **A deadlock of this class requires (a) a queue with a restricted set of consumers, and (b) every consumer blocked on something that can only be produced by draining that queue.**

- **UI:** one consumer (the UI thread), blocked on a continuation queued to itself.
- **Thread pool (§20):** N consumers, all blocked on continuations queued to the pool.
- **Blazor Server circuit:** the circuit's serialized executor, blocked on work queued to itself.

Remove either condition and it disappears. ASP.NET Core removed (a) globally by installing no context. `ConfigureAwait(false)` removes (a) locally by routing the continuation to the pool instead. **Not blocking removes (b), and is the only fix that addresses the cause.**

> ⚠ *`ConfigureAwait(false)` is a mitigation for library authors who cannot control their callers. It is not a licence to block. A codebase that needs `ConfigureAwait(false)` in order not to deadlock has a sync-over-async call it has not found yet.*

## 25. `async void`: Where the Exception Physically Goes

The compiler selects the builder from the return type:

| Return type | Builder |
|---|---|
| `Task` / `Task<T>` | `AsyncTaskMethodBuilder[<T>]` |
| `ValueTask` / `ValueTask<T>` | `AsyncValueTaskMethodBuilder[<T>]` |
| `IAsyncEnumerable<T>` | `AsyncIteratorMethodBuilder` |
| custom | per `[AsyncMethodBuilder(...)]` |
| **`void`** | **`AsyncVoidMethodBuilder`** |

`AsyncVoidMethodBuilder` is about forty lines, and it is the whole story:

```csharp
public static AsyncVoidMethodBuilder Create()
{
    SynchronizationContext? sc = SynchronizationContext.Current;
    sc?.OperationStarted();                       // captured at METHOD ENTRY
    return new AsyncVoidMethodBuilder { _synchronizationContext = sc };
}

public void SetResult() => _synchronizationContext?.OperationCompleted();

public void SetException(Exception exception)
{
    if (_synchronizationContext != null)
    {
        try { AsyncMethodBuilderCore.ThrowAsync(exception, _synchronizationContext); }
        finally { _synchronizationContext.OperationCompleted(); }
    }
    else AsyncMethodBuilderCore.ThrowAsync(exception, targetContext: null);
}
```

```csharp
internal static void ThrowAsync(Exception exception, SynchronizationContext? targetContext)
{
    var edi = ExceptionDispatchInfo.Capture(exception);   // preserves the original stack trace

    if (targetContext != null)
    {
        try { targetContext.Post(static s => ((ExceptionDispatchInfo)s!).Throw(), edi); return; }
        catch (Exception postEx) { edi = ExceptionDispatchInfo.Capture(new AggregateException(exception, postEx)); }
    }
    ThreadPool.QueueUserWorkItem(static s => ((ExceptionDispatchInfo)s!).Throw(), edi);
}
```

So, precisely:

> **"Thrown on the SynchronizationContext"** means the exception is captured into an `ExceptionDispatchInfo`, wrapped in a delegate whose entire body is `.Throw()`, and `Post`ed to the context captured when the method *started*. It is rethrown later, on whatever thread that context schedules, from a stack frame unrelated to yours.
>
> **"Thrown on the thread pool"** means the same thing via `QueueUserWorkItem`, because there was no context to capture.

Per host:

| Host | Where it surfaces | Survivable? |
|---|---|---|
| WinForms | inside `Application.Run`'s dispatch loop → **`Application.ThreadException`** | yes, handler can log and continue |
| WPF | inside the dispatcher loop → **`Dispatcher.UnhandledException`** | yes, set `e.Handled = true` |
| Blazor Server | the circuit's queue → circuit-level unhandled error | **the circuit dies; the process survives** |
| Classic ASP.NET | associated with the request → `Application_Error` / 500 | yes |
| **ASP.NET Core, console, worker, timer callback** | a bare pool thread → `AppDomain.UnhandledException` (notification only) | **no — the process terminates** |

That last row is the operationally important one for our systems. **`async void` in ASP.NET Core takes down the entire worker process, not the request.** And the Blazor Server row is arguably worse in practice, because it is *quiet*: a killed circuit shows the user an error bar and produces no process-level alarm.

Why a `try/catch` around the call cannot help:

```csharp
try { FireAndForget(); }                 // async void
catch (Exception ex) { /* NEVER reached if the throw is after the first await */ }

async void FireAndForget()
{
    await Task.Delay(100);
    throw new InvalidOperationException("boom");
}
```

`FireAndForget()` returns at the first `await`. The `try` block completes and its frame is popped long before the exception exists. When it does exist, `SetException` runs on a continuation thread, `ThrowAsync` queues a delegate, and that delegate throws on a *third* thread with an unrelated stack. There is no stack relationship between the throw and your `catch`. This is not a limitation — the `catch` is simply not on the call stack any more.

Contrast with `async Task`, and note the perverse asymmetry:

| | `async void` | `async Task`, unobserved |
|---|---|---|
| Where the exception goes | rethrown on the captured SC, else the pool | stored in the `Task` |
| Catchable by the caller | **no** | yes, if awaited |
| If ignored | **process crash** (no SC) or a host handler | silent; `TaskScheduler.UnobservedTaskException` at GC |
| Timing | shortly after the fault, out of band | at an arbitrary later GC |

The fire-and-forget form is loud and fatal; the awaitable form is silent. Both are wrong defaults, in opposite directions. (Article 005 §14 established that a `Task` has three terminal states, and §15 that conflating `Canceled` with `Faulted` is a one-keystroke bug. `async void` has no terminal state at all — there is no `Task`, so there is nothing to inspect, nothing to await, and nothing to distinguish cancellation from failure. It discards the entire three-state model.)

`async void` appears wherever an async lambda is converted to a **`void`-returning delegate**, which is more often than people expect:

```csharp
list.ForEach(async x => await ProcessAsync(x));    // Action<T> → async void. Unordered, unobserved.
new Timer(async _ => await TickAsync(), …);        // TimerCallback → async void
Parallel.ForEach(items, async i => await X(i));    // Action<T> → async void; returns immediately.
                                                   //   Use Parallel.ForEachAsync.
button.Click += async (s, e) => await SaveAsync(); // EventHandler → async void — the legitimate case
Task.Run(async () => await WorkAsync());           // Func<Task> overload wins. FINE, not async void.
```

## 26. What Keeps the Whole Thing Running

A natural question after §18: what starts the pool, and what keeps it alive? The answer is more deflating than expected — **nothing does**. There is no startup routine and no supervisor.

**The queue builds itself on first use.** `ThreadPoolWorkQueue` is a static field; the CLR's lazy type initializer creates it the first time anything enqueues. A console app that never touches a `Task` never has a thread pool at all.

**Hiring is done by whoever is holding the work.** The last thing `Enqueue` does is check availability. Below `MinThreads`, *the enqueueing thread itself* creates the OS thread, synchronously, in your call stack. Your code hires the worker that will run your code.

**The loop is not a policy the worker follows — it is all the worker can do.** `WorkerThreadStart` *is* a `while(true)`. There is no other code the thread can reach. When the loop returns, the thread ends and the OS destroys it.

**Retirement is a timeout, not a decision.** §18's LIFO semaphore means bottom-of-stack workers are never woken, hit the 20-second timeout, and exit. Nobody decides to shrink the pool.

And the property that catches people out:

> **The thread pool does not keep the process alive.** Every pool thread is a background thread. A .NET process lives exactly as long as at least one *foreground* thread lives. When `Main` returns, the process exits immediately and every worker is killed mid-work — no unwinding, no `finally` blocks, no flushing.

This retroactively explains a pattern everyone writes without thinking about it. `await host.RunAsync()`, `Console.ReadLine()`, `Application.Run()` — these are not idioms. Each is **the main thread refusing to return**, and that refusal is the only thing holding the process open for everything else to happen inside.

It is also the last structural difference between the two loop types. The pool materializes on demand and cannot keep itself alive. The UI pump is the opposite: you start it by hand, on a foreground thread, and that single loop is simultaneously the consumer of the queue *and* the thing preventing process exit. One loop doing both jobs — which is exactly why blocking it is fatal in a way that blocking a pool thread is not.

(This is the mechanism behind Article 006 §22's "the process is the lifetime boundary." Not only does in-memory work not survive the process — it does not even survive `Main` returning in an orderly way, which is why graceful shutdown must be *designed*, not assumed.)

---

# Part 4 — The .NET Toolbox

Everything above is descriptive. This part is what to actually do.

## 27. `ConfigureAwait`: What It Actually Waives

```csharp
await x.ConfigureAwait(false);                                  // do not capture the context
await x.ConfigureAwait(ConfigureAwaitOptions.None);             // .NET 8, identical
await x.ConfigureAwait(ConfigureAwaitOptions.ContinueOnCapturedContext);
await x.ConfigureAwait(ConfigureAwaitOptions.ForceYielding);    // always suspend, even if complete
await x.ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing); // Task only: await completion, ignore fault
```

What it does: skips step 1 (and, for `false`, step 2) of the §17 decision table. That is all.

What it does **not** do: affect `ExecutionContext`. `AsyncLocal`, logging scopes, `Activity`/trace context, and culture all still flow (§21).

| Code you are writing | Guidance |
|---|---|
| Library, shipped or shared across hosts | **Use `ConfigureAwait(false)` everywhere.** You do not control your caller. |
| ASP.NET Core application code | Irrelevant for correctness; harmless. Consistency argument only. |
| WinForms / WPF / Blazor code that touches UI after the await | **Do not use it** — you need the context. |
| Anywhere you are about to block | Fix the blocking, not the await. |

`ForceYielding` is the genuinely new one in .NET 8: it guarantees the `IsCompleted` fast path is skipped. Use it to break up a loop over operations that complete synchronously (a hot socket, §15) which would otherwise monopolize a worker for its whole 30 ms quantum or grow the stack through chained inline continuations.

## 28. `TaskCompletionSource` and the Inline-Continuation Hazard

From §17, case 3: a `TaskCompletionSource` completed on your thread can run arbitrary consumer code on your thread, inside whatever lock you hold.

```csharp
// Default in library code:
var tcs = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
```

The same applies to `ManualResetValueTaskSourceCore<T>.RunContinuationsAsynchronously` when implementing `IValueTaskSource`.

| | Inline (default) | `RunContinuationsAsynchronously` |
|---|---|---|
| Latency of the resume | lowest — no scheduling hop | one queue hop |
| Producer's latency | **unbounded** — pays for consumer code | bounded |
| Deadlock risk under a lock | **real** | none |
| Stack growth on chains | possible | none |

The default is the fast one and the dangerous one. Choose inline only when you own both sides and the continuation is provably short and non-blocking.

Also: prefer the non-generic `TaskCompletionSource` (.NET 5+) over `TaskCompletionSource<object?>` when you have no result, and always use `TrySetResult`/`TrySetException`/`TrySetCanceled` over the throwing variants in racy paths — a second completion attempt is a common and legitimate outcome. Note `TrySetCanceled(token)` specifically: passing the token is what produces the `Canceled` terminal state rather than `Faulted` (Article 005 §14).

## 29. `ValueTask` and `IValueTaskSource`

`Task` costs an allocation per operation. When an operation usually completes synchronously — a buffered stream read, a cache hit, a hot socket (§15) — that allocation is pure waste.

`ValueTask<T>` is a struct wrapping *either* a `T` (synchronous completion, zero allocation) *or* a `Task<T>` *or* an `IValueTaskSource<T>`. The third form is what lets `Socket` run an entire receive loop with no per-operation allocation: the `AwaitableSocketAsyncEventArgs` is pooled and reused as the value task source.

The rules are strict, and violating them produces corruption rather than exceptions:

| Rule | Why |
|---|---|
| Await it **at most once** | The backing source may be recycled immediately after |
| Do not `.Result` it before completion | Unlike `Task`, it does not block correctly |
| Do not await it concurrently from two places | The source has one continuation slot |
| Need any of the above? Call `.AsTask()` once and use that | Converts to a normal, safe `Task` |

| Use | Return type |
|---|---|
| Public API, ordinary async operation | `Task` / `Task<T>` |
| Hot path, frequently completes synchronously, measured | `ValueTask<T>` |
| Any API where callers might store, await twice, or `WhenAll` | `Task<T>` |

> ⚠ *`ValueTask` is a performance tool with sharp edges, not a better `Task`. Use it where you have measured allocation pressure on a hot path. `CA2012` catches the common misuses; enable it.*

## 30. Sync-over-Async: The Costs, Enumerated

Article 006 §21 framed this as coupling a thread to a wait. Here is the full bill:

| Cost | Mechanism |
|---|---|
| A pool thread is held for the entire operation | §2 — it sits in WAITING |
| Injection is slow, so recovery is slow | §20 — one or two threads per second |
| Possible **deadlock** on a context-bearing host | §24 |
| Possible **starvation deadlock** on the pool | §20 |
| Exceptions are wrapped in `AggregateException` | `.Result`/`.Wait()` semantics |
| Cancellation semantics are damaged | `.Result` produces `AggregateException(OperationCanceledException)`, not `Canceled` — Article 005 §15 |

The escape hatches, in order of preference:

1. **Make the caller async.** Almost always possible; the virality is the point, not a bug.
2. **At a true boundary** (`Main`, a `Dispose`, a legacy interface you cannot change), `GetAwaiter().GetResult()` — same blocking, but unwrapped exceptions rather than `AggregateException`.
3. **Never** `Task.Run(() => Async()).Result` as a deadlock workaround. It burns two threads instead of one and hides the actual bug.

## 31. `SetMinThreads` Is a Tourniquet, Not a Fix

```csharp
ThreadPool.SetMinThreads(200, 200);
```

This makes injection immediate up to 200 threads, converting a multi-minute starvation stall into a survivable degradation. Legitimate uses: a legacy code path with blocking calls you genuinely cannot remove yet, or a startup burst where a known number of threads will block briefly.

It does not fix anything. It buys time to find the blocking call. And it has a real cost — 200 threads is ~200 MB of reserved stack and a materially worse scheduling profile under CPU load. If it is in your startup path, there should be a comment naming the blocking call it exists to survive, and a ticket to remove it.

## 32. Fire-and-Forget That Isn't `async void`

From §25 and Article 006 §19, the defect in fire-and-forget is not backgrounding — it is that **nothing owns the work**. The replacement must supply an owner. In ascending order of robustness:

**1. Explicit discard with observation** — the minimum, for genuinely optional work:

```csharp
public static void FireAndForget(this Task task, ILogger logger)
{
    _ = task.ContinueWith(
        static (t, s) => ((ILogger)s!).LogError(t.Exception, "Background task faulted"),
        logger, CancellationToken.None,
        TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously,
        TaskScheduler.Default);
}
```

**2. A `Channel<T>` plus a `BackgroundService` consumer** — the default answer for in-process work (Article 006 §24). Supplies backpressure, a shutdown story, and a place for errors to go.

**3. `IHostedService` / `BackgroundService`** — for work with a lifetime of its own. Note `BackgroundServiceExceptionBehavior`, which since .NET 6 can stop the host on an unhandled `ExecuteAsync` fault rather than silently killing the service.

**4. A durable queue or outbox** — when the work must survive the process (Article 006 §28).

And the one legitimate `async void`, which must contain its own catch-all:

```csharp
private async void Button_Click(object sender, EventArgs e)
{
    try { await _viewModel.SaveAsync(); }
    catch (Exception ex) { _logger.LogError(ex, "Save failed"); ShowError(ex); }
}
```

## 33. Diagnosing It: The Two Signatures

```bash
dotnet-counters monitor -p <pid> --counters \
  System.Runtime[threadpool-thread-count,threadpool-queue-length,threadpool-completed-items-count]

dotnet-stack report -p <pid>          # what every thread is doing right now

dotnet-dump collect -p <pid>
dotnet-dump analyze core_xxx
> threads          # all threads
> clrstack -all    # managed stacks
> threadpool       # queue lengths, worker and IOCP counts
> dumpasync        # pending async state machines  ◄── the one that matters
> syncblk          # monitor ownership, for lock deadlocks
```

`dumpasync` is the payoff of understanding §12. It walks the heap for `AsyncStateMachineBox` objects and reconstructs the **logical** async call stacks of operations that have no thread at all. It is how you debug "requests are stuck" when every thread looks idle — because in a correctly-async system, a stuck operation is by definition *not* on any stack.

The two signatures worth memorizing:

| Symptom | Reading |
|---|---|
| queue length rising, **CPU low**, threads slowly climbing | **starvation.** Find the blocking call. `dotnet-stack` will show workers parked in `WaitForSingleObject` beneath a `.Result`/`.Wait()` frame |
| queue length rising, **CPU high** | genuine saturation. Scale or optimize; the pool is behaving correctly |

## 34. Analyzers Worth Enforcing

Most of Part 4 can be enforced mechanically. These should be errors, not warnings:

| Rule | Catches |
|---|---|
| `VSTHRD100` | `async void` methods |
| `VSTHRD101` | `async void` lambdas — the §25 traps |
| `VSTHRD002` | synchronously blocking on a `Task` |
| `VSTHRD003` | awaiting a foreign `Task` (a deadlock precursor) |
| `CA2007` | missing `ConfigureAwait` in libraries |
| `CA2012` | `ValueTask` misuse (§29) |
| `CA1849` | calling a sync method when an async overload exists |
| `CA2016` | forgetting to forward a `CancellationToken` (Article 005) |

`VSTHRD100`/`101` alone would prevent the majority of production incidents in the §25 table.

## 35. A Decision Path

```
Is the thread waiting for something the kernel can notify about
(network, disk, timer) or for another thread in this process?
│
├─ NO → it is CPU work. Use parallelism, not async.
│        Do not Task.Run inside a server request handler.
│
└─ YES → async all the way down. Then:
     │
     ├─ Am I writing a library?
     │     → ConfigureAwait(false) everywhere. Never block. Return Task.
     │
     ├─ Am I completing a Task myself (TCS / IValueTaskSource)?
     │     → RunContinuationsAsynchronously, unless I own both sides
     │       and the continuation is provably short.
     │
     ├─ Do I need fire-and-forget?
     │     → Never async void (except an event handler with a total catch).
     │       In-process → Channel + BackgroundService.
     │       Must survive the process → outbox (Article 006 §28).
     │
     ├─ Am I forced to block at a boundary (Main, Dispose, legacy interface)?
     │     → GetAwaiter().GetResult(), at that boundary only, with a comment.
     │
     └─ Is it already slow in production?
           → dotnet-counters: queue length vs CPU (§33).
             Low CPU  → starvation; find the blocking call.
             High CPU → saturation; scale or optimize.
             Neither, but stuck → dotnet-dump + dumpasync.
```

---

# Summary: The Baseline

1. **Async is a concurrency-density optimization, not a latency one.** It changes what a thread does while waiting, never how long the wait is. A single-user benchmark of an async endpoint measures nothing except your allocation profile.
2. **A blocking design uses a 1 MB OS thread as a bookmark.** Async replaces it with a ~100-byte heap object. That four-orders-of-magnitude swap is the entire economics of the model.
3. **Every solution is a queue, a loop, and a continuation.** There is no coordinator. Identify which queue an item is in, which loop drains it, and who enqueued it, and every "why is this running here" question is answerable.
4. **`await` never talks to the OS — it talks to an awaiter.** The awaiter arranges for `MoveNext` to be called eventually, by IOCP, epoll, a timer, another thread, or nothing at all.
5. **One object is the Task, the continuation, the work item, and your locals.** `AsyncStateMachineBox`. Registering a continuation is one interlocked write into `m_continuationObject`; the CAS on that field is the entire suspension/completion synchronization.
6. **Windows is completion-based, Linux is readiness-based, and it shows.** Buffers are pinned on Windows; on Linux an optimistic `recv()` often means no suspension at all. Async *file* I/O on Linux is a thread pool emulation — the same code has a different threading profile after containerization.
7. **Four questions decide the resumption thread**, evaluated at suspension and applied at completion: captured context, non-default scheduler, inlining permitted, else the pool. Inline completion is the default and can run consumer code inside your lock.
8. **Your daily code runs inside `ThreadPoolWorkQueue.Dispatch`** — a `while(true)` that pops from a local LIFO deque, then a global FIFO queue, then steals from the far end of another worker's deque. Look at the bottom of any call stack to confirm it.
9. **Thread pool starvation is not "the pool is too small."** It is threads held by work that is not progressing. Queue length rising with **low CPU** is the signature; injection at one or two threads per second is why recovery takes minutes.
10. **`ExecutionContext` and `SynchronizationContext` are different things.** `ConfigureAwait(false)` waives scheduling, not ambient state — `AsyncLocal`, logging scopes, and trace context all still flow.
11. **`SynchronizationContext` owns no queue and drains nothing.** It is a write-only doorway into a host's execution environment, used by `await` to resume you where you started. ASP.NET Core installs none, which is why the classic deadlock does not occur there.
12. **The deadlock shape is universal:** a queue with restricted consumers, and every consumer blocked on something only draining that queue can produce. UI thread, thread pool, Blazor circuit — same phenomenon at different scales.
13. **`async void` captures the context at method entry and rethrows the exception on it later**, from an unrelated stack no `catch` of yours is on. With no context — ASP.NET Core, workers, timers — that means a bare pool thread, and **the process dies**. In Blazor Server it quietly kills the circuit instead, which is worse for detection.
14. **Nothing keeps the thread pool running.** It materializes on first use, enqueuers hire workers in their own call stack, idle workers retire on a timeout, and every one of them is a background thread. Only a foreground thread refusing to return keeps the process alive at all.

These are not aspirational. They are the difference between a system that is asynchronous and one that has merely spelled `async` in front of its methods.

---

# Appendix A — Experiments Worth Running

Each is short, and each makes one section above concrete.

| # | Experiment | Demonstrates |
|---|---|---|
| 1 | Print `Environment.CurrentManagedThreadId` before and after an `await` in a console app, an ASP.NET Core action, a WinForms handler, and a Blazor Server component. Repeat with `.ConfigureAwait(false)` | §17, §22 — context capture, visibly |
| 2 | Set a breakpoint in a controller action; read the **bottom** of the call stack. Then do the same in a WinForms handler | §18, §23 — the two loops |
| 3 | Write a `SynchronizationContext` whose `Post` logs `Environment.StackTrace`; install it in a console app | §22 — every framework call site that captures |
| 4 | `Task.Run(() => { }) ` 1000× and count distinct thread ids. Add `Thread.Sleep(1000)` inside and watch the count climb | §20 — hill climbing, live |
| 5 | `ThreadPool.SetMinThreads(2,2)`, fire 50 `Task.Run(() => Thread.Sleep(5000))`, time a 51st trivial one. Convert `Sleep` to `await Task.Delay` and re-measure | §20 — starvation, then its absence |
| 6 | `TaskCompletionSource` with and without `RunContinuationsAsynchronously`; print the thread id inside the continuation and inside the `SetResult` caller | §17 case 3, §28 |
| 7 | Time `File.ReadAllTextAsync` over 1000 files on Windows and on Linux while watching `threadpool-thread-count` | §16 — the portability trap |
| 8 | Throw from an `async void` in a console app and in a WinForms app | §25 — process death vs `Application.ThreadException` |
| 9 | Deadlock a UI app with `.Result`, then break in and inspect: the UI thread is in `WaitForSingleObject`, not `GetMessage` | §24 — the deadlock is visible, not mysterious |
| 10 | Take a dump of a healthy busy service and run `dumpasync` | §33 — operations with no thread |

---

*— End of Document —*
