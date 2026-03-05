# Data Handling Across Boundaries in ASP.NET Core Services

*Security, Correctness, and Maintainability*

**Internal Learning Material for the .NET Team**
DDD / CQRS Context • ASP.NET Core • EF Core • PostgreSQL

---

## Table of Contents

*This document is organized into five parts. Each part builds on the previous one. Parts 1–4 are conceptual; Part 5 is EF Core / PostgreSQL-specific.*

**Part 1 — Foundation: What Layers Are and Why They Exist**

1. The Three Layers of a Typical .NET Web API
2. What "Trust Boundary" Means
3. The API Contract as a Promise
4. Input Model vs. Domain Model vs. Persistence Model

**Part 2 — Security**

5. Over-Posting / Mass Assignment
6. Authentication vs. Authorization vs. Input Integrity
7. Authenticated Does Not Mean Legitimate
8. Least Privilege Applied to API Input Contracts
9. Defense in Depth
10. The Confused Deputy Problem

**Part 3 — Understandability and Code That Does What It Looks Like**

11. The Principle of Least Surprise in API Design
12. Why Accepting a Persistence Entity at the API Layer Is Misleading
13. How Over-Broad Input Shapes Hide Business Rules
14. "This Code Works" vs. "This Code Is Correct"
15. Reading a Method Signature

**Part 4 — Protection From Accidental Mistakes**

16. The Happy Path Fallacy
17. Input Space Reduction
18. The Echo-Back Pattern
19. Silent Corruption
20. Server-Managed Fields

**Part 5 — EF Core and PostgreSQL: Constraints vs. Defaults**

21. Sentinel Values and INSERT Decisions
22. ValueGeneratedOnAdd()
23. Database DEFAULT vs. Database Constraint
24. SERIAL / BIGSERIAL / IDENTITY Columns
25. Sequence Desynchronisation
26. HasDefaultValueSql() vs. IsRequired() vs. Constraints
27. Why the Database Cannot Enforce Business Rules
28. Common EF Core Misconceptions

---

# Part 1 — Foundation: What Layers Are and Why They Exist

Before discussing security or correctness, we must establish a shared vocabulary about the layers data flows through in a typical ASP.NET Core service. Every mistake described later in this document originates from a misunderstanding of these layers or a failure to respect their boundaries.

## 1. The Three Layers of a Typical .NET Web API

In a DDD/CQRS service built on ASP.NET Core, there are at minimum three distinct layers through which incoming data travels:

| Layer | Responsibility | Model Type |
|---|---|---|
| API / Presentation | Accepts HTTP input, validates shape, returns HTTP responses | Input Model (DTO / Command) |
| Domain / Application | Enforces business rules, orchestrates operations | Domain Model / Aggregate |
| Persistence / Infrastructure | Maps domain state to storage (EF Core, Dapper) | Persistence Entity |

**The single responsibility of each layer:** Each layer has exactly one job. The API layer translates HTTP into commands and queries. The domain layer enforces invariants. The persistence layer maps state to tables. When a layer does work that belongs to another layer, it creates coupling that silently breaks when any layer changes.

In a CQRS architecture, the distinction is even sharper: the command side has a separate pipeline from the query side. A `CreateOrderCommand` carries only the fields the caller is allowed to provide. A `OrderReadModel` carries only the fields the caller is allowed to see. Neither should be the `Order` entity from EF Core.

> ⚠ *A common shortcut is to use the EF Core entity class as both the domain model and the API input model. This collapses all three layers into one type and eliminates every protection discussed in this document.*

## 2. What "Trust Boundary" Means and Why Every Layer Has a Different One

A trust boundary is the line between code that trusts its input and code that does not. Every time data crosses a trust boundary, the receiving side must validate and transform it before acting on it.

**API boundary (untrusted → partially trusted):** Data arrives over HTTP. The caller might be a frontend, a third-party integration, a curl command, or an attacker. Nothing in the payload can be trusted without validation. Even if the caller is authenticated, the data itself is still untrusted.

**Domain boundary (partially trusted → trusted):** The command or DTO passed from the API layer has been shape-validated but not yet business-validated. The domain layer must enforce invariants such as "only an administrator can change the status to Approved" or "the order total must match the sum of line items."

**Persistence boundary (trusted → storage):** By the time data reaches EF Core, the expectation is that it is already correct. The persistence layer should not be the first line of defence against bad data. Database constraints are a safety net, not the primary validation mechanism.

> ✓ *Mental model: each layer boundary is like a passport checkpoint. The API layer checks the passport (shape). The domain layer checks the visa (business rules). The database checks that the seat exists on the plane (structural integrity). If you skip the passport check, the visa check becomes meaningless.*

## 3. The API Contract as a Promise — What Accepting a Field Tells the Caller

When a REST endpoint accepts a JSON body with a property called `id`, `createdAt`, or `isActive`, the caller has a reasonable expectation that providing a value for those fields will have some effect. The shape of the input model is a promise to the consumer of the API.

Consider the following input model:

```csharp
public class CreateInvoiceRequest
{
    public int Id { get; set; }
    public string CustomerName { get; set; }
    public decimal Total { get; set; }
    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; }
    public bool IsDeleted { get; set; }
}
```

This model tells the caller: "you may set the primary key, you may choose the creation timestamp, you may decide who created this record, and you may mark it as deleted on creation." If the server silently ignores most of these fields, the contract is lying. If the server does not ignore them, the caller has control over data they should never touch.

**The correct input model** should contain only the fields the caller is expected and allowed to provide:

```csharp
public class CreateInvoiceCommand
{
    public string CustomerName { get; set; }
    // Total is calculated from line items by the domain.
    // Id, CreatedAt, CreatedBy, IsDeleted are server-managed.
}
```

> ⚠ *Every additional field in an input model is an invitation for the caller to provide data the server does not want. Even if the server ignores it today, a future refactor might accidentally wire it through.*

## 4. The Difference Between an Input Model, a Domain Model, and a Persistence Model

These three types serve fundamentally different purposes and should never be collapsed into one, even when they look structurally similar.

| Model | Lives In | Purpose | Example |
|---|---|---|---|
| Input Model (DTO/Command) | API layer | Describes what the caller sends | CreateOrderCommand |
| Domain Model (Aggregate) | Domain layer | Enforces invariants, encapsulates behaviour | Order (with methods) |
| Persistence Entity | Infrastructure layer | Maps to database tables | OrderEntity (EF Core) |

**Why separate models matter:**

- The input model is a contract with the outside world. It changes when the API changes.
- The domain model is a contract with the business. It changes when business rules change.
- The persistence entity is a contract with the database. It changes when the schema changes.

If all three are the same class, a column rename forces an API change. A new business rule leaks into the database schema. And a new API field gets silently persisted without any domain validation.

In a CQRS architecture with MediatR, the typical flow is:

```csharp
// Controller → MediatR → Handler → Domain → Repository
[HttpPost]
public async Task<IActionResult> Create(CreateOrderCommand command)
{
    var result = await _mediator.Send(command);
    return Ok(result);
}

// In the handler:
public async Task<OrderId> Handle(CreateOrderCommand cmd, ...)
{
    var order = Order.Create(cmd.CustomerId, cmd.Lines);
    // Domain validates invariants inside Order.Create()
    _repository.Add(order);
    await _unitOfWork.SaveChangesAsync();
    return order.Id;
}
```

The `CreateOrderCommand` never contains `Id`, `CreatedAt`, or `Status`. The domain model sets those. The persistence entity maps them to columns. Each model knows exactly as much as it needs to and no more.

---

# Part 2 — Security

The security implications of improper data handling are often invisible during development and testing. They become visible in penetration tests, audits, and — in the worst case — production incidents.

## 5. Over-Posting / Mass Assignment — Definition, Mechanism, and Why It Happens Silently

**Definition:** Over-posting (also called mass assignment) occurs when a client sends additional fields in a request body that the developer did not intend to accept, and those fields are bound to a server-side model that includes them.

**Mechanism in ASP.NET Core:** The model binder will bind any JSON property that matches a public settable property on the target type, regardless of whether the developer intended that property to be part of the input contract. If the target type is an EF Core entity, this means any column in the table is potentially writable by the caller.

Consider an endpoint that accepts a `User` entity directly:

```csharp
[HttpPut("{id}")]
public async Task<IActionResult> Update(int id, User user)
{
    user.Id = id;
    _context.Users.Update(user);
    await _context.SaveChangesAsync();
    return Ok();
}
```

If the `User` entity has an `IsAdmin` property, the caller can send `{ "name": "Alice", "isAdmin": true }` and escalate privileges. The model binder does not know which properties are "intended" — it binds everything that matches.

> ⚠ *This is not a theoretical risk. Over-posting was the root cause of the 2012 GitHub mass-assignment incident (Ruby on Rails, same concept) and appears regularly in OWASP guidelines.*

**Why it happens silently:** there is no error, no log entry, and no exception. The binder does its job correctly. The ORM does its job correctly. The database accepts the data. The only thing that went wrong is that the developer used a model with more surface area than intended.

**Mitigation:** use a dedicated input model (command/DTO) with only the fields the caller is allowed to provide. Map explicitly to the domain model. Never accept an EF Core entity at an API boundary.

## 6. Authentication vs. Authorization vs. Input Integrity — Three Concepts Routinely Confused

| Concept | Question It Answers | Mechanism |
|---|---|---|
| Authentication | Who is the caller? | JWT, cookies, API keys, certificates |
| Authorization | Is the caller allowed to perform this action? | Roles, policies, claims, permissions |
| Input Integrity | Is the data the caller sent valid and permitted? | Input models, validation, domain rules |

A request can pass authentication (valid JWT), pass authorization (user has the "editor" role), and still carry illegitimate data (the user sets `CreatedBy` to someone else's identifier). Input integrity is a separate concern from identity and permission.

In ASP.NET Core, authentication is handled by middleware (`UseAuthentication()`), authorization by `[Authorize]` attributes and policies, and input integrity by the model design itself combined with FluentValidation or `IValidatableObject`. Conflating these three leads to the belief that an `[Authorize]` attribute is sufficient to make an endpoint safe.

## 7. Why "The User Is Authenticated" Does Not Imply "All Input Values Are Legitimate"

Authentication establishes identity. It says nothing about the content of the request body. A fully authenticated user can submit:

- A negative quantity on an order line item.
- A foreign key that references another user's data.
- A status value that should only be set by a background process.
- A timestamp in the past to backdate a record.

Each of these is a legitimate HTTP request from an authenticated caller. None of them should succeed. The protection comes from the shape of the input model (restricting which fields are accepted) and domain validation (enforcing what values are legal).

> ✓ *Ask yourself: if I gave this endpoint to a disgruntled employee with valid credentials, what is the worst they could do by crafting JSON payloads? The answer reveals the gap between authentication and input integrity.*

## 8. The Principle of Least Privilege Applied to API Input Contracts

Least privilege is usually discussed in terms of authorization: users should have the minimum permissions necessary. The same principle applies to input contracts: **an endpoint should accept the minimum set of fields necessary for the operation.**

Every additional field is additional attack surface, additional validation burden, and additional opportunity for the caller to influence server behaviour in unintended ways. The ideal command object for an endpoint that creates an order contains only the fields the caller is expected to provide — typically the items being ordered and a delivery address. Everything else (order ID, timestamp, status, audit fields) is determined by the server.

This is not over-engineering. This is the default. Accepting extra fields is the deviation from correct design, even though it is often the path of least resistance.

## 9. Defense in Depth — Why Each Layer Must Enforce Its Own Invariants

Defense in depth means that no single layer is responsible for all validation. Each layer validates what it is responsible for:

- The API layer validates shape: required fields are present, types are correct, string lengths are within bounds.
- The domain layer validates business rules: the order total is non-negative, the status transition is legal, the user is allowed to act on this entity.
- The database layer validates structural integrity: foreign keys exist, unique constraints hold, NOT NULL columns are populated.

Why not just validate at one layer? Because layers can be bypassed. A background job that writes directly to the database bypasses the API layer. An internal service that sends commands to the domain bypasses the API layer. A direct SQL script bypasses both the API and domain layers. If the database is the only layer with constraints, it catches some errors. If the domain is the only layer, then the database is unprotected. All three must participate.

> ⚠ *In CQRS, the command handler is the natural place for domain validation. The command itself (input model) should make invalid states unrepresentable at the type level where possible. FluentValidation on the command handles shape validation before the handler runs.*

## 10. The Confused Deputy Problem — When a Legitimate User Causes Illegitimate Actions

The confused deputy problem occurs when a system (the "deputy") performs an action on behalf of a caller, using its own elevated privileges, based on unvalidated input from the caller.

In an ASP.NET Core context, the "deputy" is your service. It runs with a database connection string that has write access to all tables. When a user sends a request with `{ "ownerId": 42 }` and the service blindly writes that value, the service is acting as a confused deputy: it uses its own database privileges to set a value the user chose, without verifying the user is allowed to set it.

This is distinct from a direct authorization failure. The user might have legitimate access to the endpoint. The problem is that the endpoint trusts a value the user is not authoritative for. The fix is twofold: (1) the input model should not include `ownerId` if the server determines it from the authentication context, and (2) if the field must be in the input, the domain layer must verify the caller is allowed to use that value.

---

# Part 3 — Understandability and Code That Does What It Looks Like

Security flaws are often the direct consequence of code that is difficult to reason about. If a developer cannot look at a method and understand what it does, they will make incorrect assumptions about what is safe.

## 11. The Principle of Least Surprise in API Design

The principle of least surprise (or least astonishment) states that a system should behave in a way that the user — in this case the API consumer or the developer maintaining the code — would expect.

In API design, this means:

- If a POST endpoint accepts a body, every field in the body should be used.
- If a field is ignored, the caller should never have been asked to provide it.
- If a field has a server-determined value, it should not appear in the input model.
- If an endpoint returns an entity, the returned entity should match what was persisted, not what was submitted.

When an API accepts 15 fields and silently ignores 10 of them, every new developer who reads the model will assume those fields are meaningful. They will write frontend code that populates them. They will write integration tests that assert on them. And eventually someone will wire them through to the database, because "they must be there for a reason."

## 12. Why Accepting a Persistence Entity at the API Layer Is a Misleading Contract

When a controller method accepts an EF Core entity as its parameter, it communicates the following to every developer who reads it:

- "The caller is expected to provide every property of this entity, including navigation properties, audit fields, and computed columns."
- "The shape of the API input is identical to the shape of the database row."
- "Any schema change will be an API-breaking change."

None of these statements are the developer's intent. The developer's intent is usually: "Accept a few fields, create a record." But the type signature says something entirely different. The gap between intent and declaration is the breeding ground for bugs.

Furthermore, using an EF Core entity at the API boundary means the change tracker may attach the entity in unexpected states. A partial entity received from JSON deserialization, when passed to `DbContext.Update()`, marks every property as modified — including properties the caller never provided, which now contain their default values (`0`, `null`, `false`, `DateTime.MinValue`). This overwrites existing data with zeroes and nulls.

> ⚠ *EF Core's Update() marks ALL properties as Modified, regardless of whether they were set by the caller or left at their C# default. This is one of the most common sources of silent data corruption.*

## 13. How Over-Broad Input Shapes Hide Business Rules From the Reader

When a command object includes fields like `Status`, `ApprovedBy`, and `CompletedAt`, the reader has no way to know — from the type alone — which of those fields the caller controls and which the server computes.

Contrast these two signatures:

```csharp
// Version A: What fields does the caller control?
Task<r> Handle(UpdateOrderCommand cmd)
// where UpdateOrderCommand has: Id, Status, Items, Total,
//   ApprovedBy, CompletedAt, Notes, IsUrgent

// Version B: Completely clear
Task<r> Handle(UpdateOrderItemsCommand cmd)
// where UpdateOrderItemsCommand has: OrderId, Items, Notes
```

Version A forces the reader to trace through the handler implementation to discover that `Status`, `ApprovedBy`, and `CompletedAt` are ignored or overwritten. Version B makes the business rule visible at the type level: this command updates items and notes, nothing else.

> ✓ *In DDD, separate commands per intent is the standard practice. Instead of a single UpdateOrder, have UpdateOrderItems, ApproveOrder, CompleteOrder. Each command carries only the data relevant to that specific operation.*

## 14. The Difference Between "This Code Works" and "This Code Is Correct"

Code "works" if it produces the expected output for the inputs that were tested. Code is "correct" if it produces the expected output for all possible inputs within its contract, and if it rejects inputs that violate the contract.

An endpoint that accepts an EF Core entity and writes it to the database "works" in the sense that a well-behaved frontend sending correct data will produce the expected result. It is not "correct" because:

- A malicious caller can set fields they should not control.
- A buggy caller can omit fields, causing default values to overwrite real data.
- A caller that includes unexpected fields gets no feedback that those fields were ignored.
- A future schema change will break the API without any compilation error.

The gap between "works on the happy path" and "is correct by construction" is exactly what this document aims to close. Using strongly-typed, narrowly-scoped commands is the primary mechanism.

## 15. How to Read a Method Signature and Know What It Is Responsible For

A well-designed method signature tells the reader:

- What inputs the method requires (parameter types).
- What the method produces (return type).
- What side effects it has (naming convention, e.g., Create, Update, Delete).

If a handler accepts `CreateOrderCommand` with fields `CustomerId` and `Lines`, and returns `OrderId`, the reader knows: the caller provides a customer and line items, the server creates an order and returns its ID. No ambiguity.

If the same handler accepts `OrderEntity` with 25 properties, the reader knows nothing about intent. They must read the implementation to understand which properties matter. This is a failure of design, not of documentation.

---

# Part 4 — Protection From Accidental Mistakes

Most data integrity problems are not attacks. They are honest mistakes by well-intentioned developers who made reasonable but incorrect assumptions about how the system works.

## 16. The Happy Path Fallacy — Why Developers Reason Only About Correct Input

When developers test their endpoints, they typically send the request body they expect a well-behaved frontend to send. The frontend sends 5 fields; the endpoint receives 5 fields; the test passes. But the endpoint *accepts* an entity with 20 fields. The other 15 are never tested.

The happy path fallacy is the assumption that because the expected input works correctly, the endpoint is correct. It ignores:

- What happens when a field has its C# default value instead of a real value?
- What happens when a caller provides a field the server is supposed to manage?
- What happens when a required field is missing from the JSON (and thus defaults to null or 0)?
- What happens when a renamed frontend field no longer matches the backend property?

Each of these scenarios is common in practice, and none of them produce errors when the input model is over-broad. They produce silent corruption.

## 17. Input Space Reduction — Fewer Fields Mean Fewer Failure Modes

If an endpoint accepts 3 fields, there are a limited number of ways the input can be wrong: a field can be missing, have an incorrect type, or have an out-of-range value. If it accepts 20 fields, the combinatorial space of possible errors explodes.

Every field you remove from the input model:

- Eliminates one vector for over-posting.
- Eliminates one field that can have an unexpected default value.
- Eliminates one field the frontend must correctly populate.
- Eliminates one field that must be validated.
- Eliminates one field that can drift when the schema changes.

This is not minimalism for its own sake. It is error surface reduction. The narrowest correct input model is the safest input model.

## 18. The Echo-Back Pattern — How Consumers Naturally Reuse Objects

Frontend and integration developers have a natural and reasonable habit: when they receive an object from a GET endpoint, they modify the fields they need to change and send the whole object back to a PUT endpoint. This is the echo-back pattern.

If the GET response includes server-managed fields like `CreatedAt`, `ModifiedBy`, and `RowVersion`, the caller will send them back. If the PUT endpoint accepts an entity type, those fields will be bound. If the server does not explicitly ignore or overwrite them, the caller's stale values will be written to the database.

This leads to scenarios such as:

- The creation timestamp being overwritten with the value from the last GET response.
- The modification audit field showing the wrong user.
- Optimistic concurrency tokens being silently replaced, defeating concurrency checks.

The fix is to not include server-managed fields in the input model. The input model for a PUT endpoint should contain only the fields the caller is allowed to change.

## 19. Silent Corruption — When Wrong Values Are Accepted Without Error

Silent corruption is the most dangerous category of data integrity failure. Unlike an exception or a validation error, silent corruption produces no signal that something went wrong. The data is saved, the response is 200 OK, and the problem is only discovered hours, days, or months later — often by a business user looking at a report.

Common causes in ASP.NET Core services:

- A caller sends a partial entity; unset properties default to C# defaults (0, null, false, DateTime.MinValue) and overwrite existing values.
- A caller provides a foreign key value that belongs to another tenant.
- A server-managed timestamp field is overwritten by a client-provided value.
- A status field is set to a value that should only result from a specific workflow step.
- An `int` property that should be nullable (`int?`) silently defaults to 0 instead of null.

In every case, the system behaves as though nothing is wrong. The error is structural: the type accepted more data than the operation required.

## 20. Whose Responsibility Is It to Set Server-Managed Fields?

Server-managed fields include: primary keys (auto-generated), audit fields (CreatedAt, ModifiedBy), status fields controlled by workflows, computed fields (totals, hashes), and concurrency tokens (RowVersion).

**Who should set them?**

| Field Type | Set By | Set When |
|---|---|---|
| Primary key (identity) | Database (SERIAL/IDENTITY) | On INSERT |
| CreatedAt | Domain or handler | On creation, once |
| ModifiedAt | Domain or handler (or DB trigger) | On every update |
| CreatedBy / ModifiedBy | Handler (from auth context) | On creation / update |
| Status | Domain (state machine) | On explicit transitions |
| Computed total | Domain | Whenever inputs change |
| RowVersion / xmin | Database | On every write |

**What happens when nobody sets them:** If a server-managed field appears in the input model and the handler does not explicitly overwrite it, the caller's value (or the C# default) is what gets persisted. There is no mechanism in ASP.NET Core or EF Core that says "this property should be ignored when it comes from outside." The only reliable protection is to not include it in the input model.

> ⚠ *The [JsonIgnore] and [BindNever] attributes exist, but they are opt-in annotations on individual properties. They are easy to forget, invisible during code review, and do not communicate intent the way a separate input model does.*

---

# Part 5 — EF Core and PostgreSQL: Constraints vs. Defaults

This part addresses the specific ways EF Core and PostgreSQL interact that create a false sense of security. Developers often believe that configuring a default value in EF Core or the database will prevent bad data from being inserted. This section explains why that belief is incorrect.

## 21. How EF Core Decides Whether to Include a Property in an INSERT

EF Core uses a mechanism called **sentinel values** to decide whether a property should be included in the generated INSERT statement. A sentinel value is the value that EF Core treats as "not set by the application." For most types, the sentinel is the CLR default:

| CLR Type | Sentinel (Default) | Included in INSERT? |
|---|---|---|
| int | 0 | No (if ValueGeneratedOnAdd) |
| long | 0L | No (if ValueGeneratedOnAdd) |
| Guid | Guid.Empty | No (if ValueGeneratedOnAdd) |
| DateTime | DateTime.MinValue (0001-01-01) | No (if ValueGeneratedOnAdd) |
| string | null | No (if ValueGeneratedOnAdd) |
| bool | false | No (if ValueGeneratedOnAdd) |
| int? | null | No (if ValueGeneratedOnAdd) |

**Key rule:** if a property is configured as `ValueGeneratedOnAdd()` and the property's value equals the sentinel, EF Core omits it from the INSERT, allowing the database default to take effect. If the value is anything other than the sentinel — *including a value the application did not intend to set* — EF Core includes it in the INSERT.

This means that if a caller sends `{ "id": 5 }` and the model binder sets `entity.Id = 5`, EF Core will include `Id = 5` in the INSERT statement, bypassing the database sequence entirely. The sentinel mechanism does not protect against unwanted input. It only detects the absence of input.

## 22. What ValueGeneratedOnAdd() Does and What It Does Not Protect Against

`ValueGeneratedOnAdd()` tells EF Core: "The database will generate a value for this property if I don't include it in the INSERT." It does **not** tell EF Core: "Never include this property in the INSERT."

Specifically, `ValueGeneratedOnAdd()`:

- Causes EF Core to omit the property from INSERT when the value equals the sentinel.
- Causes EF Core to read back the database-generated value after INSERT.
- Does **NOT** prevent the application from setting the property.
- Does **NOT** prevent the model binder from setting the property.
- Does **NOT** prevent EF Core from including a non-sentinel value in the INSERT.
- Does **NOT** make the column read-only in any way.

```csharp
// This configuration:
builder.Property(e => e.Id).ValueGeneratedOnAdd();

// Does NOT prevent this from working:
var entity = new Order { Id = 999 }; // 999 != sentinel (0)
context.Orders.Add(entity);
await context.SaveChangesAsync();
// INSERT INTO orders (id, ...) VALUES (999, ...)
// The sequence is NOT incremented. 999 is stored.
```

> ⚠ *Many developers believe ValueGeneratedOnAdd() means the database always generates the value. It does not. It means the database generates the value only when EF Core omits it. If the application provides a value, EF Core sends it.*

## 23. The Difference Between a Database DEFAULT and a Database Constraint

**DEFAULT:** specifies a value to use when the INSERT statement does not include the column. A DEFAULT does not prevent an explicit value from being inserted. It is an "if absent, use this" rule.

**Constraint:** specifies a condition that must hold for every row at all times. A CHECK constraint can reject values. A NOT NULL constraint rejects nulls. A UNIQUE constraint rejects duplicates. Constraints are enforced regardless of what the INSERT statement contains.

```sql
-- DEFAULT: provides a fallback, does NOT restrict
CREATE TABLE orders (
    created_at TIMESTAMPTZ DEFAULT now()  -- used only if omitted
);

-- This INSERT succeeds, DEFAULT is ignored:
INSERT INTO orders (created_at) VALUES ('2020-01-01');

-- CONSTRAINT: actively rejects invalid data
ALTER TABLE orders
    ADD CONSTRAINT chk_created_at
    CHECK (created_at <= now());
```

The fundamental difference: a DEFAULT is passive (fills gaps), a constraint is active (rejects violations). Many developers treat `HasDefaultValueSql("now()")` as if it means "the database will always use now()." It does not. It means "the database will use now() if the INSERT does not provide a value for this column."

## 24. SERIAL / BIGSERIAL / IDENTITY Columns — What They Guarantee

In PostgreSQL, `SERIAL`, `BIGSERIAL`, and `GENERATED BY DEFAULT AS IDENTITY` all create a sequence-backed column with a DEFAULT. They do **not** prevent explicit values from being inserted.

| Definition | Allows Explicit INSERT? | Sequence Incremented? |
|---|---|---|
| SERIAL / BIGSERIAL | Yes | No (sequence unchanged) |
| GENERATED BY DEFAULT AS IDENTITY | Yes | No (sequence unchanged) |
| GENERATED ALWAYS AS IDENTITY | No (unless OVERRIDING SYSTEM VALUE) | N/A |

Only `GENERATED ALWAYS AS IDENTITY` provides true protection against client-provided values, and even then it can be overridden with `OVERRIDING SYSTEM VALUE`. For the other variants, a client-provided ID is silently accepted.

EF Core by default maps `int` primary keys to `GENERATED BY DEFAULT AS IDENTITY` in PostgreSQL (via Npgsql). This means that if the application provides a non-zero ID, it will be used instead of the sequence.

## 25. Sequence Desynchronisation — How a Client-Provided PK Becomes a Future Crash

When a client provides an explicit primary key value that is higher than the sequence's current value, the sequence does not advance. Later, when the sequence naturally reaches that value, the next INSERT will fail with a unique constraint violation.

Example timeline:

```sql
-- Current sequence value: 50
-- Client sends: { "id": 200, "name": "Test" }
INSERT INTO orders (id, name) VALUES (200, 'Test');
-- Succeeds. Sequence is still at 50.

-- 150 natural inserts later...
INSERT INTO orders (name) VALUES ('Normal Order');
-- Generated id = 200 from sequence. BOOM:
-- ERROR: duplicate key value violates unique constraint
```

This crash is a time bomb. It happens long after the original problematic insert, with no obvious connection to it. Debugging requires checking `pg_sequences` and looking for manually-inserted rows with IDs above the sequence's current value.

> ⚠ *This is one of the strongest arguments for never including the primary key in the input model. Even if the server ignores it, a single bug in the mapping code can desynchronise the sequence and cause a crash weeks later.*

## 26. HasDefaultValueSql() vs. IsRequired() vs. Database Constraints

These three EF Core / PostgreSQL mechanisms are often confused. Here is what each one actually does:

| Configuration | What It Does | What It Does NOT Do |
|---|---|---|
| `HasDefaultValueSql("now()")` | Adds DEFAULT now() to column DDL | Does NOT prevent explicit values |
| `IsRequired()` | Adds NOT NULL constraint | Does NOT prevent empty strings or zero |
| `HasCheckConstraint()` | Adds CHECK constraint to column | Does NOT run in the application layer |
| `ValueGeneratedOnAdd()` | Omits sentinel values from INSERT | Does NOT block non-sentinel values |

**Combining them:** to truly protect a `created_at` column, you would need: `HasDefaultValueSql("now()")` (to generate a value when absent), `IsRequired()` (to reject NULL), and a CHECK constraint or trigger to reject explicit values that differ from `now()`. Even then, the cleanest solution is to simply not include `created_at` in the input model.

## 27. Why the Database Cannot Know or Enforce Application-Level Business Rules

The database can enforce structural rules: types, nullability, uniqueness, referential integrity, and simple CHECK constraints. It cannot enforce:

- Authorization logic (can this user modify this record?).
- Workflow rules (can this status transition from Draft to Published?).
- Cross-aggregate consistency (does the total match the line items?).
- Temporal rules beyond simple comparisons (has the editing window expired?).
- Rules that depend on the identity of the caller.
- Rules that require context from other services.

Relying on database constraints as the primary business rule enforcement is tempting because PostgreSQL constraints are reliable and declarative. But they operate on rows and columns, not on domain concepts. The domain layer is where business rules belong. Database constraints are the last line of defence, not the first.

## 28. Common EF Core Misconceptions: What Developers Believe vs. What Actually Executes

This section catalogues widespread incorrect beliefs about EF Core behaviour, each paired with the actual behaviour.

### Misconception 1: "ValueGeneratedOnAdd() means the database always generates the value."

**Reality:** It means EF Core omits the property from INSERT *only* when the value equals the sentinel. If the application provides any other value, EF Core sends it.

### Misconception 2: "If I use Update(), EF Core will only update the fields that changed."

**Reality:** DbContext.Update() marks *every* property as Modified, regardless of whether it actually changed. This means properties that were never set by the caller (and thus contain C# defaults) will overwrite the existing database values.

```csharp
// The caller sends { "name": "Alice" } but the entity has 10 properties.
// After model binding, all other properties are at C# defaults.
context.Users.Update(user);
// Generated SQL:
// UPDATE users SET name='Alice', email=NULL, age=0, is_active=FALSE ...
// All 10 columns are updated, 9 of them to wrong values.
```

> ✓ *Instead of Update(), fetch the existing entity, apply changes to specific properties, and call SaveChangesAsync(). The change tracker will generate UPDATE only for modified properties.*

### Misconception 3: "If I configure a DEFAULT in the database, EF Core will use it."

**Reality:** EF Core will only use the database DEFAULT if the property value equals the sentinel AND the property is configured as ValueGeneratedOnAdd/OnAddOrUpdate. If neither condition is met, EF Core sends the value, and the DEFAULT is ignored.

### Misconception 4: "The database NOT NULL constraint will catch missing required fields."

**Reality:** NOT NULL rejects NULL. It does not reject 0, empty string, or DateTime.MinValue. If a non-nullable `int` property is not set by the caller, C# defaults it to 0, and EF Core sends 0 to the database. NOT NULL passes because 0 is not NULL.

### Misconception 5: "Using [Required] attribute on the entity is sufficient validation."

**Reality:** [Required] participates in ASP.NET Core model validation (`ModelState.IsValid`) for reference types and nullable value types. For non-nullable value types like `int` and `DateTime`, the model binder always produces a value (the default), so [Required] will never fail. The property is always "present" from the binder's perspective.

### Misconception 6: "If I don't map a property, EF Core won't send it to the database."

**Reality:** If a property is on the entity class and EF Core discovers it by convention, it will be mapped. You must explicitly call `Ignore()` in the configuration or use `[NotMapped]` to exclude a property. An unmapped property by naming convention in the entity may not be what you think.

### Misconception 7: "Using SERIAL / IDENTITY means the ID is always auto-generated."

**Reality:** As covered in Chapter 24, SERIAL and GENERATED BY DEFAULT AS IDENTITY allow explicit values. Only GENERATED ALWAYS AS IDENTITY blocks explicit values, and even that can be overridden.

### Misconception 8: "SaveChangesAsync() validates the entity before writing."

**Reality:** SaveChangesAsync() sends the tracked changes to the database. It does not run FluentValidation, [Required] checks, or any application-level validation. The only validation that occurs is at the database level (constraints), and that is a PostgreSQL responsibility, not an EF Core feature.

---

# Summary: The Minimum Standard for Every Endpoint

Apply these principles as a baseline for every endpoint in the codebase:

1. **Dedicated input models:** Every endpoint gets its own command/DTO. Never accept an EF Core entity at the API boundary.
2. **Minimal surface area:** Include only the fields the caller is expected and allowed to provide. If the server determines it, it does not belong in the input model.
3. **Explicit mapping:** Map from the input model to the domain model by hand or with a well-configured mapper. Never rely on implicit binding of entity properties.
4. **Domain validation:** Business rules live in the domain layer (aggregates, value objects, or command handlers). The input model handles shape; the domain handles semantics.
5. **Server-managed fields:** Primary keys, timestamps, audit fields, and status fields are set by the server, never accepted from the caller.
6. **Database constraints as safety nets:** NOT NULL, CHECK, and UNIQUE constraints catch bugs that escape the application layer. They are the last line of defence, not the first.
7. **Assume the caller will send anything:** Design input models for hostile input, not cooperative frontends. If the model allows it, someone will send it.
8. **Code review checkpoint:** if you see an EF Core entity type in a controller method signature, that is a finding. It should be discussed and resolved before merge.

These are not aspirational goals. They are the engineering baseline that prevents the class of bugs described in this document. Every rule here costs less to implement during development than to debug in production.

---

*— End of Document —*
