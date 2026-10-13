# 010 — Async, threads, scheduling and contexts: a precise mental model

> **Prerequisites:** 007 (async/await internals). **Related:** 005 (cancellation, intent, recovery, atomicity), 006 (temporal and lifetime coupling).

Article 007 described the mechanisms: the IOCP/epoll path, thread pool dispatch and work stealing, `SynchronizationContext` versus `ExecutionContext`, and `async void` exception routing. This article does not re-derive them. It gives the vocabulary that makes those mechanisms predictable, and it uses that vocabulary to explain three things that teams repeatedly get wrong: what "the code after `await` runs on some thread" actually means, why `.Result` deadlocks in some hosts and not in others, and why the compiler does not stop you.

## A note on language

Everyday speech treats threads as workers. A thread "runs" code, "picks up" work, "is blocked", "returns to the pool". These phrases are compact, and this article translates them where they appear, but they are not explanations. A thread is not an actor. It is a record: a kernel structure, a stack, and a saved register set. Nothing in a thread record executes. Cores execute instructions, and the code they execute manipulates records and queues. Every statement below is written so that it stays accurate when read literally.

---

## Part 1 — Problem generalization

### Waiting is a resource problem

A flow of execution that cannot make progress should not hold resources it is not using.

The resources involved are concrete. A thread record carries a user-mode stack (typically 1 MB reserved on Windows and about 1.5 MB for runtime-created threads on Linux, mostly reserved address space rather than committed memory), a kernel stack of roughly 16–24 KB, kernel bookkeeping, and — for pool threads and UI threads — a slot in a deliberately limited set. A request that spends 40 ms waiting for a database result spends those 40 ms computing nothing. If its thread record is parked for the duration, the thread is a resource held idle. At a few thousand concurrent requests, idle threads become memory pressure, scheduler overhead, and pool starvation.

### Code should read in order

The classic answer to the resource problem is callbacks: register "what to do next" and return. That frees the thread but scatters one logical sequence across many functions, and error handling, loops and `using` blocks become hard to express. The second intent is that code should read in the order it logically executes, even when the execution is split across time.

### The reader should be able to tell which code runs where

Some code must execute on a specific thread (UI code touching controls). Some code must not execute there (long CPU work, synchronous waits). The third intent is that a reader can determine, from the code and its host, which thread's stack will hold the frame for a given line. In .NET the answer is determined by data captured at each `await`, not by any property of a thread.

These three intents conflict at their edges. Most async defects sit exactly there: synchronous waits on asynchronous work, lost or unwanted context, and thread pool starvation.

---

## Part 2 — Platform-neutral overview

### Core terms

- **Core:** the hardware unit that executes instructions.
- **Thread record:** the kernel structure for one flow of execution, together with its stack and saved register state. Windows calls the kernel structure `KTHREAD`/`ETHREAD`; Linux calls it `task_struct`.
- **Stack:** memory holding return addresses, locals and arguments for the call chain in progress.
- **Wait object:** a kernel object that holds thread records waiting for a condition — an event, a semaphore, a socket wait queue, an I/O completion port, an epoll instance.
- **Work item:** an entry in a queue that references code and data, ready to be invoked. Part 3 refines this for .NET.

### The three states

At any instant a thread record is in one of three states:

- **Running:** a core has loaded the record's saved state into its registers and is executing instructions from that state.
- **Ready:** the record is on a run queue. It is eligible to be loaded onto a core, but no core currently has it.
- **Waiting (parked):** the record has been removed from all run queues and linked to a wait object.

The transition from running to waiting happens inside a kernel routine. Code executing on the core calls, for example, "wait on this event". The routine finds the condition unsatisfied, links the record to the event, and calls the scheduler routine. That routine saves the core's registers into the outgoing record and loads another record's saved state. This is a context switch.

The reverse transition is never initiated by the parked record. Parked records are not on any run queue, so the scheduler never examines them. Only a wake-up call — made by code that satisfies the condition, such as the code that sets the event — moves a record back to a run queue.

### Blocking versus suspension

**Blocking** keeps the flow's state on its stack and parks the thread record on a wait object. It costs no core time, but the stack and the record are held for the whole wait. The code is simple: the next line executes after the wake-up.

**Suspension** copies the state that must survive into a heap object, registers a reference to resumption code with the pending operation, discards the stack frame, and returns to the caller. The thread record is not parked. Its core continues executing the caller's code. The cost is a heap allocation and restructuring the function into resumable form, which is the job compilers take on.

The essential difference: blocking ties a pending flow to a thread; suspension does not. After suspension, no thread is associated with the pending flow. The flow exists only as data.

### Callbacks

A callback is a pair of a code address and a data reference, stored where the completing party can find it. When an operation completes, the code that observes the completion either invokes the callback directly or enqueues it as a work item. That choice is one of the most consequential in any asynchronous runtime. Direct invocation is cheaper, but it executes arbitrary code on whichever stack happened to observe the completion. Queuing costs a hop and isolates the two.

### Schedulers

There are several, nested. The **OS scheduler** selects which ready record a core loads next. **User-mode schedulers** — a thread pool's queues, a UI message loop — determine which work item is dequeued next by code that is already executing on a core. User-mode scheduling orders work items; OS scheduling determines when the threads executing the dequeue code get cores. Neither component selects "a thread for a piece of work". Section 3.4 returns to this point.

---

## Part 3 — Deep .NET mechanics

### .NET-specific terms

- **Delegate:** a managed object holding a target reference and a method pointer.
- **State machine:** the compiler-generated type for an async method, holding `<>1__state`, the locals that survive suspension, the builder (`<>t__builder`), and the pending awaiter (`<>u__1`, …). It is a class in Debug builds and a struct in Release builds.
- **Continuation:** the object that resumes the state machine at the point after an `await`. Conceptually a delegate; section 3.2 notes where the runtime optimizes the delegate away.
- **Work item:** in .NET, an entry in a thread pool queue — a `Task`, an `IThreadPoolWorkItem`, or a delegate wrapper — that code on a pool thread will dequeue and invoke.

### 3.1 Loading and compilation

Loading and compiling are separate steps, and separating them matters for the mental model.

**Loading** maps the assembly file into the process's address space. Type metadata is read lazily: the runtime builds its internal type structures (`MethodTable` and related) the first time a type is needed. At that point, each method's entry point is a small stub (a precode) rather than native code.

**Compilation** happens on first call. The stub transfers control to the JIT, which compiles the method's IL to native code and patches the entry point so later calls go straight to it. ReadyToRun images ship precompiled code that can skip this step. With **tiered compilation** (default since .NET Core 3.0), the first native version is a quickly produced tier-0 version. After a method has been called roughly 30 times (the default threshold; details vary by version), it is queued for tier-1 recompilation with full optimization, and the entry point is repointed. On-stack replacement (.NET 7 and later) lets long-running loops move to optimized code mid-execution.

Two consequences follow. First, native code is shared, read-only memory owned by no thread. A thousand pending requests resuming the same `MoveNext` share one copy of its instructions; what differs per request is the `this` reference and the stack the frame is built on. Second, "a pointer to the native code of `MoveNext`" is precise only after compilation. Before that, the pointer leads to a stub, and the first invocation pays the JIT cost on whatever stack makes the call.

### 3.2 Suspension of an async method

```csharp
public async Task<int> GetDoubledLengthAsync(Stream s, byte[] buf)
{
    int n = await s.ReadAsync(buf, 0, buf.Length);
    return n * 2;
}
```

The compiler turns the body into a `MoveNext` method on the state machine:

```csharp
// Simplified. Real code adds try/catch, SetException, and hoisted fields.
void MoveNext()
{
    TaskAwaiter<int> a;
    if (<>1__state == 0) { a = <>u__1; <>u__1 = default; <>1__state = -1; goto Resume; }
    a = s.ReadAsync(buf, 0, buf.Length).GetAwaiter();
    if (!a.IsCompleted)
    {
        <>1__state = 0; <>u__1 = a;
        <>t__builder.AwaitUnsafeOnCompleted(ref a, ref this);
        return;                                   // stack frame discarded here
    }
Resume:
    <>t__builder.SetResult(a.GetResult() * 2);
}
```

At the first `await` whose awaiter reports `IsCompleted == false`:

1. `<>1__state` is set to the resume point, and the awaiter is stored in a field.
2. The builder boxes the state machine. In .NET Core and later, the box is an `AsyncStateMachineBox<TStateMachine>`, which is itself a `Task<TResult>`. The `Task` returned to the caller and the box holding the state machine are the same object. In .NET Framework, the box and the `Task` are separate objects, and the builder allocates an additional runner object and an `Action` delegate.
3. The continuation is stored in the awaited `Task`'s continuation slot. For the built-in awaiters (`TaskAwaiter`, `ConfiguredTaskAwaiter`), .NET Core and later may store the box itself, which implements an internal interface the `Task` knows how to invoke, so no delegate is allocated. For other awaiters, the builder passes a cached `Action` delegate whose target is the box and whose method pointer leads to `MoveNext`. If a `SynchronizationContext` or non-default `TaskScheduler` was captured, a wrapper object records it alongside the box.
4. `MoveNext` returns. Its frame is discarded. The original call returns the incomplete `Task` to its caller, and the caller's code continues on the same core.

```
  caller holds ──(reference)──▶ ┌────────────────────────────────────┐
                                │ AsyncStateMachineBox  (is a Task)   │
                                │  StateMachine:                      │
                                │   <>1__state = 0                    │
                                │   s, buf (hoisted locals)           │
                                │   <>u__1 : TaskAwaiter ─(reference)─┼──┐
                                │  m_continuationObject = null        │  │
                                └────────────────────────────────────┘  │
                                      ▲                                  ▼
                                      │                ┌────────────────────────┐
                                      └─(reference:    │ awaited Task<int>      │
                                         continuation)─│ m_continuationObject   │
                                                       └────────────────────────┘
```

Read the diagram as a heap graph rooted wherever the pending I/O operation keeps its reference to the awaited `Task`. There is no edge to any thread. Ten thousand pending reads correspond to ten thousand such graphs and zero parked threads.

### 3.3 Completion path, OS to managed code

#### Readiness versus completion

On Linux and macOS, .NET sets sockets to non-blocking mode. A `recv` call with no buffered data returns `EAGAIN`/`EWOULDBLOCK`. The meaning is precise: nothing was started and nothing is pending; a later attempt might succeed. To learn when, the runtime registers the socket with an epoll instance (edge-triggered, registered once per socket). This is a **readiness** model: the kernel reports that data is available, and user code performs the copy by calling `recv` again.

On Windows, .NET issues overlapped `WSARecv` calls on sockets associated with an I/O completion port. A return of `ERROR_IO_PENDING` (`WSA_IO_PENDING`) means the opposite of `EWOULDBLOCK`: the operation was accepted and is in progress. When it finishes, the kernel has already copied the data into the supplied buffer and queues a completion packet to the port. This is a **completion** model. The buffer must remain valid and pinned for the duration. An operation can also complete synchronously; with `FILE_SKIP_COMPLETION_PORT_ON_SUCCESS` set, no packet is queued in that case and the result is handled inline.

#### The socket engine

On Linux and macOS, `SocketAsyncEngine` owns one or more engine threads; the count scales with processor count and is small. Each engine thread's record is parked in `epoll_wait`. When a packet arrives, the network stack appends data to the socket's receive buffer and calls a wake-up routine on the socket's wait queue. The epoll callback adds an entry to the epoll instance's ready list and wakes the record parked in `epoll_wait`. The scheduler eventually loads that record onto a core, the call returns with a batch of events, and the engine code iterates over the batch.

That iteration is serial per engine thread. In .NET 5 and later, the default behavior is that the engine code hands the per-socket processing to the thread pool rather than executing continuations itself. Setting `DOTNET_SYSTEM_NET_SOCKETS_INLINE_COMPLETIONS=1` makes the engine thread execute completions, including user continuations, directly. In either mode, time spent per event delays later events in the same batch; in inline mode, that time includes your code.

On Windows, the I/O completion path changed over versions. In .NET 7 and later, the managed thread pool includes I/O poller threads whose records are parked in `GetQueuedCompletionStatusEx`; returned packets are turned into work for the worker pool. In earlier .NET Core versions and in .NET Framework, a separate native I/O completion thread pool processed packets. Verify the exact behavior for the version you run if it matters.

#### Completing the Task

Once data is available in managed memory, the socket code completes the awaited `Task`. Completion atomically swaps the continuation slot to a sentinel (so a racing `await` sees the task as completed) and then processes the stored continuation: it is either invoked directly or queued as a work item, depending on the captured context, the task's creation options (`RunContinuationsAsynchronously` forces queuing), and runtime heuristics.

```
NIC ─(DMA + interrupt)─▶ kernel network stack ─(append bytes)─▶ socket receive buffer
                                                                  │ (wake-up on socket wait queue)
                                                                  ▼
epoll ready list / IOCP packet ─(record moved to run queue)─▶ engine or poller thread record
                      epoll_wait / GetQueuedCompletionStatusEx returns on some core
                                                                  │ Linux: recv copies bytes
                                                                  ▼ Windows: already copied
awaited Task completed ─(read continuation slot)─▶ work item enqueued to thread pool
                                                                  │ (CAS dequeue, indirect call)
                                                                  ▼
box.MoveNext() on a pool thread's stack ─(switch on <>1__state)─▶ code after await
```

### 3.4 Dispatch from the thread pool

#### The queues are shared memory

The .NET Core thread pool (fully managed, cross-platform, default since .NET 6) has one global queue and one local queue per worker. A **worker** here means a thread record created by the pool whose code executes the dispatch loop. The global queue is a segmented concurrent queue. Each local queue is an array accessed from its owner at one end and from other workers at the other. Work queued from code executing on a worker goes to that worker's local queue by default; work queued from elsewhere goes to the global queue.

None of these queues belongs to a thread in any active sense. They are memory, reachable from every core.

#### The dispatch loop

```csharp
// Simplified shape of a worker's dispatch loop.
while (true)
{
    object? item = TryPopLocal() ?? TryDequeueGlobal() ?? TryStealFromOtherWorker();
    if (item is null)
    {
        if (!semaphore.Wait(idleTimeout)) TryRetireWorker();
        continue;
    }
    ((IThreadPoolWorkItem)item).Execute();   // indirect call; Task has its own path
}
```

`TryDequeueGlobal` reads the head index, attempts an interlocked compare-and-swap (CAS) to advance it, and on failure re-reads and retries. Stealing reads from the opposite end of another worker's local queue using interlocked operations, with a short lock on some contended paths. The owner pops from its own end (LIFO) because the most recently queued item is likely to reference data still in the core's cache; stealing and the global queue are FIFO for rough fairness. Fairness is approximate, not guaranteed.

Invoking a work item is an indirect call: load the method pointer from the delegate (or the interface slot for `IThreadPoolWorkItem.Execute`), place the target reference in the first argument register, and call through the pointer.

#### When the queues are empty

Code that finds every queue empty spins briefly, then calls `Wait` on the pool's semaphore. If the count is zero, the record is parked on the semaphore's wait object. When new work is enqueued and the pool's accounting indicates that no worker is already searching, the enqueue code releases the semaphore.

Three different choices are often blurred into "the pool assigns a thread":

- **Which parked worker is woken** is decided by the semaphore implementation and the kernel. On Windows the pool's semaphore is built on an I/O completion port, which releases waiters in last-in-first-out order. On Linux the runtime implements LIFO preference itself on top of lower-level primitives; the kernel's own futex wake order is not specified. Treat the order as a performance heuristic, not a contract.
- **Which worker obtains a given item** is decided by a CAS race among all code currently executing a dequeue, including workers that never parked.
- **Which core executes the woken worker** is decided by the OS scheduler.

No single component chooses a thread for the work. The item is in memory; whichever dequeue wins the CAS invokes it.

#### Two loops, two kinds of waiting

The **CAS retry loop** runs entirely in user space. It is short and never sleeps; a failure only means another core modified the same location first.

The **wait loop** spans user and kernel space. After every wake-up, the code re-checks the queues, because a wake-up is a hint, not a guarantee: another worker may already have taken the item, or the wake-up may be spurious. Finding nothing, the code parks again.

#### Hill climbing and starvation

The pool's hill-climbing algorithm adjusts the *target number* of workers based on measured throughput, and a separate starvation mechanism injects workers slowly (on the order of one or two per second, varying by version) when queued work is not progressing. Neither mechanism selects which worker invokes an item. Adding workers adds participants to the dequeue race; it does not route work.

### 3.5 Continuation execution

When dequeue code obtains a work item that is an async state machine box, it invokes the box's `MoveNext` through an indirect call:

- The core's instruction pointer is set from the method pointer (native code of `MoveNext`, or a stub if not yet compiled).
- The box reference becomes `this`. For a struct state machine, `this` is the address of the struct field inside the box.
- A new frame for `MoveNext` is pushed on the stack currently in use — the stack of the worker whose dequeue succeeded.
- The `switch` on `<>1__state` jumps to the resume label, and hoisted fields are read back into locals.

The frame is on a different stack, possibly on a different core and in a different thread record, than before suspension. The logical state is the same because it was never on the stack. "The code after `await` runs on a thread pool thread" means precisely: the work item referencing the box was dequeued by code executing on a pool worker's stack, and the `MoveNext` frame was pushed there.

**`ExecutionContext`** flows with the state machine. The builder captures the current `ExecutionContext` reference at suspension (cheap, because the object is immutable and captured by reference), the invocation path installs it before calling `MoveNext`, and the previous context is restored afterwards. That is why `AsyncLocal<T>` values, culture and similar ambient data appear to follow the logical flow. Article 007 covers capture, restore and suppression in detail.

**`SynchronizationContext`** is different in kind. It does not change how `MoveNext` executes. It changes *where the continuation is queued*: instead of the thread pool, into the context's own queue.

### 3.6 SynchronizationContext and the UI context

#### The message loop

A Win32 UI thread executes a loop of the form `while (GetMessage(...)) { TranslateMessage(...); DispatchMessage(...); }`. Each thread that creates windows has a message queue maintained by the kernel-mode windowing subsystem (win32k). When the queue is empty, `GetMessage` parks the thread record on a wait object tied to that queue. `PostMessage` appends a message and signals that object.

#### The Post path

- **WinForms:** `WindowsFormsSynchronizationContext.Post` calls `BeginInvoke` on a marshaling control created on the UI thread. That stores the delegate in a list on the control and posts a private message to the control's window.
- **WPF:** `DispatcherSynchronizationContext.Post` calls `Dispatcher.BeginInvoke`, which inserts a `DispatcherOperation` into the dispatcher's priority queue and, if needed, posts a message to the dispatcher's hidden window so that `GetMessage` returns.

When the loop dispatches that message, the window procedure invokes the stored delegate. The delegate resumes the state machine, and `MoveNext`'s frame is pushed on the UI thread's stack.

```
pool or engine code ─(SynchronizationContext.Post(d))─▶ delegate list / DispatcherOperation queue
        │                                                     (heap reference to d)
        └─(PostMessage to hidden window)─▶ win32k message queue of UI thread ─(signal)─┐
                                                                                      ▼
UI thread record parked in GetMessage ─(wake-up: moved to run queue)─▶ GetMessage returns
        │
        └─(DispatchMessage → window procedure → invoke d)─▶ box.MoveNext() on UI stack
```

#### Why one thread

Windows are owned by the thread that created them, and messages for a window go to the owner's queue. WPF's `DispatcherObject` (the base of `DependencyObject`) records its dispatcher and throws from `VerifyAccess` when touched from another thread. Beyond these affinity rules, the single-thread model gives the programmer **exclusion**: between two `await`s, no other UI code interleaves with yours, so sequential UI code can be read sequentially without locks. (Nested message loops — modal dialogs, `DoEvents` — break that exclusion and are a source of reentrancy bugs.)

The single thread is a framework design rule that enforces exclusion. The kernel does not require that only one thread drain a queue; the frameworks chose ownership by one thread. A **UI context** is therefore the queue together with the one thread whose code drains it. Neither half alone is "the context".

### 3.7 Why `.Result` deadlocks

`.Result` calls `Wait()`. On an incomplete task, `Wait()` spins briefly, then registers an internal continuation that sets a `ManualResetEventSlim`, and waits on that event. After its own short spin, the event parks the calling thread's record on a kernel wait object. The event is set when the task completes, and an async method's task completes only when its state machine reaches its final `return` (`SetResult`) or throws.

```csharp
private void Button_Click(object sender, EventArgs e)
{
    string text = LoadAsync().Result;    // parks the UI thread's record
    label.Text = text;
}

private async Task<string> LoadAsync()
{
    string s = await _http.GetStringAsync(_url);  // captures the UI context
    return s.Trim();
}
```

`GetStringAsync` completes on a pool thread. Its own internal awaits use `ConfigureAwait(false)` and are not the problem. The problem is `LoadAsync`'s `await`: it captured the UI context, so its continuation is posted to the UI message queue. The only code that drains that queue is the UI thread's message loop, and the UI thread's record is parked in `.Result`.

```
UI thread record ──(parked on)──▶ MRES kernel event
       ▲                               │ (set only when LoadAsync's Task completes)
       │                               ▼
(only drainer of)            LoadAsync's Task completes only when MoveNext reaches return
       │                               │
UI message queue ◀──(continuation posted here: queue entry)── awaited HTTP task completed
       (entry never dispatched: no code drains the queue while the record is parked)
```

#### The three conditions

All three must hold:

1. Code synchronously waits on the task (`.Result`, `.Wait()`, `GetAwaiter().GetResult()`).
2. Inside the awaited call chain, an `await` on an incomplete task captured a context whose queue has a single consumer.
3. That single consumer is the code that is waiting in condition 1.

#### Where no deadlock occurs

- **ASP.NET Core** has no `SynchronizationContext`. Continuations go to the thread pool, so condition 2 fails. The synchronous wait still parks a pool thread for the duration; under load, enough such waits produce thread pool starvation, which looks like a hang from outside and recovers only as fast as the starvation mechanism injects workers.
- **`ConfigureAwait(false)`** on every `await` in the chain that can execute while the context is current. Note that `ConfigureAwait(false)` on an already-completed task has no effect; execution stays on the context and the *next* `await` captures it again. One `ConfigureAwait(false)` near the top does not protect the rest of the method.
- **Synchronously completed tasks**: no suspension, no continuation, nothing posted.
- **Console applications** without an installed context: condition 2 fails.

**ASP.NET Framework** uses `AspNetSynchronizationContext`. It does not bind to one OS thread; it serializes work per request. A continuation posted to it is scheduled to execute after the request's current work finishes, and the current work is the code parked in `.Result`. The deadlock shape is the same; the single consumer is the request's serialization, not a specific thread.

### 3.8 Why the compiler allows it

The compiler knows types and signatures. It does not know which `SynchronizationContext` will be current when a line executes; that is a property of the host, decided at runtime. From the compiler's point of view, `.Result` is a property returning `T`.

Blocking is also legitimate in many places: `Thread.Sleep`, `Console.ReadLine`, `lock`, synchronous file reads in a startup path, a dedicated thread that blocks by design. A language rule against blocking would forbid correct code.

Finally, async in C# is an opt-in transformation, not a tracked effect. A method's signature records that it returns a `Task`; it does not record "may block" or "requires context", and the type system does not propagate such facts through call chains.

Static analysis fills part of the gap. `Microsoft.VisualStudio.Threading.Analyzers` reports VSTHRD002 (avoid problematic synchronous waits) and related rules such as VSTHRD103 (call async methods when in an async method). The .NET code-analysis rule CA2007 flags `await` without `ConfigureAwait`, for libraries that choose to enforce it. AsyncFixer is a further third-party option. These are heuristics, not proofs.

---

## Part 4 — Concrete solution overview

### 4.1 Async all the way, and where it breaks

If a method awaits, its callers should await too, up to an entry point that the framework calls asynchronously: an ASP.NET Core action, a hosted service's `ExecuteAsync`, a UI event handler (`async void` is acceptable only there; see 007 for exception routing), or `async Task Main`.

It breaks down at a synchronous boundary you cannot change: a legacy interface, a third-party callback, a constructor, a `Dispose` that must release async resources. Alternatives:

| Option | Trade-off |
|---|---|
| Change the interface to async (`ValueTask`/`Task`, `IAsyncDisposable`) | Correct and cheapest at runtime; costs a breaking change |
| Provide a genuinely synchronous implementation (many .NET APIs have one, e.g. `HttpClient.Send` since .NET 5) | No sync-over-async; duplicates code paths |
| `JoinableTaskFactory.Run` (vs-threading) in UI applications | Avoids the deadlock while preserving main-thread affinity; adds a library and a discipline the whole app must follow |
| `Task.Run(() => FooAsync()).GetAwaiter().GetResult()` | Avoids the context deadlock; still parks the caller and occupies a pool thread |

**Recommendation:** change the interface when you own it. Otherwise prefer a real synchronous path. Use `JoinableTaskFactory` in UI codebases that already adopt it. Treat `Task.Run(...).GetResult()` as a documented, contained exception.

### 4.2 `ConfigureAwait(false)` in libraries

Library code does not know its host. If a UI application calls your library and then blocks, or simply calls it on the UI thread, every captured `await` in the library posts back to the UI queue, costing a hop and creating deadlock risk. `ConfigureAwait(false)` makes continuations go to the thread pool instead.

- **Option A — `ConfigureAwait(false)` on every library `await`,** enforced with CA2007. Robust in every host; verbose; easy to miss one without the analyzer.
- **Option B — omit it,** arguing that ASP.NET Core has no context and modern UI code should not block. Simpler code; correct only if every consumer behaves, which a library cannot verify.

**Recommendation:** Option A for shared libraries and NuGet packages; Option B is acceptable for code that exists only inside an ASP.NET Core application. .NET 8 adds `ConfigureAwait(ConfigureAwaitOptions)` for finer control (for example, suppressing exceptions or forcing a yield).

`ConfigureAwait(false)` does not help application code that needs the context afterwards. After it, the next line executes on a pool thread, and touching a control there throws. In UI code, keep the default capture.

### 4.3 `Task.Run(() => SomeAsync()).Result`

This avoids the deadlock because `SomeAsync` starts on a pool thread where no `SynchronizationContext` is current, so no `await` inside it captures the UI context. But it still parks the calling thread's record until completion — on the UI thread, the UI freezes — and it occupies at least one pool thread at the same time. It is usually a smell: it hides a design boundary rather than resolving it. Acceptable uses: a one-time synchronous bootstrap, a legacy interface with no alternative (4.1), tests.

### 4.4 `GetAwaiter().GetResult()` versus `.Result`

Both park the caller in exactly the same way and have the same deadlock conditions. The difference is exception shape: `.Result` and `.Wait()` wrap failures in `AggregateException`; `GetAwaiter().GetResult()` rethrows the original exception with its stack trace preserved. When a synchronous wait is unavoidable, prefer `GetAwaiter().GetResult()`. It is not "safer" with respect to deadlocks.

### 4.5 Decision guide

**Library code**
- `await` with `ConfigureAwait(false)`; enforce with CA2007.
- Never block on tasks; expose async APIs, and synchronous ones only if they are genuinely synchronous.
- Accept `CancellationToken` and pass it through (see 005).

**UI application code**
- Keep the default capture when the following code touches UI state.
- Never block the UI thread on a task; make event handlers `async` and await.
- Move CPU-bound work off the UI thread with `Task.Run`, then await its result back on the UI context.

**ASP.NET Core request code**
- There is no context; `ConfigureAwait(false)` is harmless but unnecessary.
- Never block on tasks; the failure mode is starvation instead of deadlock, and it appears only under load.
- Do not wrap work in `Task.Run` to "make it async"; it moves work from one pool thread to another and adds a hop.
- For work that outlives the request, use a queue and a hosted service, not fire-and-forget (see 006).

### 4.6 CPU-bound work is not helped by async

Async frees threads while operations are pending outside the CPU. CPU-bound work has no such period: it needs a core for its whole duration. Wrapping it in `Task.Run` in a server only redistributes it. What matters is limiting concurrency so that CPU-bound work does not starve request handling:

- `SemaphoreSlim` with `WaitAsync` around the CPU-heavy section, sized below the core count.
- `Parallel.ForEachAsync` with `MaxDegreeOfParallelism` for batch processing.
- A bounded `Channel<T>` with a fixed number of consumers when production and consumption should be decoupled (see 006).

### 4.7 Keep per-completion work short

Socket readiness events are processed serially per engine thread. With inline completions enabled, or with continuations that execute synchronously as part of completing a task, a slow handler delays the other sockets in the same batch on the same engine. Even in the default mode, long synchronous sections after an `await` hold a pool thread and slow every other work item behind it. Do the minimum after resumption, and move heavy processing behind a queue or a concurrency limit.

### 4.8 One-line rules

| Situation | Rule |
|---|---|
| Calling an async API from async code | `await` it. |
| Library `await` | Add `ConfigureAwait(false)`. |
| UI code that touches controls after `await` | Keep the default capture. |
| Synchronous interface you cannot change | Prefer a real sync implementation; otherwise contain `Task.Run(...).GetAwaiter().GetResult()`. |
| Unavoidable synchronous wait | Use `GetAwaiter().GetResult()`, not `.Result`. |
| CPU-bound work in a server | Limit concurrency; do not wrap it in `Task.Run`. |
| CPU-bound work in a UI app | `await Task.Run(...)`. |
| Event handler | `async void` only here. |

---

## References

The following sources exist and cover the material above. URLs are given only where they are well established; search by title if a link has moved.

- Stephen Toub, *How Async/Await Really Works in C#*, .NET Blog, 2023 — https://devblogs.microsoft.com/dotnet/how-async-await-really-works/
- Stephen Toub, *ConfigureAwait FAQ*, .NET Blog, 2019 — https://devblogs.microsoft.com/dotnet/configureawait-faq/
- Stephen Cleary, *Don't Block on Async Code*, 2012 — https://blog.stephencleary.com/2012/07/dont-block-on-async-code.html
- Stephen Cleary, *There Is No Thread*, 2013 — https://blog.stephencleary.com/2013/11/there-is-no-thread.html
- Microsoft Learn: *Task-based asynchronous pattern (TAP)*; *The managed thread pool*; *Tiered compilation* (runtime configuration docs).
- Microsoft Learn (Win32): *I/O Completion Ports*; *About Messages and Message Queues*.
- Linux man pages: `epoll(7)`, `recv(2)`.
- `microsoft/vs-threading` on GitHub: analyzer documentation for VSTHRD002 and related rules, and `JoinableTaskFactory`.
- Stephen Toub, *Performance Improvements in .NET 6* and *.NET 7* posts on the .NET Blog, for the managed thread pool and I/O poller changes. The precise version in which each change shipped should be confirmed there.
- Pavel Yosifovich, Mark Russinovich et al., *Windows Internals*, 7th edition, for thread records, wait objects and scheduling on Windows.

## Key takeaways

1. A thread record is passive state; cores execute instructions, and code on those cores moves records between run queues and wait objects.
2. Suspension moves an async method's state into a heap object and discards the stack frame; while an operation is pending, no thread is associated with it.
3. A continuation is an object referenced from the awaited `Task`; it becomes associated with a thread only while a core executes the call into `MoveNext`.
4. No component assigns work to a thread: the kernel chooses which parked record is woken, a CAS race decides which dequeue obtains an item, and the OS scheduler chooses the core.
5. `.Result` deadlocks when the only code that drains a captured single-consumer queue is the code parked in the wait; remove any one of the three conditions and the deadlock disappears, though a parked pool thread still costs capacity.
6. The compiler cannot see the runtime context, so the rules — async all the way, `ConfigureAwait(false)` in libraries, no synchronous waits on tasks — must be enforced by analyzers and review.
