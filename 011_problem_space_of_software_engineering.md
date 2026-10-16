# 011 — The Problem Space of Software Engineering

### Organizing the field by where constraints come from

> **Installment status.** This file contains the Introduction and Part I (sets 1–8). Parts II–V and the closing sections follow in later installments. Literature in this installment rests on background knowledge. No web verification was performed for Part I. Every detail I am not certain of is marked **[verify]**. DOIs are given only where I am confident of them.

---

## Introduction

Most maps of software engineering are organized by artifact (requirements, design, code, tests, operations) or by technology (databases, messaging, front end). Those maps answer *where an activity sits*. They hide *why a practice exists*. A pattern such as the transactional outbox looks like an arbitrary convention until you see the chain behind it: a network that cannot report the outcome of a request, a database that can make two writes atomic only locally, and a business that cannot tolerate a payment recorded without its notification.

This article organizes the field by **where a constraint comes from**. A constraint here means something you cannot negotiate away by choosing a different framework. You can only choose where, and in what currency, you pay for it. A lock does not remove the cost of shared state; it converts a correctness risk into latency and a deadlock risk. A saga does not remove the cost of a distributed transaction; it converts lost isolation into compensation logic and business reconciliation.

**The four layers.**

1. **Physical and machine constraints (sets 1–8).** The speed of light, the cost of moving bits between memory tiers, independent failure of components, clocks that drift, and the arithmetic of finite machines. These constraints do not change with fashion. Their ratios shift slowly over decades.
2. **Software structure and mechanism (sets 9–15).** Constraints that arise from the artifacts we build: languages, data models, module boundaries, interfaces, runtime operation, adversaries, and accumulated change. They are human-made, but once a system exists they are as binding as physics for the people working inside it.
3. **Human cognition, language, and knowledge (sets 16–18).** Bounded working memory, meaning that depends on shared context, understanding that is performed by particular people and cannot be copied, and knowledge that does not survive conversion into text.
4. **Social, organizational, and institutional constraints (sets 19–23).** Team structure, governance, economics, law, procurement, and the effect of software on the society whose processes it encodes.

The order is not a ranking of importance, and causality does not run in one direction only. Conway's law (§19) is the standard case of an organizational constraint producing a software structure. The layers differ in **malleability and rate of change**. Physics does not move. Hardware ratios move over decades. Languages and frameworks move over years. Organizations can be redrawn in months, but their inertia often exceeds that of code.

**Why the causal view matters.** A typical chain crosses all four layers. Light in fibre travels about 200,000 km/s, so a round trip between two European regions costs tens of milliseconds (§1). Synchronous cross-region replication therefore adds that cost to every commit (§6). Teams choose asynchronous replication, which permits stale reads and lost acknowledged writes on failover (§6, §4). Somebody must then reconcile divergent records. That is a data-ownership question (§10), an organizational responsibility (§19), and in the public sector often a contractual term in a tender (§22). A reader who sees only the last link treats the reconciliation process as bureaucracy. A reader who sees the chain sees it as the price of a physical constant.

**Cross-cutting lenses.** Three concerns appear in nearly every set and are treated in Part V as lenses rather than sets:
- **Time:** ordering, deadlines, and lifecycle.
- **Cost:** money, latency, and cognitive load.
- **Failure:** random (Part I), adversarial (§14), cognitive (Part III), and organizational (§19).

**How each set is written.** Every set in Parts I–IV follows the same eight headings: the constraint; what goes wrong; what you must understand; trade-offs and alternatives; contested points; examples (optional); key literature; and self-check questions. Cross-references use the form §5 or §16b.

**Epistemic conventions.** I distinguish four levels of support:
- **Settled:** proved, or uncontroversial among specialists. FLP impossibility is an example.
- **Well supported:** strong evidence with residual debate about scope.
- **Contested:** competent people disagree, and the evidence does not settle the matter.
- **Tentative:** recent claims I could not verify.

Literature is marked **seminal** or **recent**. Any unverified detail is marked **[verify]**.

**Reading advice.** Part I is the most mechanical and the most familiar to a .NET architect. Its value here is less in new facts than in exact distinctions:
- data race versus race condition;
- serializability versus linearizability;
- timeout versus failure;
- quorum overlap versus linearizability.

These pairs are routinely conflated in design reviews. Part III is the least familiar and gets the most depth. In large government systems, the most expensive failures tend to originate there, even when they surface in Part I or Part II.

---

# Part I: Physical and machine constraints

## 1. Physical substrate

### The constraint

Software executes on matter. Three physical facts dominate.

**First, distance costs time.** Signals in copper and fibre propagate at roughly two thirds of the speed of light, about 5 µs per kilometre. A 1,000 km round trip therefore costs at least 10 ms before any switching, queuing, or protocol overhead. No engineering removes this floor. Engineering can only avoid crossing the distance.

**Second, moving data costs more than computing on it.** This holds for both time and energy. Horowitz's widely cited figures (ISSCC 2014) put a 64-bit DRAM access two to three orders of magnitude above a 64-bit arithmetic operation in energy. The exact numbers depend on process node, but the ratio is the robust point.

**Third, heat limits clock speed.** Dennard scaling (shrinking transistors at constant power density) broke down around 2005–2007. Clock frequencies plateaued, and further performance came from parallelism, wider vector units, and deeper caches. Parallelism is not a design fashion. It is the only remaining route to more throughput per chip, and it is the physical origin of §2.

**The latency hierarchy.** These are order-of-magnitude figures for a contemporary server. Absolute values drift; the ratios are what matter.

| Operation | Approximate latency | Ratio to L1 |
|---|---|---|
| L1 cache hit | ~1 ns (≈4 cycles) | 1× |
| Branch mispredict | ~5 ns | 5× |
| L2 cache hit | ~3–5 ns | ~4× |
| L3 cache hit (shared) | ~10–20 ns | ~15× |
| Contended cache line moving between cores | ~40–100+ ns (worse across sockets) | ~50× |
| Main memory (local NUMA node) | ~80–100 ns | ~100× |
| Main memory (remote NUMA node) | ~1.5–2× local | ~150–200× |
| System call | ~0.1–1 µs | ~10³× |
| Thread context switch (direct cost) | ~1–5 µs, plus cache pollution | ~10³× |
| NVMe random read | ~10–100 µs | ~10⁴–10⁵× |
| Durable flush (fsync) on SSD | ~0.05–5 ms (depends on power-loss protection) | ~10⁵–10⁶× |
| Round trip within one availability zone | ~0.1–0.5 ms | ~10⁵× |
| Round trip across availability zones | ~0.5–2 ms | ~10⁶× |
| Round trip within Europe across regions | ~10–40 ms | ~10⁷× |
| Round trip Europe to US East | ~70–100 ms | ~10⁸× |

**Memory and storage tiers.** Data moves between tiers in fixed units:
- **Cache lines** are 64 bytes on x86 and most ARM servers. (Apple M-series uses 128-byte lines.)
- **Pages** are 4 KiB by default, with 2 MiB and 1 GiB huge pages available.
- **Storage blocks** are 512 B or 4 KiB sectors. SSDs also have internal erase blocks that are much larger.

Hardware prefetchers reward sequential and strided access. The translation lookaside buffer (TLB) caches page mappings, and a TLB miss triggers a page walk that itself costs memory accesses.

**Unit cost as a function of hardware.** In the cloud, the cost of one business operation is the resource-seconds it consumes multiplied by price. Resources include vCPU-seconds, GB-seconds of memory, IOPS, storage GB-months, and inter-zone or inter-region egress.

Hardware enters unit cost in three ways:
- **Efficiency:** cache-friendly code uses fewer CPU-seconds.
- **Provisioning headroom:** latency targets force utilization below 100%, because queueing delay grows nonlinearly (§7). Idle capacity is part of unit cost.
- **Shape mismatch:** a memory-bound service on CPU-optimized instances pays for cores it cannot use.

A cloud vCPU is usually one hyperthread, not one core. Burstable instance types and CPU steal from co-tenants make performance **non-stationary**, so the same code measures differently at different times.

**What the operating system and the electronics guarantee.**

| Guaranteed (with caveats) | Not guaranteed |
|---|---|
| **Process isolation through virtual memory.** Caveat: Spectre and Meltdown (2018) showed that microarchitectural state leaks across these boundaries. | **Timely scheduling.** A runnable thread can be descheduled for milliseconds. A VM can be paused for seconds during live migration or host contention. A garbage collector can stop all threads. Any reasoning of the form "this takes at most N ms" is a hope, not a guarantee. This is the root of lease expiry problems (§3, §4). |
| **Program order as observed by the executing thread itself.** | **Ordering of one thread's writes as seen by another thread.** That is the memory model's job (§2). |
| **Atomicity of naturally aligned, word-sized loads and stores on mainstream hardware.** The CLI guarantees atomic reads and writes for properly aligned values up to native pointer size. A `long` on a 32-bit process is *not* guaranteed atomic. | **Atomicity of anything larger than a word.** See §2. |
| **Cache coherence.** All cores eventually agree on the value of a *single* memory location, and writes to that location are seen in one order. Coherence is per-location. It says nothing about the relative order of writes to *different* locations. | **Durability on `write()`.** A successful `write()` means the data reached the kernel page cache, not the device. `fsync` asks the kernel to push it to the device and the device to persist it. |
| **ECC memory corrects single-bit errors.** Common on servers. | **Correct `fsync` error handling.** The 2018 "fsyncgate" episode showed that on Linux, after a failed `fsync`, dirty pages could be marked clean and the error reported only once, so a retried `fsync` could "succeed" without the data being on disk. PostgreSQL responded by treating `fsync` failure as fatal (PANIC) and recovering from WAL. |
| | **Durable `rename`.** POSIX makes `rename` atomic in the namespace, but durability of the rename requires an `fsync` of the containing directory. |
| | **Write ordering to the device.** Writes may reach the device in any order. |
| | **Untorn writes.** A crash during a write can leave a page half old and half new. PostgreSQL's `full_page_writes` exists because of this. |
| | **Honest devices.** Some consumer devices acknowledge flushes they have not performed. |
| | **Correct CPUs.** Hyperscalers have reported "mercurial cores" that silently compute wrong results (Hochschild et al. 2021; Dixit et al. 2021). |
| | **Clocks.** See §3. |
| | **The network.** See §4. |

### What goes wrong

- **False sharing.** Two threads update logically independent counters that sit on the same cache line. Each write invalidates the other core's copy, and the line ping-pongs between cores. Two threads can then run slower than one.
- **Pointer chasing.** A `LinkedList<T>`, or a deep object graph of small heap objects, defeats the prefetcher. Each node costs a potential DRAM access, roughly 100× an L1 hit. Iterating 10⁶ nodes in a list can be an order of magnitude slower than iterating a `T[]` of structs.
- **NUMA effects.** A process on a two-socket machine allocates on one node and runs threads on both. Half its memory accesses pay the remote penalty. The same code benchmarks differently on a laptop and a bare-metal server.
- **Durability assumptions.** A service writes a status file, calls `Flush()`, and renames it into place. After a power failure the directory shows the new name with zero-length or old content. `Flush()` without `flushToDisk: true` only empties .NET's buffer into the OS, and the directory entry was never fsynced.
- **Container memory limits.** A .NET service in Kubernetes is OOM-killed by the cgroup, not by the runtime. Since .NET Core 3.0 the GC respects container limits (by default the heap hard limit is 75% of the container limit), but native allocations, thread stacks, and memory-mapped files count against the cgroup and not against the GC heap.
- **Non-stationary performance.** A load test passes on Monday and fails on Thursday. The cause is a noisy neighbour, thermal throttling, or exhausted burst credits, not the code.
- **Tail latency from the runtime.** A gen2 GC pause or a large-object-heap compaction shows up at p99.9, not in averages. Averages hide the substrate.

### What you must understand

**Latency versus throughput versus bandwidth.**
- *Latency* is the time for one operation.
- *Throughput* is operations per unit time.
- *Bandwidth* is the capacity of a channel.

Pipelining and parallelism raise throughput without improving latency. Batching raises throughput and *worsens* latency. Many performance arguments fail because the two parties optimize different quantities.

**Locality.**
- *Temporal locality:* data used recently will be used again.
- *Spatial locality:* data near recently used data will be used soon.

Caches exploit both. In .NET:
- An array of structs (`Point[]`) is contiguous.
- An array of classes (`Point[]` where `Point` is a class) is an array of references to scattered objects.
- `Span<T>`, `Memory<T>`, `ArrayPool<T>`, and `stackalloc` exist largely to keep data contiguous and avoid allocation.

**Coherence versus consistency.** These are separate properties:
- *Coherence* concerns a single location: every core sees writes to that location in one order.
- *A memory consistency model* concerns the ordering of accesses to *different* locations (§2).

The MESI family of protocols implements coherence by tracking line states (Modified, Exclusive, Shared, Invalid). A write requires exclusive ownership, which is why contended writes are expensive.

**Durability is a protocol.** "Durable" means the data survives power loss on stable media. To make an update durably visible, a program must:
1. write the data;
2. flush it to the device (`fsync` / `fdatasync`; `FlushFileBuffers` on Windows; `FileStream.Flush(flushToDisk: true)` in .NET);
3. if a rename is involved, rename and then flush the directory.

Databases exist partly to perform this protocol correctly once, so applications do not have to. Pillai et al. (2014) showed that widely used applications got it wrong, and that file systems differ in which orderings they preserve.

**Virtualization layers.** In a typical Kubernetes deployment, an operation passes through many layers:

> application → runtime (GC, JIT, thread pool) → container (cgroup CPU quota and memory limit) → guest kernel → hypervisor → host kernel → hardware

Each layer can delay you. CPU quotas under the CFS scheduler cause *throttling*: a container that uses its quota early in a 100 ms period is stopped until the period ends. This produces latency spikes even at low average CPU. Setting CPU limits on latency-sensitive pods is a contested practice for this reason.

**The managed runtime as part of the substrate.**
- The .NET GC is generational (gen0, gen1, gen2).
- Objects ≥ 85,000 bytes go to the large object heap.
- Server GC uses one heap per core.
- Since .NET 9, Server GC enables DATAS (dynamic adaptation to application sizes) by default, which trades some throughput for a smaller memory footprint **[verify: confirm default status for your target runtime]**.

Allocation is cheap at the moment of allocation and expensive later. Allocation rate is therefore a first-class cost.

**Mechanical sympathy.** Martin Thompson borrowed this term from racing driver Jackie Stewart. It means designing with knowledge of how the machine works. It does not mean micro-optimizing everything. It means not choosing data layouts and access patterns that fight the hardware when an equally clear alternative does not.

### Trade-offs and alternatives

| Design choice | Alternative A | Cost of A | Alternative B | Cost of B |
|---|---|---|---|---|
| Data layout | Object graph with references (natural domain model) | Poor locality, GC pressure | Flat arrays / struct-of-arrays | Less expressive model; harder to change; copying semantics of structs |
| Durability of commits | `fsync` per commit | Latency floor per transaction | Group commit (batch fsyncs) | Higher latency per transaction, higher throughput |
| | Asynchronous commit (PostgreSQL `synchronous_commit = off`) | Loses a bounded window of acknowledged transactions on crash | Durability by replication (acknowledged when in memory on N nodes) | Correlated failure (power, kernel bug) loses data; network cost |
| Provisioning | High utilization | Cheap per unit, poor tail latency (§7) | Headroom | Better tails, higher unit cost |
| Scaling | Scale up (bigger machine) | Hardware ceiling, NUMA effects, single failure domain | Scale out | Pay coordination costs (§7) and partial failure (§4) |
| Memory management | Rely on GC | Pauses, allocation-rate sensitivity | Pooling / `stackalloc` / unmanaged memory | Lifetime bugs return; code complexity |

### Contested points

- **"Hardware is cheap, programmers are expensive."** The phrase was popularized in practitioner blogs around 2008. It holds for one-off, low-volume systems. It fails in three cases:
  - at scale, where the multiplier is millions of operations;
  - in cloud billing, where inefficiency is a recurring operating cost and not a one-off capital cost;
  - in energy terms.

  The defensible position is that the trade-off depends on volume and lifetime, and should be calculated, not assumed.
- **How much mechanical sympathy matters in enterprise systems.** One position: typical line-of-business systems spend most of their time waiting on I/O and the database, so CPU-level layout is irrelevant. The counter-position: at moderate scale, serialization, allocation, and logging often dominate CPU profiles, and these are substrate-sensitive. Profiles from real systems support both, depending on workload. The honest answer is to measure.
- **Language energy rankings.** Pereira et al. (2017) ranked programming languages by energy efficiency using the Computer Language Benchmarks Game. The study is widely cited. It is also criticized because benchmark implementations vary in quality and idiom, so the results measure implementations as much as languages. Treat rankings from it as weak evidence.
- **CPU limits in Kubernetes.** One school recommends requests without limits for latency-sensitive services, to avoid CFS throttling. The other insists on limits for isolation and cost predictability. The disagreement reflects different priorities, not different facts.

### Examples

**Example 1.1 — False sharing (C#).**

```csharp
// Both counters likely share one 64-byte cache line.
sealed class Counters { public long A; public long B; }

// Each counter on its own line: padding pushes Value 64 bytes in.
[StructLayout(LayoutKind.Explicit, Size = 128)]
struct PaddedCounter { [FieldOffset(64)] public long Value; }

// Thread 1: Interlocked.Increment(ref counters.A);  // invalidates B's line too
// Thread 2: Interlocked.Increment(ref counters.B);
```

With `Counters`, two threads incrementing separate fields contend on one line. With an array of `PaddedCounter`, they do not. The .NET runtime itself pads hot fields in some concurrent collections for this reason.

**Example 1.2 — Durable replace of a file (scenario).** To durably replace `state.json`:
1. Write `state.json.tmp`.
2. Call `FileStream.Flush(flushToDisk: true)`.
3. Call `File.Move(tmp, path, overwrite: true)`.
4. On Linux, open and fsync the directory. .NET has no first-class API for this step; it needs P/Invoke or acceptance of the risk.

Omit step 2 and you can get a durable rename pointing to non-durable content. Omit step 4 and you can lose the rename. Most applications should not do this at all. They should store the state in a database that already implements the protocol.

### Key literature

1. **Hennessy, J. L. & Patterson, D. A. (2017). *Computer Architecture: A Quantitative Approach*, 6th ed. Morgan Kaufmann.** — *Seminal.* The standard quantitative treatment of memory hierarchies, parallelism, and the end of Dennard scaling. It is the source to consult for why the latency table has the shape it has.
2. **Drepper, U. (2007). *What Every Programmer Should Know About Memory.*** Self-published technical paper, serialized on LWN.net. — *Seminal.* A detailed account of caches, NUMA, TLBs, and their software consequences. Some numbers are dated; the mechanisms are not.
3. **Arpaci-Dusseau, R. H. & Arpaci-Dusseau, A. C. (2018). *Operating Systems: Three Easy Pieces*, v1.00. Arpaci-Dusseau Books.** https://ostep.org — *Seminal.* A clear treatment of virtualization, scheduling, virtual memory, and file system crash consistency. It is freely available.
4. **Pillai, T. S., Chidambaram, V., Alagappan, R., Al-Kiswany, S., Arpaci-Dusseau, A. C. & Arpaci-Dusseau, R. H. (2014). "All File Systems Are Not Created Equal: On the Complexity of Crafting Crash-Consistent Applications." OSDI '14.** — *Seminal.* Showed empirically that widely used applications rely on file system behaviours that are not guaranteed. This is the strongest evidence that durability should be delegated to databases.
5. **Rebello, A., Patel, Y., Alagappan, R., Arpaci-Dusseau, A. C. & Arpaci-Dusseau, R. H. (2020). "Can Applications Recover from fsync Failures?" USENIX ATC '20.** — *Recent.* A systematic study of fsync failure semantics across file systems and applications, following the PostgreSQL fsync episode.
6. **Hochschild, P. H., Turner, P., Mogul, J. C., et al. (2021). "Cores That Don't Count." HotOS '21.** — *Recent.* Google's report that some CPUs silently compute wrong results at measurable rates. It undermines the assumption that the processor itself is a reliable component.

### Self-check questions

1. Two threads each increment their own `long` field with `Interlocked.Increment`, and the program runs slower than with one thread. Explain the mechanism in terms of cache-line ownership. Explain how you would confirm it with a profiler or hardware counters.
2. A service writes a file, calls `Flush()` without arguments, and renames it. Power fails. Enumerate the possible on-disk states and the missing steps for each.
3. A pod moves from a 4-vCPU to an 8-vCPU limit and throughput does not improve. Give three substrate-level explanations (for example CFS throttling, memory bandwidth, or GC mode) and a measurement that distinguishes each.
4. Why does doubling the speed of every CPU in a service *not* halve the latency of an operation that makes one cross-region call?
5. The CLI guarantees atomic access to an aligned `int`. Why does that give you no guarantee about an invariant relating two `int` fields? (Forward to §2.)

---

## 2. Shared state and concurrency

### The constraint

Since clock speeds stopped rising (§1), throughput comes from multiple executors running at once. These are cores, threads, processes, and in distributed systems, nodes.

When two executors access the same mutable location, the hardware and compiler work against intuition. CPUs buffer stores, execute out of order, and speculate. Compilers hoist, reorder, and eliminate memory accesses. All of this is legal as long as a *single* thread cannot tell the difference.

**Sequential consistency** is the model in which all operations appear in one interleaving consistent with each thread's program order. It would forbid many of these optimizations, and it is expensive. Hardware therefore provides weaker models:
- **x86** is close to total store order (TSO). It permits a later load to pass an earlier store to a different location.
- **ARM64** is considerably weaker. This matters for .NET on Graviton, Ampere, and Apple Silicon.

The constraint is that correctness across threads must be *established explicitly*, through synchronization that creates ordering. It does not come for free.

### What goes wrong

Keep two classes of failure apart. They have different causes and different remedies.

**Atomicity failures.** `count++` is three operations: load, add, store. Two threads interleave, both load 41, both store 42, and one increment is lost. Atomicity can also fail across fields:
- A `DateRange` with `From` and `To` is updated as two writes.
- Each write is atomic.
- A reader can still observe `From` from the new range and `To` from the old one, producing a range where `From > To`.

**Atomicity on one word does not preserve invariants across fields.**

**Visibility and ordering failures.** A write may not be seen by another thread, or may be seen out of order:

- *Publication:* thread A initializes an object and then sets a `ready` flag. On ARM, thread B can see `ready == true` and still read uninitialized fields, unless the flag write has release semantics and the flag read has acquire semantics.
- *Hoisting:* in a Release build, `while (!_stop) { }` with a non-volatile `_stop` can be compiled into a loop that reads `_stop` once. The loop then runs forever. The code "worked" in Debug.

**Further failure modes.**
- **Deadlock** from inconsistent lock ordering.
- **Lock convoys:** threads queue behind a lock whose holder is descheduled (§1).
- **Priority inversion.**
- **Thread-pool starvation:** sync-over-async (`.Result`, `.Wait()`) blocks pool threads that the awaited work needs.
- **ABA** in compare-and-swap loops, described below.

**Data race versus race condition.** These terms are often used interchangeably. They name different things.

- A **data race** is a *memory-level event*. Two accesses to the same location, at least one of them a write, are not ordered by happens-before, and at least one is not a synchronizing (atomic or volatile) access.
- A **race condition** is a *logical property*. The correctness of the program depends on the timing or interleaving of operations.

The two are independent:

- **A race condition without a data race.** Every individual operation is synchronized, but the composite is not:

  ```csharp
  if (!dict.ContainsKey(k)) dict.TryAdd(k, Create());
  ```

  On a `ConcurrentDictionary`, each call is thread-safe, but two threads can both see "absent" and both call `Create()`. A second case: on a single-threaded `SynchronizationContext` (classic UI, or old ASP.NET), *no data race is possible at all*. Yet `if (_cache is null) _cache = await LoadAsync();` can call `LoadAsync` twice, because the `await` is an interleaving point.
- **A data race without a visible bug.** An unsynchronized flag read that happens to work on x86 today, under the current JIT. These are *more dangerous* than visible race conditions. They are latent: a JIT change (tiered compilation, dynamic PGO), a move to ARM64, or a different load pattern turns them into heisenbugs. Nothing in testing tells you they exist.

### What you must understand

**Happens-before is the unit of correctness.** Happens-before is a partial order on memory actions. It is formed from:
- *program order* within a thread, plus
- *synchronizes-with* edges between threads,

closed under transitivity. Synchronizes-with edges include:
- a release on a location paired with an acquire on the same location that observes its value;
- a lock release paired with a later acquire of the same lock;
- thread start and join;
- task completion paired with its continuation.

If write W happens-before read R, and no other write intervenes, R sees W. Nothing else gives you that guarantee.

**Why locks work.** A lock is not magic mutual exclusion that also happens to flush memory. Acquiring a lock is an acquire operation and releasing it is a release operation. A release followed by an acquire of the same lock creates a synchronizes-with edge. Everything thread A did before releasing is therefore visible to thread B after acquiring. *Mutual exclusion gives atomicity; the release–acquire chain gives visibility.* A lock provides both, which is why it is the default.

**DRF-SC.** The central result of modern memory models is "data-race-free implies sequentially consistent" (Adve & Hill 1990; adopted by Java's JSR-133 in 2004 and by C++11): if a program has no data races, it behaves as if sequentially consistent. This is the contract that lets ordinary programmers ignore hardware reordering, *provided* they synchronize all shared mutable access.

**The .NET memory model.** ECMA-335 specifies a weak model. CoreCLR's actual guarantees are stronger and are now documented in the dotnet/runtime repository (`docs/design/specs/Memory-model.md`) **[verify exact path]**. The key points:

- `Volatile.Read` has **acquire** semantics: no later memory access can move before it.
- `Volatile.Write` has **release** semantics: no earlier memory access can move after it.
- `Interlocked` operations are **full fences**: no reordering across them in either direction.
- `Thread.MemoryBarrier()` / `Interlocked.MemoryBarrier()` is an explicit full fence.
- Storing an object reference into a shared location has release-like publication guarantees on CoreCLR, so a reader that sees the reference sees the constructor's writes **[verify the precise wording in the runtime spec before relying on it]**.

**Acquire/release does not give you everything.** Acquire and release prevent some reorderings but *not* a release store followed by an acquire load of a *different* variable. This is the store–load reordering that x86 also permits. Dekker-style mutual exclusion cannot be built from `Volatile.Read` and `Volatile.Write`. It needs a full fence or an `Interlocked` operation. Engineers often assume `volatile` means "sequentially consistent". It does not.

**Compare-and-swap.** `Interlocked.CompareExchange(ref location, newValue, expected)` writes `newValue` only if `location` still holds `expected`, and returns the value it found. It is a *conditional atomic write*. A lock-free update is a retry loop:
1. read the current value;
2. compute a new one;
3. CAS;
4. if another thread got there first, repeat.

**Progress guarantees.**

| Guarantee | Meaning |
|---|---|
| Blocking | A descheduled lock holder stops everyone waiting for the lock. |
| Obstruction-free | A thread running alone completes. |
| Lock-free | Some thread always makes progress. |
| Wait-free | Every thread completes in a bounded number of steps. |

**Lock-free is not the same as fast.** Under contention, CAS loops retry, and every failed CAS still pulls the cache line into exclusive state. A well-implemented lock can outperform a lock-free structure under heavy contention, because it serializes access instead of producing a coherence storm. Lock-free structures win when contention is low and blocking is unacceptable, for example because of descheduling or real-time constraints.

**ABA: when "unchanged" lies.** CAS checks that a value is *equal* to what you read, not that it is *unchanged*. Suppose thread 1 reads A, thread 2 changes A to B and back to A, and thread 1's CAS succeeds. Thread 1's reasoning, based on the state it observed, may now be wrong.

In native code the classic case is a freed and reused node address. In .NET, the GC prevents that particular case: a node cannot be freed and its address reused while a thread still holds a reference to it. **ABA still occurs in .NET** with:
- value-typed state (integers, enum states, version-less counters);
- pooled objects that are returned to an `ObjectPool` or `ArrayPool` and reissued.

Remedies:
- version stamps combined into the compared value;
- immutable nodes that are never reused;
- avoiding pooling in lock-free code.

.NET has no general double-width CAS.

**Locks compose poorly.** Two thread-safe operations do not form a thread-safe sequence, as the `ContainsKey`/`TryAdd` case shows. Holding two locks requires a global ordering discipline. Calling unknown code (callbacks, virtual methods, events) while holding a lock invites deadlock.

Software transactional memory was the main research answer to composition (Harris et al. 2005). Microsoft's STM.NET experiment was abandoned around 2010. Joe Duffy's retrospective blog post cites performance and the impossibility of transacting I/O.

**async/await removes thread blocking, not races.** An `await` frees the thread, and the continuation may run on another thread. The await point is an interleaving point. Shared state accessed across awaits needs the same reasoning as threaded code:
- `lock` cannot contain an `await` (the compiler forbids it).
- `SemaphoreSlim.WaitAsync` provides async mutual exclusion.
- .NET 9's `System.Threading.Lock` type is a better synchronous lock, but it does not change the async picture.

**The distributed analogue.** Two replicas of a service form a shared-state system with *no memory model at all*. The database becomes the shared memory and its isolation level becomes the memory model (§5). Everything in this set recurs there, at roughly 10⁴ times the latency.

### Trade-offs and alternatives

| Strategy | Mechanism | Costs |
|---|---|---|
| **Confinement** | Only one executor touches the state: actor, single-writer principle, `Channel<T>` with one consumer. | Throughput bounded by one thread; hand-off latency; back-pressure must be designed. |
| **Immutability** | State is never mutated; updates create new versions published by an atomic reference swap. | Allocation and GC pressure; copying cost for large state; lost updates if two writers swap concurrently (needs CAS or a single writer). |
| **Partitioning by key** | Each key's state is owned by one executor. | Hot keys (§7); cross-key operations need coordination. |
| **Locks** | Mutual exclusion plus the release–acquire chain. | Deadlock, convoys, poor composition; blocking under descheduling. |
| **Lock-free structures** | CAS retry loops. | Hard to verify; ABA; poor under contention; limited to simple structures. |
| **Push invariants into the database** | Constraints, isolation, row locks. | Round-trip latency; coupling to engine semantics (§5); throughput limited by the database. It is the only option here that also works across processes and replicas. |

### Contested points

- **Actors versus shared memory.** Actor advocates argue that message passing eliminates data races by construction. Critics observe that it moves race conditions into message ordering: two messages that arrive in either order are a race condition at the protocol level. Tasharofi, Dinges & Johnson (ECOOP 2013) **[verify]** found that Scala developers frequently mix actors with other concurrency models, which suggests the pure model rarely suffices in practice. Both positions are correct about their own claim.
- **"Benign" data races.** Some practitioners treat certain unsynchronized accesses as harmless, for example a lazily computed hash code. Boehm (2011) argued that compilers can legally miscompile such programs, so no data race is reliably benign in a language whose memory model gives racy programs weak or undefined semantics. .NET's model is less hostile than C++'s, which has undefined behaviour, but the argument about future compilers still applies. The stronger position (Boehm's) is better supported; the pragmatic position survives in runtime-internal code written by people who know the JIT.
- **Static prevention.** Rust's ownership system (stable since 2015) shows that data races can be ruled out statically in a mainstream language. It does not prevent race conditions or deadlocks. Whether its cost to the programmer is worth it outside systems programming is contested.

### Examples

**Example 2.1 — Hoisted read (C#).**

```csharp
private bool _stop;                         // not volatile
public void Run()  { while (!_stop) { /* no calls */ } }   // may never exit in Release
public void Stop() { _stop = true; }
// Fix: while (!Volatile.Read(ref _stop)) ... ; Volatile.Write(ref _stop, true);
```

**Example 2.2 — Preserving a multi-field invariant by immutable snapshot (C#).**

```csharp
public sealed record Period(DateOnly From, DateOnly To)
{
    public Period(DateOnly from, DateOnly to) : this()
    { if (from > to) throw new ArgumentException(); (From, To) = (from, to); }
}

private Period _current = new(DateOnly.MinValue, DateOnly.MaxValue);

public Period Current => Volatile.Read(ref _current);          // acquire
public void Set(DateOnly f, DateOnly t) => Volatile.Write(ref _current, new Period(f, t)); // release
```

Readers can never observe a torn period. Two concurrent `Set` calls cannot corrupt the invariant, but one of them silently wins. If updates are read-modify-write (for example "extend `To` by 30 days"), use a CAS loop:

```csharp
public void Extend(int days)
{
    while (true)
    {
        var seen = Volatile.Read(ref _current);
        var next = seen with { To = seen.To.AddDays(days) };
        if (Interlocked.CompareExchange(ref _current, next, seen) == seen) return;
    }
}
```

Because each `Period` is a fresh immutable object, ABA cannot occur here.

### Key literature

1. **Lamport, L. (1979). "How to Make a Multiprocessor Computer That Correctly Executes Multiprocess Programs." *IEEE Transactions on Computers* C-28(9).** — *Seminal.* Defines sequential consistency, the baseline against which all weaker models are described.
2. **Adve, S. V. & Gharachorloo, K. (1996). "Shared Memory Consistency Models: A Tutorial." *IEEE Computer* 29(12).** — *Seminal.* The clearest introduction to relaxed models and to why compilers and hardware reorder.
3. **Boehm, H.-J. (2005). "Threads Cannot Be Implemented as a Library." PLDI '05.** — *Seminal.* Shows that correct concurrency requires a language-level memory model. This argument led to the C++11 and Java models and shaped .NET's.
4. **Herlihy, M., Shavit, N., Luchangco, V. & Spear, M. (2020). *The Art of Multiprocessor Programming*, 2nd ed. Morgan Kaufmann.** (1st ed. by Herlihy & Shavit, 2008.) — *Seminal.* The standard text on linearizability, progress guarantees, CAS-based structures, and ABA.
5. **Boehm, H.-J. (2011). "How to Miscompile Programs with 'Benign' Data Races." HotPar '11.** — *Seminal (contested point).* The strongest argument that no data race is safe to rely on.
6. **.NET runtime team. "Memory Model" specification, dotnet/runtime repository (c. 2022) [verify date and path].** — *Recent; specification document, not peer-reviewed.* The authoritative description of the guarantees CoreCLR actually provides beyond ECMA-335.

### Self-check questions

1. Write a short C# program with a race condition but no data race, and another with a data race but no currently visible bug. Explain which is more dangerous in production and why.
2. Explain why `Volatile.Write(ref a, 1); var r = Volatile.Read(ref b);` on one thread, mirrored on another thread, can result in both threads reading 0. What is the minimal fix?
3. In .NET, the GC eliminates one class of ABA. Which class, and construct a case it does not eliminate?
4. A Blazor Server component (single logical thread of execution per circuit) loads data in `OnInitializedAsync` and also on a button click. Explain how a race condition can arise without any data race, and give two fixes.
5. Two replicas of a service enforce "at most one active session per user" with an in-process `lock`. What fails, what is the distributed equivalent of the race, and where should the invariant live?

---

## 3. Time and ordering

### The constraint

There is no global clock.

- **Drift.** Quartz oscillators drift by tens of parts per million. 20 ppm is about 1.7 seconds per day.
- **Skew.** NTP keeps clocks within milliseconds over the internet and sub-milliseconds on a good LAN. PTP and hardware timestamping reach microseconds. These are typical values, not bounds.
- **Jumps.** Clocks jump when NTP steps them, when a VM resumes from pause, or when a leap second is handled by stepping instead of smearing.
- **No upper bound on message delay** (§4).

Together these mean that *the order of events on different machines is not observable by comparing their timestamps.* The only ordering a distributed system can know with certainty is the one created by messages: if A sent a message that B received before doing X, then A's send precedes X.

### What goes wrong

- **Last-writer-wins with skewed clocks.** Node 1's clock runs 300 ms fast. A user updates a record via node 1, then corrects it 100 ms later via node 2. Node 2's timestamp is smaller, so LWW keeps the *older* value and discards the correction silently.
- **Lease expiry measured on the wrong clock.** A process holds a lease "until 12:00:30" by its wall clock. Its clock is behind, or it was paused by GC (§1). It acts after another holder has taken over (§4).
- **Ordering by `created_at` across servers.** Rows inserted by different application servers are sorted by application-side timestamps. Causally later rows sort earlier.
- **Elapsed time measured on the wall clock.** `DateTime.UtcNow` differences go negative or spike when NTP steps the clock. In 2017 a leap second caused a negative duration in Cloudflare's DNS software, which then panicked.
- **Sequence numbers are not commit order.** A PostgreSQL sequence hands out 101 to transaction T1 and 102 to T2. T2 commits first. A consumer polling `WHERE id > @last` reads 102, stores `last = 102`, and never sees 101 when T1 commits. This is a common bug in hand-built outbox relays and projections (§5, §10).
- **Civil time.** A deadline "end of day 31 March" is ambiguous until you say whose day. The repeated hour at the autumn DST transition makes some local times ambiguous, and the spring transition makes some local times nonexistent. A future appointment stored as a UTC instant becomes wrong if the time zone rules change before the date arrives.
- **Untestable time.** `DateTime.Now` scattered through business logic makes overdue-reminder rules untestable except by waiting or by changing the machine clock.

### What you must understand

**Two kinds of clocks.**

| Clock | .NET API | Properties | Use for |
|---|---|---|---|
| Wall clock (time of day) | `DateTime.UtcNow`, `DateTimeOffset.UtcNow`, `TimeProvider.GetUtcNow()` | Comparable across machines (approximately); can jump in either direction | Timestamps meaningful to humans |
| Monotonic clock | `Stopwatch.GetTimestamp()`, `Environment.TickCount64`, `TimeProvider.GetTimestamp()` | Never goes backwards within one boot; meaningless across machines | Measuring durations and timeouts |

**Causality is a partial order.** Lamport's happens-before relation (→) is defined by:
- program order within a process;
- send → receive for each message;
- transitivity.

Two events are *concurrent* (a ∥ b) if neither happens-before the other. Concurrent does not mean simultaneous. It means *no information flowed between them*, so neither could have influenced the other. Most of the ordering problems in distributed systems come from treating a partial order as if it were total.

**Lamport timestamps.** Each process keeps a counter:
- increment it on each event;
- attach it to messages;
- on receive, set it to max(local, received) + 1.

Guarantee: *if a → b then L(a) < L(b).* The converse does not hold. L(a) < L(b) is consistent with a → b and with a ∥ b. Breaking ties by process id gives a total order consistent with causality, but the order it imposes on concurrent events is arbitrary. You cannot detect concurrency with Lamport timestamps. If your business needs to know that two edits conflicted, Lamport timestamps throw that information away.

**Vector clocks.** Each process keeps a vector with one entry per process (Fidge 1988; Mattern 1989). Vectors are compared component-wise. *a → b iff V(a) < V(b).* If neither vector dominates the other, the events are concurrent.

Vector clocks therefore *detect* concurrency, which is what you need to surface a conflict instead of silently picking a winner. The cost is O(N) metadata per message or version, and growth with the number of writers.

Related structures:
- **Version vectors** have the same form but are attached to replicas of a data item, not to events.
- **Dotted version vectors** fix a precision problem in version vectors when clients write through servers (Preguiça et al. 2010) **[verify]**.

**Hybrid logical clocks (HLC).** Kulkarni et al. (2014) combine a physical component (the maximum physical time seen so far) with a logical counter used to break ties. The result:
- respects causality like a Lamport clock;
- stays within a bounded distance of physical time;
- fits in a 64-bit timestamp.

CockroachDB uses HLC, and MongoDB's cluster time is HLC-like **[verify the exact mechanism in current MongoDB releases]**. HLC gives you timestamps that are causally consistent *and* readable as approximate wall time.

**Bounded-uncertainty clocks.** Google Spanner's TrueTime returns an interval [earliest, latest] guaranteed to contain true time, with ε typically a few milliseconds, maintained by GPS receivers and atomic clocks. On commit, Spanner:
1. chooses timestamp s ≥ latest;
2. waits until earliest > s (the *commit wait*) before making the write visible.

Any transaction that starts after the commit becomes visible therefore gets a larger timestamp. This gives **external consistency** (strict serializability, §5), where timestamp order matches real-time order. The price is commit latency of about 2ε per transaction, plus specialized clock infrastructure. AWS ClockBound exposes similar error bounds **[verify current product name and status]**. Systems without such bounds that assume a maximum clock offset (CockroachDB's `max-offset`) must detect violations and stop nodes, because correctness depends on the assumption.

**Order is needed per stream, not globally.** In event sourcing, an aggregate's stream needs a total order, and the stream version provides it with optimistic concurrency on append. Different aggregates rarely need ordering against each other. A global order requires either a single sequencer (a bottleneck and a single point of failure, §7) or consensus (§6). Kafka gives order per partition, not per topic. Most systems that ask for "global order" actually need causal order between a few related streams. That is cheaper, and it is a different requirement.

**Event time versus processing time; valid time versus transaction time.**
- *Event time* is when something happened in the world.
- *Processing time* is when the system saw it.

Stream processors handle late data with watermarks (Akidau et al. 2015). Bitemporal data models distinguish *valid time* (when the fact holds) from *transaction time* (when the system recorded it). Public-sector systems need both. For example, "the person's address on 1 January as known to us on 15 March" is a legal question answered from bitemporal data.

**Deadlines propagate; timeouts do not.** A chain of services each configured with a 5-second timeout can spend 15 seconds on a request whose client gave up after 5. Propagating an absolute deadline (as gRPC does) lets each hop compute its remaining budget. A deadline is a time value that crosses machines, so it is also subject to skew. Propagating a remaining duration instead of an absolute time avoids the skew, at the cost of ignoring network transit time.

**"Now" is an input.** Business logic that reads the clock directly is non-deterministic and untestable. .NET 8 introduced `TimeProvider` (with `FakeTimeProvider` in `Microsoft.Extensions.TimeProvider.Testing`). Inject it. The same principle makes event-sourced projections replayable: the time of an event is data in the event, not the time of replay.

**Storing civil times.**

| What you are storing | How to store it |
|---|---|
| A past instant | UTC (`timestamptz` in PostgreSQL stores UTC) |
| A future civil time that is defined by local rules ("the session starts at 10:00 Tallinn time on 28 March 2027") | Local date-time plus IANA zone ID, converted to an instant only when needed |

Time zone rules change by legislation. NodaTime's separation of `Instant`, `LocalDateTime`, and `ZonedDateTime` makes this distinction explicit in types. BCL types blur it.

### Trade-offs and alternatives

| Ordering mechanism | Gives | Costs |
|---|---|---|
| Wall-clock timestamps | Human-readable, cheap | Wrong under skew; silent data loss with LWW |
| Lamport timestamps | Causal consistency, cheap | Cannot detect concurrency |
| Vector clocks / version vectors | Exact concurrency detection | O(N) metadata; pruning problems |
| HLC | Causal plus approximately physical; compact | Assumes bounded skew for the "approximately physical" property |
| TrueTime-style bounded clocks | External consistency | Hardware infrastructure; commit wait per transaction |
| Single sequencer (one database sequence, one log) | Simple total order | Throughput ceiling (§7); single point of failure; still not commit order unless the log *is* the commit (see the sequence bug above) |
| Per-stream order only | Scales horizontally | Cross-stream invariants and projections must handle interleaving (closing chains) |

### Contested points

- **Is last-writer-wins ever acceptable?** Jepsen analyses of LWW-based stores repeatedly documented acknowledged writes being lost under skew. One position: LWW is acceptable where losing one of two concurrent writes is genuinely harmless (a "last seen" timestamp, a cached preference). The opposing position: LWW is chosen because it is easy, and the business consequences are rarely examined. Both are right. The defensible practice is that LWW must be an explicit business decision per field, not a storage default.
- **Correctness that depends on bounded clock skew.** CockroachDB and Spanner make correctness depend on clock bounds, and enforce them operationally. Kleppmann (2016, distributed locking post) argues that correctness should never depend on timing assumptions, only liveness should. The positions differ in whether operational enforcement of bounds is trustworthy enough. The evidence includes real incidents of clock misbehaviour in virtualized environments.
- **Leap seconds.** In 2022 the CGPM resolved to stop inserting leap seconds by 2035. Until then, smearing (spreading the second over hours, as Google and AWS do) and stepping coexist. Mixing smeared and non-smeared sources creates skew of up to a second. The decision to abolish is settled; the transition handling is not.

### Examples

**Example 3.1 — Sequence order is not commit order (SQL scenario).**

```sql
-- Session 1                                -- Session 2
BEGIN;
INSERT INTO outbox(payload) VALUES ('A');  -- gets id 101
                                            BEGIN;
                                            INSERT INTO outbox(payload) VALUES ('B'); -- id 102
                                            COMMIT;
-- relay: SELECT * FROM outbox WHERE id > 100 → sees 102, stores last = 102
COMMIT;                                     -- 101 now visible, never relayed
```

Alternatives:
- Mark rows as processed (`status` column with `FOR UPDATE SKIP LOCKED`, §7) instead of using a high-water mark.
- Gate on transaction visibility with PostgreSQL snapshot functions (`pg_snapshot_xmin(pg_current_snapshot())`), relaying only rows older than every in-flight transaction.
- Use logical decoding, which emits changes in commit order.

Each has operational costs. The high-water-mark approach is the cheapest and the incorrect one.

**Example 3.2 — Injected time (C#).**

```csharp
public sealed class ReminderPolicy(TimeProvider clock)
{
    public bool IsOverdue(Obligation o) => clock.GetUtcNow() >= o.DueAt;
}

// Test
var clock = new FakeTimeProvider(new DateTimeOffset(2027, 3, 31, 21, 0, 0, TimeSpan.Zero));
Assert.False(new ReminderPolicy(clock).IsOverdue(obligation));
clock.Advance(TimeSpan.FromHours(3));
Assert.True(new ReminderPolicy(clock).IsOverdue(obligation));
```

The test makes the business definition of "end of day" explicit. Note that 21:00 UTC is midnight in Tallinn in summer time.

### Key literature

1. **Lamport, L. (1978). "Time, Clocks, and the Ordering of Events in a Distributed System." *Communications of the ACM* 21(7), 558–565.** DOI: 10.1145/359545.359563 — *Seminal.* Defines happens-before and logical clocks. Everything in this set descends from it.
2. **Mattern, F. (1989). "Virtual Time and Global States of Distributed Systems." In *Parallel and Distributed Algorithms*, North-Holland.** — *Seminal.* Introduces vector time (independently of Fidge, 1988) and its use for consistent global snapshots.
3. **Corbett, J. C., Dean, J., et al. (2012). "Spanner: Google's Globally-Distributed Database." OSDI '12.** — *Seminal.* The TrueTime design and commit wait, the clearest demonstration of paying latency for external consistency.
4. **Kulkarni, S., Demirbas, M., Madappa, D., Avva, B. & Leone, M. (2014). "Logical Physical Clocks." OPODIS 2014.** — *Seminal for current practice.* Defines hybrid logical clocks, now used in several production databases.
5. **Akidau, T., Bradshaw, R., Chambers, C., et al. (2015). "The Dataflow Model." *PVLDB* 8(12).** — *Seminal.* Separates event time from processing time and introduces watermarks and triggers for out-of-order data.
6. **Geng, Y., Liu, S., Yin, Z., et al. (2018). "Exploiting a Natural Network Effect for Scalable, Fine-grained Clock Synchronization." NSDI '18.** — *Recent.* Software clock synchronization (Huygens) reaching tens of nanoseconds in data centres. It shows that the bound on ε is an engineering variable, not a constant.

Also useful: **Sheehy, J. (2015). "There Is No Now." *ACM Queue* 13(3).** A practitioner essay, short and precise, on why "now" is not a distributed concept.

### Self-check questions

1. Two application servers insert rows with `created_at = DateTime.UtcNow`, and a consumer reads `WHERE created_at > @last`. Name two independent mechanisms by which rows are missed, and a design that eliminates both.
2. Why can Lamport timestamps not tell you that two edits to the same document were concurrent? What business capability do you lose as a result?
3. What exactly does commit wait buy in Spanner? Express the per-transaction cost in terms of ε, and explain why a system without bounded clocks cannot buy the same property this way.
4. You must store "the hearing starts at 10:00 local time on 28 March 2027 in Tallinn". Instant or local time plus zone? Justify, including what happens if the EU abolishes seasonal clock changes before that date.
5. A request passes through three services, each with a 5-second timeout. Show the worst case, and explain the difference between propagating an absolute deadline and a remaining duration.

---

## 4. Partial failure and the network

### The constraint

In a single process, a function call either returns or the whole process dies. In a distributed system, components fail independently, and the network between them can delay, drop, duplicate, or reorder messages without bound. The fundamental constraint is that **a slow component cannot be distinguished from a failed one.** No amount of waiting tells you which. This is what makes distributed systems different in kind, not degree, from local ones (Waldo et al. 1994 made this argument against RPC systems that hid the difference).

Real networks fail more often than designers assume. Bailis & Kingsbury (2014) collected public reports of partitions inside data centres and clouds. Gray failures are partial, intermittent, or visible only to some observers (Huang et al. 2017). They are harder than clean crashes, because health checks pass while users fail.

### What goes wrong

**One timeout, five possible worlds.** A client sends a request and times out. Exactly one of the following happened:

1. The request never arrived.
2. It arrived, and the server crashed before processing it.
3. It was processed, and the server crashed before replying.
4. It was processed, and the reply was lost.
5. The server is still processing, just slowly. It may yet succeed.

In worlds 1 and 2 nothing happened. In 3 and 4 the effect happened. In 5 the effect may happen in the future, possibly *after* the client has retried. **The outcome is indeterminate.** A timeout is a suspicion, not a failure report.

**Consequences.**
- **Duplicates on retry.** Worlds 3, 4, and 5 make a naive retry perform the effect twice: two payments, two reminders, two registry entries.
- **Lost effects on non-retry.** Worlds 1 and 2 make "assume failure and give up" lose the effect.
- **The commit that might have happened.** If the connection drops during `COMMIT`, the client does not know whether the transaction committed. PostgreSQL's documentation states this explicitly.
- **Zombie writers.** A process holding a lock or lease is paused (GC, VM migration; §1). The lease expires and another process acquires it. The first process wakes and writes, unaware. Two writers now act as owner. This is split brain at small scale.
- **Cascading failure.** One slow dependency holds threads or connections. Callers time out and retry, adding load. The slow dependency gets slower (§7).

### What you must understand

**Classify every remote interaction.** Each remote call has three outcome classes, not two:

| Class | Examples | Required handling |
|---|---|---|
| **Definite success** | Response received and validated | Proceed |
| **Definite failure** | The server *processed and rejected* the request: validation error, a 4xx that is defined as having no effect | Report or compensate |
| **Unknown** | Timeout, connection reset, 502/503/504 from a proxy, an error during `COMMIT`, gRPC `DEADLINE_EXCEEDED` | Resolve by idempotent retry, by querying the outcome, or by reconciliation |

Most code has two branches, try and catch, and silently maps "unknown" onto one of them. That mapping is a business decision being made by accident.

**Exactly-once, precisely.** It is commonly stated that "the Two Generals problem shows exactly-once delivery is impossible". The conclusion is right, but the attribution is imprecise, so I restate it.

- **What Two Generals proves.** No finite protocol over an unreliable channel can establish *common knowledge* that both parties will act. This is an impossibility about coordinated agreement.
- **Why exactly-once delivery is impossible.** It follows more directly from the indeterminacy above. A sender that does not receive an acknowledgment cannot know whether to resend, and a receiver that crashes after applying but before recording the message cannot know whether it applied it.
- **What is achievable.** *Exactly-once effect* (sometimes called "effectively once") is achievable *end-to-end* when the receiver records the fact of processing atomically with the effect itself, in the same transaction or the same log.

The practical guarantee is therefore **at-least-once delivery plus idempotent effects**, or at-most-once delivery where losing a message is acceptable.

**Idempotency.**
- An *operation* is idempotent if applying it twice has the same effect as applying it once.
- "Set status to Submitted" is naturally idempotent.
- "Add 10 to balance" and "send email" are not.

An **idempotency key** makes a non-idempotent operation idempotent from the caller's perspective:
1. The caller generates a unique key per *intended* operation.
2. The server stores the key together with the result, atomically with the effect.
3. On a duplicate key, the server returns the stored result instead of acting again.

The design details matter:
- **Key scope.** Per client? Per operation type?
- **Retention.** How long until a retry with the same key would act again?
- **Concurrent duplicates.** Two in-flight requests with the same key must not both act. A unique constraint on the key serializes them.
- **Body mismatch.** Same key, different body is a client error. Store a hash of the request to detect it.

**Failure models.** From weakest to strongest assumption violated:

| Model | Behaviour |
|---|---|
| **Crash-stop** | A node halts and never returns. |
| **Crash-recovery** | A node halts and may return with its stable storage intact but volatile state lost. This is the realistic model for most services and the reason durability (§1) matters. |
| **Omission** | A node fails to send or receive some messages. |
| **Timing (performance)** | A node responds, but outside expected bounds. |
| **Byzantine** | A node behaves arbitrarily, including maliciously or by sending inconsistent messages to different peers. Relevant for security (§14) and for some hardware faults (§1). |

Protocols are proved correct under a specific model. Running a crash-stop protocol in a crash-recovery world, for example by restarting a node with a stale disk, voids the proof.

**Failure detectors.** Chandra & Toueg (1996) characterized failure detectors by two properties:
- *completeness:* failed nodes are eventually suspected;
- *accuracy:* correct nodes are not suspected, or eventually not suspected.

In an asynchronous system, a perfect detector is impossible. Every practical detector trades false suspicion against detection time. Examples include heartbeat timeouts, Kubernetes liveness probes, and phi-accrual detectors (Hayashibara et al. 2004), which output a suspicion level instead of a binary verdict.

**Split brain and fencing.** When two nodes both believe they are leader or lock holder, timing alone cannot prevent both from acting. The robust remedy is a **fencing token**:
1. Each grant of the lease or leadership carries a monotonically increasing number: an epoch, term, or generation.
2. The *resource being protected* (the database or storage) rejects writes carrying a token lower than the highest it has seen.

The essential point is that **the resource must check the token, not the client.** A paused zombie client cannot check anything reliably about the present. This pushes fencing into the storage layer, which is often the hard part, because many resources (an SMTP server, a third-party API) cannot check tokens. For those, idempotency or reconciliation is the only option.

**FLP impossibility.** Fischer, Lynch & Paterson (1985) proved that in an asynchronous system, no deterministic consensus protocol can guarantee termination if even one process may crash. Precisely what is impossible:
- FLP is about **liveness**. A protocol can always remain *safe* (never decide inconsistently). It cannot guarantee that it will always decide.

Practical protocols escape FLP in three ways:
- **Partial synchrony** (Dwork, Lynch & Stockmeyer 1988). Assume bounds on delay hold *eventually*, after an unknown stabilization time. Safety holds always; liveness holds once the system behaves synchronously. Paxos and Raft take this route.
- **Randomization** (Ben-Or 1983). Termination with probability 1.
- **Failure detectors** of a specified strength.

**The transactional outbox.** You need to change local state *and* notify another system. Writing to the database and then publishing to a broker is a dual write: a crash between the two loses or duplicates the message. The outbox works as follows:
1. Insert the message into an `outbox` table in the *same local transaction* as the state change.
2. A relay publishes outbox rows at-least-once.
3. Consumers are idempotent (an "inbox" table of processed message IDs, written in the consumer's own transaction).

This converts a distributed atomicity problem into a local transaction plus idempotent redelivery.

**Reconciliation.** Some uncertainty is never resolved by protocol: third-party systems without idempotency, manual steps, legacy batch interfaces. Reconciliation is the backstop. Periodically compare the states of two systems against an authoritative source and repair differences. Accounting has done this for centuries. Treat it as a designed component with an owner (§19), not as an embarrassment.

**Timeouts.**
- Too short: false suspicion, more unknown outcomes, and duplicate work.
- Too long: threads, connections, and memory are held, and failure cascades.

Set timeouts from measured latency distributions (for example, a multiple of p99.9), together with retry budgets and circuit breakers. Nygard's *Release It!* catalogued these stability patterns.

### Trade-offs and alternatives

| Approach | Handles | Costs |
|---|---|---|
| **Idempotency keys** | Duplicates from retries | Key storage and retention policy; the client must generate and keep keys; concurrent-duplicate handling |
| **Idempotent effects by design** ("set" instead of "increment"; state transitions guarded by current state) | Duplicates without extra storage | Constrains the domain model; not always possible (sending a message) |
| **Transactional outbox** | Dual-write atomicity | Latency between commit and publish; a relay to operate; ordering subtleties (§3, Example 3.1) |
| **Two-phase commit** (§5) | Atomic multi-resource commit | Blocking on coordinator failure; locks held across the network |
| **Reconciliation** | Everything protocols miss | Detects only after the fact; needs an authoritative source; operational ownership |
| **Aggressive timeouts plus fail-fast** | Resource exhaustion, cascades | More unknown outcomes, so it needs one of the above |
| **Synchronous outcome query** ("did request X succeed?") | Resolving unknowns | The remote system must support it; the query itself can time out |

### Contested points

- **Distributed locks with leases.** Kleppmann (2016, blog) argued that Redis's Redlock algorithm is unsafe for correctness, because it depends on timing assumptions and provides no fencing token. Sanfilippo (2016, blog) replied that the assumptions are reasonable in practice and that a lock used only for efficiency need not be perfect. The resolution most specialists accept: for *efficiency* (avoiding duplicate work), a lease lock is fine; for *correctness*, you need fencing checked by the resource or a consensus-based system. Both blog posts are the origin of the debate and are cited as such below.
- **Vendor "exactly-once" claims.** Kafka's exactly-once semantics (since 0.11, 2017) provide atomic read-process-write *within Kafka* using transactions and idempotent producers. That is a true and useful guarantee. It does not extend to side effects outside Kafka, such as a database write or an email, unless those participate in the same atomic unit. Marketing language often blurs this boundary.
- **Microservices and partial failure.** One position holds that microservices multiply the number of partial-failure boundaries without proportional benefit for most organizations, which favours modular monoliths (§11). The opposing position holds that independent deployment and failure isolation outweigh this. The evidence is mostly case reports, not controlled comparison.

### Examples

**Example 4.1 — Idempotent submission (SQL + C#).**

```sql
CREATE TABLE submission_request (
    idempotency_key uuid PRIMARY KEY,
    request_hash    bytea       NOT NULL,
    result          jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);
```

```csharp
await using var tx = await db.Database.BeginTransactionAsync(ct);
var inserted = await db.Database.ExecuteSqlInterpolatedAsync(
    $"INSERT INTO submission_request(idempotency_key, request_hash) VALUES ({key}, {hash}) ON CONFLICT DO NOTHING", ct);

if (inserted == 0)
{
    // duplicate: a concurrent duplicate blocks on the PK until the first commits
    var prior = await db.SubmissionRequests.SingleAsync(r => r.IdempotencyKey == key, ct);
    if (!prior.RequestHash.SequenceEqual(hash)) return Conflict();   // same key, different body
    return Ok(prior.Result);                                         // return the first result
}

var result = await SubmitReport(cmd, ct);          // the effect, in the same transaction
await db.Database.ExecuteSqlInterpolatedAsync(
    $"UPDATE submission_request SET result = {Json(result)} WHERE idempotency_key = {key}", ct);
await tx.CommitAsync(ct);
```

The key, the effect, and the stored result commit together. If `CommitAsync` throws with an unknown outcome, the client retries with the same key and gets either the stored result or a fresh, single execution.

**Example 4.2 — Reminder via a third-party mail API (scenario).** The mail provider accepts the request, but the reply is lost (world 4). A retry sends a second email.

- If the provider supports a client-supplied message ID with deduplication, use it. That is an idempotency key enforced by the resource.
- If it does not, you must choose between at-most-once (risking a missed legal reminder) and at-least-once (risking duplicates). That is a business decision, and it should be made explicitly and recorded. Usually at-least-once wins, with message text written so a duplicate is harmless.

### Key literature

1. **Fischer, M. J., Lynch, N. A. & Paterson, M. S. (1985). "Impossibility of Distributed Consensus with One Faulty Process." *Journal of the ACM* 32(2), 374–382.** DOI: 10.1145/3149.214121 — *Seminal.* The FLP result: the precise boundary of what asynchronous systems cannot guarantee.
2. **Dwork, C., Lynch, N. & Stockmeyer, L. (1988). "Consensus in the Presence of Partial Synchrony." *Journal of the ACM* 35(2).** — *Seminal.* The model that practical consensus protocols rely on to escape FLP.
3. **Chandra, T. D. & Toueg, S. (1996). "Unreliable Failure Detectors for Reliable Distributed Systems." *Journal of the ACM* 43(2).** — *Seminal.* Formalizes failure detection as an unreliable oracle and characterizes what consensus requires of it.
4. **Helland, P. (2012). "Idempotence Is Not a Medical Condition." *ACM Queue* 10(4).** — *Seminal practitioner essay.* The clearest treatment of idempotence and message processing in loosely coupled systems.
5. **Bailis, P. & Kingsbury, K. (2014). "The Network Is Reliable." *ACM Queue* 12(7).** — *Seminal practitioner survey.* Evidence that partitions are common, which removes the excuse for assuming they are not.
6. **Kleppmann, M. (2016). "How to do distributed locking." Blog post.** https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html — *Blog; origin of the fencing-token argument as commonly cited.* Read with **Sanfilippo, S. (2016). "Is Redlock safe?"** (blog, antirez.com) for the opposing position.

Also: **Huang, P., Guo, C., Zhou, L., et al. (2017). "Gray Failure: The Achilles' Heel of Cloud-Scale Systems." HotOS '17.** — *Recent.* Why partial, observer-dependent failures defeat health checks.

### Self-check questions

1. `COMMIT` returns a socket error. List what you know and do not know about the state of the database. Design the client's next steps so that the business effect happens exactly once.
2. Explain why a fencing token must be checked by the protected resource and not by the lock holder. Name a resource in your systems that cannot check tokens, and what you would do instead.
3. State precisely what FLP forbids. Explain why a three-node Raft cluster still makes progress in practice, naming the assumption it relies on.
4. Design an idempotency-key scheme for a "submit annual report" endpoint. What happens with two concurrent requests that have the same key and the same body? The same key and different bodies? A retry after the key's retention period has passed?
5. State the precise relationship between the Two Generals problem and the impossibility of exactly-once delivery. Explain why exactly-once *effect* is nonetheless achievable, and under what condition.

---
## 5. Transactions and isolation

### The constraint

Many concurrent operations read and write overlapping data. Executing them one at a time is correct, but throughput is then bounded by the serial work (§7) and by the latency of each transaction. Interactive transactions that hold locks across application round trips make this worse.

Databases therefore allow transactions to overlap. They offer **isolation levels** that trade permitted anomalies for concurrency. Underneath are physical costs:
- lock waits;
- MVCC version storage and vacuum;
- round trips between application and database;
- in distributed transactions, network latency and partial failure (§4).

The constraint is that **an isolation level is a contract about which interleavings you will be exposed to**. Business logic is correct only relative to that contract.

### What goes wrong

**The anomalies**, roughly from weakest to subtlest:

| Anomaly | Description |
|---|---|
| **Dirty write** | A transaction overwrites another's uncommitted write. Prevented at every practical level. |
| **Dirty read** | A transaction reads another's uncommitted write, which may then roll back. |
| **Lost update** | Two transactions read the same value, both modify it, and one overwrites the other. |
| **Non-repeatable read (read skew)** | A transaction reads a row twice, or reads two related rows, and sees different committed states. An example is a balance and its ledger out of sync. |
| **Phantom** | A transaction's predicate query (`WHERE room = 7 AND overlaps(...)`) would return a different set if re-executed, because another transaction inserted or deleted matching rows. |
| **Write skew** | Two transactions read an overlapping set, each makes a decision based on what it read, and each writes a *different* object. Each is correct alone. Together they violate an invariant. |
| **Read-only anomaly** | Under snapshot isolation, a *read-only* transaction can observe a state that no serial order produces (Fekete, O'Neil & O'Neil 2004). |

**Write skew is the central business-logic case.** The standard example is an on-call roster:
- Rule: at least one doctor must be on call for a shift.
- Alice and Bob are both on call, and both feel unwell.
- Each opens the app at the same moment. Each transaction reads "2 doctors on call", concludes it is safe to go off call, and updates *its own* row.
- Both commit. Zero doctors are on call.

No row was written by both transactions, so row-level conflict detection sees nothing. The invariant spans rows. The same shape recurs in:
- "a case must have at least one responsible official";
- "total allocated budget must not exceed the limit";
- "no two active versions of the same draft".

### What you must understand

**Serializability, linearizability, and strict serializability.** These three are often confused. They are distinct.

| Property | Scope | Ordering requirement |
|---|---|---|
| **Serializability** | *Transactions* over *multiple objects* | The outcome equals *some* serial execution of the committed transactions. That order need *not* respect real time: a transaction that started after another committed may be ordered before it. |
| **Linearizability** (§6) | *Single operations* on a *single object* | Each operation appears to take effect atomically at some point between its invocation and response, so the order *does* respect real time. |
| **Strict serializability** | Transactions over multiple objects | Serializability plus real-time order. Spanner's external consistency is this (§3). |

A serializable system can show you a stale but consistent world. A linearizable register cannot, but it says nothing about multi-object invariants.

**Dependency graphs define anomalies precisely.** Adya (1999) defined isolation levels by forbidden cycles in a graph whose nodes are committed transactions and whose edges are:

- **ww (write dependency):** T2 overwrites a version T1 wrote.
- **wr (read dependency):** T2 reads a version T1 wrote.
- **rw (anti-dependency):** T2 overwrites a version that T1 read. T1 read "before" T2's write.

A history is serializable iff its graph is acyclic. Each anomaly is a cycle of a particular shape:
- Lost update involves a cycle with ww and rw edges.
- **Write skew is a cycle consisting of two rw anti-dependencies.** In the roster, T1 read Bob's row and T2 wrote it; T2 read Alice's row and T1 wrote it.

This definition is implementation-neutral. It applies equally to locking and to MVCC engines. It is more precise than the ANSI definitions, which Berenson et al. (1995) showed to be ambiguous.

**Snapshot isolation (SI).** Each transaction reads from a consistent snapshot taken at its start. Writes conflict only if two concurrent transactions write the *same* row ("first committer wins"). SI therefore prevents:
- dirty reads;
- non-repeatable reads;
- lost updates (in engines that detect write–write conflicts);
- most phantoms for reads.

It **permits write skew**, because write skew involves no write–write conflict. Fekete et al. (2005) proved that every SI anomaly contains a "dangerous structure": two consecutive rw edges between concurrent transactions.

**Names do not mean what they suggest.**
- Oracle's `SERIALIZABLE` is snapshot isolation.
- PostgreSQL's `REPEATABLE READ` is snapshot isolation. That is stronger than ANSI's definition with respect to phantoms and weaker than true serializability with respect to write skew.
- PostgreSQL's default is `READ COMMITTED`. Each *statement* gets a fresh snapshot.
- SQL Server's default `READ COMMITTED` uses locking unless `READ_COMMITTED_SNAPSHOT` is enabled.
- MySQL InnoDB's default `REPEATABLE READ` mixes snapshot reads (plain `SELECT`) with current reads (`SELECT ... FOR UPDATE`, `UPDATE`). This produces behaviour that matches neither textbook definition. Jepsen analysed it in detail **[verify: Jepsen MySQL analysis, c. 2023]**.

Always read the engine's documentation of what its level actually prevents.

**PostgreSQL serializable snapshot isolation (SSI).** Since PostgreSQL 9.1, `SERIALIZABLE` is implemented as SSI (Cahill, Röhm & Fekete 2008; Ports & Grittner 2012):
- SI is extended with tracking of rw anti-dependencies through predicate locks ("SIREAD" locks). These locks do not block anyone.
- When a dangerous structure appears, one transaction is aborted with SQLSTATE `40001` (`serialization_failure`).

SSI is optimistic. It never blocks on reads, and it aborts on suspected cycles, including some false positives.

**The consequence leaks into business code.** The *entire* transaction must be retried, including its reads and the decisions based on them. A retry loop around `SaveChanges()` alone is wrong, because it re-sends stale decisions. The retry boundary is the *unit of business decision*, and it must not include non-transactional side effects such as sending an email or calling an external API. Those belong after commit, or in an outbox (§4).

**Phantoms defeat row locks on check-then-insert.** "No overlapping bookings for room 7":
1. `SELECT ... WHERE room = 7 AND period && @p`
2. If empty, `INSERT`.

Under SI or `READ COMMITTED`, two transactions both see empty and both insert. `SELECT ... FOR UPDATE` does not help: it locks the rows returned, and *no rows were returned*. The conflict is on a row that does not exist yet.

Remedies:
- **Predicate locks**, which SSI provides in effect.
- **Constraints that encode the predicate.** PostgreSQL exclusion constraints, `EXCLUDE USING gist (room WITH =, period WITH &&)`, enforce non-overlap directly.
- **Materializing the conflict.** Lock a parent row that every competing transaction must touch: `SELECT ... FROM room WHERE id = 7 FOR UPDATE`.
- **Unique constraints**, where the invariant is uniqueness.

**Schema constraints are the cheapest correct enforcement.**
- `UNIQUE`, `FOREIGN KEY`, `CHECK`, and `EXCLUDE` are evaluated by the engine at the right isolation, for every writer, including writers you do not control: scripts, other services, future code.
- Deferrable constraints (`DEFERRABLE INITIALLY DEFERRED`) allow temporary violations within a transaction.

Invariants that are not expressible as constraints need one of the other techniques. Engineers often reach for application-level checks first, because the domain model lives in C#. That is backwards for invariants a constraint can express.

**Row locking and queues.**
- `SELECT ... FOR UPDATE` takes an exclusive row lock for the rest of the transaction.
- `FOR NO KEY UPDATE` is weaker and does not block foreign-key checks.
- `FOR UPDATE SKIP LOCKED` lets concurrent workers claim disjoint rows. It is the basis of database-backed queues (§7, closing chains).

**Two-phase commit (2PC).** A coordinator asks all participants to *prepare*: persist their changes and promise to commit if asked. If all say yes, it tells them to *commit*.

If the coordinator fails after participants have prepared but before telling them the outcome, participants are **blocked**. They cannot commit (others may have voted no) or abort (others may have committed), and they hold locks until the coordinator recovers. These are "in-doubt" transactions; PostgreSQL's `PREPARE TRANSACTION` leaves them visible in `pg_prepared_xacts`.

Three-phase commit removes blocking only under synchrony assumptions that real networks violate (§4). Paxos Commit (Gray & Lamport 2006) replaces the single coordinator with a consensus group.

**Sagas.** A saga is a sequence of local transactions, each with a compensating action that semantically undoes it (Garcia-Molina & Salem 1987).
- **Gains:** availability and independence. No locks are held across services.
- **Losses:** isolation. Other transactions see intermediate states. This amounts to dirty reads at business level.

Compensation is not rollback. A sent notification cannot be unsent; an issued decision may have legal effect. Countermeasures include:
- **semantic locks:** a "pending" state that other operations respect;
- **commutative updates;**
- **ordering steps** so that the irreversible step comes last (the "pivot" transaction).

**EF Core read-decide-write.** The default pattern is a common source of write skew:
1. Load entities.
2. Evaluate a rule in C#.
3. Modify one entity.
4. Call `SaveChanges()`.

Under PostgreSQL's default `READ COMMITTED`, two requests run this concurrently against the roster and both pass.

**Concurrency tokens** (`[ConcurrencyCheck]`, or Npgsql's mapping of a `uint` row-version property to the system column `xmin`) add `WHERE xmin = @original` to the UPDATE. They therefore detect a **lost update on the row you write**. They do **not** detect a **stale decision based on rows you only read**. In the roster, each transaction writes a different row with an unchanged token, so both succeed.

Remedies:
- *Include the read set in the conflict:* update a shared parent row's version, such as the shift row.
- Run at `SERIALIZABLE` and retry the whole unit of work. Npgsql's retrying execution strategy treats serialization failures as transient **[verify the current default behaviour]**, but the retry must re-execute the *read and decision*, which means wrapping the whole operation in `strategy.ExecuteAsync(...)`.
- Express the invariant as a constraint, or as a single conditional `UPDATE ... WHERE (SELECT count(*) ...) > 1`. Note that a conditional `UPDATE` under `READ COMMITTED` has its own subtleties with concurrent updates.

### Trade-offs and alternatives

| Approach | Correctness | Costs |
|---|---|---|
| **SERIALIZABLE (SSI) plus whole-transaction retry** | Prevents all anomalies, including write skew and phantoms | Retries under contention; false-positive aborts; retry logic in business code; non-idempotent side effects must be moved outside |
| **SI / READ COMMITTED plus explicit locks** (`FOR UPDATE` on a materialized conflict row) | Correct if every competing path takes the lock | Easy to forget on one path; lock waits; deadlocks if ordering is inconsistent |
| **Schema constraints** (unique, exclusion, check, FK) | Correct for every writer | Only expressible invariants; error handling must translate constraint violations into domain errors |
| **Optimistic concurrency tokens** | Prevent lost updates on written rows | Do not prevent write skew; conflict UX |
| **Single writer per aggregate** (serialize all commands for one aggregate through one executor) | Prevents intra-aggregate anomalies | Throughput per aggregate; cross-aggregate invariants unsolved; routing infrastructure |
| **2PC across resources** | Atomic multi-resource commit | Blocking, coordinator availability, locks held across network latency |
| **Sagas** | Eventual completion or compensation | No isolation; compensations are domain work; irreversible steps |
| **Redraw the boundary** so the invariant lives in one database | Removes the distributed transaction | Organizational and structural cost (§11, §19) |

### Contested points

- **Should serializable be the default?** One camp argues weak isolation is a false economy. Warszawski & Bailis (2017, "ACIDRain") found exploitable concurrency anomalies in a majority of the open-source e-commerce applications they examined. That is evidence that developers do not reason correctly about weak isolation. The other camp, supported by work on Highly Available Transactions (Bailis et al. 2014), argues that many applications do not need serializability, and that its cost under contention and in geo-distribution is real. The evidence supports this position: weak isolation causes real bugs, *and* serializable has real costs. The choice should be per operation, not global.
- **Sagas as a replacement for distributed transactions.** Proponents in the microservices literature present sagas as *the* solution. Critics point out that sagas shift isolation failures to business processes and that compensation logic is frequently untested. The original paper (Garcia-Molina & Salem 1987) was explicit about the loss of isolation. That caveat is often dropped in later presentations.
- **ORMs and optimistic concurrency by default.** Some argue every entity should carry a concurrency token. Others note that this gives a false sense of safety, because it does not address write skew, and complicates UX. Both are right about different anomalies.

### Examples

**Example 5.1 — Write skew under PostgreSQL REPEATABLE READ (SQL scenario).**

```sql
-- Both sessions: BEGIN ISOLATION LEVEL REPEATABLE READ;
-- S1: SELECT count(*) FROM on_call WHERE shift_id = 9 AND active;  -- 2
-- S2: SELECT count(*) FROM on_call WHERE shift_id = 9 AND active;  -- 2
-- S1: UPDATE on_call SET active = false WHERE shift_id = 9 AND doctor = 'A';
-- S2: UPDATE on_call SET active = false WHERE shift_id = 9 AND doctor = 'B';
-- S1: COMMIT;   -- ok
-- S2: COMMIT;   -- ok under REPEATABLE READ (SI); 40001 for one of them under SERIALIZABLE
```

**Example 5.2 — Materializing the conflict in EF Core (C#).**

```csharp
await strategy.ExecuteAsync(async () =>
{
    await using var tx = await db.Database.BeginTransactionAsync(ct);
    // Every path that changes the roster for a shift locks the shift row first.
    await db.Database.ExecuteSqlInterpolatedAsync(
        $"SELECT 1 FROM shift WHERE id = {shiftId} FOR UPDATE", ct);
    var active = await db.OnCall.CountAsync(o => o.ShiftId == shiftId && o.Active, ct);
    if (active <= 1) throw new DomainException("At least one doctor must remain on call.");
    (await db.OnCall.SingleAsync(o => o.ShiftId == shiftId && o.Doctor == me, ct)).Active = false;
    await db.SaveChangesAsync(ct);
    await tx.CommitAsync(ct);
});
```

The lock converts write skew into ordinary serialization on one row. Its weakness is discipline: a code path that skips the lock reintroduces the bug. A `SERIALIZABLE` alternative needs no discipline per path, but it needs retry wrapping around the same block.

### Key literature

1. **Berenson, H., Bernstein, P., Gray, J., Melton, J., O'Neil, E. & O'Neil, P. (1995). "A Critique of ANSI SQL Isolation Levels." SIGMOD '95.** DOI: 10.1145/223784.223785 — *Seminal.* Showed the ANSI definitions to be ambiguous, defined snapshot isolation, and identified write skew.
2. **Adya, A. (1999). *Weak Consistency: A Generalized Theory and Optimistic Implementations for Distributed Transactions.* PhD thesis, MIT.** — *Seminal.* Implementation-independent definitions of isolation levels via dependency-graph cycles, the precise language used in this set.
3. **Fekete, A., Liarokapis, D., O'Neil, E., O'Neil, P. & Shasha, D. (2005). "Making Snapshot Isolation Serializable." *ACM Transactions on Database Systems* 30(2).** — *Seminal.* Proves the dangerous-structure characterization of SI anomalies and gives static techniques to avoid them.
4. **Ports, D. R. K. & Grittner, K. (2012). "Serializable Snapshot Isolation in PostgreSQL." *PVLDB* 5(12).** — *Seminal for practice.* How SSI was implemented in PostgreSQL, with its performance and false-positive characteristics. It builds on Cahill et al. (2008).
5. **Garcia-Molina, H. & Salem, K. (1987). "Sagas." SIGMOD '87.** — *Seminal.* The original saga paper, including its explicit statement of the isolation trade-off.
6. **Warszawski, T. & Bailis, P. (2017). "ACIDRain: Concurrency-Related Attacks on Database-Backed Web Applications." SIGMOD '17.** — *Recent.* Empirical evidence that weak isolation produces exploitable bugs in real applications.

Also: the **Jepsen analyses** by Kyle Kingsbury (jepsen.io; practitioner reports, not peer-reviewed), and **Kingsbury, K. & Alvaro, P. (2020). "Elle: Inferring Isolation Anomalies from Experimental Observations." *PVLDB* 14(3).** — *Recent.* How isolation claims of real databases are tested.

### Self-check questions

1. Draw the dependency graph for the on-call write skew. Name each edge type, explain why snapshot isolation permits the cycle, and explain how SSI detects it.
2. Why does an EF Core concurrency token on the `on_call` row not prevent write skew? Give two changes that would, with their costs.
3. Give two correct ways to enforce "no overlapping bookings for one room" in PostgreSQL and compare their behaviour under contention.
4. Where must the retry loop for SQLSTATE `40001` sit in a request handler that also sends a notification? What must not be inside it?
5. Give one example each of a history that is serializable but not strictly serializable, and of a system that is linearizable per object but permits a multi-object anomaly.

---

## 6. Consistency, replication, and consensus

### The constraint

Data is replicated for three reasons:
- **availability:** survive a node failure;
- **latency:** serve from nearby;
- **durability:** survive a disk or site loss.

Replicas are kept in sync by messages, and messages take time. That time is bounded below by distance (§1) and unbounded above (§4). Every replicated system therefore chooses, per operation, between:
- *waiting* for replicas to agree, which costs latency and, under partition, availability; and
- *not waiting*, which permits replicas to disagree and costs anomalies.

This is not a design flaw to be fixed. It is the propagation delay of information.

### What goes wrong

- **Read-your-writes violation.** A user submits a form (write to the primary) and is redirected to a list served from a replica that has not caught up. The submission is missing. The user submits again, producing a duplicate.
- **Monotonic reads violation.** Successive requests hit different replicas with different lag, and data appears to go back in time.
- **Lost acknowledged writes on failover.** With asynchronous replication, the primary acknowledges a commit, then fails before shipping it. A replica is promoted and the acknowledged write is gone. The recovery point objective (RPO) is not zero, whatever the project documentation says.
- **Two primaries.** A failover manager promotes a replica because it believes the primary is dead (§4). The old primary is only partitioned and keeps accepting writes, so the data diverges. Tools such as Patroni use a lease in a consensus store (etcd) plus fencing (watchdog, demotion) to prevent this.
- **Silent data loss in multi-leader setups.** Concurrent edits at two sites are "resolved" by last-writer-wins and one disappears (§3).
- **Stale reads from a leader that is no longer leader.** A deposed leader that has not noticed serves reads from its local state.

### What you must understand

**Replication topologies.**

| Topology | How it works | Characteristics |
|---|---|---|
| **Single-leader, synchronous** | The leader waits for one or more replicas to confirm before acknowledging. | RPO zero for those replicas; commit latency includes a round trip; if the synchronous replica fails, writes stall unless the configuration degrades. PostgreSQL's `synchronous_standby_names = 'ANY 1 (a, b)'` waits for any one of a set. |
| **Single-leader, asynchronous** | The leader acknowledges immediately and ships later. | Low latency; replication lag; data loss on failover. |
| **Multi-leader** | Several nodes accept writes and exchange changes. | Write availability at each site; *concurrent writes conflict* and must be resolved. |
| **Leaderless** (Dynamo style) | Clients write to and read from multiple replicas directly, with N replicas, W write acknowledgements, and R read responses. | Tolerates node failures without failover; conflicts and stale reads require read repair and anti-entropy. |

**Conflict resolution in multi-leader and leaderless systems.**
- **Last-writer-wins.** Depends on clocks (§3) and discards data by design.
- **Application merge.** Store siblings and let domain code or a user merge them.
- **CRDTs** (Shapiro et al. 2011). Data types whose merge is commutative, associative, and idempotent, so replicas converge regardless of delivery order and duplication:
  - *State-based* CRDTs form a join semilattice.
  - *Operation-based* CRDTs require commutative operations and causal delivery.
  - Examples: grow-only counters, PN-counters, observed-remove sets, sequence CRDTs for text.

CRDTs guarantee *convergence*, not *invariants*. "Balance ≥ 0" cannot be maintained by a CRDT without coordination, because two replicas can each approve a withdrawal that is valid locally. This is the invariant-confluence boundary (§7).

**Consistency models.** Ordered roughly from strongest to weakest for single-object operations:

| Model | Guarantee |
|---|---|
| **Linearizability** (Herlihy & Wing 1990) | Every operation appears to take effect atomically at an instant between its invocation and response; all clients agree on one order consistent with real time. It is *per-object*: a linearizable key-value store gives no multi-key transactions. |
| **Sequential consistency** | One order consistent with each client's program order, not necessarily real time. |
| **Causal consistency** | Operations related by happens-before (§3) are seen in that order by everyone; concurrent operations may be seen in different orders. Causal consistency is (in a precise sense) the strongest model that remains available under partition (Mahajan, Alvisi & Dahlin 2011) **[verify publication venue: technical report]**. |
| **Eventual consistency** | Only that replicas converge if writes stop. It says nothing about what you read meanwhile. |

**Session guarantees** (Terry et al. 1994) are per-client and often exactly what user-facing systems need:
- **read your writes;**
- **monotonic reads;**
- **monotonic writes;**
- **writes follow reads:** a write made after a read is ordered after the write that was read.

They can be provided on top of asynchronous replication with client-carried tokens, for example a log position. That is much cheaper than linearizability.

**Quorums.** With N replicas, W write acknowledgements, and R read responses, **R + W > N** guarantees that every read quorum intersects every write quorum. A read therefore *contacts* at least one replica holding the latest acknowledged write. This is **necessary but not sufficient for linearizability**:

1. **Concurrent reads during a write.** A write has reached some replicas but not W. Reader 1's quorum includes an updated replica and returns the new value. Reader 2, starting afterwards, has a quorum without it and returns the old value. Real-time order is violated. ABD (Attiya, Bar-Noy & Dolev 1995) fixes this with a write-back phase: the reader writes the value it will return to a quorum before returning it.
2. **Sloppy quorums and hinted handoff.** When the "home" replicas are unreachable, writes go to substitute nodes, and quorum intersection no longer holds.
3. **Clock-based conflict resolution.** Concurrent writes resolved by LWW (§3) can make the "latest" value depend on skew.
4. **Failed writes are not rolled back.** A write that reached fewer than W replicas reports failure, but the replicas that received it keep it, and later reads may return it.

Check every protocol against these conditions instead of assuming that the formula buys linearizability.

**Consensus.** Consensus means several nodes agreeing on a value, or on a sequence of values in a replicated log, despite failures. It has four properties:

- **Agreement:** no two correct nodes decide differently.
- **Validity:** the decided value was proposed by some node.
- **Integrity:** each node decides at most once.
- **Termination:** every correct node eventually decides. This is the property FLP denies in pure asynchrony (§4).

Consensus is equivalent to atomic (total order) broadcast. A replicated log *is* repeated consensus. Protocols include Paxos (Lamport 1998/2001), Viewstamped Replication (Oki & Liskov 1988), Zab (ZooKeeper), and Raft (Ongaro & Ousterhout 2014). They tolerate f crash failures with 2f + 1 nodes using majority quorums. Flexible Paxos (Howard, Malkhi & Spiegelman 2016) showed that only the leader-election quorums and replication quorums need to intersect, not all pairs. That opens trade-offs between election cost and write cost.

**Epochs and terms are fencing tokens.** Each leader election increments a term (Raft) or ballot (Paxos). Messages carry it, and nodes reject messages from lower terms. This is the same mechanism as the fencing token in §4, built into the protocol. Exposing the term to external resources extends fencing beyond the consensus group.

**Raft's subtlety with linearizable reads.** A newly elected Raft leader has every committed entry in its log, which is guaranteed by the election restriction. It does *not* know which of those entries are committed, because the commit index from the previous term may be ahead of what it knows. It also cannot commit previous-term entries by counting replicas alone (Raft §5.4.2).

So before serving linearizable reads, a new leader must **commit an entry from its own term**, conventionally a no-op. A linearizable read then follows the ReadIndex procedure:
1. Record the commit index.
2. Confirm it is still leader by a heartbeat round to a majority.
3. Wait until the state machine has applied up to the recorded index.
4. Read.

*Lease reads* skip step 2 by assuming bounded clock drift. That trades a timing assumption for latency (§3).

Skipping these steps produces stale reads from deposed or newly elected leaders. Several production systems shipped exactly this bug, documented in Jepsen analyses.

**CAP and PACELC.**
- **CAP** as formalized by Gilbert & Lynch (2002) is narrow. During a network partition, a system cannot be both linearizable (for a register) and available (every non-failed node answers). It says nothing about behaviour without partitions, nothing about latency, and nothing about weaker models or multi-object transactions.
- **PACELC** (Abadi 2012) states the day-to-day trade-off: *if* Partition, choose Availability or Consistency; *Else*, choose Latency or Consistency. The "else" branch is where most design decisions live.
- **Where unit cost appears.** A cross-region synchronous commit pays one inter-region round trip (10–100 ms, §1) on every write. It also pays for extra replicas and inter-region egress. Per-key write throughput under linearizability is bounded by 1/RTT for operations that must be sequenced.

### Trade-offs and alternatives

| Choice | Option A (cost) | Option B (cost) |
|---|---|---|
| Replication mode | Synchronous (latency per commit; stalls if the synchronous replica fails) | Asynchronous (non-zero RPO; stale replicas) |
| Topology | Single leader (failover complexity; write latency from far regions) | Multi-leader or leaderless (conflicts; resolution logic; weaker guarantees) |
| Read path | Read from the leader (leader load; latency from far clients) | Read from followers with session tokens (client must carry tokens; reads may wait for replay) |
| Consistency model | Linearizable (coordination per operation) | Causal plus session guarantees (cannot enforce invariants requiring agreement, such as uniqueness) |
| Consensus | Use the database's built-in replication and failover (opaque; vendor-specific) | Use an external consensus service such as etcd or ZooKeeper (another system to operate; correctness of integration is your problem) |
| Conflict handling | Prevent conflicts by routing each key to one leader (routing infrastructure; hot keys) | Detect and merge (domain merge logic; CRDT metadata) |

### Contested points

- **The usefulness of CAP.** Brewer (2012, "CAP Twelve Years Later") argued that the "2 of 3" framing was misleading and that designers should manage partitions explicitly. Kleppmann (2015, "A Critique of the CAP Theorem", arXiv) argued that CAP's definitions are so narrow that it should not be used for classifying systems at all. Most specialists now treat CAP as a correct but narrow theorem and use PACELC or explicit consistency models for design.
- **CRDTs for general applications.** The local-first software movement (Kleppmann et al. 2019, Onward!) argues CRDTs enable collaboration without central servers. Critics point to metadata overhead, the difficulty of non-monotonic invariants, and the semantic surprise of automatic merges, where "converged" is not the same as "what the users meant". Both observations are accurate. CRDTs fit collaborative editing well and fit invariant-heavy domains poorly.
- **Paxos versus Raft.** Raft was designed for understandability, supported by a user study. Howard & Mortier (2020) argued that the two protocols are much closer than commonly presented, and that Raft's understandability advantage comes mainly from presentation and leader-election choices, not from a fundamentally different algorithm.
- **Is eventual consistency acceptable in business systems?** This is domain-dependent, and debates often talk past each other. Eventual consistency is acceptable where the business has a reconciliation process and where a stale read leads to a recoverable action. It is unacceptable where a stale read leads to an irreversible decision.

### Examples

**Example 6.1 — Read-your-writes with a log position token (C# + SQL, simplified).**

```csharp
// After the write transaction commits on the primary:
var lsn = await primary.QuerySingleAsync<string>("SELECT pg_current_wal_lsn()::text");
session.Set("min-lsn", lsn);

// On a read that must see the user's own writes:
var minLsn = session.Get("min-lsn");
var caughtUp = minLsn is null || await replica.QuerySingleAsync<bool>(
    "SELECT pg_last_wal_replay_lsn() >= @minLsn::pg_lsn", new { minLsn });
var conn = caughtUp ? replica : primary;     // fall back to primary, or wait briefly
```

This gives read-your-writes per session without making all reads go to the primary. It is simplified: the LSN should be captured as the transaction's commit position, and a replica that lags persistently should be removed from rotation. The alternatives are to route all of that user's reads to the primary for a short window (simpler, more primary load), or to accept staleness and design the UI to show the submitted item from client state (no infrastructure, but it hides the problem from the UI only).

### Key literature

1. **Herlihy, M. P. & Wing, J. M. (1990). "Linearizability: A Correctness Condition for Concurrent Objects." *ACM TOPLAS* 12(3), 463–492.** DOI: 10.1145/78969.78972 — *Seminal.* The definition of linearizability and its locality property.
2. **Terry, D. B., Demers, A. J., Petersen, K., Spreitzer, M. J., Theimer, M. M. & Welch, B. B. (1994). "Session Guarantees for Weakly Consistent Replicated Data." PDIS '94.** — *Seminal.* Defines the four session guarantees that most user-facing systems actually need.
3. **Ongaro, D. & Ousterhout, J. (2014). "In Search of an Understandable Consensus Algorithm." USENIX ATC '14.** — *Seminal.* The Raft paper. Read together with Ongaro's 2014 PhD thesis for ReadIndex and membership changes.
4. **Shapiro, M., Preguiça, N., Baquero, C. & Zawirski, M. (2011). "Conflict-Free Replicated Data Types." SSS 2011.** — *Seminal.* Formal foundation of CRDTs and their convergence conditions.
5. **Abadi, D. (2012). "Consistency Tradeoffs in Modern Distributed Database System Design." *IEEE Computer* 45(2).** — *Seminal.* Introduces PACELC and moves attention from partitions to the latency–consistency trade-off.
6. **Howard, H. & Mortier, R. (2020). "Paxos vs Raft: Have We Reached Consensus on Distributed Consensus?" PaPoC '20.** — *Recent.* A careful comparison showing how close the protocols are.

Also: **DeCandia, G., et al. (2007). "Dynamo: Amazon's Highly Available Key-Value Store." SOSP '07** — *seminal* for leaderless quorums. **Kleppmann, M. (2015). "A Critique of the CAP Theorem." arXiv:1509.05393** — for the contested point.

### Self-check questions

1. Construct a concrete interleaving with N = 3, W = 2, R = 2 in which two sequential reads violate linearizability. State what ABD adds to prevent it.
2. A user submits a form and the list page, served from a replica, does not show it. Propose two fixes, with their infrastructure and consistency costs.
3. Why must a newly elected Raft leader commit an entry from its own term before serving linearizable reads? What goes wrong if it does not?
4. Classify each invariant as maintainable by a CRDT without coordination, or not, and justify: "number of submitted reports never decreases", "each report has a unique registry number", "an obligation's outstanding count is never negative".
5. State CAP precisely. Name one decision in a system you know that CAP says nothing about but PACELC does.

---

## 7. Coordination cost and scale

### The constraint

Every point where executors must agree or take turns has a cost per event. That cost grows with the number of participants and the distance between them. Examples:
- a lock;
- a cache line under write contention;
- a consensus round;
- a distributed transaction;
- a database sequence;
- a meeting (§19).

The physical cost of one coordination event ranges from roughly 50 ns (an uncontended cache-line transfer) to roughly 100 ms (a cross-region consensus round), about six orders of magnitude (§1). The constraint is that **coordination is paid per operation, and it does not parallelize.** Adding executors adds coordination partners.

### What goes wrong

- **Serialization bottleneck.** All operations pass through one point: a single counter row, a global lock, a single-partition topic, a single leader. Throughput stops growing at that point's capacity, regardless of how many instances you add.
- **Contention collapse.** Under optimistic concurrency, retries grow with contention. Each failed attempt consumes resources and causes further conflicts. *Goodput* (successful work per second) can *fall* as offered load rises.
- **Tail latency amplification in fan-out.** A request fans out to 100 backends and waits for all of them. If each backend's p99 is 10 ms, the probability that at least one of 100 calls exceeds its p99 is 1 − 0.99¹⁰⁰ ≈ 63%. The fan-out request's *median* is near the backends' p99 (Dean & Barroso 2013).
- **Queueing nonlinearity.** A service at 50% utilization has modest queueing delay. At 90% the delay is several times larger. Near 100% it diverges.
- **Retry storms and metastable failure.** A brief overload causes timeouts. Clients retry, so load exceeds capacity even after the original cause is gone, and the system remains degraded until load is shed manually (Bronson et al. 2021; Huang et al. 2022).
- **Thundering herd.** A popular cache entry expires and every request recomputes it at once.
- **Hot keys.** Partitioning spreads load only if keys are spread. One large customer, one popular case, or "today's date" defeats it.

### What you must understand

**Little's law.** L = λW. The average number in the system equals the arrival rate times the average time in the system. It holds for any stable system regardless of distribution, which makes it the most reliable tool in capacity reasoning. If a service handles 200 requests/s at 50 ms average, about 10 requests are in flight. Connection pool and thread pool sizes follow from it.

**Queueing.** For an M/M/1 queue (Poisson arrivals, exponential service, one server) with utilization ρ = λ/μ:
- mean time in system = S / (1 − ρ), where S is mean service time;
- mean number in system = ρ / (1 − ρ).

At ρ = 0.5 the response time is 2S. At 0.8 it is 5S. At 0.9 it is 10S. At 0.95 it is 20S.

Real systems are not M/M/1. **Kingman's approximation** for a G/G/1 queue makes the dependence on variability explicit:

> W_q ≈ (ρ / (1 − ρ)) × ((c_a² + c_s²) / 2) × S

Here c_a and c_s are the coefficients of variation of inter-arrival and service times. Bursty arrivals (batch jobs, retries, start-of-month deadlines) and variable service times (GC pauses, cache misses) multiply waiting time *at the same utilization*. This is why headroom is part of unit cost (§1, §21), and why reducing variance can be cheaper than adding capacity.

**Amdahl's law.** If a fraction p of the work parallelizes perfectly and 1 − p is serial, speedup on N executors is:

> S(N) = 1 / ((1 − p) + p / N)

With p = 0.95, speedup is bounded by 20 no matter how many executors you add. Gustafson's law is the counterpoint: if the *problem size* grows with N, the serial fraction shrinks relatively. The two laws answer different questions. Amdahl concerns fixed work done faster; Gustafson concerns more work done in the same time.

**The Universal Scalability Law (USL).** Gunther's model adds a coherence term to Amdahl:

> X(N) = λN / (1 + σ(N − 1) + κN(N − 1))

- σ (contention) is the serial fraction, as in Amdahl.
- κ (coherence) captures the cost of keeping executors consistent with each other: pairwise crosstalk, cache coherence traffic, distributed lock chatter. It grows quadratically.

With κ > 0, throughput *peaks* at N* = √((1 − σ) / κ) and then *declines*. Adding nodes makes the system slower. Fitting σ and κ from a few measured points is cheap. It replaces the assumption of linear scaling with evidence.

**A design is a budget of coordination events.** For each business operation, count:
- database round trips;
- locks taken and held across what;
- consensus writes;
- cross-service synchronous calls;
- cross-region hops.

Multiply each by its cost from §1. That gives a latency floor per operation and, multiplied by volume, a large part of unit cost (§21). Architecture reviews that do not count coordination events per operation cannot predict either.

**Coordination avoidance.** Some invariants can be maintained without coordination; others cannot.

- **Invariant confluence** (Bailis et al. 2015). An invariant can be preserved without coordination iff merging any two valid divergent states yields a valid state.
  - "The set of submitted reports only grows" is confluent.
  - "Registry numbers are unique" is not: two replicas can each assign number 1001.
  - "Balance ≥ 0" is not.
- **CALM** (Hellerstein & Alvaro 2020). Programs whose output is monotonic in their input (they never retract a conclusion when more data arrives) have consistent coordination-free implementations. Non-monotonic logic, such as "no report has arrived, so send a reminder", requires coordination or a decision rule about when absence counts as absence.

This gives a principled way to decide *which* operations pay for coordination.

**Partitioning.**
- Partition by the unit that most operations touch: the aggregate in domain-driven design terms.
- Operations within a partition coordinate cheaply. Operations across partitions pay full price.
- Hot keys need special handling: splitting a counter into sub-counters, salting keys, or a dedicated tier for heavy tenants.

**Batching** amortizes per-event coordination: group commit, bulk inserts, claiming 500 queue rows instead of one. It trades latency for throughput and enlarges the blast radius of a failure (crash after claim; closing chains).

**Retries.**
- Bound them with a maximum number of attempts and a *retry budget*, for example retries limited to 10% of requests.
- Use exponential backoff with **jitter**. Without jitter, synchronized clients retry in waves. The AWS Architecture Blog post on backoff and jitter (Brooker 2015) shows that "full jitter" is a good default.
- Retry only at one layer. Retries at every layer multiply: three layers of three retries make 27 attempts.

**Hedged requests.** Send a second request to another replica if the first has not answered within roughly the p95 latency, and use whichever answers first. This trades a small amount of extra load for much better tails (Dean & Barroso 2013). It requires idempotent requests (§4).

**Load shedding and back-pressure.** Reject work early when over capacity: admission control, bounded queues, `429` responses. Queuing everything converts overload into latency and then into timeouts.

**Human coordination obeys the same arithmetic.** Brooks's law (§19) is coordination cost in teams: n people have n(n − 1)/2 potential communication channels, a κ term. This is a structural analogy, not a metaphor. The USL has been fitted to team productivity data, though with weaker evidence than for computer systems.

### Trade-offs and alternatives

| Technique | Gains | Costs |
|---|---|---|
| **Partitioning by aggregate** | Linear scaling within partitions | Cross-partition operations become distributed (§5, §6); hot keys; repartitioning is painful |
| **Batching** | Throughput; fewer coordination events | Latency; larger failure units; fairness between batches |
| **Commutative operations** (increments, set unions) | No ordering coordination | Constrains the domain model; not all invariants expressible |
| **Relaxed guarantees** (causal, eventual) | Fewer coordination events | Anomalies that the business must tolerate or reconcile |
| **Caching** | Fewer calls to the source | Staleness; invalidation; thundering herd |
| **Hedging** | Better tails | 2–5% extra load; requires idempotency |
| **More capacity** | Lower ρ, so less queueing | Direct cost; does not help a serialization bottleneck |
| **Measure σ and κ** | Evidence instead of assumption | Test infrastructure and time |

### Contested points

- **The applicability of the USL.** Gunther's model fits many measured systems well. Critics argue that with two free parameters, many curves fit, and that the physical interpretation of κ is not always clear. The defensible use: fit it to measured data to *predict* scaling limits and to prompt investigation of contention sources. Do not treat the fitted coefficients as identified mechanisms.
- **Scale-out versus a single machine.** McSherry, Isard & Murray (2015, "Scalability! But at what COST?") showed that published distributed graph-processing systems often failed to beat a single-threaded laptop implementation. Their argument is that scalability without absolute efficiency is a misleading metric. The opposing position stresses fault tolerance and data sizes that do exceed one machine. Both are right about their cases. The paper's lasting point is that the baseline must be a good single-machine implementation.
- **Designing for scale up front.** One position holds that you should design for current load and rewrite when needed (YAGNI). The other holds that some decisions, such as partition keys, identifiers, and consistency model, are expensive to change later and should be made with growth in mind. The evidence is anecdotal. A reasonable synthesis: identify the few decisions that are irreversible at scale and decide those deliberately; defer the rest.

### Examples

**Example 7.1 — Claiming a batch of scheduled work (SQL).**

```sql
WITH batch AS (
    SELECT id FROM scheduled_message
    WHERE status = 'pending' AND due_at <= now()
    ORDER BY due_at
    LIMIT 500
    FOR UPDATE SKIP LOCKED
)
UPDATE scheduled_message m
SET status = 'claimed', claimed_by = @worker, claimed_until = now() + interval '5 minutes'
FROM batch WHERE m.id = batch.id
RETURNING m.id;
```

`SKIP LOCKED` lets several workers claim disjoint batches without waiting for each other, so coordination is reduced to row locks. The costs:
- **Crash after claim.** Rows stay "claimed" until `claimed_until` passes and a sweeper releases them. A worker that was only *slow* may then process them concurrently with the new claimant (§4, closing chains). The effect must be idempotent, or the write must be fenced with a claim token.
- **Index hot spot.** The `(status, due_at)` index is a single region where all workers read and update. At high rates, consider partitioning the queue table by time or by a hash of the key.

**Example 7.2 — Fan-out tail arithmetic.** A page aggregates data from 20 backend calls in parallel, each with p99 = 200 ms. P(at least one call exceeds 200 ms) = 1 − 0.99²⁰ ≈ 18%. So roughly 1 page in 5 is slower than the backend p99. Options:
- reduce fan-out (pre-aggregated projections, §10);
- hedge the slowest calls;
- render progressively, so the page does not wait for all calls.

### Key literature

1. **Amdahl, G. M. (1967). "Validity of the Single Processor Approach to Achieving Large Scale Computing Capabilities." AFIPS Spring Joint Computer Conference.** — *Seminal.* The original argument that serial work bounds speedup.
2. **Gunther, N. J. (2007). *Guerrilla Capacity Planning*. Springer.** — *Seminal.* Presents the Universal Scalability Law and how to fit it to measurements.
3. **Dean, J. & Barroso, L. A. (2013). "The Tail at Scale." *Communications of the ACM* 56(2), 74–80.** DOI: 10.1145/2408776.2408794 — *Seminal.* Tail latency amplification in fan-out, with hedged and tied requests as remedies.
4. **Bailis, P., Fekete, A., Franklin, M. J., Ghodsi, A., Hellerstein, J. M. & Stoica, I. (2015). "Coordination Avoidance in Database Systems." *PVLDB* 8(3).** — *Seminal.* Invariant confluence: a precise criterion for which invariants need coordination.
5. **Hellerstein, J. M. & Alvaro, P. (2020). "Keeping CALM: When Distributed Consistency Is Easy." *Communications of the ACM* 63(9).** — *Recent.* The CALM theorem in accessible form: monotonicity as the boundary of coordination-free consistency.
6. **Huang, L., Magnusson, M., Muralikrishna, A. B., et al. (2022). "Metastable Failures in the Wild." OSDI '22.** — *Recent.* An empirical study of failures sustained by retries and feedback loops, building on Bronson et al. (HotOS 2021).

Also: **McSherry, F., Isard, M. & Murray, D. G. (2015). "Scalability! But at what COST?" HotOS '15** — for the contested point. **Brooker, M. (2015). "Exponential Backoff and Jitter." AWS Architecture Blog** — *blog; origin of the widely used jitter recommendations.* **Harchol-Balter, M. (2013). *Performance Modeling and Design of Computer Systems*. Cambridge University Press** — a rigorous queueing text.

### Self-check questions

1. A service runs at 70% utilization with mean response 20 ms. Traffic rises by 20%. Estimate the new mean response time under M/M/1. Use Kingman's formula to explain why the real increase may be larger.
2. Measured throughput is 1,000 req/s on 1 node, 1,800 on 2, 2,800 on 4, and 3,000 on 8. What does the USL suggest? Design an experiment that distinguishes a contention (σ) source from a coherence (κ) source.
3. Explain why goodput under optimistic concurrency can *fall* as clients increase, while pessimistic locking plateaus. Under what contention level would you switch strategies?
4. Classify as invariant-confluent or not, with reasons: unique report numbers; non-negative balance; "every overdue obligation receives at least one reminder"; "no reminder is sent for a submitted report".
5. Describe a metastable failure caused by retries in a system you know or can imagine. Give two mitigations that act at different layers.

---

## 8. Computation and algorithms

### The constraint

Classical complexity analysis uses the RAM model, in which every memory access and arithmetic operation costs one unit. Real machines violate this by two orders of magnitude between cache levels and six orders between memory and network (§1). So:

- **Asymptotic complexity predicts behaviour as n grows, but constant factors and access patterns dominate at practical n.**
- **Arithmetic is finite.** Integers overflow. Binary floating point cannot represent most decimal fractions. Decimal types round on division.
- **Some problems are intractable** (NP-hard optimization problems such as many scheduling problems). **Some are undecidable** (Rice's theorem: every non-trivial semantic property of programs is undecidable). Exact solutions or complete analysis are therefore unavailable in principle, not just expensive.

There is also the question of mapping. High-level code states *what* is computed. A query optimizer, a JIT, or an ORM chooses *how*. The algorithm actually executed may differ from the one the author had in mind.

### What goes wrong

- **Linked structures versus arrays.** Same complexity, an order of magnitude apart in time (§1).
- **Accidental quadratic.** A pattern that is O(n²) in disguise:
  - `list.Contains(x)` inside a loop over another list;
  - `List<T>.Remove` in a loop;
  - string concatenation in a loop;
  - `IEnumerable` re-enumeration of a LINQ query inside a loop.

  These work at test sizes (n = 100) and fail at production sizes (n = 100,000).
- **N + 1 queries.** An EF Core loop that touches a navigation property per item issues one query per item. The algorithm is O(n) in *network round trips*, each costing ~0.5 ms, so 10,000 items take 5 seconds before any database work. Complexity must be counted in the dominant cost unit, which here is round trips, not CPU operations.
- **Adversarial inputs.**
  - *Hash flooding:* colliding keys turn O(1) dictionary operations into O(n). .NET randomizes string hashing per process for this reason.
  - *ReDoS:* catastrophic backtracking in a regular expression turns validation into exponential time. .NET 7 added `RegexOptions.NonBacktracking`.
  - Both connect to §14.
- **Floating point and money.**
  - `0.1 + 0.2 != 0.3` in `double`.
  - Summing many `double` values in different orders gives different results, because addition is not associative. Parallel aggregation is therefore non-deterministic.
  - Fees computed in `double` and rounded at display do not reconcile with ledgers.
- **Rounding rules.** `Math.Round(2.5m)` returns 2, because the default `MidpointRounding.ToEven` is banker's rounding. A fee rule that assumed "round half up" is silently violated. Splitting 10.00 into three parts and rounding each gives 9.99.
- **Integer overflow.** C# integer arithmetic is unchecked by default. A sum of amounts in minor units in `int` wraps around silently.
- **Sort stability.** `List<T>.Sort` and `Array.Sort` are unstable (introsort). LINQ's `OrderBy` is stable. Sorting a list of submissions by date with `Sort` reorders same-date items unpredictably, which can matter where "first submitted" has legal meaning.
- **Plan cliffs.** A query runs in 20 ms for months. After statistics are refreshed, the optimizer chooses a nested-loop join over a hash join, and the query takes 20 s. The code did not change; the algorithm did.

### What you must understand

**Models of computation and their cost units.**
- **RAM model:** unit-cost operations. Good for comparing algorithms when data fits in cache.
- **External-memory (I/O) model** (Aggarwal & Vitter 1988): cost is the number of block transfers of size B between a memory of size M and an unbounded disk.
  - Scanning n items costs n/B transfers.
  - Sorting costs (n/B) log_{M/B}(n/B).
  - B-trees are I/O-optimal for search, which is why databases use them instead of binary trees.
- **Cache-oblivious algorithms** (Frigo, Leiserson, Prokop & Ramachandran 1999) achieve I/O-optimal behaviour for *every* level of the hierarchy without knowing B or M, typically by recursive subdivision. The practical lesson for application code: recursive divide-and-conquer and contiguous layouts tend to behave well across cache levels without tuning.
- **LSM trees** (O'Neil et al. 1996) trade read amplification and background compaction for write throughput. They are the basis of RocksDB, Cassandra, and many time-series stores. The choice between B-tree and LSM is a workload-dependent trade-off of write, read, and space amplification.

**Complexity versus constants.**
- Insertion sort beats quicksort for small n. .NET's `Array.Sort` (introsort) switches to insertion sort for small partitions and to heapsort when recursion is too deep, which guards against adversarial quadratic inputs.
- Linear search over a small contiguous array can beat a hash lookup, because hashing has fixed costs.
- Asymptotics tell you *where* the curves cross. Measurement tells you *whether you are past the crossover.*

**Worst, average, amortized, and smoothed.**
- *Amortized* complexity averages over a sequence of operations. `List<T>.Add` is amortized O(1) because the capacity doubles, though an individual `Add` that triggers a resize is O(n). That resize is a latency spike, and it allocates a new array, which matters for the large object heap (§1).
- *Average case* assumes an input distribution. Adversaries choose the distribution (§14).
- *Smoothed analysis* (Spielman & Teng 2004) measures expected performance under small random perturbations of worst-case inputs. It explains why the simplex method is fast in practice despite exponential worst cases.

**Algorithms in high-level languages map onto execution in layers.**
- **LINQ to Objects** executes the algorithm you wrote, lazily. `IEnumerable` is a pipeline of iterators, and multiple enumeration repeats the work.
- **LINQ to Entities** (`IQueryable`) is translated to SQL. The *database* then chooses the algorithm.
- **SQL is declarative.** The optimizer chooses join algorithms (nested loop, hash, merge), access paths (index scan, sequential scan, bitmap), and join order, based on cardinality estimates from statistics.

Leis et al. (2015) showed that cardinality estimation errors are the dominant cause of bad plans, often by orders of magnitude, and that cost-model refinements matter far less. The practical consequence: when performance depends on the plan, the "algorithm" is a function of statistics. Plan stability is an operational concern (§13), and it can be pursued by:
- extended statistics;
- query hints where available (PostgreSQL has none natively; the `pg_hint_plan` extension provides them);
- keeping queries simple enough that estimation is robust.

**The JIT and runtime.**
- Tiered compilation and dynamic PGO (enabled by default since .NET 8) mean that the machine code for a method changes during the process's lifetime. Benchmarks must warm up (BenchmarkDotNet handles this).
- Bounds-check elimination, inlining, devirtualization, and vectorization (`Vector<T>`, `Vector128/256/512`) can change constant factors several-fold.
- Allocation is an algorithmic cost in a managed runtime. An algorithm that allocates per element pays GC cost proportional to n.

**Numerical behaviour.**
- **IEEE 754 binary64 (`double`)** has a 53-bit significand, about 15–17 significant decimal digits. It is exact for integers up to 2⁵³ and for fractions with power-of-two denominators. 0.1 is not representable.
- **Addition is not associative.** (a + b) + c can differ from a + (b + c). Summation error grows with n and with magnitude differences. Kahan (compensated) summation, or pairwise summation, reduces it.
- **Catastrophic cancellation.** Subtracting nearly equal numbers loses significant digits. Example: the variance formula E[x²] − E[x]², which Welford's algorithm avoids.
- **Conditioning versus stability** (Higham 2002). A *problem* is ill-conditioned if small input changes produce large output changes, whatever the algorithm. An *algorithm* is backward stable if its result is the exact answer to a slightly perturbed problem. Ill-conditioning is a property of the question; instability is a property of the method. Separate them before blaming either.
- **`decimal` in .NET** is a 128-bit type: a 96-bit integer coefficient with a base-10 scale of 0–28.
  - It represents decimal fractions exactly within about 28–29 significant digits.
  - It is still floating point: `1m / 3m` rounds, and operations round to the available precision.
  - It is roughly an order of magnitude slower than `double` **[verify on current hardware and runtime]**.
- **Money.** Use `decimal`, or integers in minor units. Treat rounding as a **business rule**: specify the rounding mode, the point at which rounding happens (per line, per total), and the allocation of remainders. Write it down; do not let the framework default decide.

**Approximation.**
- **Probabilistic data structures** trade bounded error for memory:
  - Bloom filters (set membership with false positives);
  - HyperLogLog (cardinality estimation, Flajolet et al. 2007);
  - Count-Min sketch (frequency).
- **Approximation algorithms** give provable bounds for NP-hard problems. Examples include greedy bin packing and list scheduling.
- **Heuristics and solvers.** Constraint programming, SAT, and MIP solvers (such as Google OR-Tools) handle timetabling, rostering, and allocation problems far better than hand-written greedy code. The modelling effort is real.

**Undecidability and analysis.** By Rice's theorem, every static analyzer of a non-trivial semantic property is either unsound (misses some bugs), incomplete (reports false positives), or non-terminating. This is why nullable reference types in C# are a "best effort" analysis with known holes. It is also why security scanners report false positives (§9, §14). Neither is a tooling failure to be eventually fixed. Both are a consequence of the mathematics.

### Trade-offs and alternatives

| Choice | Option A (cost) | Option B (cost) |
|---|---|---|
| Data structure | Hash table: O(1) average (hash cost; adversarial worst case; poor ordered iteration) | Sorted array / B-tree: O(log n) (insert cost; but ordered, cache-friendly) |
| Exactness | Exact computation (time, memory) | Approximate structure or algorithm (bounded error that must be acceptable to the business) |
| Numeric type | `double` (fast; inexact for decimals) | `decimal` or integer minor units (slower; exact for decimal fractions; explicit rounding needed) |
| Where to compute | Set-based in the database (one round trip; DB CPU; coupling to SQL) | Row-by-row in the application (round trips; network; but testable C#) |
| When to compute | Precompute or materialize (staleness; storage; projection maintenance, §10) | On demand (latency; repeated work) |
| Hard optimization | Hand-written heuristic (quick; quality unknown) | Solver (modelling effort; solver dependency; better and measurable quality) |

### Contested points

- **"Premature optimization is the root of all evil."** This is usually quoted without context. Knuth's 1974 paper "Structured Programming with go to Statements" says we should forget about small efficiencies about 97% of the time, but should not pass up the critical 3%, which must be identified by measurement. The truncated version is used to dismiss all performance thinking. The full version argues for *measured* optimization. Data layout and algorithm choice at design time are not "premature" in Knuth's sense when they are hard to change later.
- **Learned index structures.** Kraska et al. (2018) proposed replacing B-trees with learned models of the key distribution, reporting large gains. Later benchmark work (Marcus et al. 2020 **[verify]**) found gains in some settings but sensitivity to data distribution, updates, and implementation quality. The current state is tentative: learned components are useful in specific niches, and they have not replaced classical structures in general-purpose databases.
- **Does algorithmic complexity matter in enterprise code?** One view: I/O dominates, so CPU complexity is irrelevant. The observed counter-evidence is that accidental quadratic behaviour and N + 1 queries are among the most common production performance defects. The synthesis: complexity matters, but it must be counted in the dominant cost unit (round trips, rows scanned, allocations), not in abstract operations.
- **`double` for money.** Some practitioners argue that `double` with careful rounding at boundaries is adequate and faster. Accounting standards and audit practice favour exact decimal arithmetic, because reproducibility and reconciliation matter more than speed. In public-sector finance the second position is effectively mandatory.

### Examples

**Example 8.1 — Defaults that encode business rules (C#).**

```csharp
Math.Round(2.5m);                                  // 2  — banker's rounding (ToEven)
Math.Round(2.5m, MidpointRounding.AwayFromZero);   // 3
0.1 + 0.2 == 0.3;                                  // false (double)
0.1m + 0.2m == 0.3m;                               // true  (decimal)

// Splitting 10.00 into three parts so the total reconciles: allocate the remainder explicitly.
static decimal[] Split(decimal total, int n)
{
    var part = Math.Floor(total / n * 100m) / 100m;
    var parts = Enumerable.Repeat(part, n).ToArray();
    parts[0] += total - part * n;                  // 3.34, 3.33, 3.33
    return parts;
}
```

Which part receives the remainder is a business rule (first payer, largest share, a fixed account) and should be stated in the requirements (§17).

**Example 8.2 — Complexity in round trips (C#).**

```csharp
// N + 1: one query for obligations, then one per obligation.
foreach (var o in await db.Obligations.Where(o => o.Year == 2026).ToListAsync())
    var count = await db.Reports.CountAsync(r => r.ObligationId == o.Id);

// One round trip: let the database choose the join algorithm.
var counts = await db.Obligations.Where(o => o.Year == 2026)
    .Select(o => new { o.Id, Reports = o.Reports.Count() })
    .ToListAsync();
```

The first is O(n) round trips. The second is O(1) round trips and delegates algorithm choice to the planner, which is better on average but subject to plan cliffs (§13).

**Example 8.3 — Accidental quadratic (C#).**

```csharp
var result = candidates.Where(c => existing.Contains(c.Id)).ToList();   // O(n·m) if existing is a List
var set = existing.ToHashSet();
var fixedResult = candidates.Where(c => set.Contains(c.Id)).ToList();   // O(n + m)
```

### Key literature

1. **Aggarwal, A. & Vitter, J. S. (1988). "The Input/Output Complexity of Sorting and Related Problems." *Communications of the ACM* 31(9).** — *Seminal.* Defines the external-memory model, in which cost is block transfers. It is the theoretical basis for B-trees and for most database algorithm choices.
2. **Frigo, M., Leiserson, C. E., Prokop, H. & Ramachandran, S. (1999). "Cache-Oblivious Algorithms." FOCS '99.** — *Seminal.* Algorithms optimal across all levels of a memory hierarchy without knowing its parameters.
3. **Goldberg, D. (1991). "What Every Computer Scientist Should Know About Floating-Point Arithmetic." *ACM Computing Surveys* 23(1), 5–48.** DOI: 10.1145/103162.103163 — *Seminal.* The standard explanation of IEEE 754 behaviour, rounding, and cancellation.
4. **Higham, N. J. (2002). *Accuracy and Stability of Numerical Algorithms*, 2nd ed. SIAM.** — *Seminal.* The authoritative treatment of conditioning, backward stability, and summation error.
5. **Leis, V., Gubichev, A., Mirchev, A., Boncz, P., Kemper, A. & Neumann, T. (2015). "How Good Are Query Optimizers, Really?" *PVLDB* 9(3).** — *Seminal for practice.* Shows that cardinality estimation, not cost modelling, dominates plan quality, and explains plan cliffs.
6. **Kraska, T., Beutel, A., Chi, E. H., Dean, J. & Polyzotis, N. (2018). "The Case for Learned Index Structures." SIGMOD '18.** — *Recent (contested).* The proposal to replace classical index structures with learned models. Read with the follow-up benchmarking literature, for example **Marcus, R., et al. (2020). "Benchmarking Learned Indexes." *PVLDB* 14(1) [verify authors and issue].**

Also: **Knuth, D. E. (1974). "Structured Programming with go to Statements." *ACM Computing Surveys* 6(4)** — the source of the full "premature optimization" passage.

### Self-check questions

1. Why does a B-tree outperform a balanced binary search tree in the external-memory model, although both perform O(log n) comparisons? Express both costs in block transfers.
2. An EF Core loop over 1,000 obligations accesses each obligation's reports. What is its complexity in round trips at 0.5 ms each? Give two rewrites and the plan risk each introduces.
3. A 2.50 EUR fee is split among three parties and rounded to cents. Specify the complete business rule (rounding mode, rounding point, remainder allocation) so that totals reconcile with the ledger.
4. Why does adversarial input invalidate average-case analysis? Which .NET defaults (hashing, regex, sorting) defend against it, and which do not?
5. A query's plan flips from hash join to nested loop after `ANALYZE`. Explain the mechanism in terms of cardinality estimates, and give two mitigations with their costs.

---

> **End of installment 1.** This installment covers the Introduction and Part I (sets 1–8). The next installment begins with **Part II, set 9 (Language and abstraction)** and continues through set 15. Part III (sets 16–18, including subclasses 16a–16e and the note on the current moment) follows. Part III is the installment in which I will use web search to verify recent literature in cognitive science, philosophy of language, and requirements engineering, as the brief requests.
