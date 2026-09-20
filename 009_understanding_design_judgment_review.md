# Understanding Is Not Knowledge: Design Judgment, Invariant Boundaries, and the Review Loop

*Why Well-Known Principles Do Not Produce Good Decisions, and What Does*

**Internal Learning Material for the .NET Team**
Fragile Knowledge • Coupling & Connascence • Policy vs Mechanism • Perceptual Learning • ADRs • Code Review

---

## Table of Contents

*This document is organized into four parts. Part 1 is about why the principles everyone already knows do not settle real decisions. Part 2 is the older, more precise discipline the principles compressed, plus the question of how that discipline is actually acquired — including by AI agents. Part 3 is about team structure, tasks, and artifacts. Part 4 is about code review as the feedback loop that makes the rest work. It deviates from the usual four-part convention of this series (no .NET mechanics section) for the same reason Article 008 did: the subject is not a platform feature. It uses the coupling vocabulary established in Article 006 §1 — that article was about what must be **running**; this one is about what may **cross**.*

**Part 1 — Why Principles Do Not Decide**

1. Knowledge, Understanding, and the Four Ways Knowing Fails
2. The Case: Two Pull Requests
3. What the Principles Actually Said
4. What Compression Removed
5. Why a Principle Cannot Select Its Own Application
6. How a Principle Becomes Ceremony

**Part 2 — The Discipline Underneath, and How It Is Acquired**

7. The Genealogy: What Came Before the Acronyms
8. The Coupling Ladder and Control Coupling
9. Connascence: Strength × Locality × Degree
10. Mechanism vs Authority
11. The Refined Parameter Rule
12. Four Grounds: A Map of Every Rule We Use
13. Why Layer 2 Has No Tooling
14. Why Books Cannot Transfer It
15. Why Framework and API Owners Cannot Fix It For Us
16. How an AI Model Fails Differently — and Where It Helps
17. Perceptual Learning: The Unused Highway
18. Prerequisites, and How We Would Actually Implement It

**Part 3 — Structure: Teams, Tasks, and Authority in Code**

19. The Paradox: Democracy, Mastery, and a Refactoring Mandate Were All Present
20. Problem Representation Is Set by the Ticket and the Review
21. Implementation Ownership Is Not Contract Ownership
22. Requirement, Specification, and the Missing Domain Knowledge
23. Why Permission to Refactor Does Not Trigger Refactoring
24. Artifacts That Must Be Named and Reachable — by Humans and by Agents

**Part 4 — Code Review as Input to Problem Solving**

25. A Review Comment Is an Input, Not an Output
26. The Constraint Trap
27. A Taxonomy of Comment Types
28. The Selection Rule
29. Prerequisites for Review to Work as Design Feedback
30. Practical Recommendations, and Four Anti-Patterns

**Appendix A — The Decision Ownership Worksheet**
**Appendix B — The Review Comment Selection Card**
**Appendix C — Building Your First Contrasting-Case Set**

**Summary: The Baseline**

---

# Part 1 — Why Principles Do Not Decide

## 1. Knowledge, Understanding, and the Four Ways Knowing Fails

Knowledge is static. You have it or you do not. Understanding is the quality that decides **where and how** knowledge applies. Understanding requires knowledge; knowledge does not produce understanding.

This distinction is not new, and it has a precise vocabulary. David Perkins and Fay Martin studied novice programmers in 1986 and found that most failures were not caused by missing knowledge. They classified four states:

| State | Description | Diagnostic sign |
|---|---|---|
| **Missing** | Never learned | Blank incomprehension; asks the question |
| **Inert** | Possessed, not retrieved when the situation calls for it | Recognizes the principle immediately once named |
| **Ritual** | Applied as a ceremony whose purpose is not understood | Satisfies the form of the rule; misses its effect |
| **Foreign** | Learned correctly in one domain, misapplied in another | Confident, fluent, and wrong |

Almost everything we call a "design problem" in review is **inert** or **ritual**, not missing. This matters because the three states need different responses: missing knowledge needs telling, inert knowledge needs a trigger, and ritual knowledge needs the purpose restored. Telling someone what they already know — which is what most review comments do — is the correct response to exactly one of the three.

> ✓ *Mental model: when a competent person produces a bad design, "they did not know" is almost never the explanation. Assume the knowledge was present and ask which of the other three failures occurred. The answer changes what you should do next.*

## 2. The Case: Two Pull Requests

The whole document hangs off one real example. It is worth reading carefully, because the interesting thing about it is how *reasonable* each step is.

The requirement, from the analyst, was one line: **"A user can delete his own change."**

**PR 1:**

```csharp
bool AuthorizeCommand(ChangeRequest req)
{
    if (req.UserId == currentUser.Id) return true;   // owner shortcut
    return authorizer.Authorize(req);
}
```

Rejected, with the reason: *authorization logic must reside in the authorizer module.*

**PR 2:**

```csharp
bool AuthorizeCommand(ChangeRequest req)
{
    return authorizer.Authorize(req, bypassCheckWhenOwner: true);
}
```

Note what happened. PR 2 is not a worse attempt at the same idea. It is a **correct solution to the problem the review comment posed.** The authorizer is now in the call path. The rejection reason, read literally, is satisfied. And to make it so, the developer added a new overload to `IAuthorizer` — which is more work than the alternative, not less.

Four facts make this case worth studying rather than dismissing:

- The developer is the **owner and maintainer of the Authorizer module**. He knows it well, and maintains it well.
- The team has a standing agreement: **refactor when you see the need**, with refactoring prioritized above finishing the task, endorsed by management.
- Every developer may change any part of the codebase. There are no ownership gates.
- `Authorize` already took a `QueryParameters` record hierarchy designed precisely to carry facts to the authorizer — `DeleteRecordQueryParameters(recordId)`, `AddContentQueryParameters(content, parentId)`, and so on. The correct fix was **one new record**.

So: the knowledge was present, the cheap correct path existed, the developer owned the module the fix lives in, and he was explicitly authorized to take it. He took the other one anyway.

If that does not seem strange to you, you have not understood the case. The rest of this document exists to explain it.

## 3. What the Principles Actually Said

Before asking why the principles did not help, it is worth recovering what they originally claimed. In every case the original is narrower, more precise, and more useful than the slogan.

| Principle | Original source and claim | What it degraded into | What was lost |
|---|---|---|---|
| **DRY** | Hunt & Thomas, 1999: *"Every piece of **knowledge** must have a single, unambiguous, authoritative representation within a system."* | "Do not duplicate text" | It is about **authority over a decision**, not textual similarity. The degraded form actively causes harm by merging things that merely look alike. |
| **SRP** | Martin, later reformulated: *"A module should be responsible to one and only one **actor**."* | "A class should do one thing" | It is an **organizational** heuristic about aligning module boundaries with stakeholder boundaries — Conway's Law used normatively. "One thing" is undefinable and therefore unfalsifiable. |
| **KISS** | US Navy, 1960: systems should be maintainable by an average technician **with limited tools under field conditions** | "Prefer simple code" | The original names the **operator and the conditions**. Simplicity is relative to who must operate it and when. Without that, "simple" means "familiar to me". |
| **YAGNI** | XP, late 1990s: do not implement on speculation, because the speculative feature carries permanent cost and is usually wrong | "Do not write code you do not need yet" | The argument is about **option value under uncertainty**, not typing. Its force depends entirely on the cost of retrofitting later, which varies enormously. |
| **SSOT** | Data modelling: every datum is mastered in exactly one place; everything else is a derived view | Treated as a DRY synonym | It is the **data-level twin of DRY's original meaning**, and it is the one principle in this table that actually points at our case. |
| **OCP** | Meyer, 1988: a module should be extensible without modifying its source | "Use abstractions" | Meyer's version assumed you cannot recompile clients. In a monorepo with one deployment, most of its rationale is gone. |
| **LSP** | Liskov & Wing, 1994: behavioural subtyping with real proof obligations — preconditions may not strengthen, postconditions may not weaken, invariants must hold | "Subclasses should behave like their parents" | The formal obligations. LSP is the only member of SOLID that is a **theorem-shaped rule**; it belongs with the structural discipline of Part 2, not with its slogan-shaped siblings. |

Two observations worth stating plainly.

**DRY and SSOT are the principles that actually covered our case,** in their original meanings. The knowledge "an owner may delete their own change" ended up with two representations: one in the authorizer's policy model, and one in the call site that decides when to pass `true`. That is exactly the violation Hunt & Thomas described. The textual reading of DRY cannot see it, because no text was duplicated.

**SRP, which is what everyone reaches for here, is the wrong tool.** SRP tells you *where to draw a boundary*. It says nothing about *what may cross one*. Our case is entirely about what crossed.

## 4. What Compression Removed

The acronyms are not wrong. They are **lossy compressions** of an older and more precise discipline, and what was compressed out is exactly the part that tells you when they apply.

This was a deliberate trade. Structured design's coupling taxonomy has criteria and a classification procedure; it also takes a semester. "Single Responsibility Principle" fits on a slide and can be taught in ten minutes. The industry chose teachability, and got adoption in exchange for discriminating power.

The consequence is systematic and predictable:

> **A compressed principle tells you what good looks like. It cannot tell you whether you are looking at it.**

Every developer in our team can define SRP. That definition does not contain the information needed to classify `Authorize(params, bypassBecauseOwner: true)`. Neither does any other acronym in the table above, in its slogan form. This is not a failure of the developer's education. It is a property of the compression.

## 5. Why a Principle Cannot Select Its Own Application

There is a deeper reason, and it is worth being precise about, because it explains why "learn the principles better" is not the fix.

A principle is a **predicate over designs**. Applying it requires you to first **categorize the situation** — to decide which principle is in play and what the relevant entities are. Nothing in the principle performs that categorization.

Chi, Feltovich & Glaser showed in 1981 that novices sort problems by **surface features** while experts sort by **deep principle**. Physics novices group problems by "inclined plane"; experts group them by "conservation of energy". The knowledge is identical. The *indexing* is not.

In our case:

- Surface categorization: *"this is a parameter-passing problem."* Under that reading, adding a boolean is obviously fine; we pass booleans to methods constantly.
- Deep categorization: *"this is a decision-ownership problem."* Under that reading, the boolean is a verdict crossing into a module whose only job is to produce verdicts.

Both readings are available from the same code. The principle cannot choose between them, because the choice happens **before** the principle is invoked. This is why two developers with identical principle knowledge reliably produce different designs, and why the difference does not close by reading another book.

> ⚠ *If you catch yourself thinking "he should have applied SRP here", test it: write down exactly how SRP, stated as a rule, distinguishes `Authorize(params, bypass: true)` from `repository.Get(id, tracking: false)`. It does not. If you can make the distinction, you are using something else and calling it SRP.*

## 6. How a Principle Becomes Ceremony

Ritual knowledge, from §1, is what you get when a rule survives without its purpose. The mechanism is simple: **rules are enforced by their observable form, so the form is what gets optimized.**

"Authorization must go through the authorizer" has two readings:

- **Locational:** the authorizer must appear in the call path.
- **Authority:** the authorizer must be able to make and justify the decision without trusting the caller's conclusion.

The locational reading is checkable by eye. The authority reading requires knowing what the module is *for*. PR 2 satisfies the first completely and violates the second completely.

This is a general pattern, and it is worth recognizing in its other forms:

| Ceremony | Form satisfied | Purpose defeated |
|---|---|---|
| `Authorize(params, bypass: true)` | Authorizer is called | Authorizer decides nothing |
| An interface with exactly one implementation, never substituted | "Depend on abstractions" | Nothing was made substitutable; a file was added |
| A repository whose methods return `IQueryable<T>` | "Persistence is abstracted" | The ORM's semantics leak to every caller; the abstraction abstracts nothing |
| A mapper layer that copies identical DTOs field for field | "Layers are isolated" | Two representations must now change together — coupling was added, not removed |
| An ADR written after the decision, to satisfy the process | "Decisions are recorded" | No rationale is captured; nobody reads it |

The common shape: **a proxy for the goal is being measured, so the proxy is what gets produced.** This is Goodhart's law applied to design rules, and the more mechanically a rule is enforced, the more reliably it happens.

> ✓ *Useful reflex: whenever you state a rule in review or in a document, ask what the cheapest way to satisfy it would be. If the cheapest way does not achieve the purpose, state the purpose instead of the rule.*

---

# Part 2 — The Discipline Underneath, and How It Is Acquired

## 7. The Genealogy: What Came Before the Acronyms

The line runs:

**Parnas (1972)** — information hiding; modules should be decomposed around *decisions likely to change*, and each should hide one such decision from the others.
→ **Constantine & Yourdon (mid-1970s)** — the coupling and cohesion taxonomies, with criteria.
→ **Page-Jones (1992)** — connascence, which replaces the discrete ladder with a cost model.
→ **SOLID (Martin, 1990s–2000s)** — five memorable rules.
→ **Clean Code (2008)** — a readability-centred codification for a mass audience.

Rigor decreased monotonically along that line, and it bought reach. Note that Parnas's 1972 criterion is already the thing we are missing: a module hides **a decision**. Not a layer, not a technology, not a "responsibility" — a decision that could have been made otherwise and might change. Read that way, `IAuthorizer` hides *the access-control policy decision*. A parameter that supplies the outcome of that decision from outside is, in Parnas's original terms, the module failing to hide the thing it exists to hide.

We did not need fifty years of progress to diagnose PR 2. We needed the vocabulary from 1972 that the acronyms replaced.

## 8. The Coupling Ladder and Control Coupling

Structured design ranks coupling between two modules, best to worst:

| Rank | Coupling | What crosses |
|---|---|---|
| 1 | **Data** | Simple values used as data |
| 2 | **Stamp** | A composite structure, of which the callee uses part |
| 3 | **Control** | An element that **directs the callee's internal logic** |
| 4 | **External** | A shared externally imposed format or protocol |
| 5 | **Common** | Shared global state |
| 6 | **Content** | One module reaches into another's internals |

`bypassCheckWhenOwner: true` is **control coupling**, textbook. The parameter carries no information about the world. It is an instruction about how the callee should behave.

That gives a test that can be applied without any judgment at all:

> **Parameters should be facts, not verdicts.**
> If a parameter name reads as an imperative to the callee — `skip`, `bypass`, `force`, `ignore`, `trusted`, `validate: false` — the caller has taken the decision and the callee has become an executor.

But the classical ladder is too blunt to stop there, because control coupling is frequently **correct**. `AsNoTracking()`, `IsolationLevel.Serializable`, `JsonSerializerOptions`, `CancellationToken` are all instructions about how the callee should behave, and none of them is a design defect. §10 supplies the missing criterion.

> ⚠ *Article 006 §1 separated four dependencies hiding inside the word "coupling": referential, temporal, lifetime, location. That taxonomy and this one are **orthogonal**. An interface removes referential coupling and changes the coupling **type** not at all. `IAuthorizer.Authorize(req, bypass: true)` is perfectly abstracted, injected, mockable — and control-coupled. "We injected an interface" answers a different question than "what crosses the boundary".*

## 9. Connascence: Strength × Locality × Degree

Page-Jones's contribution was to replace "control coupling is bad" with a cost model. Two elements are **connascent** if changing one requires changing the other to preserve correctness. The cost of that connascence is the product of three factors:

**Strength** — how hard it is to discover and change:

- *Name* (both must agree on a name) — weakest
- *Type*, *Meaning*, *Position*, *Algorithm*, *Timing*, *Value*, *Identity* — progressively stronger

**Locality** — how far apart the connascent elements are. Strong connascence inside one class is normal and cheap. The same strength across a published boundary is expensive.

**Degree** — how many places participate.

Apply it to our case. `bypassCheckWhenOwner` is not merely *connascence of meaning* (both sides must agree what `true` means). It is **connascence of algorithm**: to pass the flag safely, the caller must reproduce part of the authorization policy — the judgment that ownership is sufficient *for this operation, in this state*. That is the strongest practical form, sitting on a **public API of a module at a trust boundary**, available to **every command handler in the system**.

Strong × non-local × high degree. That is why the same construct that is harmless on a repository is a defect here, and the model says so quantitatively rather than by taste.

> ✓ *Connascence is the formal version of "it depends". When someone says a pattern is fine in one place and wrong in another, they are usually reasoning about locality and degree without the words for it.*

## 10. Mechanism vs Authority

This is the load-bearing distinction of the entire document, and it is the one we did not have a name for.

The separation of **policy from mechanism** comes from operating-system design — Levin et al., Hydra, 1975. A mechanism provides a capability; a policy decides how the capability is used. The rule that follows:

- A **mechanism** exists to carry out decisions made elsewhere. Its callers own the policy, so instructing it is precisely its purpose. Repositories, serializers, HTTP clients, transaction managers, loggers are mechanisms.
- A **policy module** exists *to make a decision*. That decision is its entire reason to exist. Instructing it on the outcome removes its reason to exist while leaving its shape intact.

So:

> **Control coupling is legitimate when the flag carries the caller's decision into a mechanism. It is destructive when it carries the callee's decision back into it. Same syntax, opposite direction of authority.**

Page-Jones called the general shape **inversion of authority**. Note that the call graph and the authority graph point in different directions here: the handler *calls* the authorizer but is *subordinate* to it in authority. That mismatch is exactly why the flag feels natural to someone reasoning from the call graph alone.

The access-control world has the sharpest vocabulary for this, and we should adopt it, because our system has these roles whether we name them or not:

| Role | Full name | In our system |
|---|---|---|
| **PEP** | Policy Enforcement Point | The command handler. Intercepts the operation, enforces the verdict. |
| **PDP** | Policy Decision Point | `IAuthorizer`. Evaluates policy, returns permit/deny. |
| **PIP** | Policy Information Point | Whatever supplies attributes — ownership, state, roles. |

**The PEP supplies attributes; the PDP produces decisions.** PR 2 has the PEP send a pre-made decision to the PDP.

Going further back, Saltzer & Schroeder (1975) require a reference monitor to be **always invoked, tamperproof, and verifiable**. The bypass overload breaks two of three:

- **Tamperproof** — any caller can now alter the monitor's behaviour. The overload is not scoped to "delete own change"; it is a general override on a public API, available to the next developer for any operation.
- **Verifiable** — you can no longer ask the authorizer "who may delete a change?" and get a complete answer. Policy now lives in the authorizer *plus every call site that passes the flag*. Audit logs will attribute to the authorizer decisions it never made.

## 11. The Refined Parameter Rule

Combining §8–§10:

> **A parameter may instruct a callee only when (a) the decision it expresses is owned by the caller, (b) it is expressed in the vocabulary of the callee's contract rather than its implementation, and (c) it cannot switch off a guarantee the callee exists to provide. When the callee exists to make a decision, the caller may supply only facts.**

Three sub-tests, in order of how often they catch something:

**(a) Who owns this decision?** The primary test. See the table below.

**(b) Contract vocabulary or implementation vocabulary?** `IsolationLevel` is part of what a transactional store *promises*; passing it is fine. `useIndexHint: "IX_Change_UserId"` is also a caller-owned choice, but it is stated in implementation terms, so the caller must now know the callee's internals. The flag selects a path *inside* the callee's logic rather than a variant of its *service*.

**(c) Can it disable an invariant?** A legitimate option chooses between valid behaviours. `AsNoTracking` cannot corrupt anything. `bypassCheckWhenOwner` can.

Examples, sorted by decision ownership:

| Parameter | Whose decision? | Verdict |
|---|---|---|
| `CancellationToken` | Caller's — the lifetime of its operation | Fine |
| `AsNoTracking()` | Caller's — read vs modify intent | Fine |
| `IsolationLevel` | Caller's — consistency needs of the use case | Fine; part of the contract's semantics |
| `IgnoreQueryFilters()` for **soft delete** | Caller's — e.g. an admin restore view | Usually fine |
| `IgnoreQueryFilters()` for **tenant isolation** | **Not** the caller's — a security invariant | Same defect as `bypassCheckWhenOwner` |
| `bypassCheckWhenOwner: true` | The authorizer's | Defect |

The two `IgnoreQueryFilters` rows are the most instructive thing in this document. **The same API call is benign or a vulnerability depending on which invariants you put behind the filter.** It is not a "technical layer vs business layer" distinction. Once tenant isolation lives in a global query filter, that filter *is* a PDP, and `IgnoreQueryFilters()` *is* a bypass flag on it. EF Core 10's named query filters — letting you ignore `"SoftDelete"` while keeping `"Tenant"` — are the framework acknowledging that one switch covered decisions with different owners.

Even when the caller legitimately owns the choice, a boolean is usually the weakest available expression (Fowler's *flag argument* smell). Alternatives, from cheapest to most restructuring:

- **Intent-revealing methods**: `GetForReadAsync` / `GetForUpdateAsync` instead of `Get(id, tracking: false)`. The caller states what it is doing; the callee maps intent to mechanism.
- **Options objects / value records** when several independent contract-level choices exist.
- **Specification objects** when the "instruction" is really a selection criterion.
- **Capability APIs** for genuinely dangerous switches: make the bypass unavailable except through a separately injected, audited dependency. A bypass should require a dependency you can grep for, review, and restrict — not a parameter anyone can type.

## 12. Four Grounds: A Map of Every Rule We Use

Every design rule we have is grounded in one of four things. Sorting by ground is more useful than sorting by name, because the ground predicts whether tooling can help and whether the rule survives changes in how code gets written.

| Ground | Derived from | Principles | Tool-checkable? |
|---|---|---|---|
| **1. Dependency structure** | Change propagation and locality of reasoning in a graph | Coupling types, cohesion, connascence, information hiding, DIP, ISP, LSP, Law of Demeter, acyclic dependencies, CQS | **Largely yes** |
| **2. Decision ownership** | Who is authoritative for a given decision | Policy/mechanism separation, PEP/PDP, reference monitor, SSOT, DRY (original), Tell-Don't-Ask, invariant placement | **Almost never** |
| **3. Cognitive economy** | Bounded working memory of the reader | KISS, naming, function length, cyclomatic complexity, most of *Clean Code* | Partially — proxies only |
| **4. Change economics under uncertainty** | Option value: speculative generality vs retrofit cost | YAGNI, "premature optimization", OCP, rule of three | No — requires a forecast |

Read the table for what it implies about effort. Layer 1 is where static analysis lives and where most tooling investment has gone. Layer 3 has proxies (metrics, formatters, analyzers) that are imperfect but real. Layer 4 is irreducibly a judgment call about the future. **Layer 2 is where our incidents come from, and it is the only layer with no tooling at all.**

## 13. Why Layer 2 Has No Tooling

Not for lack of effort. For a structural reason:

> **Two structurally identical programs can differ only in who is authoritative.**

```csharp
authorizer.Authorize(req, bypassCheckWhenOwner: true);
serializer.Serialize(obj, indent: true);
```

Same shape: a call to an injected abstraction with a boolean. No analyzer distinguishes them. The difference lives in a fact about our system — *"`IAuthorizer` is the authority for access decisions"* — that is **not represented anywhere in the code**. It is tacit architectural knowledge held in people's heads.

That gives a diagnostic sequence that is worth memorizing, because it asks the questions in the order that matters:

1. **What decision is being made here, and who owns it?** (layer 2)
2. **Does the information needed for that decision reach its owner?** (layer 2)
3. **What must change together if this changes?** (layer 1)
4. **What must be held in context to verify this is correct?** (layer 3)
5. **What am I paying now for a future I am guessing at?** (layer 4)

Question 1 is the one nobody asks, and it is the one both PRs failed.

The corollary, which Part 3 develops: **layer 2 does not survive by being taught better. It survives by being converted into layer 1.** Anything enforceable only by explaining it in a review comment will eventually be violated.

## 14. Why Books Cannot Transfer It

Three independent reasons, all of them structural rather than about anybody's diligence.

**Peter Naur, "Programming as Theory Building" (1985).** Naur's claim is that the real product of programming is a **theory** held by the programmers: why the structure is as it is, what maps to what in the world, which changes are consistent with the design. Code and documentation are *projections* of the theory and cannot reconstitute it. A team that loses its theory-holders is, in his terms, dead — even with complete source.

This settles the question directly. Books transfer vocabulary, patterns, and examples. They cannot transfer the theory of **our** system. And layer-2 knowledge is always system-specific: "the authorizer is the authority" is a fact about our architecture, not about software. No book can contain it, and §15 argues no vendor can ship it.

**Glass's arithmetic.** The developer population has historically doubled roughly every five years. At any moment about half the field has under five years of experience. Knowledge must be *retransmitted* faster than it accumulates, so the field structurally cannot get ahead. This is arithmetic, not a complaint about juniors.

**Hogarth's wicked learning environments.** Learning from experience requires feedback that is fast, accurate, and unambiguously attributable. Chess and surgery are *kind* enough. Software design is **wicked**:

- Feedback arrives in years, not seconds.
- It is confounded by turnover, requirement changes, platform shifts.
- The person who made the decision is usually not the one who pays.
- The counterfactual is never observed. You never see the version where you did it right.

In wicked environments, experience does not reliably produce expertise. **It produces confidence.** This is why fifteen years of practice can yield five years of skill, and why "they will learn it over time" is not a plan.

It also identifies the one thing we have that is not wicked: **code review is essentially the only fast, attributable feedback loop the discipline offers.** That is why Part 4 exists.

## 15. Why Framework and API Owners Cannot Fix It For Us

The natural reaction to §13 is: the framework vendors employ excellent engineers, they have known this since the 1970s, why are they still shipping `IgnoreQueryFilters()`? Four answers, none of which is "lack of goodwill".

**Generality requires escape hatches, and every escape hatch is a potential authority violation.** `IgnoreQueryFilters()` is not an oversight. Some caller legitimately needs to see soft-deleted rows. The framework cannot know that in our system the same switch also disables a tenant-isolation invariant, because the framework does not know we put a security property in a query filter. The vendor's best possible move is to make the switches **separable and named** so *we* can distinguish decisions with different owners — which is exactly what EF Core 10 did. Even the best-designed general API cannot decide authority for us; authority is a property of our system, not of theirs.

**The APIs that cause our incidents are not theirs.** `IAuthorizer`, `QueryParameters`, our repositories, our command handlers. Those are designed in-house, often by whoever needed them first. The "seniors design the APIs" model is correct, and the gap is **internal**.

**Vendor incentives point at time-to-first-success.** Vendor success is measured in adoption and in how fast a newcomer gets something working. Quickstarts and templates optimize for a result in five minutes, and those samples are the single largest teaching corpus in the industry. They systematically demonstrate the locally-cheap pattern — controller talks to `DbContext`, no layers, no invariants — because that is what fits on the page. This is a real and mostly unacknowledged source of the problem, and it is a rational response to their actual objective, not negligence.

**Where vendors have genuinely under-delivered** is different from what people usually claim. Not "ship the right rules" — the dangerous rules are never universal. Rather: **make project-specific rules cheap to express and hard to ignore.** Roslyn analyzers have existed since 2015 and writing one is still a small project. Architecture testing is third-party (NetArchTest, ArchUnitNET). Nothing in Visual Studio asks "what invariants does this solution have?" The tooling assumes rules are universal, and the dangerous ones never are.

> ⚠ *This is the one place where the AI shift genuinely changes the economics. The historical reason our invariants stayed tacit is that encoding them — as an analyzer, an architecture test, a capability type — cost more than it seemed to be worth. That reason is largely gone. See §16.*

## 16. How an AI Model Fails Differently — and Where It Helps

We are now writing a growing share of code with agents, so their failure modes belong in this document rather than in a separate one.

**The similarity nobody should overlook:** agents are not free of cognitive limits. They have bounded context, attention that degrades over long inputs, and no persistence between sessions. Everything in §14 about wicked environments applies to them — **an agent is a permanent resident of the wicked environment.** It never accumulates Naur's theory at all.

**Where an agent fails differently, and worse:**

| Property | Consequence |
|---|---|
| **Bounded context** | Delocalized plans (Letovsky & Soloway, 1986) are invisible. "The authorizer is the authority" is not in the file being edited. |
| **No cross-session theory** | Whatever rationale exists must be re-supplied every time, or it does not exist. |
| **Trained on the public corpus** | Its priors are the quickstart distribution from §15 — controller-to-`DbContext`, local shortcuts, sample-grade code. |
| **High instruction fidelity** | Give it the literal constraint "route authorization through the authorizer" and it produces PR 2 — faster, more confidently, and with better commit hygiene than a human. **Ritual compliance is what instruction-following optimizes for.** |
| **No stake in the future** | Layer-4 reasoning (YAGNI, option value) has nothing to ground it. Speculative structure accumulates because generation is free. |
| **Recognition over the wrong distribution** | It will flag `bypass` as a smell in generic code, and will not know that `IgnoreQueryFilters()` disables tenant isolation *in our system*. |

Read the fourth row again. **The defect class this entire document is about is the one agents produce most reliably**, because it is produced by satisfying a stated constraint literally while missing an unstated invariant — and that is a precise description of what an instruction-following model does well.

**Where agents help, and help a lot:**

- **They never get tired.** An agent reviewing every diff against an explicit, written invariant register does the one job humans do worst: checking the same boring invariant on the four-hundredth PR at 17:40 on a Friday.
- **They make layer-2 → layer-1 conversion cheap.** Writing a Roslyn analyzer, a NetArchTest rule, a banned-API list, or a capability type used to be a day's work that never made the sprint. It is now minutes. **This is the single highest-value use of agents in our codebase, and it is not code generation.**
- **They can generate contrasting-case sets** from our own repository for the training in §17–§18 — pull every call site of a given shape, strip it to call-plus-contract, and produce classification batches.
- **They can draft ADRs from review threads**, turning a durable insight that would have died in a PR comment into a retrievable artifact.
- **They can run the five questions of §13 at design time**, which is cheaper than at review time.

The operative asymmetry: **agents are weak exactly where tacit knowledge is required, and strong exactly at the work that converts tacit knowledge into explicit enforcement.** Point them at the second.

> ✓ *Practical consequence for us: every invariant we would have to explain in a review comment is a candidate for an agent-written architecture test. The test is the artifact; the agent is just the cheap way to get it.*

## 17. Perceptual Learning: The Unused Highway

Everything so far implies that experts have recognition that novices lack. The obvious follow-up question is whether recognition can be **trained directly**, rather than accumulated as a by-product of years of mistakes. The answer is yes, it is well documented, and software has not used it.

First, a premise worth killing. "Recognition comes from contrasting cases with feedback" does **not** imply the cases must be your own production mistakes. Radiologists train on archived films with known diagnoses. Pilots train in simulators. Chess masters study annotated positions from games they never played. The feedback loop needs to be **fast, unambiguous, attributable, and high-volume**. "Your own production incident" satisfies only *attributable*, badly — it is slow, confounded, and arrives perhaps three times a decade. It is close to the worst available training signal.

So the choice is not between mistakes and guardrails. It is between **self-generated slow mistakes** and **curated fast cases**, and the second is strictly better as a learning mechanism.

Four research lines, all directly applicable:

**Perceptual Learning Modules (Philip Kellman).** Pattern recognition can be trained deliberately. The method is high-volume, short-duration, **forced-choice classification with immediate feedback** — not explanation, not reasoning through principles, but rapid categorization of many varied instances. Kellman's aviation module had pilots classify instrument-panel configurations; a few hours produced recognition comparable to pilots with far more flight hours. His mathematics modules do the same for structure recognition in algebraic expressions. Crucially, PLM training is measurably **different from and faster than** conceptual instruction, and it produces exactly what we want: recognition *before* deliberation.

**Contrasting cases (Schwartz & Bransford, "A Time For Telling", 1998).** Having learners first contrast carefully-paired cases and *then* receive the explanation produces far better transfer than explanation first. The contrast creates the discriminations that the explanation then labels. Our PR 1 / PR 2 pair is an accidental instance: two designs, minimally different in form, completely different in authority. The long explanation landed on prepared ground, which is probably why it worked at all.

**Error-management training (Keith & Frese, meta-analysis 2008).** Deliberately inducing errors *during training*, with explicit framing that errors are informative, beats error-avoidant training on transfer tasks. We do not need to eliminate mistakes — we need to relocate them out of production and compress their timescale.

**Worked examples (Sweller).** For non-experts, *studying* solved problems beats *solving* problems, because problem-solving spends working memory on search rather than on schema formation. A developer struggling to satisfy a review comment is spending their cognitive budget on search.

**Why software has not done this.** Three reasons; two are fixable.

1. **The discriminating feature is not in the stimulus.** A radiologist's film contains everything needed to classify it. `Authorize(req, bypassCheckWhenOwner: true)` does not — whether it is a defect depends on whether `IAuthorizer` is a policy module. This is a real obstacle, but it is a **curriculum design constraint, not an impossibility**: the training case must include the contract alongside the call. It also explains why generic "clean code" training transfers so poorly while cases from *our* codebase would transfer well.
2. **The taxonomy is contested.** Forced-choice training needs ground truth. Radiology has biopsies; software has opinions — genuinely so at the margins. (Is "only the author may delete" authorization, or a domain invariant on the aggregate? Both are defensible; we chose authorization.) But it is contested **at the margins, not at the centre**. `bypassCheckWhenOwner` is not a close call. Build the module from unambiguous cases and exclude the contested ones, which is what medical training does too.
3. **Nobody owns the problem.** Vendors sell tools, not perception. Universities teach concepts. Bootcamps teach frameworks. Employers pay for output. Perceptual training is cheap to build and has no natural seller. This is the most banal reason and probably the most operative.

> ⚠ *One honest caveat: as far as is publicly known, nobody has run a controlled study of perceptual learning modules on code. The mechanism is well-established in other domains and the transfer argument is strong, but for us this is an experiment with good priors, not a proven method. Treat it accordingly — and measure it.*

## 18. Prerequisites, and How We Would Actually Implement It

**Prerequisites**, in order:

1. **A written invariant register.** Ground truth cannot exist before the invariants are stated (see §24). This is the real blocker and it is also independently worth doing.
2. **Cases that carry the discriminating feature.** Each item must show the call **and** enough of the contract to classify it. A call site alone is unclassifiable.
3. **A binary or small-N classification.** "Decision or fact?" works. "Is this good code?" does not.
4. **Unambiguous ground truth per item.** Discard contested items; do not average opinions into a label.
5. **Volume and speed.** Forty to sixty items per session, a few seconds each. This is the property that distinguishes PLM from a discussion, and it is the one teams instinctively violate.
6. **Immediate feedback, minimal explanation during the run.** Explanation belongs *after* the batch, when the discriminations exist to be labelled.

**A concrete first implementation**, roughly two hours of preparation:

- Pick one invariant we already hold: *"`IAuthorizer` is the sole decision point for access control."*
- Extract 40 call sites from our own repository — a mix of `Authorize` calls, repository calls, serializer calls, and options-carrying calls. An agent can do the extraction and the stripping.
- Render each as a card: the call, plus the callee's signature and a one-line statement of what the callee is for.
- Single question: **decision or fact?** Two buttons. Immediate right/wrong.
- Run it as a 20-minute session. Record accuracy and response time per person, anonymously.
- Debrief *after* the run: show the items with the lowest team accuracy and discuss those only.
- Second batch two weeks later, with subtler discriminating features — options objects, intent-revealing methods, a legitimate `IsolationLevel`, a tenant-filter bypass.

Measure two things: accuracy, and **response time**. Recognition is fast by definition. Accuracy that only appears after twenty seconds of deliberation is not recognition; it is derivation, and it will not fire under deadline pressure.

The highest-return application is not junior training. It is **training the people who design our internal APIs**, because an API designer's recognition is leveraged across everyone who calls it. See §24 and §11 on making the discriminating feature visible in the API itself — the third mechanism, alongside training and enforcement:

| Mechanism | Acts on | Fails when |
|---|---|---|
| Perceptual training | The person | Attention lapses; novel context |
| Legible API design | The stimulus | The API author lacks the recognition |
| Structural enforcement | The outcome | The case was not anticipated |

All three are needed. Training is the highest-leverage because it generalizes to cases no rule anticipated. Enforcement is the only one that works when attention fails, incentives bite, or the author is not human.

---

# Part 3 — Structure: Teams, Tasks, and Authority in Code

## 19. The Paradox: Democracy, Mastery, and a Refactoring Mandate Were All Present

Return to §2. Every condition that is usually prescribed as the cure was already satisfied:

| Prescribed cure | Present? |
|---|---|
| Developer must know the module | **Yes** — he owns and maintains it |
| Developer must be allowed to change other code | **Yes** — full democracy, no ownership gates |
| Refactoring must be sanctioned, not stolen time | **Yes** — explicitly prioritized above task completion, endorsed by management |
| The correct path must be cheap | **Yes** — one new `QueryParameters` record |
| The API must already support facts | **Yes** — the hierarchy exists precisely for this |

And PR 2 happened anyway. So the explanations that turn on capability, permission, cost, or API design are all unavailable. What remains is **how the problem got represented in his head**, which is a function of the ticket and the review, not of the person.

Before the mechanisms: these are candidate explanations, not a verdict. Which one applied is an empirical question, and the answer is obtained by asking — see §20's closing.

## 20. Problem Representation Is Set by the Ticket and the Review

Newell & Simon's central finding is that the **problem representation determines which operators get generated.** You do not search a space of all solutions; you search the space your framing defines.

Consider what the problem was at each moment:

- **At ticket time:** *"Implement: a user can delete his own change."* Design space open, problem framed as **feature-sized**.
- **After the rejection:** *"Make the reviewer's objection go away."* Design space now = modifications of the existing solution that pass a stated filter.

Adding `DeleteOwnChangeQueryParameters` is not a *better* solution to the second problem. It is a solution to a **different** problem — one that was no longer active. This is means-ends analysis working correctly over the goal that was actually set.

Three things reinforce it:

- The stated rejection reason was satisfied by PR 2 under a locational reading (§6). He did not ignore the feedback; he solved precisely the problem posed, which was narrower than the one intended.
- Rework carries implicit schedule pressure. The task was "done"; now it is not. Minimal-delta is the natural response to rework, and minimal-delta over a constraint is a bypass flag.
- The ticket itself framed a feature-sized problem. "Allow deletion of change by the owner" contains nothing suggesting a type hierarchy, a contract change, or a question about where a decision lives. That inference is usually right, which is precisely why it fails silently on the cases that matter.

Compare the same requirement, reframed: *"Ownership becomes a factor in delete authorization. The Authorizer currently has no way to know about ownership for this operation."* Same requirement, no solution specified — but it frames a **gap in the authorization model**, which is a different size of problem and invites a different class of solution.

Two further candidate mechanisms worth keeping in view:

**The word "bypass" may not have meant what it looks like.** Read charitably, `bypassBecauseOwner` might have been intended as *"this operation has a self-service exemption"* — a policy **fact**, badly named, encoded as a boolean because it did not occur to him that it was a fact at all. Under that reading, the error is **misplaced policy**, not defiance of the module's authority. Those are different diagnoses with different fixes.

**The taxonomy may have been ambiguous.** `QueryParameters` encodes *operations*. Adding `DeleteOwnChangeQueryParameters` requires classifying "delete own change" as a distinct operation. But the requirement reads as "delete change, with an exception for the owner" — ownership as a **modifier on an operation**, and the hierarchy has no slot for modifiers. A boolean is the obvious encoding for a modifier. If that is what happened, it is a legitimate modelling judgment answered wrongly, not a principle failure. (Worth auditing: are all our existing records pure operations, or do some already encode conditions? If the latter, there was precedent.)

> ✓ *The diagnostic question, asked without blame, is: "When you wrote the flag, what did you intend the authorizer to do with it?" If the answer is "skip the evaluation", the authority model is not shared. If it is "know that owners are allowed", the authority model is fine and it is a location error. Two problems, two fixes, one question.*

## 21. Implementation Ownership Is Not Contract Ownership

Module ownership splits into two genuinely different skills:

- **Implementation ownership** — how evaluation works, how policies compose, how the model is structured.
- **Contract ownership** — what the module promises to callers, and what may cross the boundary.

Implementation mastery can work **against** boundary discipline. From inside the module, `bypassBecauseOwner` is a trivially correct short-circuit; he could see exactly where it lands in the evaluation and knew it was safe *in this call*. The defect is not visible from inside. It is visible from the population of all call sites over time — a systems view, not a module view.

There is also a specific trap, **implementer's privilege**: an owner *can* change the module, so "make the authorizer accept this" and "make the authorizer decide this" feel like the same class of action. For a non-owner, only one is available. Ownership removed the friction that would have forced the second framing.

And note whose theory it was. The architecture was designed by one person; the module is maintained by another. The **rationale** for the `QueryParameters` hierarchy — that it exists so the authorizer is never handed a verdict — is the designer's theory in Naur's sense, and possibly not fully transferred. Inheriting a working mechanism and knowing it deeply is not the same as holding the reason it has that shape.

> ⚠ *Practical consequence: when assigning work on a module, "he owns it" is evidence about implementation, not about contract. The two need separate handover. An ADR (§24) is precisely a contract-ownership handover artifact.*

## 22. Requirement, Specification, and the Missing Domain Knowledge

Our working rule has been: *the analyst describes the behaviour, the developer decides the design.* The rule is sound. The inference drawn from it is not.

It conflates two very different things:

- **Solution specification** — "add a `DeleteOwnChangeQueryParameters` record and route through the authorizer." This genuinely belongs to the developer. Specifying it destroys their ability to find something better and makes the analyst a bottleneck on knowledge they do not have.
- **Constraint and rationale** — "this is an authorization rule; the authorizer is the sole decision point; ownership here is additive, not overriding." This is **not a solution**. It is part of the problem statement.

Michael Jackson's problem-frames work makes the underlying structure explicit. A requirement is a statement about the **world**; a specification is a statement about the **machine**. The bridge between them is **domain knowledge** — the facts about the environment and the existing system that make a specification satisfy the requirement. Jackson & Zave's formulation is roughly:

> **specification + domain knowledge ⊨ requirement**

Our tickets carry the requirement. They carry no domain knowledge. So the entailment must be reconstructed from memory by whoever picks up the ticket, every time, with no index and no completeness check. That is not a division of labour; it is an unbounded lookup.

This also exposes a real bug hiding under the design problem. Both PRs encode *"ownership **overrides** all other checks."* That is almost certainly not the intended policy. May the owner delete after the change is submitted or locked? After their role is revoked? While the document is in another procedure? "A user can delete his own change" **adds a permission**; it does not override every other rule. When a rule lives in the PDP, its author is forced to decide how it composes with the others (deny-overrides, permit-overrides). Scattered bypasses never face that question.

> ✓ *Putting the decision in the right place is how correct semantics get **discovered**, not merely how hygiene is maintained. The composition question only gets asked where the composition happens.*

**On the signalling problem.** In this case the constraint was omitted deliberately: stating it to the module owner would have read as distrust. That is a real dynamic, and the fix is structural rather than social. Constraints in tickets are **not addressed to a person** — they are properties of the work item, written for its whole lifetime: the person who picks it up after a reassignment, the reviewer, the person reading it in eighteen months. Nobody reads acceptance criteria as an insult. The moment omission is *possible*, inclusion carries meaning; if the field is mandatory, filling it is a process step and carries none.

## 23. Why Permission to Refactor Does Not Trigger Refactoring

"Leave the code better; refactor when you see the need" is a genuinely good agreement, and it addresses a real cost — the **political** cost of spending time on structure. It does not address the one that bit us.

Look at what it presupposes: *when you **see** the need.* It is conditional on a recognition that has already happened. If the problem representation is "add a parameter", no refactoring permission is relevant, because nothing in the model calls for a refactor. **Permission does not generate recognition.**

There is a second gap, subtler. The agreement makes refactoring *permitted*. It does not make the design question *asked*. Nothing in our workflow forces "where does this decision belong?" to be answered before code is written. That is the layer-2 gap from §13 reappearing as a process gap.

And a third, from the Cognitive Dimensions framework (Green & Petre, 1996): **viscosity**, the resistance of a design to local change. High-viscosity designs push people toward patches rather than restructuring. Our case is unusual in that viscosity was *low* — the fix was one record. Which is precisely why this case is diagnostic: with viscosity removed as an explanation, representation is what is left.

> ⚠ *Generalization worth carrying: a working agreement can only regulate behaviours the person has already classified as belonging to that agreement. Agreements are weak at the classification step and strong afterwards. Whenever an agreement is not producing the expected behaviour, check whether the situation is being classified into it at all.*

## 24. Artifacts That Must Be Named and Reachable — by Humans and by Agents

This is the actionable core of Part 3. The problem from §13 is that a layer-2 invariant exists nowhere in the code. The response is a small set of artifacts, each with a specific job, each **discoverable at the moment of decision** rather than at the moment of onboarding.

**1. An invariant register.** One page. Each entry: the invariant, the module that owns the decision, what may cross the boundary, and what a violation looks like.

```markdown
## INV-003 — Access control decisions are made only by IAuthorizer

Owner of the decision: IAuthorizer (PDP)
Callers (PEPs): command handlers
What may cross: facts only, as a QueryParameters subtype
What may never cross: a verdict, an exemption, or an instruction to skip evaluation
Violation looks like: any Authorize overload parameter that is not a fact;
                      any authorization branch in a handler
Related: INV-004 (tenant isolation), ADR-011
```

This register is the ground truth for §18's training, for the review checklist in Part 4, for the analyzer in point 4 below, and for agent context. It is the single highest-value artifact in this document. Keep it under two pages; if it grows past that, it has started collecting preferences instead of invariants.

**2. ADRs, written at decision time, linked from the code.** An ADR's value is the **rationale and the rejected alternatives**, not the decision — the decision is visible in the code; the reasoning is not. `ADR-011: The Authorizer is the sole PDP` should state why the `QueryParameters` hierarchy exists, what was rejected (handler-local checks, a bypass flag, ownership as a domain invariant on the aggregate), and under what conditions the decision should be revisited. This is Naur's theory, written down in the only form that survives its holders.

Link it from where it will be encountered: XML doc comments on `IAuthorizer` and `QueryParameters`, not only a `docs/` folder.

**3. Ticket constraints, as a fixed short checklist.** Usually empty. Four questions:

- Which existing invariants does this touch? (authorization, tenancy, audit, concurrency)
- Does this introduce a decision? If so, who is authoritative for it?
- Does that authority need information it does not currently receive?
- Is this rule **additive** or **overriding** relative to existing rules?

The last one would have caught the semantic bug in §22. Triage rather than uniform analysis: most tickets do not need this, and the ones that do are identifiable by a cheap signal — *does it touch a cross-cutting invariant?* Keep "no solution specification" as an explicit rule in the template, and make the constraints field reviewable for whether a design has been smuggled in.

**4. Executable versions of the invariants** — the layer-2 → layer-1 conversion:

- Architecture tests (NetArchTest / ArchUnitNET): no assembly outside the authorization module may reference the policy types.
- A banned-API list or Roslyn analyzer for specific overloads that constitute a bypass.
- **Types instead of booleans**, so the illegal state is unrepresentable: no bypass parameter on the API at all.
- **Capability APIs** for genuinely necessary escapes: a cross-tenant read requires injecting `ICrossTenantReader`, which is greppable, reviewable, and restrictable — not a parameter anyone can type.

Per §16, an agent will write all four of these in an afternoon. This is the work to give agents.

**5. The agent-facing index.** Everything above must be reachable by the agents we code with, which means a checked-in instruction file (`CLAUDE.md` / `AGENTS.md` or equivalent) that **names the invariant register and the ADR index by path** and states the five questions from §13. An invariant that exists only in a wiki does not exist for an agent, and increasingly does not exist for us either.

> ✓ *The test for all five artifacts is the same: **is it reachable at the moment of decision, by whoever or whatever is deciding?** An invariant register nobody opens during a task is documentation. One that is named in the ticket, linked from the XML docs, and indexed for the agent is infrastructure.*

---

# Part 4 — Code Review as Input to Problem Solving

## 25. A Review Comment Is an Input, Not an Output

Most review practice treats review as **defect detection**: find problems, report them, verify the fix. Under that model a comment is an *output* — the reviewer's work is done once it is written.

That model is wrong, and our case demonstrates why. A comment is an **input to somebody else's problem-solving process.** Its effect is determined entirely by **what problem it causes the author to solve next**. The deliverable is not the comment; it is the author's next representation of the problem.

Which means: **a comment can be completely correct and still produce a worse outcome.** The rejection in §2 was correct. It produced PR 2.

This is consistent with what is known about review's actual value. From Fagan inspections onward, and confirmed by Bacchelli & Bird's study at Microsoft, participants report wanting defect detection while observed outcomes are dominated by **knowledge transfer and awareness**. If transfer is the real product, then "what does the author now understand?" is the success metric and "was the defect noted?" is a proxy — and §6 already told us what happens when we optimize proxies.

## 26. The Constraint Trap

The specific failure has a name and a mechanism.

The comment stated a **constraint**: *authorization logic must reside in the authorizer.* A constraint is a filter over solutions. The natural, correct, efficient operation to perform on a constraint is: **find the minimal modification to my existing solution that passes the filter.**

The bypass flag is a good answer to that operation. So:

> **Constraint-shaped feedback produces constraint-satisfying modifications, not redesigns. And it does so more reliably the more competent and cooperative the author is** — because competent, cooperative people find minimal satisfying modifications quickly.

The corollary defines the scope of the problem: the defect class where the correct fix is a **reframing** is exactly the class that constraint-shaped comments handle worst. Local bugs are fine — "this is off by one" needs no reframing. Authority errors, layering errors, and modelling errors all require the author to re-pose the problem, and a constraint actively prevents that by narrowing the space they are searching.

## 27. A Taxonomy of Comment Types

The types are **not ranked**. Each is correct for a different defect. The point is to choose deliberately rather than defaulting to the constraint, which is what most of us do.

| Type | Example | What the author does next | Correct for |
|---|---|---|---|
| **Defect report** | "This is off by one." | Local fix | Local correctness |
| **Constraint** | "Authorization must go through the authorizer." | Minimal modification to pass the filter | A genuinely missing rule the author does not know |
| **Question about the model** | "What decision is being made here, and who owns it?" | Re-examines the representation | Authority and modelling errors |
| **Consequence** | "If this ships, any handler can bypass policy. How would we audit that?" | Evaluates the solution against a criterion they had not applied | Making invisible costs visible |
| **Contrast** | "Compare this to how `AddContent` supplies facts. What is different?" | Derives the discriminating feature themselves | Building recognition (§17) |
| **Rationale** | "The hierarchy exists so the authorizer is never handed a verdict." | Acquires the theory | Transferring design intent |
| **Preference** | "I would extract this." | Complies or argues | Nothing important; mark it as optional |

Two notes.

**Contrast comments are perceptual training embedded in the workflow.** They are the cheapest instance of §17 available to us, they cost one sentence, and they use cases from our own codebase. Of everything in this document, this is the change with the best effort-to-effect ratio.

**Mark preferences as preferences.** A review where blocking issues and taste are expressed in the same register forces the author to guess which is which, and the usual guess is "all of it", which is how minimal-compliance behaviour gets trained.

## 28. The Selection Rule

One question selects the row:

> **What has to change in the author's head for the right solution to become obvious?**

| If the answer is… | Use |
|---|---|
| Nothing — they just typed it wrong | Defect report |
| A rule they do not know exists | Constraint (plus rationale) |
| The way they framed the problem | Question about the model, or Contrast |
| An invariant they were not aware of | Rationale, or Consequence |
| Nothing at all; I just prefer it differently | Preference, explicitly labelled optional |

Applied to our case: the answer was "the way he framed the problem", so the constraint was the wrong instrument even though it was true.

The alternative comment would have been something like:

> *"The authorizer cannot evaluate this — it does not know the operation is a delete, or who owns the record. What would it need to receive?"*

That is not softer. It is **more demanding**: it refuses to accept a minimal modification, because minimal modification does not answer it. And it leaves the design entirely to the author, which preserves the autonomy that made the original constraint feel safer to state.

> ⚠ *Question-shaped feedback has real costs. It is slower, it adds round-trips, and used indiscriminately it reads as Socratic theatre — "just tell me what you want." It is also genuinely worse when the author simply lacks a fact; asking someone to derive a rule they have never met is unkind. **Questions for misframing; statements for missing facts.** The selection rule matters more than any preference between the two.*

## 29. Prerequisites for Review to Work as Design Feedback

Review cannot carry design feedback unless several things are true beforehand. Most "our reviews are not effective" complaints are really one of these being absent.

1. **The invariants exist in writing (§24).** A reviewer enforcing an unwritten invariant is asking the author to read their mind, and is also unable to prove the rule to a third party. Two reviewers will enforce different unwritten rules, which trains authors to optimize for whoever is assigned.
2. **Rationale is retrievable.** The reviewer must be able to link ADR-011 rather than retype the argument. Retyped arguments get shorter each time until they become constraints.
3. **The author restates the problem before reworking.** One line: *"I understand the issue as X."* This surfaces representation mismatch in seconds instead of after a second round-trip. Cheapest intervention in this entire document.
4. **An escalation rule.** Two failed rounds on the same issue means the medium is wrong. Text review has a low bandwidth ceiling for representation mismatches — the reviewer cannot see the author's model and the author cannot see what the reviewer meant. A five-minute call beats a thousand-word comment, and it also reveals *which* mechanism from §20 was operating.
5. **System-level comments get a durable home.** "This flag lets any handler bypass policy" is a statement about the system, not about the diff. If it lives only in a PR thread, it is archived at merge and re-litigated the next time someone meets the invariant. Route it to the invariant register or an ADR.
6. **Review is scheduled work, not interstitial work.** A reviewer with ten minutes produces defect reports and preferences, because those are what can be produced in ten minutes. Model questions and rationale require having understood the change.
7. **Design questions are asked before the code exists, where possible.** Review is the *last* place to discover a decision-ownership problem. It is our fastest feedback loop (§14), but it is still feedback after the fact, and by then the author has sunk effort and acquired a position.

## 30. Practical Recommendations, and Four Anti-Patterns

**Recommendations**

- **Before writing a comment, ask the §28 question.** One second. It changes the comment type perhaps one time in five, and those are the important ones.
- **State the purpose, not only the rule** (§6). "The authorizer must be able to decide and justify without trusting the caller" cannot be satisfied by a bypass flag; "authorization must go through the authorizer" can.
- **Use contrast comments deliberately.** Point at an existing call site in our codebase that does it correctly. This is free perceptual training and it also transfers the local convention.
- **Label blocking vs optional explicitly.** Consider a prefix convention: `blocking:` / `question:` / `nit:`.
- **When you reject, name the problem you want solved, not the property you want restored.**
- **Authors: restate the problem in one line before reworking.**
- **Route durable insights out of the PR** into the invariant register or an ADR, in the same session. If it is worth saying twice, it belongs somewhere permanent.
- **Convert whatever you can into a test** (§16, §24). If you have explained the same invariant twice in review, the third response is an architecture test, not a third explanation.

**Anti-patterns**

| Anti-pattern | Why it fails |
|---|---|
| **The correct constraint** | Produces minimal compliance. Correct, and it is what produced PR 2. |
| **The essay** | A thousand words is a broadcast, not a loop. If it takes an essay, the medium is wrong — talk instead, then write the ADR. |
| **Mixed registers** | Blocking issues and taste in the same voice train authors to treat everything as taste, or everything as blocking. |
| **The invisible standard** | Enforcing an unwritten invariant. The author cannot anticipate it, cannot verify against it, and learns only that reviews are unpredictable. |

One closing observation about our case, and it is the part that generalizes furthest. The mechanism identified in §26 is **not about that developer**. A rejection that names a constraint rather than re-opening the design question will reliably produce constraint-satisfying non-solutions, from competent people, in proportion to how cooperative and fast they are. That is a mechanism we can act on directly — and unlike everything in Part 3, acting on it does not require diagnosing anyone's thinking.

---

# Appendix A — The Decision Ownership Worksheet

A one-page artifact for design discussions and for the §29 prerequisite that invariants be checkable. It turns §11 from a rule you nod at into a form that produces a decision. Same three-column shape as the Intermediary Worksheet in Article 006 Appendix A: the argument happens in the **gap**.

## The form

| Question | Answer | Consequence |
|---|---|---|
| 1. What decision is being made? | | |
| 2. Which module is authoritative for it? | | |
| 3. What facts does that module need to decide? | | |
| 4. Which of those facts does it currently receive? | | |
| 5. What is crossing the boundary now — facts or a verdict? | | |
| 6. Is the new rule **additive** or **overriding**? | | |
| 7. If someone else used this same parameter next month, what could they switch off? | | |

Two rules make it work:

**Answer 1 and 2 before any code shape is proposed.** If a signature is on the table first, rows 3–5 get written to justify it. Same failure as mechanism-before-meaning, one level up.

**"I don't know" is a finding, not a blank.** Row 6 in particular is almost always unanswered, and it is where the semantic bugs live.

## Worked example — the case from §2

| Question | Answer | Consequence |
|---|---|---|
| 1. What decision? | May this user delete this change? | Access control |
| 2. Authoritative module? | `IAuthorizer` (PDP) — INV-003 | Handler is a PEP; it enforces, it does not decide |
| 3. Facts needed? | Operation = Delete; resource owner; resource state; user (ambient) | |
| 4. Currently received? | Only what a generic `ChangeRequest` carries — **not the operation type, not the owner** | **This is the actual gap.** Everything else follows from it |
| 5. What is crossing? | PR 1: nothing (decision never reached the PDP). PR 2: a **verdict** | Both are the same defect in different clothes |
| 6. Additive or overriding? | **Unknown** — and both PRs silently implemented *overriding* | Blocking. Can an owner delete a submitted or locked change? Must be answered before anything is written |
| 7. Reuse risk? | The overload is on a public API; any handler can disable any policy evaluation | Reference monitor is no longer tamperproof or verifiable (§10) |

Row 4 is the whole design. The correct change writes itself from it: one new `DeleteOwnChangeQueryParameters(recordId, ownerId)` record, the policy rule inside the PDP, the composition question from row 6 answered where composition happens.

Note what the worksheet did *not* need: any mention of SRP.

---

# Appendix B — The Review Comment Selection Card

Print it, pin it, use it for two weeks until it is automatic.

**Before writing, ask: what has to change in the author's head?**

```
Nothing, just a slip            → Defect report:  "off by one here"
A rule they don't know          → Constraint + rationale + link to the ADR
How they framed the problem     → Question:  "what decision is this, and who owns it?"
                                → Contrast:  "compare with <call site>; what's different?"
An invariant they can't see     → Consequence: "if this ships, X becomes possible"
                                → Rationale:  "the hierarchy exists so that..."
Nothing — I'd just do it my way → Preference, labelled `nit:` and non-blocking
```

**Three checks before submitting the review:**

1. What is the cheapest way to satisfy what I just wrote? Does it achieve the purpose? *(§6)*
2. Am I stating a constraint where the real issue is the framing? *(§26)*
3. Is anything here a statement about the **system** rather than the diff? If so, where will it live after merge? *(§29.5)*

**Escalate after two failed rounds on the same issue.** Not a third comment — a conversation.

---

# Appendix C — Building Your First Contrasting-Case Set

The minimum viable perceptual-training batch, per §18. Target: 40 items, 20 minutes, one invariant.

**Item template**

```
--- ITEM 17 ---
Callee contract:
    IAuthorizer.Authorize(QueryParameters p) -> bool
    Purpose: sole decision point for access control (INV-003)

Call site:
    authorizer.Authorize(p, bypassCheckWhenOwner: true)

Question: Is the highlighted parameter a FACT or a DECISION?
Answer: DECISION — the caller has concluded that ownership suffices.
```

**Composition of the batch**

| Category | Count | Purpose |
|---|---|---|
| Clear facts into a PDP | 8 | Establish the positive case |
| Clear verdicts into a PDP | 8 | Establish the negative case |
| Legitimate options into a mechanism (`AsNoTracking`, `IsolationLevel`, `CancellationToken`) | 10 | Prevent over-generalization — this is the category people get wrong after training |
| Implementation-vocabulary options into a mechanism (index hints, internal-path flags) | 6 | Trains sub-test (b) of §11 |
| Invariant-disabling switches on a mechanism (tenant filter bypass) | 6 | The hardest and most valuable class |
| Deliberately contested items | 2 | Discussed afterwards; **excluded from scoring** |

**Rules**

- Seconds per item, not minutes. Speed is the point.
- Immediate right/wrong. No explanation during the run.
- Debrief only the lowest-accuracy items, afterwards.
- Score accuracy **and response time**. Slow-but-correct is derivation, not recognition, and it will not fire under pressure.
- Second batch two weeks later, with the discriminating features made subtler.

An agent can extract and format the whole batch from our repository; the human work is choosing the invariant and labelling the ground truth.

---

# Summary: The Baseline

1. **Knowledge is not the constraint.** Perkins's taxonomy — missing, inert, ritual, foreign — puts almost every design defect we see in review into *inert* or *ritual*. Telling someone what they already know is the right response to only one of the four.

2. **The principles are lossy compressions, and what was compressed out is the part that tells you when they apply.** SRP tells you where to draw a boundary, not what may cross one. DRY's original meaning — one authoritative representation of each piece of *knowledge* — is the principle that actually covers our case, and the textual reading of it cannot see the violation.

3. **A principle cannot select its own application.** Applying it requires categorizing the situation first, and nothing in the principle performs that categorization. This is why identical principle knowledge yields different designs, and why more reading does not close the gap.

4. **Rules are enforced by their observable form, so the form is what gets produced.** "Authorization goes through the authorizer" has a locational reading and an authority reading. The locational one is checkable by eye and is the one that gets satisfied.

5. **Control coupling is legitimate into a mechanism and destructive into an authority.** Same syntax, opposite direction. The criterion is *who owns the decision the parameter expresses* — not technical vs business, not whether an interface is involved.

6. **Parameters should be facts, not verdicts.** And even a caller-owned option should be in the vocabulary of the contract, and must not be able to switch off a guarantee the callee exists to provide. `IgnoreQueryFilters()` is benign or a vulnerability depending only on what you put behind the filter.

7. **Four grounds: dependency structure, decision ownership, cognitive economy, change economics.** Layer 2 — decision ownership — is where our incidents come from, and it is the only one with no tooling, because two structurally identical programs can differ only in who is authoritative.

8. **Books cannot transfer layer 2, and vendors cannot ship it.** Naur: the real artifact is a theory that code and documentation only project. The invariant "the authorizer is the authority" is a fact about *our* system. Vendor escape hatches are necessary by construction, and their samples optimize for time-to-first-success.

9. **Software design is a wicked learning environment**, so experience produces confidence more reliably than expertise. Code review is essentially the only fast, attributable feedback loop the discipline has — which is why it deserves to be designed rather than performed.

10. **Recognition can be trained directly and does not require your own production mistakes.** Perceptual learning, contrasting cases, error-management training, worked examples. The prerequisites are a written invariant register, cases that carry the discriminating feature, binary classification, unambiguous ground truth, and volume. Nobody has done this for code; the method is cheap enough to try.

11. **Democracy, mastery, and a refactoring mandate do not produce correct invariant handling**, because none of them operates on problem representation. The ticket frames the problem size; the review reframes it. Permission to refactor presupposes the recognition it was supposed to cause. Ownership of a module's implementation is not ownership of its contract.

12. **A review comment is an input to someone else's problem-solving, and constraint-shaped feedback produces constraint-satisfying modifications.** The more competent and cooperative the author, the more reliably. Choose the comment type by asking what has to change in the author's head — and when the answer is "the framing", a correct constraint is the wrong instrument.

13. **Convert layer 2 into layer 1 wherever you can.** Invariant register, ADRs linked from the code, ticket constraints, architecture tests, banned overloads, capability types, types instead of booleans. Agents are weak exactly where tacit knowledge is needed and strong exactly at this conversion work — and the historical reason we skipped it, that encoding invariants cost more than it seemed worth, no longer holds.

---

*— End of Document —*
