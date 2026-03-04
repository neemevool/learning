# .NET Strings: Self-Learning Plan

## Learning Objectives

After completing this self-learning plan, you will:
- ✅ Understand the internal representation of `System.String` in the .NET runtime
- ✅ Know exactly which string operations allocate new memory and which do not
- ✅ Understand how string content is encoded, stored, and when encoding matters
- ✅ **Identify hidden allocation traps in everyday string operations**
- ✅ Efficiently process and transfer large string content across system boundaries
- ✅ Minimize string allocations when mapping between DTO layers
- ✅ Apply `Span<char>`, `Memory<char>`, `StringPool`, and `StringBuilder` effectively
- ✅ Make informed decisions about string handling in enterprise multi-layer architectures

---

## Module 1: Internal Representation of System.String

### 1.1 What a String Actually Is

A `System.String` in .NET is a **sealed reference type** stored on the managed heap. Despite behaving like a value type in many ways (immutability, equality by value), it is an object with a header, and every distinct string instance occupies its own heap memory.

**Memory layout of a string object on the heap:**

```
┌──────────────────────────────────────────────────────────────┐
│  Object Header  │  MethodTable*  │  _stringLength  │  _firstChar ...  │
│    (8 bytes)    │   (8 bytes)    │   (4 bytes)     │  (2 bytes × len) │
└──────────────────────────────────────────────────────────────┘
                                                       + 2 bytes null terminator
```

- **Object Header (8 bytes on x64):** Sync block index (used for locking, hashing).
- **MethodTable pointer (8 bytes on x64):** Type identity pointer, standard for all objects.
- **`_stringLength` (4 bytes):** The number of `char` elements (not the byte count).
- **`_firstChar` (inline char buffer):** The actual character data, stored **inline** in the object — not as a separate array. This is a critical difference from most other reference types. The characters live directly after the length field.

**Total heap size of a string:**

```
Size = 26 + (length × 2) bytes, rounded up to pointer-size boundary (8 bytes on x64)
```

For an empty string `""`: 26 bytes → rounded to 32 bytes on x64.
For `"Hello"` (5 chars): 26 + 10 = 36 → rounded to 40 bytes.

**Key takeaways:**
- Every string object has at least ~26 bytes of overhead even before content.
- Characters are stored inline — there is no indirection to a separate `char[]`.
- String length is measured in `char` count (UTF-16 code units), not in bytes, not in Unicode codepoints, and not in visible characters (grapheme clusters).

### 1.2 Character Encoding: UTF-16 Internally, Everything Else at the Boundary

.NET strings use **UTF-16 LE (Little Endian)** encoding internally. Each `char` is a 16-bit UTF-16 code unit.

This has concrete implications:

```csharp
string ascii = "Hello";          // 5 chars, 5 UTF-16 code units
string estonian = "Tõõpäev";     // 7 chars, 7 UTF-16 code units (all in BMP)
string emoji = "Hello 🌍";       // 7 visible characters, but...
Console.WriteLine(emoji.Length); // 8! The 🌍 emoji is U+1F30D, a supplementary character
                                 // stored as a surrogate pair: 2 UTF-16 code units
```

**Surrogate pairs — a common source of bugs:**

```csharp
string earth = "🌍";
Console.WriteLine(earth.Length);        // 2 (two char values)
Console.WriteLine(earth[0]);            // '\uD83C' — high surrogate (meaningless alone)
Console.WriteLine(earth[1]);            // '\uDF0D' — low surrogate (meaningless alone)

// Correct way to enumerate Unicode codepoints:
var enumerator = StringInfo.GetTextElementEnumerator(earth);
int codepointCount = 0;
while (enumerator.MoveNext()) codepointCount++;
Console.WriteLine(codepointCount);      // 1

// .NET 5+ alternative:
foreach (Rune rune in earth.EnumerateRunes())
{
    Console.WriteLine($"U+{rune.Value:X4}");  // U+1F30D
}
```

**Why this matters:** Any code that indexes into a string by `char` position, uses `Substring` with calculated offsets, or truncates strings to a max length can silently split a surrogate pair, producing invalid Unicode. This is particularly relevant when storing truncated strings in database columns with character limits.

### 1.3 Encoding Is a System Boundary Concern

Inside the .NET process, strings are always UTF-16. Encoding and decoding happen at boundaries:

```
                    UTF-16 (internal)
                    ┌─────────────┐
  Network ──UTF-8──▶│  .NET       │──UTF-8──▶ REST API
  Database ─────────▶│  Process    │──────────▶ Database
  File ────UTF-8───▶│  (UTF-16)   │──UTF-8──▶ File
  Console ──────────▶│             │──────────▶ Console
                    └─────────────┘
```

Encoding issues manifest at these boundaries:

```csharp
// PROBLEM: Assuming bytes are UTF-8 when they might not be
byte[] bytesFromLegacySystem = GetBytesFromSomewhere();
string wrong = Encoding.UTF8.GetString(bytesFromLegacySystem);
// If the bytes were actually Windows-1252, you now have garbled text — silently.

// CORRECT: Know your encoding, or detect it
// Register legacy encoding provider (required in .NET Core+)
Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
string correct = Encoding.GetEncoding(1252).GetString(bytesFromLegacySystem);

// PROBLEM: Not specifying encoding when writing
File.WriteAllText("output.txt", content); // Uses UTF-8 without BOM by default in .NET Core
// Legacy systems may expect a BOM or a different encoding

// CORRECT: Be explicit
File.WriteAllText("output.txt", content, new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));
```

**Common encoding traps in enterprise systems:**

| Boundary | Common Problem | Correct Approach |
|----------|---------------|-----------------|
| HTTP request body | Assuming UTF-8, not checking `Content-Type` charset | Read `Content-Type` header, default to UTF-8 only when RFC says so |
| Database (SQL Server) | `varchar` vs `nvarchar` — `varchar` uses database collation encoding | Use `nvarchar` for Unicode; understand that `varchar` can lose characters |
| Database (PostgreSQL) | Assuming server encoding is UTF-8 | Typically is UTF-8 by default, but verify; `text` type is encoding-aware |
| File I/O | Using `StreamReader` default (UTF-8) on legacy files | Detect or know encoding; use `Encoding.GetEncoding(...)` |
| XML | Ignoring XML declaration encoding | `XmlReader` respects it, but manual string reading may not |
| Console output | Garbled characters in Windows terminal | `Console.OutputEncoding = Encoding.UTF8;` |

**Learning exercise:**

```csharp
// Explore the byte-level difference between encodings
string text = "Tõõpäev — a workday";

byte[] utf8 = Encoding.UTF8.GetBytes(text);
byte[] utf16 = Encoding.Unicode.GetBytes(text);
byte[] ascii = Encoding.ASCII.GetBytes(text);

Console.WriteLine($"UTF-8:  {utf8.Length} bytes — {BitConverter.ToString(utf8)}");
Console.WriteLine($"UTF-16: {utf16.Length} bytes — {BitConverter.ToString(utf16)}");
Console.WriteLine($"ASCII:  {ascii.Length} bytes — {BitConverter.ToString(ascii)}");
// ASCII will replace non-ASCII characters with '?' (0x3F) — data loss!

// Verify: round-trip test
string roundTripped = Encoding.ASCII.GetString(ascii);
Console.WriteLine(roundTripped);
// "T??p?ev ? a workday" — the õ, ä, and em-dash are lost

// Detect encoding issues: EncoderFallback
var strictUtf8 = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);
try
{
    byte[] invalidUtf8 = new byte[] { 0xC0, 0xAF }; // overlong encoding, invalid
    strictUtf8.GetString(invalidUtf8);
}
catch (DecoderFallbackException ex)
{
    Console.WriteLine($"Invalid UTF-8: {ex.Message}");
}
```

---

## Module 2: String Operations and Memory Allocation

### 2.1 The Fundamental Rule

**`System.String` is immutable.** Any operation that appears to modify a string actually creates a new string object on the heap (with a few specific exceptions listed below). Understanding which operations allocate and which do not is critical for performance-conscious development.

### 2.2 Operations That ALWAYS Allocate a New String

Every operation below creates a new `System.String` instance on the heap:

```csharp
string original = "Hello, World!";

// ❌ ALLOCATES — Concatenation (most well-known)
string concat = original + " Goodbye";          // new string: "Hello, World! Goodbye"
string concat2 = string.Concat("a", "b", "c");  // new string: "abc"

// ❌ ALLOCATES — Substring (commonly overlooked!)
string sub = original.Substring(0, 5);           // new string: "Hello"
// Even if the substring is the entire string, .NET may or may not optimize this
// (it does optimize when start=0 and length=original.Length, returning the same reference)

// ❌ ALLOCATES — ToUpper / ToLower
string upper = original.ToUpper();               // new string: "HELLO, WORLD!"
string lower = original.ToLower();               // new string: "hello, world!"
// Even if the string is already all upper/lower, a new string is created
// (ToUpperInvariant / ToLowerInvariant behave the same way)

// ❌ ALLOCATES — Trim, TrimStart, TrimEnd
string trimmed = "  hello  ".Trim();             // new string: "hello"
// Exception: if nothing was trimmed, returns the original reference

// ❌ ALLOCATES — Replace
string replaced = original.Replace("World", "Earth"); // new string: "Hello, Earth!"
// Even Replace("x", "x") on a string without 'x' — returns original reference (no match)
// But Replace that matches always allocates, even if replacement is same as original

// ❌ ALLOCATES — Insert / Remove
string inserted = original.Insert(5, "!!");      // new string: "Hello!!, World!"
string removed = original.Remove(5);             // new string: "Hello"

// ❌ ALLOCATES — PadLeft / PadRight
string padded = "42".PadLeft(10, '0');           // new string: "0000000042"

// ❌ ALLOCATES — String.Format / string interpolation
string formatted = $"Name: {name}, Age: {age}";  // new string
string formatted2 = string.Format("Name: {0}", name); // new string

// ❌ ALLOCATES — String.Join
string joined = string.Join(", ", items);         // new string

// ❌ ALLOCATES — String.Split (allocates BOTH the array AND each substring)
string[] parts = original.Split(',');            // new string[] + new strings

// ❌ ALLOCATES — ToString() on value types
int number = 42;
string numStr = number.ToString();               // new string: "42"
```

### 2.3 Operations That DO NOT Allocate

These operations work with the existing string without creating new objects:

```csharp
string original = "Hello, World!";

// ✅ NO ALLOCATION — Length
int len = original.Length;                        // just reads the _stringLength field

// ✅ NO ALLOCATION — Indexer
char c = original[0];                            // direct memory read from inline buffer

// ✅ NO ALLOCATION — String comparison (returns bool/int, not a string)
bool equal = original == "Hello, World!";
bool equal2 = string.Equals(original, "hello, world!", StringComparison.OrdinalIgnoreCase);
int cmp = string.Compare(original, "other");

// ✅ NO ALLOCATION — Contains, StartsWith, EndsWith, IndexOf, LastIndexOf
bool has = original.Contains("World");
bool starts = original.StartsWith("Hello");
int idx = original.IndexOf(',');
// These return bool or int — no string created

// ✅ NO ALLOCATION — String.IsNullOrEmpty / IsNullOrWhiteSpace
bool empty = string.IsNullOrEmpty(original);

// ✅ NO ALLOCATION — GetHashCode
int hash = original.GetHashCode();

// ✅ NO ALLOCATION — AsSpan() (returns ReadOnlySpan<char> over existing memory)
ReadOnlySpan<char> span = original.AsSpan();
ReadOnlySpan<char> slice = original.AsSpan(0, 5); // "Hello" without allocation!

// ✅ NO ALLOCATION — AsMemory() (returns ReadOnlyMemory<char>)
ReadOnlyMemory<char> mem = original.AsMemory(0, 5);

// ✅ NO ALLOCATION — Enumerating characters
foreach (char ch in original) { }                // iterates inline buffer directly

// ✅ NO ALLOCATION — Reference to string.Empty
string empty2 = string.Empty;                    // singleton, no allocation

// ✅ NO ALLOCATION — Interned string literals
string literal = "Hello, World!";                // loaded from assembly metadata, interned
```

### 2.4 Operations with Conditional Allocation

Some operations are smart enough to return the original reference when no actual change occurs:

```csharp
string original = "Hello";

// ⚠️ CONDITIONAL — Substring
string same = original.Substring(0, original.Length); // returns original reference (optimized)
string sub = original.Substring(0, 3);                // allocates new string "Hel"

// ⚠️ CONDITIONAL — Trim (when nothing to trim)
string noTrim = original.Trim();                      // returns original reference (nothing trimmed)
string trimmed = "  Hello  ".Trim();                  // allocates new string "Hello"

// ⚠️ CONDITIONAL — Replace (when pattern not found)
string noMatch = original.Replace("xyz", "abc");      // returns original reference (no match)
string match = original.Replace("Hello", "Hi");       // allocates new string "Hi"

// ⚠️ CONDITIONAL — string.Concat with empty
string concatEmpty = string.Concat(original, "");     // returns original reference
string concatEmpty2 = string.Concat("", original);    // returns original reference

// ⚠️ CONDITIONAL — String interning
string interned = string.Intern(someString);          // returns interned reference if exists,
                                                      // otherwise interns and returns it
```

### 2.5 The Split + Substring Double Allocation Trap

`String.Split` is one of the most allocation-heavy operations because it allocates both the result array and every individual substring:

```csharp
// Parsing a CSV line — common in enterprise code
string line = "John,Doe,42,Tallinn,Estonia,Developer";
string[] parts = line.Split(',');
// Allocations: 1 string[] (6 elements) + 6 new string objects = 7 heap allocations

// For a 10,000-line CSV file:
// 10,000 × 7 = 70,000 allocations — significant GC pressure

// BETTER: Use Span-based splitting (.NET 8+)
ReadOnlySpan<char> lineSpan = line.AsSpan();
int fieldIndex = 0;
foreach (Range range in lineSpan.Split(','))
{
    ReadOnlySpan<char> field = lineSpan[range];
    // Process field WITHOUT allocating a string
    // Only create a string if you actually need to store it
    if (fieldIndex == 0)
    {
        string firstName = field.ToString(); // allocates only when needed
    }
    fieldIndex++;
}

// BETTER for .NET 6/7: Manual span slicing
ReadOnlySpan<char> remaining = line.AsSpan();
while (!remaining.IsEmpty)
{
    int commaIndex = remaining.IndexOf(',');
    ReadOnlySpan<char> field = commaIndex == -1 ? remaining : remaining[..commaIndex];
    remaining = commaIndex == -1 ? ReadOnlySpan<char>.Empty : remaining[(commaIndex + 1)..];

    // Process field without allocation
}
```

### 2.6 String Interpolation: Allocation Details

String interpolation has evolved significantly across .NET versions:

```csharp
int age = 30;
string name = "Alice";

// .NET 5 and earlier: interpolation compiles to String.Format — always allocates
string old = $"Name: {name}, Age: {age}";
// Equivalent to: String.Format("Name: {0}, Age: {1}", name, age);
// Allocations: boxing of int, params array, final string

// .NET 6+: interpolation uses InterpolatedStringHandler — more efficient
string modern = $"Name: {name}, Age: {age}";
// Compiler generates handler-based code, fewer intermediate allocations
// BUT: still allocates the final string

// BEST for hot paths: use directly with Span-accepting APIs
Span<char> buffer = stackalloc char[128];
bool success = buffer.TryWrite($"Name: {name}, Age: {age}", out int written);
// ZERO heap allocations — interpolated directly into stack buffer

// Or with StringBuilder
var sb = new StringBuilder();
sb.Append($"Name: {name}, Age: {age}");
// .NET 6+: handler writes directly into StringBuilder's buffer, no intermediate string
```

**Learning exercise:**

```csharp
// Measure allocations with a simple tracker
// (In production, use BenchmarkDotNet with [MemoryDiagnoser])

string input = "  Hello, World!  How are you?  ";

// Test 1: How many allocations?
string result1 = input.Trim().Replace("World", "Earth").ToUpper();
// Answer: 3 allocations (Trim, Replace, ToUpper each produce a new string)
// The intermediate strings become garbage immediately

// Test 2: Can we reduce allocations?
// Using Span where possible:
ReadOnlySpan<char> trimmed = input.AsSpan().Trim(); // 0 allocations — just pointer + length
// But: Replace and ToUpper are not available on Span<char> directly
// For that, we'd need StringBuilder or manual processing

// Test 3: Verify conditional allocation
string a = "Hello";
string b = a.Substring(0, a.Length);
Console.WriteLine(ReferenceEquals(a, b)); // True — same reference, no allocation

string c = a.Trim();
Console.WriteLine(ReferenceEquals(a, c)); // True — nothing to trim

string d = a.Replace("xyz", "abc");
Console.WriteLine(ReferenceEquals(a, d)); // True — no match found

string e = a.ToUpper();
Console.WriteLine(ReferenceEquals(a, e)); // False! Even though "HELLO" != "Hello",
                                          // a new string is always created

// What about this? (the string is already uppercase)
string f = "HELLO";
string g = f.ToUpper();
Console.WriteLine(ReferenceEquals(f, g)); // False in .NET 6 and below
                                          // True in .NET 7+! (optimized to check first)
```

---

## Module 3: StringBuilder and Efficient String Construction

### 3.1 When StringBuilder Is Beneficial

The rule of thumb "use StringBuilder for concatenation in loops" is widely known but often applied too broadly or too narrowly. Here's a precise guide:

**StringBuilder is beneficial when:**
- Concatenating in a loop with unknown or large iteration count
- Building a string incrementally across multiple method calls
- Constructing strings from many (5+) parts

**StringBuilder is NOT beneficial when:**
- Concatenating a known small number of strings (2–4)
- The compiler can use `string.Concat` overloads (up to 4 args, highly optimized)
- One-shot string interpolation (in .NET 6+, the handler is already efficient)

```csharp
// ❌ UNNECESSARY StringBuilder — string.Concat is faster for few arguments
var sb = new StringBuilder();
sb.Append(firstName);
sb.Append(" ");
sb.Append(lastName);
string name = sb.ToString();
// 2 allocations: StringBuilder buffer + ToString result

// ✅ BETTER — direct concatenation for few parts
string name = firstName + " " + lastName;
// Compiler converts to string.Concat(firstName, " ", lastName) — 1 allocation, highly optimized

// ✅ BETTER — interpolation for readability (same perf in .NET 6+)
string name = $"{firstName} {lastName}";
```

### 3.2 StringBuilder Internals

```
StringBuilder object
┌────────────────────────────────────────────────┐
│  m_ChunkChars: char[]   ← current write buffer │
│  m_ChunkLength: int     ← used portion         │
│  m_ChunkPrevious: SB    ← linked list to prev  │
│  m_MaxCapacity: int                             │
└────────────────────────────────────────────────┘
```

- StringBuilder uses a **linked list of `char[]` chunks**, not a single resizable array.
- Default initial capacity: 16 characters.
- When a chunk is full, a new chunk is allocated and linked.
- `ToString()` always allocates a new string by copying all chunks into one contiguous buffer.

```csharp
// Pre-size when you can estimate the final length
var sb = new StringBuilder(estimatedLength);

// Avoid:
var sb = new StringBuilder();
for (int i = 0; i < 10000; i++)
{
    sb.Append(items[i]); // Multiple chunk allocations as it grows
}

// Better:
var sb = new StringBuilder(10000 * averageItemLength);
for (int i = 0; i < 10000; i++)
{
    sb.Append(items[i]); // Likely fits in initial buffer
}

// .NET 6+: StringBuilder.Append with interpolation handler
sb.Append($"Item {i}: {value}"); // No intermediate string — writes directly into buffer
```

### 3.3 String.Create — The Zero-Copy String Factory

`String.Create` allows you to write directly into a newly allocated string's character buffer, avoiding any intermediate copies:

```csharp
// Create a formatted string with zero intermediate allocations
string result = string.Create(20, (firstName, lastName), (span, state) =>
{
    state.firstName.AsSpan().CopyTo(span);
    span[state.firstName.Length] = ' ';
    state.lastName.AsSpan().CopyTo(span[(state.firstName.Length + 1)..]);
});

// More practical example: formatting a fixed-width record
string record = string.Create(50, (id: 42, name: "Alice", balance: 1234.56m),
    (span, state) =>
    {
        state.id.TryFormat(span[..10], out _, "D10");       // "0000000042"
        state.name.AsSpan().CopyTo(span[10..30]);            // left-aligned in 20 chars
        span[10..30].Fill(' ');                               // clear remaining
        state.name.AsSpan().CopyTo(span[10..]);
        state.balance.TryFormat(span[30..50], out _, "F2");  // "1234.56"
    });
```

### 3.4 ValueStringBuilder (Internal / ZString)

The runtime internally uses `ValueStringBuilder`, a `ref struct` that can use stack memory. It is internal to the runtime, but the community library **ZString** provides similar functionality:

```csharp
// ZString (Cysharp/ZString on NuGet): heap-free string building
using Cysharp.Text;

// Stack-allocated building for short strings
using var sb = ZString.CreateStringBuilder();
sb.Append("Hello, ");
sb.Append(name);
sb.Append("! You are ");
sb.Append(age);
sb.Append(" years old.");
string result = sb.ToString(); // Only one allocation: the final string

// Especially useful in logging-heavy code
using var sb2 = ZString.CreateUtf8StringBuilder(); // writes UTF-8 bytes directly
sb2.Append("Log: ");
sb2.Append(timestamp);
sb2.Append(" | ");
sb2.Append(message);
// Can write directly to Stream without creating a string at all
await sb2.WriteToAsync(stream);
```

---

## Module 4: Large String Content Across System Boundaries

This module addresses the practical scenario of receiving large string content (hundreds of KB to tens of MB) from a network client, processing it, storing it in a database, retrieving it, and passing it to an API consumer — common in content management and legislative/document systems.

### 4.1 The Problem with Naive Large String Handling

```csharp
// NAIVE APPROACH — What most developers write first
[HttpPost]
public async Task<IActionResult> SaveDocument([FromBody] DocumentDto dto)
{
    // Problem 1: ASP.NET Core has already deserialized the entire JSON body
    //            into a string. If dto.Content is 5 MB of text, that's a
    //            10 MB UTF-16 string on the heap (LOH if > ~42,500 chars).

    var entity = new Document
    {
        Content = dto.Content  // Problem 2: just copying the reference (cheap),
                               // but the original DTO keeps the string alive
    };

    await _dbContext.SaveChangesAsync();
    return Ok();
}

// Where memory goes:
// 1. ASP.NET reads HTTP body bytes into a buffer (~5 MB UTF-8)
// 2. JSON deserializer creates string from UTF-8 → ~10 MB UTF-16 string (LOH!)
// 3. Entity holds reference to same string
// 4. EF Core parameterizes it for SQL — driver may convert back to UTF-8 for PostgreSQL
// Peak: ~15-20 MB for a single 5 MB document
```

**LOH (Large Object Heap) threshold:** Objects ≥ 85,000 bytes go to LOH. A string of ~42,500+ characters (85,000 bytes of char data) lands on LOH. LOH is collected only during Gen 2 GC — infrequent and expensive. Repeated large string allocations cause LOH fragmentation.

### 4.2 Streaming Approach: Avoiding Full Materialization

The key principle: **keep data as bytes (UTF-8) as long as possible, avoid converting to UTF-16 string until absolutely necessary.**

```csharp
// BETTER: Stream the content, don't materialize entirely

// Option 1: Read the request body as a stream, pass bytes to database
[HttpPost]
[DisableRequestSizeLimit] // or configure in options
public async Task<IActionResult> SaveDocument(
    [FromRoute] int documentId,
    CancellationToken ct)
{
    // Read raw body — no string allocation
    // The content type should be "text/plain; charset=utf-8" or "application/octet-stream"
    using var bodyStream = Request.Body;

    // For PostgreSQL with Npgsql — write directly from stream
    await using var conn = await _dataSource.OpenConnectionAsync(ct);
    await using var cmd = new NpgsqlCommand(
        "UPDATE documents SET content = @content WHERE id = @id", conn);

    // Npgsql can accept a stream for text parameters
    cmd.Parameters.Add(new NpgsqlParameter("content", NpgsqlDbType.Text)
    {
        Value = await new StreamReader(bodyStream, Encoding.UTF8).ReadToEndAsync(ct)
        // Still materializes to string — but we can do better (see 4.3)
    });
    cmd.Parameters.AddWithValue("id", documentId);
    await cmd.ExecuteNonQueryAsync(ct);

    return Ok();
}
```

### 4.3 Chunked Processing for Very Large Content

When content is large enough to warrant avoiding full materialization:

```csharp
// Strategy: Process content in chunks, never hold the entire string in memory

public class ChunkedContentProcessor
{
    private const int ChunkSize = 64 * 1024; // 64 KB chunks

    public async Task ProcessAndStoreAsync(
        Stream inputStream,
        Func<ReadOnlyMemory<char>, int, Task> processChunk,
        CancellationToken ct)
    {
        using var reader = new StreamReader(inputStream, Encoding.UTF8,
            detectEncodingFromByteOrderMarks: true,
            bufferSize: ChunkSize,
            leaveOpen: true);

        char[] buffer = ArrayPool<char>.Shared.Rent(ChunkSize);
        try
        {
            int chunkIndex = 0;
            int charsRead;
            while ((charsRead = await reader.ReadAsync(buffer.AsMemory(), ct)) > 0)
            {
                await processChunk(buffer.AsMemory(0, charsRead), chunkIndex++);
            }
        }
        finally
        {
            ArrayPool<char>.Shared.Return(buffer);
        }
    }
}

// Usage: Store large content to DB in a streaming fashion
// (Exact API depends on your database driver and ORM)
```

### 4.4 PipeReader for High-Throughput Scenarios

For the highest performance when reading large content from the network, `System.IO.Pipelines` avoids most allocations:

```csharp
using System.Buffers;
using System.IO.Pipelines;

public async Task ProcessWithPipelineAsync(PipeReader reader, CancellationToken ct)
{
    while (true)
    {
        ReadResult result = await reader.ReadAsync(ct);
        ReadOnlySequence<byte> buffer = result.Buffer;

        // Process UTF-8 bytes directly — no string allocation
        // For example, search for a pattern in raw bytes:
        SequencePosition? newlinePos = buffer.PositionOf((byte)'\n');

        if (newlinePos != null)
        {
            // Process the line as UTF-8 bytes
            ReadOnlySequence<byte> line = buffer.Slice(0, newlinePos.Value);
            ProcessLineAsUtf8(line);
            reader.AdvanceTo(buffer.GetPosition(1, newlinePos.Value));
        }
        else
        {
            reader.AdvanceTo(buffer.Start, buffer.End);
        }

        if (result.IsCompleted)
            break;
    }
}

private void ProcessLineAsUtf8(ReadOnlySequence<byte> utf8Line)
{
    // Work with raw UTF-8 bytes — zero string allocation
    // Only convert to string when you need a string for an API that requires it
    if (utf8Line.IsSingleSegment)
    {
        ReadOnlySpan<byte> span = utf8Line.FirstSpan;
        // Process span...
    }
}
```

### 4.5 Database Round-Trip: Encoding Awareness

**SQL Server:**

```csharp
// SQL Server stores:
// varchar(max)  → database collation encoding (often Windows-1252)
// nvarchar(max) → UTF-16 LE (same as .NET)

// When using nvarchar: .NET string → SQL parameter → SQL Server stores UTF-16 directly
// No encoding conversion needed — fast and lossless.

// When using varchar: .NET string (UTF-16) → ADO.NET converts to collation encoding
// Risk: characters not in the collation are silently replaced with '?'

// RECOMMENDATION: Always use nvarchar for user-supplied content
// The 2× storage cost is usually worth the correctness guarantee
```

**PostgreSQL:**

```csharp
// PostgreSQL text/varchar stores in database encoding (usually UTF-8)
// Npgsql converts .NET UTF-16 string → UTF-8 bytes for transmission
// and UTF-8 bytes → .NET UTF-16 string on read

// This means every read/write does an encoding conversion
// For large strings, this conversion itself has CPU and allocation cost

// Reading large text efficiently with Npgsql:
await using var reader = await cmd.ExecuteReaderAsync(
    CommandBehavior.SequentialAccess, ct); // SequentialAccess avoids buffering all columns
if (await reader.ReadAsync(ct))
{
    // GetTextReader returns a TextReader over the raw UTF-8 wire data
    // Converts to chars on-the-fly, no full string materialization
    using var textReader = reader.GetTextReader(0);

    // Process chunks
    char[] buffer = ArrayPool<char>.Shared.Rent(8192);
    try
    {
        int charsRead;
        while ((charsRead = await textReader.ReadAsync(buffer, ct)) > 0)
        {
            // Process buffer[0..charsRead] — only small chunks in memory
        }
    }
    finally
    {
        ArrayPool<char>.Shared.Return(buffer);
    }
}
```

### 4.6 Full Pipeline: Receive → Process → Store → Retrieve → Serve

Here's an architecture overview for handling large string content end-to-end:

```
Receive from client:
┌─────────────────────────────────────────────────────────────────┐
│  HTTP Request Body (UTF-8 bytes on wire)                        │
│  ↓                                                              │
│  Option A: [< ~500 KB] Normal JSON deserialization              │
│            System.Text.Json handles encoding, creates string    │
│  Option B: [> ~500 KB] Stream body directly                     │
│            Skip JSON for the content field                      │
│            Use multipart/form-data or raw body stream           │
└─────────────────────────────────────────────────────────────────┘

Store to database:
┌─────────────────────────────────────────────────────────────────┐
│  Option A: EF Core as usual — fine for < ~1 MB content          │
│  Option B: Raw ADO.NET with streaming parameters for larger     │
│  Option C: For PostgreSQL — Large Objects (lo_*) for > ~10 MB   │
└─────────────────────────────────────────────────────────────────┘

Retrieve from database:
┌─────────────────────────────────────────────────────────────────┐
│  Option A: EF Core — materializes entire string (fine < ~1 MB)  │
│  Option B: SequentialAccess + GetTextReader for streaming read  │
└─────────────────────────────────────────────────────────────────┘

Serve to client:
┌─────────────────────────────────────────────────────────────────┐
│  Option A: Normal JSON serialization — STJ converts UTF-16 → UTF-8 │
│  Option B: Write response body directly from TextReader/bytes   │
│            Use IAsyncEnumerable or StreamContent for chunked     │
│            transfer                                             │
└─────────────────────────────────────────────────────────────────┘
```

**Practical threshold guidelines:**

| Content Size | Approach | Rationale |
|-------------|----------|-----------|
| < 100 KB | Normal string handling | Overhead not worth optimizing |
| 100 KB – 1 MB | Be mindful, standard approach OK | Consider pre-sizing StringBuilder, avoid unnecessary copies |
| 1 MB – 10 MB | Use streaming for DB I/O | LOH strings, GC pressure, encoding conversion cost |
| > 10 MB | Specialized handling required | Out of scope — consider file storage, chunked transfer |

---

## Module 5: Efficient String Passing Between Layers

This module addresses the common enterprise architecture pattern where data flows through multiple DTO and domain layers, and string properties are copied at each boundary.

### 5.1 The Problem: Death by a Thousand Copies

```csharp
// Typical multi-layer architecture:
// API Model → Application DTO → Domain Entity → Persistence Entity → DB

// For a single request:
public class ApiRequest { public string Name { get; set; } }
public class AppDto { public string Name { get; set; } }
public class DomainEntity { public string Name { get; set; } }
public class PersistenceEntity { public string Name { get; set; } }

// Mapper code:
var appDto = new AppDto { Name = apiRequest.Name };       // reference copy (free)
var entity = new DomainEntity { Name = appDto.Name };     // reference copy (free)
var dbEntity = new PersistenceEntity { Name = entity.Name }; // reference copy (free)
```

**Wait — this is actually free!** Assigning a string property to another string property just copies the reference (8 bytes on x64). **No new string is allocated.** This is because strings are immutable — there's no risk in two objects sharing the same string instance.

**So where do the actual allocations happen?** They happen when mappers or code **transform** the string:

```csharp
// ❌ HIDDEN ALLOCATION — Unnecessary Trim in mapper
var dto = new AppDto { Name = apiRequest.Name?.Trim() };
// If Name was already trimmed (common), you still pay for the method call
// though Trim returns the same reference if nothing was trimmed.
// But if it DOES trim, that's a new allocation per field per request.

// ❌ HIDDEN ALLOCATION — Defensive ToUpper/ToLower
var dto = new AppDto { Name = apiRequest.Name?.ToLowerInvariant() };
// Always allocates a new string, even if already lowercase

// ❌ HIDDEN ALLOCATION — Unnecessary string.Format / interpolation in mapper
var dto = new AppDto { FullName = $"{entity.FirstName} {entity.LastName}" };
// New string every time — even if this was already computed upstream

// ❌ HIDDEN ALLOCATION — ToString on strings!
var dto = new AppDto { Name = entity.Name.ToString() };
// Actually returns the same reference (no allocation) — but it's misleading code.
// String.ToString() returns `this` — one of the few ToString methods that doesn't allocate.

// ❌ SUBTLE ALLOCATION — LINQ .Select with string operations
var dtos = entities.Select(e => new Dto
{
    Name = e.Name.Trim().ToLower(),        // 2 allocations per entity
    Code = e.Code.PadLeft(10, '0'),        // 1 allocation per entity
    Description = e.Description ?? ""      // No allocation (string.Empty is singleton)
}).ToList();
// For 1,000 entities with 3 transformed strings: ~3,000 unnecessary string allocations
```

### 5.2 Strategy: Transform Once at the Boundary, Pass References Through

```csharp
// PRINCIPLE: Normalize strings ONCE at the system entry point,
// then pass the reference through all layers without transformation.

// At the API boundary — normalize here:
public class InputSanitizer
{
    public static string NormalizeName(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        // Single transformation: trim + case normalize
        // This allocates once — the result travels through all layers untouched
        return input.Trim(); // Only trim; avoid case changes unless business rules require it
    }
}

// Controller / entry point:
[HttpPost]
public async Task<IActionResult> CreatePerson(ApiRequest request)
{
    // Normalize once:
    request.Name = InputSanitizer.NormalizeName(request.Name);

    // From here on, EVERY layer just passes the reference:
    var appDto = _mapper.Map<AppDto>(request);         // Name = reference copy
    var entity = _mapper.Map<DomainEntity>(appDto);    // Name = reference copy
    await _repository.SaveAsync(entity);               // Name = reference copy to parameter
    // Total string allocations for Name: 1 (in NormalizeName)
}
```

### 5.3 Mapper Configuration: Avoiding Hidden Allocations

```csharp
// AutoMapper — these profiles are allocation-safe:
public class PersonProfile : Profile
{
    public PersonProfile()
    {
        // ✅ GOOD — Direct member mapping copies references
        CreateMap<ApiRequest, AppDto>();
        CreateMap<AppDto, DomainEntity>();
        CreateMap<DomainEntity, PersistenceEntity>();

        // ❌ BAD — Custom resolver that allocates
        CreateMap<ApiRequest, AppDto>()
            .ForMember(d => d.Name, opt => opt.MapFrom(s => s.Name.Trim().ToLower()));
            // Allocates every time!

        // ✅ GOOD — If transformation is needed, use a resolver that caches/reuses
        CreateMap<ApiRequest, AppDto>()
            .ForMember(d => d.Name, opt => opt.MapFrom(s =>
                string.IsNullOrEmpty(s.Name) ? string.Empty : s.Name));
            // Only returns existing references, never creates new strings
    }
}

// Manual mappers — most allocation-efficient:
public static class PersonMapper
{
    public static AppDto ToAppDto(ApiRequest source) => new()
    {
        // Just copy references — zero allocation
        Name = source.Name,
        Email = source.Email,
        Description = source.Description,
    };

    public static DomainEntity ToDomainEntity(AppDto source) => new()
    {
        Name = source.Name,       // same reference as original
        Email = source.Email,     // same reference as original
        Description = source.Description, // same reference as original
    };
}
```

### 5.4 String Interning for Repeated Values

When certain string values repeat across many objects (status codes, category names, country codes), interning eliminates duplicate allocations:

```csharp
// Problem: Loading 10,000 records from DB, each with a "Status" field
// If there are only 5 distinct status values, you have 10,000 string allocations
// for just 5 unique values.

// Solution: Intern known-repeated values
public class StatusNormalizer
{
    // For a small, known set — use a frozen dictionary
    private static readonly FrozenDictionary<string, string> StatusMap =
        new Dictionary<string, string>
        {
            ["Draft"] = "Draft",
            ["Active"] = "Active",
            ["Archived"] = "Archived",
            ["Deleted"] = "Deleted",
            ["Pending"] = "Pending",
        }.ToFrozenDictionary(StringComparer.OrdinalIgnoreCase);

    public static string NormalizeStatus(string status)
    {
        // Returns the shared interned instance
        return StatusMap.TryGetValue(status, out var normalized) ? normalized : status;
    }
}

// Usage in Dapper mapping:
var records = connection.Query<Record>(sql).Select(r =>
{
    r.Status = StatusNormalizer.NormalizeStatus(r.Status);
    return r;
}).ToList();
// Now all records with same status share the same string reference

// Alternative: Use string.Intern for globally recurring values
// WARNING: Interned strings are NEVER garbage collected — only for truly global values
string interned = string.Intern(someFrequentlyUsedValue);

// BETTER: Use a ConcurrentDictionary as a bounded string pool
public class StringPool
{
    private readonly ConcurrentDictionary<string, string> _pool = new(StringComparer.Ordinal);

    public string GetOrAdd(string value)
    {
        return _pool.GetOrAdd(value, value);
        // First occurrence: stores the reference
        // Subsequent: returns the stored reference, and the new string becomes garbage
    }

    public void Clear() => _pool.Clear(); // When pool should be refreshed
}
```

### 5.5 ReadOnlySpan/ReadOnlyMemory for Transient Processing

When you need to inspect or parse a string in a mapper or validation layer but don't need to store the result as a new string:

```csharp
// Extracting a domain from email — with and without allocation
public static class EmailUtils
{
    // ❌ ALLOCATES — creates a new substring
    public static string GetDomainAllocating(string email)
    {
        int atIndex = email.IndexOf('@');
        return email.Substring(atIndex + 1);  // new string allocation
    }

    // ✅ NO ALLOCATION — returns a span view
    public static ReadOnlySpan<char> GetDomainSpan(ReadOnlySpan<char> email)
    {
        int atIndex = email.IndexOf('@');
        return email[(atIndex + 1)..];  // just a pointer + length, zero allocation
    }

    // Use when you need the result as a string (e.g., to store in a DTO)
    // but want to check it first without allocating:
    public static string? GetDomainIfValid(string email)
    {
        ReadOnlySpan<char> span = email.AsSpan();
        int atIndex = span.IndexOf('@');
        if (atIndex < 0) return null;

        ReadOnlySpan<char> domain = span[(atIndex + 1)..];

        // Validation using Span — no allocation
        if (domain.IsEmpty || domain.IndexOf('.') < 0)
            return null;

        // Only allocate if valid
        return domain.ToString();  // single allocation, only on success path
    }
}
```

### 5.6 String Comparison: Avoiding Unnecessary Allocations in Lookups

```csharp
// ❌ COMMON PATTERN — ToLower() for case-insensitive comparison
if (input.ToLower() == "active")  // allocates a new lowercase string every time!

// ✅ CORRECT — use StringComparison
if (string.Equals(input, "active", StringComparison.OrdinalIgnoreCase)) // zero allocation

// ❌ COMMON PATTERN — ToLower for dictionary lookup
var dict = new Dictionary<string, int>();
dict[key.ToLower()] = value;  // allocates on every insert and lookup

// ✅ CORRECT — use case-insensitive comparer
var dict = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
dict[key] = value;  // no allocation for case handling

// ❌ COMMON PATTERN — string manipulation for Contains check
if (bigString.ToUpper().Contains("SEARCH"))  // allocates entire uppercase copy

// ✅ CORRECT
if (bigString.Contains("SEARCH", StringComparison.OrdinalIgnoreCase))  // zero allocation
```

---

## Module 6: Practical Exercises

### Exercise 1: Allocation Counting

For each code block, determine exactly how many string allocations occur. Verify your answers using BenchmarkDotNet with `[MemoryDiagnoser]`:

```csharp
// Block A:
string result = firstName.Trim() + " " + lastName.Trim().ToUpper();
// How many allocations? Count each operation.

// Block B:
string[] lines = text.Split('\n');
string first = lines[0].Trim();
string upper = first.ToUpper();
// How many allocations?

// Block C:
var sb = new StringBuilder();
for (int i = 0; i < 100; i++)
{
    sb.Append($"Item {i}\n");
}
string result = sb.ToString();
// How many allocations in .NET 6+? In .NET 5?

// Block D:
string normalized = input?.Trim()?.ToLowerInvariant() ?? string.Empty;
// How many allocations in worst case? Best case?
```

### Exercise 2: Optimize the Mapper

Rewrite this mapper to minimize string allocations. Measure before and after with BenchmarkDotNet:

```csharp
public class NaiveMapper
{
    public IReadOnlyList<OutputDto> Map(IReadOnlyList<InputEntity> entities)
    {
        return entities.Select(e => new OutputDto
        {
            FullName = (e.FirstName?.Trim() ?? "") + " " + (e.LastName?.Trim() ?? ""),
            Status = e.Status?.ToUpper() ?? "UNKNOWN",
            Category = e.Category?.Trim().ToLower() ?? "general",
            Email = e.Email?.Trim().ToLowerInvariant() ?? "",
            Code = e.Code?.PadLeft(10, '0') ?? "0000000000",
        }).ToList();
    }
}

// Goal: Reduce allocations per entity from ~10+ to 2-3 or fewer
// Hint: Normalize once, intern repeated values, avoid redundant case changes
```

### Exercise 3: Large Content Pipeline

Build a complete pipeline that:
1. Accepts a text file upload (1-5 MB) via an ASP.NET Core endpoint
2. Validates that it's valid UTF-8
3. Counts words without materializing the entire string
4. Stores the content in PostgreSQL
5. Retrieves and serves it to a GET endpoint

Measure peak memory usage. Target: peak memory should be less than 3× the file size.

```csharp
// Skeleton:
[ApiController]
[Route("api/documents")]
public class DocumentController : ControllerBase
{
    [HttpPost("{id}/content")]
    public async Task<IActionResult> Upload(int id, CancellationToken ct)
    {
        // TODO: Implement streaming upload with word count
        // Hint: Use PipeReader or StreamReader with buffer
    }

    [HttpGet("{id}/content")]
    public async Task<IActionResult> Download(int id, CancellationToken ct)
    {
        // TODO: Implement streaming download
        // Hint: Use SequentialAccess + GetTextReader, write to Response.Body
    }
}
```

### Exercise 4: String Pool Benchmark

Implement and benchmark a `StringPool` for a scenario where you deserialize 100,000 JSON records, each with a `Status` field that has one of 10 possible values:

```csharp
// Compare:
// A) Plain deserialization (100,000 string allocations for Status)
// B) Post-deserialization interning with StringPool
// C) Custom JsonConverter that interns during deserialization

// Measure:
// - Total memory allocated
// - Gen 0/1/2 GC collections
// - Throughput (records/second)
```

---

## Module 7: Reference Tables

### 7.1 String Operation Allocation Quick Reference

| Operation | Allocates? | Notes |
|-----------|-----------|-------|
| `s1 + s2` | ✅ Always | Use `string.Concat` for 2–4 args |
| `$"...{x}..."` | ✅ Always | .NET 6+ reduces intermediate allocs |
| `s.Substring(i, n)` | ✅ Usually | Same-ref if i=0 and n=Length |
| `s.ToUpper()` / `ToLower()` | ✅ Usually | .NET 7+ returns same-ref if no change |
| `s.Trim()` | ⚠️ Conditional | Same-ref if nothing trimmed |
| `s.Replace(a, b)` | ⚠️ Conditional | Same-ref if pattern not found |
| `s.Split(c)` | ✅ Always | Array + all substrings |
| `s.Insert(i, v)` | ✅ Always | |
| `s.Remove(i)` | ✅ Always | |
| `s.PadLeft/Right(n)` | ✅ Usually | Same-ref if already at width |
| `string.Join(sep, arr)` | ✅ Always | |
| `string.Format(...)` | ✅ Always | |
| `s.AsSpan()` | ❌ Never | Returns `ReadOnlySpan<char>` |
| `s.AsMemory()` | ❌ Never | Returns `ReadOnlyMemory<char>` |
| `s.Length` | ❌ Never | Field read |
| `s[i]` | ❌ Never | Inline buffer read |
| `s.Contains(x)` | ❌ Never | Returns bool |
| `s.IndexOf(x)` | ❌ Never | Returns int |
| `s.StartsWith(x)` | ❌ Never | Returns bool |
| `s == s2` | ❌ Never | Ordinal comparison |
| `s.GetHashCode()` | ❌ Never | Returns int |
| `s.ToString()` | ❌ Never | Returns `this` |
| Property assignment `a.Name = b.Name` | ❌ Never | Reference copy (8 bytes) |

### 7.2 Encoding Quick Reference

| Encoding | Bytes per ASCII char | Bytes per BMP char | Bytes per supplementary | .NET Internal? |
|----------|---------------------|-------------------|----------------------|---------------|
| UTF-8 | 1 | 1–3 | 4 | ❌ Wire/file format |
| UTF-16 LE | 2 | 2 | 4 (surrogate pair) | ✅ System.String |
| UTF-32 | 4 | 4 | 4 | ❌ Rare |
| ASCII | 1 | ❌ (data loss) | ❌ (data loss) | ❌ Legacy |
| Windows-1252 | 1 | ❌ (limited) | ❌ (data loss) | ❌ Legacy |

### 7.3 Decision Tree: Choosing the Right String Approach

```
Need to build a string?
├─ From 2-4 known parts?
│  └─ string.Concat or $"..." interpolation
├─ In a loop?
│  ├─ Small result (< 256 chars)?
│  │  └─ stackalloc + TryWrite or String.Create
│  └─ Larger result?
│     └─ StringBuilder (pre-size if possible)
├─ From many items with separator?
│  └─ string.Join
└─ Maximum performance, hot path?
   └─ ZString / ValueStringBuilder pattern

Need to inspect/parse without storing?
├─ Use ReadOnlySpan<char> via .AsSpan()
├─ Do comparisons, IndexOf, Contains on span
└─ Only call .ToString() when you need to persist the result

Receiving large content from network?
├─ < 100 KB → standard deserialization
├─ 100 KB - 1 MB → standard, but mindful of allocations
├─ 1 MB - 10 MB → streaming I/O, chunked processing
└─ > 10 MB → out of scope (file storage, binary columns)

Passing strings between layers?
├─ Plain property assignment → free (reference copy)
├─ Need normalization (trim/case) → do it ONCE at entry point
├─ Repeated values (status, type codes) → StringPool / FrozenDictionary
└─ Avoid ToLower/ToUpper for comparison → use StringComparison enum
```

### 7.4 Tools for Measuring String Allocations

| Tool | What It Shows | When to Use |
|------|--------------|-------------|
| BenchmarkDotNet + `[MemoryDiagnoser]` | Allocations per operation, GC collections | Micro-benchmarking hot paths |
| `dotnet-counters` | Live GC and allocation rates | Runtime monitoring |
| `dotnet-trace` + PerfView | Allocation call stacks | Finding top allocators in real app |
| JetBrains dotMemory | Object retention, LOH analysis | Investigating memory growth |
| Visual Studio Allocation Profiler | Per-type allocation counts | IDE-integrated profiling |
| `GC.GetAllocatedBytesForCurrentThread()` | Bytes allocated on current thread | Quick in-code measurement |

### 7.5 Further Study

**Official Documentation:**
- [System.String (MSDN)](https://learn.microsoft.com/dotnet/api/system.string)
- [Character Encoding in .NET](https://learn.microsoft.com/dotnet/standard/base-types/character-encoding)
- [Memory\<T\> and Span\<T\> usage guidelines](https://learn.microsoft.com/dotnet/standard/memory-and-spans/memory-t-usage-guidelines)
- [System.IO.Pipelines](https://learn.microsoft.com/dotnet/standard/io/pipelines)

**Source Code:**
- [System.String source (dotnet/runtime)](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/String.cs)
- [StringBuilder source](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Text/StringBuilder.cs)

**Libraries:**
- [ZString (Cysharp)](https://github.com/Cysharp/ZString) — zero-allocation string building
- [BenchmarkDotNet](https://benchmarkdotnet.org/) — precise performance measurement

---

## Assessment Checklist

After completing this plan, verify you can:

- [ ] Draw the memory layout of a string object and calculate its size
- [ ] Explain why `.Length` counts UTF-16 code units, not characters
- [ ] Identify surrogate pairs and explain when they cause bugs
- [ ] **List which string operations allocate and which do not**
- [ ] Explain when Trim, Replace, and Substring return the original reference
- [ ] Use `ReadOnlySpan<char>` to inspect strings without allocation
- [ ] Choose between `string.Concat`, `StringBuilder`, `String.Create`, and `ZString`
- [ ] Handle encoding correctly at system boundaries (HTTP, DB, files)
- [ ] Explain the difference between `varchar` and `nvarchar` in terms of encoding
- [ ] Stream large string content through a system without full materialization
- [ ] Minimize string allocations in DTO mapping layers
- [ ] Use `StringPool` / `FrozenDictionary` for interning repeated values
- [ ] Use `StringComparison` instead of `ToLower()`/`ToUpper()` for comparison
- [ ] Measure string allocations with BenchmarkDotNet
- [ ] **Explain where hidden allocations occur in typical enterprise code**

**Congratulations!** You now have a comprehensive understanding of .NET string internals, allocation patterns, encoding boundaries, and efficient string handling across multi-layer enterprise architectures.
