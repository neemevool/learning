# 012 — Interacting Entities: State, Invariants, Coordination and Time

## Part 0 — Opening, Preface, Case Brief

---

## Audience

Two audiences, deliberately in one document.

- **Business and system analysts** who write requirements for systems in which several things have lifecycles that constrain each other.
- **Architects and medium-to-senior developers** who must turn such requirements into a design, and justify it.

The article is platform-neutral. Where an example helps, it uses .NET, PostgreSQL and event sourcing.

## Purpose

After reading, an analyst should be able to write requirements whose state model is sound and unambiguous. An architect should be able to choose a coordination pattern, justify it, recognise over-engineering, and say which future changes the choice makes cheap or expensive.

The worked example is small. The method is meant for systems far larger than it.

## How to read

**Layers.** Every concept appears twice.

- **Business reading** — plain domain language, with examples from paper and real-world processes: escrow, bank holds, liens, legal holds, ERP order blocks, permits.
- **Technical reading** — precise definitions and, where useful, formal grounding. Code and SQL appear only inside blocks marked **Technical box**.

An analyst can read the business readings, Part F (checklists) and Part G (worked example) and skip the rest. An architect should read everything; the business readings are where the design decisions originate.

**Provenance tags.** Every substantive claim carries one of three tags.

| Tag | Meaning | How to treat it |
|---|---|---|
| `[T]` | Established theory with a citable source (listed in Part H) | Rely on it; check the source for its stated assumptions |
| `[P]` | Widely shared practitioner knowledge, without a single canonical source | Rely on it within its usual context; expect exceptions |
| `[S]` | This article's own synthesis | Argue with it |

A composition of several patterns is never presented here as one named pattern. Where this article combines things, the combination is tagged `[S]` and its parts are tagged separately.

**Limits.** Limits are stated where they apply. As in 008: a stated limit is an engineering artifact; an unstated one is a future incident.

**Installments.** Part 0 (this file), A, B1, B2, C, D1, D2, D3, D4, E, F, G, H. Each ends with a glossary of the terms it introduced.

**Cross-references.** 006 (temporal and lifetime coupling, transactional outbox), 008 (fault-tolerant timed task execution), 009 (design judgment, mechanism versus authority, the invariant register).

---

## Preface — "This is not one problem"

A requirement such as "the declaration cannot be resubmitted while it is being assessed" looks like one sentence about one status. It contains at least four separate problems: what "being assessed" means and which entity it belongs to; what happens when a submission and the start of an assessment arrive together; what happens if the assessment never finishes; and who is allowed to override the rule.

"State management" is the usual name for all of this. It is a poor name, because it suggests one problem with one family of solutions. There are seven, each with its own theory, its own failure modes and its own tools.

### The seven classes

| # | Class | Business reading | Technical reading | Grounding |
|---|---|---|---|---|
| 1 | **Single-entity lifecycle** | A permit application moves through stages; at each stage only some actions are possible | A finite automaton or statechart: states, triggers, guards, transitions | `[T]` Harel 1987 |
| 2 | **Cross-entity invariant** | A property cannot be sold while a lien on it is registered; the rule spans two files kept by two offices | A predicate over the state of more than one entity that must hold at all times; it crosses a consistency boundary | `[T]` Evans 2003; Helland 2007 |
| 3 | **Concurrent actors** | Two clerks open the same file at the same moment and each acts on what they read | Interleaved operations on shared state; a decision based on a read that is no longer true when the write happens | `[T]` concurrency control theory; see 008 Part D |
| 4 | **Time-driven transition** | An offer lapses after 30 days whether or not anyone does anything | A transition whose trigger is the passage of time, not an actor's command; formally a timed automaton | `[T]` Alur & Dill 1994 |
| 5 | **Multi-party coordination** | A sale needs the buyer's payment, the seller's signature and the registry's entry, in an order, with a defined outcome if one fails | A process spanning several entities and several steps, with partial completion as a reachable condition | `[T]` Garcia-Molina & Salem 1987; van der Aalst 1998; `[P]` Hohpe & Woolf 2003 |
| 6 | **Derived versus stored state** | "Account in good standing" is not written anywhere; it is a conclusion from the ledger | A status that is a function of other facts, versus a status that is itself a recorded fact | `[P]`; treated formally in Part A |
| 7 | **Conflicting permissions** | The bank has placed a hold; a court has placed a second; the customer's own instruction says pay | Several independent sources each permit or deny the same action; a combining rule decides | `[T]` XACML 3.0 combining algorithms; see 009 |

Definitions used above:

- **Entity** — a thing with identity that persists while its attributes change. A declaration is an entity; the text of one answer in it is not.
- **State** — defined precisely in Part A. For now: a condition of an entity that determines which actions it accepts.
- **Trigger** — what causes a transition: a command from an actor, a fact recorded elsewhere, or the passage of time.
- **Guard** — a condition that must be true for a triggered transition to be taken.
- **Invariant** — a statement that must be true at every moment, not merely at the end of a process.
- **Consistency boundary** — the set of data that one operation can change atomically, that is, entirely or not at all.

### The classes are axes, not categories

`[S]` A real requirement does not belong to one class. It has a position on each. The sentence about resubmission is a class 1 problem (which states exist), a class 2 problem (the rule reads two entities), a class 3 problem (two actors), a class 4 problem (the assessment may stall) and a class 7 problem (overrides).

`[S]` The characteristic design error is to solve a problem of one class with the tool of another. Three forms recur, and Part B catalogues them in detail:

- A **new state is added** to solve a concurrency problem. The race remains; the state diagram is now larger.
- A **timer is added** to solve a missing exit. The lifecycle is still unsound; it now fails later.
- A **stored status is added** to hold something that is really a conclusion from other facts. It then disagrees with those facts.

### Parameters that separate the regimes

Each class becomes a real problem only past a threshold. The parameters below decide which classes a given requirement actually falls into. Part C extends this table into a design-selection instrument.

| Parameter | Question to ask | Value that activates a class |
|---|---|---|
| Entities read by a rule | Does the rule mention facts about more than one entity? | More than one → class 2 |
| Concurrent writers | Can two actors (people or processes) act on the same entity, or on entities linked by a rule, at overlapping times? | Yes → class 3 |
| Actor-free transitions | Can anything change with nobody doing anything? | Yes → class 4 |
| Steps with partial completion | Is there a moment when some steps are done and others not, and can the process stop there? | Yes → class 5 |
| Home of each status | Is the status recorded as a fact, or concluded from facts? | Concluded → class 6 |
| Sources constraining one action | Can more than one independent party block or allow the same action? | More than one → class 7 |
| Store topology | Is all the data a rule reads kept in one store that can change it atomically? | No → classes 2, 3 and 5 become materially harder |

**Business reading.** These are questions an analyst can answer without knowing how the system will be built. Each "yes" is a commitment to describe something further: the rule, the tie-break, the deadline, the half-finished condition, the definition, the precedence.

**Technical reading.** The last parameter is the one the literature most often assumes silently. Much of the published guidance on aggregates and sagas presupposes a distributed store. With a single store offering serializable transactions, several classes collapse into ordinary transaction design. Part C treats this explicitly.

**Limit.** The seven classes are this article's partition `[S]`. They are chosen because each maps to a distinct body of theory, not because the partition is the only possible one. Requirements about data validity within one entity at one moment (field formats, mandatory fields) are deliberately outside the scope.

---

## Case brief

The worked example runs through every Part and is consolidated in Part G. This brief fixes the vocabulary. Estonian domain terms are kept, because they are the terms in the requirements; each has one English gloss, used consistently.

### The domain

A registry of yearly declarations of interests. Certain persons are obliged by law to declare their interests each year. The declarations are public. An authority checks them.

### Entities and roles

| Term | Gloss | What it is |
|---|---|---|
| **Deklarant** | declarant | A person obliged to declare |
| **Kohustus** | obligation | The duty of one declarant to file for one period |
| **Deklaratsioon** | declaration | The document filed to satisfy an obligation; event-sourced, that is, stored as the sequence of facts that happened to it |
| **Pädev asutus** | competent authority | The body responsible for checking a set of declarations |
| **Kontrollija** | assessor | A person at the competent authority who assesses declarations |
| **Superkontrollija** | super-assessor | An assessor role with wider rights; the exact difference is one of the things the requirements must state |
| **Protokoll** | protocol | The record of one round of checking one declaration |
| **Assessment** | assessment | One assessor's judgement inside a protocol; a protocol holds several |

### Statuses

| Term | Gloss | Appears on |
|---|---|---|
| **Koostamisel** | being drafted | Deklaratsioon; Protokoll |
| **Esitatud** | submitted | Deklaratsioon |
| **Parandamisel** | under correction | Deklaratsioon (evolved model); Protokoll (original requirements) |
| **Parandamisele** | sent for correction | Protokoll (evolved model) |
| **Kinnitatud** | confirmed | Protokoll |
| **Kontrollitud** | checked | Deklaratsioon; terminal in the evolved model |
| **Kontroll jäi pooleli** | checking left unfinished | Original requirements only |

Note that *Koostamisel* names a status of two different entities, and *Parandamisel* moved from one entity to another between the two versions of the model. Both observations matter in Part B.

### Lifecycle, as first described

- A declaration starts *Koostamisel* and becomes *Esitatud* when the declarant submits it.
- For 90 days after submission the declarant may edit voluntarily. While editing, the public continues to see the last submitted version.
- Assessors check submitted declarations and record the outcome in a protocol.

### Defects in the original requirements

These are stated here without analysis. Part B names each one and Part G resolves the modelling defects.

1. *Parandamisel* was placed on the protocol.
2. A declaration-level assessment status was derived from protocol states by predicates that overlap and do not cover every case.
3. *Kontrollitud* was defined twice, under two different attribute names.
4. *Kontroll jäi pooleli* arose after 14 days without change and had no exit. Combined with the rule "a new protocol only if none is unconfirmed", it blocks the declaration permanently.
5. Resubmission and deadline expiry were said to act on "the protocol" when several protocols may exist.
6. A per-assessor status existed only as a display column.

### The evolved model

- **Deklaratsioon** gains *Parandamisel* and a terminal *Kontrollitud*.
- **Protokoll** has *Koostamisel*, *Parandamisele* and *Kinnitatud*, and aggregates the assessments of its assessors.
- Starting a protocol locks submission: while the lock holds, the declarant cannot submit.

### Open business decisions

These are not resolved anywhere in this article. The purpose of the model is to isolate each so that it can be decided by the people who own it, without reopening the rest.

| # | Decision | Why it is a business decision |
|---|---|---|
| O1 | **The gates.** Does the first assessor's judgement move the protocol, or must all assessors have judged? | It determines how long a declarant waits and whose opinion binds |
| O2 | **Idle lock versus the 90-day window.** If a protocol is started and then nothing happens, does the declarant's voluntary editing window keep running, pause, or extend? | It allocates the cost of the authority's delay |
| O3 | **Trapped drafts.** If the declarant has an unsubmitted edit when the protocol is confirmed, what becomes of it? | It decides whether work is lost, and whether *Kontrollitud* is truly terminal |
| O4 | **Submit versus start-assessment.** If both happen at once, which prevails, and what is the loser told? | A race signals a missing business rule (Part A, after Dahan) |

---

## Glossary (Part 0)

| Term | Definition |
|---|---|
| Atomic | Of a change: applied entirely or not at all |
| Business reading | The plain-language layer of a concept |
| Consistency boundary | The set of data one operation can change atomically |
| Entity | A thing with identity that persists while its attributes change |
| Event-sourced | Stored as the ordered sequence of facts that happened, from which current state is computed |
| Guard | A condition that must hold for a triggered transition to be taken |
| Invariant | A statement that must be true at every moment |
| Provenance tag | `[T]` theory, `[P]` practice, `[S]` synthesis |
| State | Provisional: a condition of an entity that determines which actions it accepts (precise definition in Part A) |
| Technical reading | The precise layer of a concept |
| Trigger | The cause of a transition: a command, a fact recorded elsewhere, or elapsed time |
| O1–O4 | The four open business decisions of the case |
