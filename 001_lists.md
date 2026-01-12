# .NET Collections and List Types: Self-Learning Plan

## Learning Objectives

After completing this self-learning plan, you will:
- ✅ Understand all major collection types and interfaces in modern .NET (focusing on .NET 10)
- ✅ Know the design intent and use cases for each type
- ✅ Understand internal implementation details that affect performance
- ✅ **Know which operations are efficient and which are inefficient for each type**
- ✅ Make informed decisions about which type to use in different contexts
- ✅ Efficiently convert between collection types
- ✅ Apply collections effectively in EF Core, streams, and async scenarios

---

## Module 1: Core Collection Types and Interfaces

### 1.1 Array-Like Collection Types

Study each type in the following order, understanding their purpose, internal structure, and performance characteristics:

#### **`T[]` (Array)**
- **Purpose:** Fixed-size, contiguous memory, maximum performance
- **Created when:** C# 1.0 / .NET Framework 1.0 (2002)
- **Why created:** Foundation collection type, direct memory access, interop with native code
- **Internal structure:** Contiguous memory block with object header + length + elements
- **Key characteristics:** 
  - Immutable size
  - Fastest iteration and indexed access
  - Covariant for reference types
  - Zero abstraction overhead

**Most Appropriate For:**
- ✅ Random access by index - O(1)
- ✅ Sequential iteration - fastest possible
- ✅ Known, fixed size at creation
- ✅ Interop with native code / P/Invoke
- ✅ Stack-allocated buffers (stackalloc)
- ✅ Memory-critical scenarios (minimal overhead)
- ✅ Mathematical operations / numeric processing
- ✅ Sorting when size is known - O(n log n)
- ✅ Binary search on sorted data - O(log n)
- ✅ Working with Span<T> and Memory<T>

**Unsuitable For / Poor Performance:**
- ❌ Adding elements (size is fixed) - impossible without creating new array
- ❌ Removing elements (size is fixed) - impossible without creating new array
- ❌ Inserting in middle - requires creating new array and copying all elements O(n)
- ❌ Dynamic size requirements - must allocate new array and copy
- ❌ Searching unsorted array - O(n) linear search
- ❌ Unknown size at creation - leads to multiple allocations and copies
- ❌ Frequent resizing needs - very inefficient

**Performance characteristics:**
```csharp
int[] array = new int[1000];

// ✅ FAST operations - O(1)
var value = array[500];           // Indexed access: ~0.3ns
array[500] = 42;                  // Indexed write: ~0.3ns
var length = array.Length;        // Length access: ~0.3ns

// ✅ FAST operations - O(n)
foreach (var item in array) { }   // Iteration: ~0.8μs for 1000 items
Array.Sort(array);                // Sort: ~50μs for 1000 items (O(n log n))
Array.BinarySearch(array, 42);    // Binary search: ~0.01μs (O(log n))

// ❌ SLOW/IMPOSSIBLE operations
// Insert at position 500:
var newArray = new int[1001];
Array.Copy(array, 0, newArray, 0, 500);     // Copy first half
newArray[500] = newValue;
Array.Copy(array, 500, newArray, 501, 500); // Copy second half
// Total: O(n) and requires new allocation

// Remove at position 500:
var smallerArray = new int[999];
Array.Copy(array, 0, smallerArray, 0, 500);      // Copy before
Array.Copy(array, 501, smallerArray, 500, 499);  // Copy after
// Total: O(n) and requires new allocation

// Add to end: impossible without resize
Array.Resize(ref array, array.Length + 1);  // Creates new array, copies all O(n)
array[array.Length - 1] = newValue;
```

**Learning exercise:**
```csharp
// Explore array internals
int[] array = new int[1000];
Console.WriteLine($"Size: {array.Length}");
Console.WriteLine($"Type: {array.GetType()}");

// Understand memory layout
unsafe
{
    fixed (int* ptr = array)
    {
        // Direct memory access - understand performance implications
    }
}

// Covariance behavior
string[] strings = new string[10];
object[] objects = strings;  // OK for reference types
// objects[0] = 123;  // Compiles but throws at runtime - why?

// Performance: benchmark resize vs pre-sized array
var stopwatch = Stopwatch.StartNew();
int[] dynamicArray = new int[1];
for (int i = 1; i < 1000; i++)
{
    Array.Resize(ref dynamicArray, i + 1);
    dynamicArray[i] = i;
}
Console.WriteLine($"Dynamic resize: {stopwatch.ElapsedMilliseconds}ms");
// Very slow due to 1000 array allocations and copies!

stopwatch.Restart();
int[] presized = new int[1000];
for (int i = 0; i < 1000; i++)
{
    presized[i] = i;
}
Console.WriteLine($"Pre-sized: {stopwatch.ElapsedMilliseconds}ms");
// Much faster - single allocation
```

#### **`List<T>`**
- **Purpose:** Dynamic-size array wrapper with rich API
- **Created when:** C# 2.0 / .NET Framework 2.0 (2005)
- **Why created:** Need for resizable arrays with type safety (replacing ArrayList)
- **Internal structure:** 
  - Wraps `T[] _items` (backing array)
  - Tracks `int _size` (element count)
  - Tracks `int _version` (modification counter for enumeration safety)
- **Key characteristics:**
  - Capacity doubles when full
  - Amortized O(1) for Add, O(n) when resizing
  - Rich mutation API (Add, Insert, Remove, Sort, etc.)

**Most Appropriate For:**
- ✅ Adding to end - O(1) amortized
- ✅ Random access by index - O(1)
- ✅ Building collections of unknown size
- ✅ Sequential iteration - very fast
- ✅ Replacing range of elements
- ✅ Sorting - O(n log n)
- ✅ Binary search (after sorting) - O(log n)
- ✅ Removing last element - O(1)
- ✅ Clearing all elements - O(n) but fast
- ✅ Pre-allocated capacity when size is known
- ✅ Bulk operations (AddRange, RemoveRange, etc.)

**Unsuitable For / Poor Performance:**
- ❌ Inserting at beginning or middle - O(n), shifts all subsequent elements
- ❌ Removing from beginning or middle - O(n), shifts all subsequent elements
- ❌ Frequent insertions/removals at arbitrary positions - use LinkedList<T>
- ❌ Thread-safe scenarios - not thread-safe, use ConcurrentBag<T> or immutable types
- ❌ Searching unsorted list - O(n) linear search
- ❌ Very large lists with frequent capacity changes - wasted memory and allocations
- ❌ When true immutability required - elements can be modified
- ❌ Priority queue operations - use PriorityQueue<T>

**Performance characteristics:**
```csharp
List<int> list = new List<int>();

// ✅ FAST operations
list.Add(42);                     // Add to end: O(1) amortized, ~3ns
var value = list[500];            // Indexed access: O(1), ~1ns (slightly slower than array)
list[500] = 42;                   // Indexed write: O(1), ~1ns
list.RemoveAt(list.Count - 1);    // Remove last: O(1), ~5ns
list.Clear();                     // Clear all: O(n) but very fast
list.AddRange(otherList);         // Bulk add: O(m) where m is items added

// ⚠️ ACCEPTABLE operations
list.Sort();                      // Sort: O(n log n)
list.BinarySearch(42);            // Binary search (sorted): O(log n)
list.Contains(42);                // Linear search: O(n)
list.IndexOf(42);                 // Linear search: O(n)

// ❌ SLOW operations
list.Insert(0, newValue);         // Insert at beginning: O(n), shifts all elements
list.RemoveAt(0);                 // Remove from beginning: O(n), shifts all elements
list.Insert(500, newValue);       // Insert in middle: O(n), shifts half elements
list.RemoveAt(500);               // Remove from middle: O(n), shifts half elements
list.Remove(value);               // Remove by value: O(n) search + O(n) shift

// Capacity growth overhead
for (int i = 0; i < 1000; i++)
{
    list.Add(i);  // Multiple reallocations when capacity reached
}
// Better: new List<int>(1000) to pre-allocate
```

**Learning exercise:**
```csharp
// Understand capacity growth
List<int> list = new List<int>();
for (int i = 0; i < 20; i++)
{
    list.Add(i);
    Console.WriteLine($"Count: {list.Count}, Capacity: {list.Capacity}");
    // Observe: 0→4→8→16→32 capacity growth
}

// Understand internal array
var internalArrayField = typeof(List<int>)
    .GetField("_items", BindingFlags.NonPublic | BindingFlags.Instance);
int[] internalArray = (int[])internalArrayField.GetValue(list);
Console.WriteLine($"Internal array length: {internalArray.Length}");
// See wasted capacity

// Enumeration version check
list = new List<int> { 1, 2, 3 };
try
{
    foreach (var item in list)
    {
        list.Add(4);  // Why does this throw?
    }
}
catch (InvalidOperationException ex)
{
    Console.WriteLine(ex.Message);
    // Understand the _version field's purpose
}

// Performance comparison: Insert operations
var stopwatch = Stopwatch.StartNew();
list = new List<int>(Enumerable.Range(0, 10000));
for (int i = 0; i < 1000; i++)
{
    list.Insert(0, i);  // Insert at beginning - very slow!
}
Console.WriteLine($"Insert at beginning: {stopwatch.ElapsedMilliseconds}ms");

stopwatch.Restart();
list = new List<int>(Enumerable.Range(0, 10000));
for (int i = 0; i < 1000; i++)
{
    list.Add(i);  // Add to end - very fast!
}
Console.WriteLine($"Add to end: {stopwatch.ElapsedMilliseconds}ms");
```

#### **`ImmutableArray<T>`**
- **Purpose:** True immutability with array-like performance
- **Created when:** .NET Framework 4.5 / Added to BCL in 2013
- **Why created:** Need for thread-safe, truly immutable collections without defensive copying
- **Internal structure:** 
  - **Struct** wrapping a `T[]` array
  - No modification methods - all operations return new instances
  - Structural equality built-in
- **Key characteristics:**
  - Value semantics (struct)
  - Zero-allocation sharing (multiple variables reference same array)
  - Operations like Add/Remove create new arrays
  - Dangerous default state (use `.Empty`)

**Most Appropriate For:**
- ✅ Thread-safe data sharing - no locks needed
- ✅ Random access by index - O(1), same as array
- ✅ Sequential iteration - very fast
- ✅ Configuration data that doesn't change
- ✅ Snapshots of data at a point in time
- ✅ Function return values that shouldn't be modified
- ✅ DTOs from database queries
- ✅ Value semantics with structural equality
- ✅ Sharing data between threads without copying
- ✅ Binary search on sorted data - O(log n)
- ✅ Read-heavy scenarios with rare updates

**Unsuitable For / Poor Performance:**
- ❌ Adding elements - O(n), creates new array and copies all
- ❌ Removing elements - O(n), creates new array and copies all
- ❌ Inserting in middle - O(n), creates new array and copies all
- ❌ Replacing elements - O(n), creates new array and copies all
- ❌ Building collections incrementally - use Builder or List<T> first
- ❌ Frequent modifications - creates many temporary arrays
- ❌ Unknown size scenarios - each add is expensive
- ❌ Sorting - O(n), must create new sorted array
- ❌ Any mutation - all mutations are O(n)

**Performance characteristics:**
```csharp
ImmutableArray<int> array = ImmutableArray.Create(Enumerable.Range(0, 1000).ToArray());

// ✅ FAST operations - same as regular array
var value = array[500];           // Indexed access: O(1), ~0.3ns
var length = array.Length;        // Length: O(1), ~0.3ns
foreach (var item in array) { }   // Iteration: ~0.8μs for 1000 items
var found = array.BinarySearch(42); // Binary search: O(log n)

// ✅ FAST operations - unique to ImmutableArray
var equals = array1 == array2;    // Structural equality: O(1) if same array, O(n) otherwise
var isEmpty = array.IsEmpty;      // Empty check: O(1)

// ❌ VERY SLOW operations - creates new arrays
var withAdded = array.Add(42);              // O(n) - copies all 1000 elements!
var withInserted = array.Insert(500, 42);   // O(n) - copies all 1000 elements!
var withRemoved = array.RemoveAt(500);      // O(n) - copies 999 elements!
var withReplaced = array.SetItem(500, 42);  // O(n) - copies all 1000 elements!

// Building incrementally is VERY inefficient
ImmutableArray<int> built = ImmutableArray<int>.Empty;
for (int i = 0; i < 1000; i++)
{
    built = built.Add(i);  // Each iteration: O(i) - total O(n²)!
}
// Much better: use List<T> or ImmutableArray.Builder
```

**Learning exercise:**
```csharp
// Understand struct semantics
ImmutableArray<int> array1 = ImmutableArray.Create(1, 2, 3);
ImmutableArray<int> array2 = array1;  // No copying - both reference same internal array

// Structural equality
ImmutableArray<int> array3 = ImmutableArray.Create(1, 2, 3);
Console.WriteLine(array1 == array3);  // True - compares content!

// Understand the default danger
ImmutableArray<int> empty = default;
try
{
    var length = empty.Length;  // NullReferenceException!
}
catch (NullReferenceException)
{
    Console.WriteLine("Always use .Empty instead of default");
}

// Immutable operations create new arrays
var withFour = array1.Add(4);  // New array created
Console.WriteLine($"Original: {array1.Length}, New: {withFour.Length}");
Console.WriteLine($"Same reference? {ReferenceEquals(array1, withFour)}");

// Performance: incremental building (BAD)
var stopwatch = Stopwatch.StartNew();
var built = ImmutableArray<int>.Empty;
for (int i = 0; i < 1000; i++)
{
    built = built.Add(i);  // Very slow - O(n²)
}
Console.WriteLine($"Incremental building: {stopwatch.ElapsedMilliseconds}ms");

// Performance: build with List first (GOOD)
stopwatch.Restart();
var list = new List<int>();
for (int i = 0; i < 1000; i++)
{
    list.Add(i);
}
var efficient = list.ToImmutableArray();
Console.WriteLine($"List then convert: {stopwatch.ElapsedMilliseconds}ms");

// Performance: Builder pattern (BETTER)
stopwatch.Restart();
var builder = ImmutableArray.CreateBuilder<int>();
for (int i = 0; i < 1000; i++)
{
    builder.Add(i);
}
var fromBuilder = builder.ToImmutable();
Console.WriteLine($"Builder pattern: {stopwatch.ElapsedMilliseconds}ms");
```

#### **`ImmutableList<T>`**
- **Purpose:** Immutable list with efficient incremental changes
- **Created when:** Same as ImmutableArray (2013)
- **Why created:** Balance between immutability and efficient modifications (better than creating new arrays)
- **Internal structure:**
  - AVL tree (self-balancing binary tree)
  - Not backed by array
  - Structural sharing between versions
- **Key characteristics:**
  - O(log n) for modifications (vs O(n) for ImmutableArray)
  - O(log n) for indexed access (vs O(1) for ImmutableArray)
  - Better for frequent "modifications" (creates efficient new versions)

**Most Appropriate For:**
- ✅ Adding elements - O(log n), much better than ImmutableArray
- ✅ Removing elements - O(log n), much better than ImmutableArray
- ✅ Inserting elements - O(log n)
- ✅ Building immutable collections incrementally
- ✅ Frequent "modifications" while maintaining immutability
- ✅ Functional programming patterns
- ✅ Creating many versions of similar data
- ✅ Thread-safe scenarios with modifications
- ✅ Undo/redo functionality (preserve history)
- ✅ When modifications are more common than reads

**Unsuitable For / Poor Performance:**
- ❌ Random access by index - O(log n) vs O(1) for array/ImmutableArray
- ❌ Sequential iteration - slower than array-based collections
- ❌ Scenarios where fast indexed access is critical
- ❌ Read-heavy workloads with rare modifications - use ImmutableArray
- ❌ Memory-critical scenarios - tree nodes have overhead
- ❌ Sorting - O(n log n) but slower than array-based sorting
- ❌ Binary search - O(log n) access makes it slower than on arrays
- ❌ Very large collections with frequent full iterations

**Performance characteristics:**
```csharp
ImmutableList<int> list = ImmutableList.Create(Enumerable.Range(0, 1000).ToArray());

// ⚠️ SLOWER than ImmutableArray for reads
var value = list[500];            // O(log n), ~15ns (vs ~0.3ns for array)
foreach (var item in list) { }    // ~20μs for 1000 items (vs ~0.8μs for array)

// ✅ MUCH BETTER than ImmutableArray for modifications
var withAdded = list.Add(42);              // O(log n), ~50ns (vs O(n) for ImmutableArray)
var withInserted = list.Insert(500, 42);   // O(log n), ~100ns
var withRemoved = list.RemoveAt(500);      // O(log n), ~100ns
var withReplaced = list.SetItem(500, 42);  // O(log n), ~100ns

// ✅ EFFICIENT incremental building
ImmutableList<int> built = ImmutableList<int>.Empty;
for (int i = 0; i < 1000; i++)
{
    built = built.Add(i);  // O(log n) per iteration - total O(n log n)
}
// Much better than ImmutableArray's O(n²)

// ❌ SLOW for operations requiring full iteration
var sorted = list.Sort();         // O(n log n) but slower than array sort
var filtered = list.Where(x => x > 500).ToList();  // Slow iteration
```

**Learning exercise:**
```csharp
// Compare creation performance
var stopwatch = Stopwatch.StartNew();
ImmutableArray<int> immArray = ImmutableArray.Create(Enumerable.Range(0, 10000).ToArray());
Console.WriteLine($"ImmutableArray creation: {stopwatch.ElapsedMilliseconds}ms");

stopwatch.Restart();
ImmutableList<int> immList = ImmutableList.Create(Enumerable.Range(0, 10000).ToArray());
Console.WriteLine($"ImmutableList creation: {stopwatch.ElapsedMilliseconds}ms");

// Compare modification performance
stopwatch.Restart();
var newArray = immArray.Add(10001);  // Copies entire array
Console.WriteLine($"ImmutableArray.Add: {stopwatch.ElapsedTicks} ticks");

stopwatch.Restart();
var newList = immList.Add(10001);  // Tree node addition
Console.WriteLine($"ImmutableList.Add: {stopwatch.ElapsedTicks} ticks");

// Indexed access comparison
stopwatch.Restart();
for (int i = 0; i < 1000; i++) { var x = immArray[i]; }
Console.WriteLine($"ImmutableArray indexed access: {stopwatch.ElapsedTicks} ticks");

stopwatch.Restart();
for (int i = 0; i < 1000; i++) { var x = immList[i]; }
Console.WriteLine($"ImmutableList indexed access: {stopwatch.ElapsedTicks} ticks");

// Incremental building comparison
stopwatch.Restart();
var arrayBuilt = ImmutableArray<int>.Empty;
for (int i = 0; i < 1000; i++)
{
    arrayBuilt = arrayBuilt.Add(i);  // O(n²) total
}
Console.WriteLine($"ImmutableArray incremental: {stopwatch.ElapsedMilliseconds}ms");

stopwatch.Restart();
var listBuilt = ImmutableList<int>.Empty;
for (int i = 0; i < 1000; i++)
{
    listBuilt = listBuilt.Add(i);  // O(n log n) total
}
Console.WriteLine($"ImmutableList incremental: {stopwatch.ElapsedMilliseconds}ms");
```

#### **`FrozenSet<T>` and `FrozenDictionary<TKey, TValue>`**
- **Purpose:** Optimized read-only collections for lookup-heavy scenarios
- **Created when:** .NET 8 (2023)
- **Why created:** Better performance than immutable collections when collection won't change and lookups dominate
- **Internal structure:**
  - Highly optimized hash table
  - Computed at creation time for optimal layout
  - Read-only after creation
- **Key characteristics:**
  - Faster lookups than Dictionary or ImmutableDictionary
  - Higher creation cost (optimization happens at freeze time)
  - Perfect for configuration data, lookup tables

**Most Appropriate For:**
- ✅ Lookups (Contains, TryGetValue) - faster than any other dictionary
- ✅ Configuration data loaded at startup
- ✅ Lookup tables that never change
- ✅ Enums, country codes, currency codes
- ✅ Read-heavy scenarios (90%+ reads)
- ✅ Long-lived collections with frequent access
- ✅ Thread-safe scenarios - no synchronization needed
- ✅ When you can pay creation cost once for faster reads

**Unsuitable For / Poor Performance:**
- ❌ Any modifications - completely immutable, no Add/Remove
- ❌ Frequently recreated collections - high creation cost
- ❌ Small collections (<100 items) - overhead not worth it
- ❌ Short-lived collections - creation cost wasted
- ❌ Write-heavy or mixed read/write scenarios
- ❌ Iteration - slower than List or array
- ❌ Scenarios where collection changes frequently
- ❌ Ordered traversal - no guaranteed order

**Performance characteristics:**
```csharp
var data = Enumerable.Range(0, 10000).Select(i => (i, $"Value{i}"));

Dictionary<int, string> dictionary = data.ToDictionary(x => x.i, x => x.Item2);
ImmutableDictionary<int, string> immutableDict = data.ToImmutableDictionary(x => x.i, x => x.Item2);
FrozenDictionary<int, string> frozenDict = data.ToFrozenDictionary(x => x.i, x => x.Item2);

// ✅ VERY FAST lookups - fastest of all
frozenDict.TryGetValue(5000, out var value);  // ~2ns (vs ~4ns for Dictionary)
frozenDict.ContainsKey(5000);                 // ~2ns
frozenDict[5000];                             // ~2ns

// ⚠️ ACCEPTABLE iteration (but slower than List)
foreach (var kvp in frozenDict) { }  // Still relatively fast

// ❌ SLOW creation
var stopwatch = Stopwatch.StartNew();
var frozen = data.ToFrozenDictionary(x => x.i, x => x.Item2);
Console.WriteLine($"Frozen creation: {stopwatch.ElapsedMilliseconds}ms");
// 2-3x slower than Dictionary creation due to optimization

// ❌ IMPOSSIBLE modifications
// frozen.Add(key, value);     // Doesn't exist
// frozen.Remove(key);         // Doesn't exist
// frozen[key] = newValue;     // Read-only
```

**Learning exercise:**
```csharp
// Compare lookup performance
var data = Enumerable.Range(0, 10000).Select(i => (i, $"Value{i}"));

var dictionary = data.ToDictionary(x => x.i, x => x.Item2);
var immutableDict = data.ToImmutableDictionary(x => x.i, x => x.Item2);
var frozenDict = data.ToFrozenDictionary(x => x.i, x => x.Item2);

var stopwatch = Stopwatch.StartNew();
for (int i = 0; i < 100000; i++)
{
    var value = dictionary[i % 10000];
}
Console.WriteLine($"Dictionary lookups: {stopwatch.ElapsedMilliseconds}ms");

stopwatch.Restart();
for (int i = 0; i < 100000; i++)
{
    var value = immutableDict[i % 10000];
}
Console.WriteLine($"ImmutableDictionary lookups: {stopwatch.ElapsedMilliseconds}ms");

stopwatch.Restart();
for (int i = 0; i < 100000; i++)
{
    var value = frozenDict[i % 10000];
}
Console.WriteLine($"FrozenDictionary lookups: {stopwatch.ElapsedMilliseconds}ms");
// FrozenDictionary should be fastest for lookups

// Compare creation cost
stopwatch.Restart();
var dict = data.ToDictionary(x => x.i, x => x.Item2);
Console.WriteLine($"Dictionary creation: {stopwatch.ElapsedMilliseconds}ms");

stopwatch.Restart();
var frozen = data.ToFrozenDictionary(x => x.i, x => x.Item2);
Console.WriteLine($"FrozenDictionary creation: {stopwatch.ElapsedMilliseconds}ms");
// FrozenDictionary creation is slower but lookups are faster
```

#### **`ReadOnlyCollection<T>`**
- **Purpose:** Read-only wrapper around existing collection
- **Created when:** .NET Framework 2.0 (2005)
- **Why created:** Provide read-only view of mutable collections
- **Internal structure:**
  - Wrapper around `IList<T>`
  - References the underlying collection
  - Underlying collection can still be modified
- **Key characteristics:**
  - Compile-time read-only (not true immutability)
  - Zero-copy wrapper
  - Changes to wrapped collection are visible

**Most Appropriate For:**
- ✅ Exposing internal collections without allowing modification via the wrapper
- ✅ Zero-allocation read-only views
- ✅ Indexed access - O(1), same as wrapped collection
- ✅ Iteration - same speed as wrapped collection
- ✅ Protecting List<T> from accidental modification
- ✅ API contracts that shouldn't allow modification
- ✅ When underlying collection might still be modified internally

**Unsuitable For / Poor Performance:**
- ❌ True immutability - underlying collection can still change
- ❌ Thread-safe scenarios - not thread-safe
- ❌ When caller can cast back to mutable type
- ❌ Any modifications - throws NotSupportedException
- ❌ Scenarios requiring value semantics
- ❌ When you need guaranteed immutability

**Performance characteristics:**
```csharp
List<int> list = new List<int> { 1, 2, 3, 4, 5 };
ReadOnlyCollection<int> readOnly = list.AsReadOnly();

// ✅ FAST - same as underlying List
var value = readOnly[2];          // O(1), ~1ns
var count = readOnly.Count;       // O(1), ~1ns
foreach (var item in readOnly) {} // Same speed as List

// ❌ NOT truly immutable
list[0] = 100;  // Modifies underlying list
Console.WriteLine(readOnly[0]);  // Sees the change! Returns 100

// ❌ Modifications through wrapper throw
try
{
    ((IList<int>)readOnly).Add(6);  // Compiles but throws
}
catch (NotSupportedException) { }

// ❌ Can be cast back
IList<int> mutable = (IList<int>)readOnly;
// Now have reference that "should" allow mutation
// But mutations throw NotSupportedException
```

**Learning exercise:**
```csharp
// Understand wrapper behavior
List<int> list = new List<int> { 1, 2, 3 };
ReadOnlyCollection<int> readOnly = list.AsReadOnly();

Console.WriteLine($"ReadOnly[0]: {readOnly[0]}");  // 1

// Modify underlying list
list[0] = 100;
Console.WriteLine($"ReadOnly[0]: {readOnly[0]}");  // 100 - sees the change!

// Cannot modify through read-only wrapper
// readOnly[0] = 200;  // Compile error

// Can cast back to mutable type
IList<int> mutableAgain = (IList<int>)readOnly;
try
{
    mutableAgain.Add(4);  // What happens?
}
catch (NotSupportedException ex)
{
    Console.WriteLine("Mutation methods throw exceptions");
}

// Compare with true immutability
ImmutableArray<int> trulyImmutable = list.ToImmutableArray();
list[0] = 999;
Console.WriteLine($"ImmutableArray[0]: {trulyImmutable[0]}");  // Still 100!
// ImmutableArray took a snapshot, not affected by list changes
```

### 1.2 Core Collection Interfaces

Study each interface, understanding what behavior it represents and its performance implications:

#### **`IEnumerable<T>`**
- **Purpose:** Represents a forward-only sequence that can be enumerated
- **Why this abstraction:** Minimal contract for iteration, enables LINQ
- **Behavior guarantee:** Can be enumerated (foreach-able)
- **No guarantee:** Size, indexed access, multiple enumeration safety

**Most Appropriate For:**
- ✅ LINQ query composition
- ✅ Lazy evaluation / deferred execution
- ✅ Streaming large datasets
- ✅ Single-pass iteration
- ✅ Abstracting over any sequence type
- ✅ Method parameters that just need to iterate
- ✅ Infinite sequences (yield return)
- ✅ When you don't need random access or count

**Unsuitable For / Poor Performance:**
- ❌ Random access by index - not supported
- ❌ Getting count without enumeration - O(n) via .Count()
- ❌ Multiple enumeration - may re-execute expensive operations
- ❌ Thread-safe scenarios - no synchronization
- ❌ When you need to know size upfront
- ❌ Checking if collection is empty without enumeration
- ❌ Modifying during enumeration - undefined behavior

**Performance characteristics:**
```csharp
IEnumerable<int> enumerable = Enumerable.Range(0, 1000);

// ✅ FAST - designed for this
foreach (var item in enumerable) { }  // O(n), single pass

// ❌ SLOW - not designed for this
var count = enumerable.Count();       // O(n), must enumerate entire sequence
var item = enumerable.ElementAt(500); // O(n), must skip first 500 elements
var isEmpty = enumerable.Any();       // O(1) but requires enumeration

// ❌ DANGER - multiple enumeration
var expensive = dbContext.Products
    .Where(p => p.Price > 100)  // IQueryable converted to IEnumerable
    .Select(p => ExpensiveOperation(p));

var first = expensive.First();   // Database query 1
var count = expensive.Count();   // Database query 2 - entire sequence again!
var all = expensive.ToList();    // Database query 3 - entire sequence again!

// ✅ BETTER - materialize once
var materialized = expensive.ToList();
var first = materialized.First();  // O(1)
var count = materialized.Count;    // O(1)
```

**Learning exercise:**
```csharp
// Understand deferred execution
IEnumerable<int> GetNumbers()
{
    Console.WriteLine("GetNumbers called");
    yield return 1;
    yield return 2;
    yield return 3;
}

IEnumerable<int> numbers = GetNumbers();
Console.WriteLine("Before enumeration");
// No output yet - deferred!

foreach (var n in numbers)
{
    Console.WriteLine(n);
}
// Now "GetNumbers called" appears

// Multiple enumeration danger
IEnumerable<int> expensive = Enumerable.Range(0, 1000)
    .Select(x => { Console.WriteLine($"Processing {x}"); return x * 2; });

var first = expensive.First();   // Processes elements
var count = expensive.Count();   // Processes ALL elements again!
// Understand why this is dangerous for database queries

// Test if collection or just enumerable
void ProcessData(IEnumerable<int> data)
{
    if (data is ICollection<int> collection)
    {
        Console.WriteLine($"Count: {collection.Count}");  // O(1)
    }
    else
    {
        Console.WriteLine($"Count: {data.Count()}");  // O(n)
    }
}
```

#### **`ICollection<T>`**
- **Purpose:** Collection that knows its size and supports add/remove
- **Behavior guarantee:** 
  - Count property (O(1))
  - Add, Remove, Clear operations
  - Contains check

**Most Appropriate For:**
- ✅ Getting count without enumeration - O(1)
- ✅ Checking if empty without enumeration - O(1)
- ✅ Adding elements
- ✅ Removing elements
- ✅ Clearing collection
- ✅ Checking membership

**Unsuitable For / Poor Performance:**
- ❌ Random access by index - not supported
- ❌ Inserting at specific position - not in interface
- ❌ Sorted access - no ordering guarantee
- ❌ Thread-safe operations

**Learning exercise:**
```csharp
// Understand the Count guarantee
IEnumerable<int> enumerable = Enumerable.Range(0, 1000);
ICollection<int> collection = new List<int>(enumerable);

// These are different!
var enumerableCount = enumerable.Count();  // O(n) - must enumerate
var collectionCount = collection.Count;     // O(1) - stored field

// See difference in List<T> constructor
public List(IEnumerable<T> collection)
{
    if (collection is ICollection<T> c)
    {
        // Fast path - we know the count!
        _items = new T[c.Count];
    }
    else
    {
        // Slow path - must grow dynamically
    }
}
```

#### **`IList<T>`**
- **Purpose:** Collection with indexed access and insertion at any position
- **Behavior guarantee:**
  - Everything from ICollection<T>
  - Indexed get/set via `[index]`
  - Insert and RemoveAt by index

**Most Appropriate For:**
- ✅ Random access by index - O(1) for most implementations
- ✅ Replacing elements at index - O(1)
- ✅ Inserting at specific position
- ✅ Removing at specific position
- ✅ Finding index of element

**Unsuitable For / Poor Performance:**
- ❌ Frequent insertions in middle (depends on implementation)
- ❌ Covariance - IList<T> is invariant
- ❌ Thread-safe scenarios

#### **`IReadOnlyCollection<T>`**
- **Purpose:** Read-only view with known count
- **Created when:** .NET Framework 4.5 (2012)
- **Why created:** Read-only interface hierarchy parallel to mutable interfaces
- **Behavior guarantee:**
  - Count property
  - Enumeration
  - No mutation methods

**Most Appropriate For:**
- ✅ Exposing collection size without mutation
- ✅ Getting count - O(1)
- ✅ Iteration
- ✅ Communicating read-only intent
- ✅ Covariant return types

**Unsuitable For / Poor Performance:**
- ❌ Random access - not supported
- ❌ Modifications - not supported
- ❌ True immutability - implementation may be mutable

#### **`IReadOnlyList<T>`**
- **Purpose:** Read-only indexed access
- **Behavior guarantee:**
  - Everything from IReadOnlyCollection<T>
  - Indexed get via `[index]`
  - No set, Add, Remove, etc.
- **Covariance:** Covariant in T (unlike IList<T>)

**Most Appropriate For:**
- ✅ Random access by index - O(1) for most implementations
- ✅ Iteration
- ✅ Getting count - O(1)
- ✅ Covariant scenarios (e.g., IReadOnlyList<string> to IReadOnlyList<object>)
- ✅ Communicating read-only indexed access intent

**Unsuitable For / Poor Performance:**
- ❌ Modifications - not supported
- ❌ True immutability guarantee - implementation may be mutable
- ❌ Searching - depends on implementation

**Learning exercise:**
```csharp
// Understand covariance
IReadOnlyList<string> strings = new List<string> { "a", "b" };
IReadOnlyList<object> objects = strings;  // OK - covariant!

// This doesn't work with IList
IList<string> stringList = new List<string>();
// IList<object> objectList = stringList;  // Compile error - invariant

// Why? Because IList allows Add:
// If this worked, you could: objectList.Add(123)
// Which would put an int into a List<string>!
```

#### **`IReadOnlySet<T>`**
- **Purpose:** Read-only set operations
- **Created when:** .NET 5 (2020)
- **Why created:** Complete the read-only interface hierarchy

**Most Appropriate For:**
- ✅ Set membership testing
- ✅ Set operations (IsSubsetOf, IsSupersetOf, Overlaps, SetEquals)
- ✅ Communicating set semantics without mutation

**Unsuitable For / Poor Performance:**
- ❌ Modifications - not supported
- ❌ Ordered iteration - sets are unordered

#### **`IImmutableList<T>` and other IImmutable interfaces**
- **Purpose:** Immutable collection operations that return new instances
- **Created when:** With System.Collections.Immutable (2013)
- **Why created:** Express immutable modification pattern (old + change = new)
- **Behavior guarantee:**
  - Modification methods return new instances
  - Original remains unchanged

**Most Appropriate For:**
- ✅ Creating new versions from existing collections
- ✅ Functional programming patterns
- ✅ Thread-safe modifications

**Unsuitable For / Poor Performance:**
- ❌ Frequent modifications - creates many instances
- ❌ Building collections incrementally - use Builder pattern

**Learning exercise:**
```csharp
// Compare IReadOnlyList vs IImmutableList
IReadOnlyList<int> readOnlyList = new List<int> { 1, 2, 3 };
// readOnlyList.Add(4);  // Doesn't exist

IImmutableList<int> immutableList = ImmutableList.Create(1, 2, 3);
var newList = immutableList.Add(4);  // Returns new instance
Console.WriteLine($"Original: {immutableList.Count}");  // Still 3
Console.WriteLine($"New: {newList.Count}");             // Now 4
```

---

## Module 2: Understanding Design Intent - Why Each Type Exists

### 2.1 The Evolution Story

Understanding the timeline helps understand the "why":

**2002 - .NET Framework 1.0:**
- `Array` - Foundation, interop, performance
- `ArrayList` - Dynamic size, but boxing for value types
- Problem: Boxing overhead, no type safety

**2005 - .NET Framework 2.0 (Generics):**
- `List<T>` - Type-safe ArrayList replacement
- Generic interfaces: `IEnumerable<T>`, `ICollection<T>`, `IList<T>`
- `ReadOnlyCollection<T>` - Wrapper for read-only access
- Problem: Still mutable, no true immutability

**2012 - .NET Framework 4.5:**
- `IReadOnlyCollection<T>`, `IReadOnlyList<T>` - Read-only interface hierarchy
- Problem: Interfaces don't provide immutability, just hide mutation

**2013 - System.Collections.Immutable:**
- `ImmutableArray<T>`, `ImmutableList<T>`, etc.
- Purpose: True immutability for thread-safe, functional programming
- Problem: ImmutableArray for random access, ImmutableList for modifications

**2020 - .NET 5:**
- `IReadOnlySet<T>` - Complete read-only hierarchy
- Purpose: Consistency in interface design

**2023 - .NET 8:**
- `FrozenSet<T>`, `FrozenDictionary<TKey, TValue>`
- Purpose: Optimize read-heavy scenarios (configuration, lookup tables)
- Trade-off: Higher creation cost for faster lookups

### 2.2 Design Patterns and Intent

**When Microsoft created each type, they solved specific problems:**

#### **Array (`T[]`)** - The Foundation
```csharp
// Problem: Need maximum performance, interop, known size
// Solution: Direct memory access, zero overhead

// Use when:
int[] scores = new int[100];  // Known size
byte[] buffer = new byte[8192];  // Stream buffers
Memory<byte> memory = buffer;  // Span<T> operations
```

#### **List<T>** - The Workhorse
```csharp
// Problem: Need dynamic size with performance close to arrays
// Solution: Resizable array with rich API

// Use when:
var items = new List<Product>();
while (reader.Read())
{
    items.Add(ParseProduct(reader));  // Unknown count
}
```

#### **ImmutableArray<T>** - The Immutable Array
```csharp
// Problem: Need immutability with array-like performance
// Solution: Struct wrapping array, value semantics

// Use when:
public ImmutableArray<string> AllowedCountries { get; }  // Config
public ImmutableArray<ValidationRule> Rules { get; }  // Thread-safe sharing
```

#### **ImmutableList<T>** - The Functional List
```csharp
// Problem: Need immutability with efficient incremental changes
// Solution: Tree structure with structural sharing

// Use when:
ImmutableList<LogEntry> logs = ImmutableList<LogEntry>.Empty;
logs = logs.Add(new LogEntry("Start"));  // Efficient version creation
logs = logs.Add(new LogEntry("Processing"));
// Building immutable structures incrementally
```

#### **FrozenDictionary<TKey, TValue>** - The Lookup Table
```csharp
// Problem: Configuration data, lookup tables with heavy read access
// Solution: Optimized hash table created once

// Use when:
private static readonly FrozenDictionary<string, CountryInfo> Countries =
    LoadCountries().ToFrozenDictionary(c => c.Code);

// Frequent lookups:
public CountryInfo GetCountry(string code) => Countries[code];
```

#### **ReadOnlyCollection<T>** - The Wrapper
```csharp
// Problem: Want to expose collection without allowing modifications
// Solution: Wrapper that hides mutation methods

// Use when:
private List<Item> _items = new();
public ReadOnlyCollection<Item> Items => _items.AsReadOnly();
// Protect internal collection
```

---

## Module 3: Understanding Internals - How Types Work

### 3.1 What "Understanding Internals" Means

Understanding internals means knowing:
1. **Memory layout** - How data is stored in memory
2. **Allocation behavior** - When and how memory is allocated
3. **Algorithmic complexity** - Performance characteristics of operations
4. **Implementation details** - What happens under the hood

### 3.2 Deep Dive: List<T> Internals

**Exercise: Explore List<T> source code**

```csharp
// Simplified internal structure
public class List<T>
{
    private T[] _items;           // The backing array
    private int _size;            // Number of actual elements
    private int _version;         // For enumeration safety
    private const int DefaultCapacity = 4;
    
    // Indexer - direct array access
    public T this[int index]
    {
        get
        {
            if ((uint)index >= (uint)_size)
                ThrowHelper.ThrowArgumentOutOfRangeException();
            return _items[index];
        }
    }
    
    // Add operation
    public void Add(T item)
    {
        _version++;  // Invalidate enumerators
        T[] array = _items;
        int size = _size;
        
        if ((uint)size < (uint)array.Length)
        {
            _size = size + 1;
            array[size] = item;  // Fast path - space available
        }
        else
        {
            AddWithResize(item);  // Slow path - need to grow
        }
    }
    
    private void AddWithResize(T item)
    {
        int size = _size;
        Grow(size + 1);  // Double capacity
        _size = size + 1;
        _items[size] = item;
    }
    
    private void Grow(int capacity)
    {
        int newCapacity = _items.Length == 0 ? DefaultCapacity : 2 * _items.Length;
        
        // Allocate new array
        T[] newArray = new T[newCapacity];
        
        // Copy existing elements
        Array.Copy(_items, newArray, _size);
        
        // Replace array
        _items = newArray;
    }
}
```

**Learn by experimentation:**

```csharp
// Track allocations using ObjectAllocationAnalyzer or BenchmarkDotNet

List<int> list = new List<int>();
long memory1 = GC.GetTotalMemory(true);

for (int i = 0; i < 1000; i++)
{
    list.Add(i);
    
    if (i < 20)  // Watch first growths
    {
        long memory2 = GC.GetTotalMemory(false);
        Console.WriteLine($"After adding {i}: Count={list.Count}, " +
                         $"Capacity={list.Capacity}, " +
                         $"Memory delta={memory2 - memory1} bytes");
        memory1 = memory2;
    }
}

// Observe:
// - Initial allocation (empty or 4 elements)
// - Doubling pattern: 4→8→16→32→64→128→256→512→1024
// - Each growth = new array allocation + copy
```

### 3.3 Deep Dive: ImmutableArray<T> Internals

```csharp
// Actual struct definition (simplified)
public struct ImmutableArray<T> : IReadOnlyList<T>, IImmutableList<T>
{
    private readonly T[] array;  // The wrapped array (null for default)
    
    // Factory method - wraps existing array
    public static ImmutableArray<T> Create(T[] items)
    {
        if (items == null || items.Length == 0)
            return Empty;
        
        // Creates defensive copy
        T[] copy = new T[items.Length];
        Array.Copy(items, copy, items.Length);
        return new ImmutableArray<T>(copy);
    }
    
    // Indexer
    public T this[int index]
    {
        get
        {
            // Direct array access - same speed as regular array
            return array[index];
        }
    }
    
    // "Mutation" returns new instance
    public ImmutableArray<T> Add(T item)
    {
        if (IsEmpty)
            return Create(new[] { item });
        
        // Create new array with space for one more
        T[] newArray = new T[array.Length + 1];
        Array.Copy(array, newArray, array.Length);
        newArray[array.Length] = item;
        
        return new ImmutableArray<T>(newArray);
    }
    
    // Equality compares content, not reference
    public bool Equals(ImmutableArray<T> other)
    {
        return array == other.array;  // Reference equality of wrapped array
        // Multiple ImmutableArray instances can share same array safely!
    }
}
```

**Learning exercise:**

```csharp
// Understand shared arrays
ImmutableArray<int> array1 = ImmutableArray.Create(1, 2, 3);
ImmutableArray<int> array2 = array1;  // No copy - shares wrapped array!

// Verify sharing using reflection
var field = typeof(ImmutableArray<int>).GetField("array", 
    BindingFlags.NonPublic | BindingFlags.Instance);
int[] internal1 = (int[])field.GetValue(array1);
int[] internal2 = (int[])field.GetValue(array2);

Console.WriteLine(ReferenceEquals(internal1, internal2));  // True!

// Both struct instances wrap same array
// Safe because array can't be modified
```

### 3.4 Learning Exercise: Build a Mini Collection

**To truly understand internals, implement a simplified version:**

```csharp
// Implement a simple dynamic array
public class SimpleDynamicArray<T>
{
    private T[] _items;
    private int _count;
    
    public SimpleDynamicArray()
    {
        _items = Array.Empty<T>();
    }
    
    public int Count => _count;
    public int Capacity => _items.Length;
    
    public void Add(T item)
    {
        // TODO: Implement growth logic
        // 1. Check if space available
        // 2. If not, create larger array (2x current size)
        // 3. Copy elements
        // 4. Add new item
    }
    
    public T this[int index]
    {
        get
        {
            // TODO: Implement bounds checking and access
        }
    }
}

// Compare your implementation with List<T> behavior
// Measure performance differences
```

---

## Module 4: IEnumerable<T> vs IQueryable<T>

### 4.1 The Fundamental Difference

**`IEnumerable<T>`** - Objects in Memory
- Represents an in-memory sequence
- Operations execute using .NET code (LINQ to Objects)
- Works with any object collection
- Execution happens on client (your application)

**`IQueryable<T>`** - Expression Trees for Translation
- Represents a query that can be translated
- Operations build expression trees
- Expression trees can be translated (e.g., to SQL)
- Execution happens on server (database, web service, etc.)

### 4.2 Deep Understanding Through Examples

#### **Example 1: Where Does Code Execute?**

```csharp
// IEnumerable - executes in .NET
IEnumerable<Product> productsInMemory = GetProductsFromMemory();
var filtered = productsInMemory.Where(p => p.Price > 100);
// .Where() executes as C# code
// Filters after loading all products into memory

// IQueryable - translates to SQL
IQueryable<Product> productsQuery = dbContext.Products;
var filteredQuery = productsQuery.Where(p => p.Price > 100);
// .Where() builds expression tree
// Translates to: SELECT * FROM Products WHERE Price > 100
// Database does the filtering
```

#### **Example 2: The Expression Tree**

```csharp
// What happens with IQueryable
IQueryable<Product> query = dbContext.Products
    .Where(p => p.Price > 100)
    .OrderBy(p => p.Name);

// This lambda: p => p.Price > 100
// Becomes an Expression<Func<Product, bool>>

// Expression tree looks like:
// Lambda
//   Parameters: p
//   Body: GreaterThan
//     Left: Property(p, "Price")
//     Right: Constant(100)

// EF Core walks this tree and translates to SQL
```

**Learning exercise:**

```csharp
// Build and inspect an expression tree
Expression<Func<Product, bool>> expr = p => p.Price > 100;

Console.WriteLine($"NodeType: {expr.NodeType}");  // Lambda
Console.WriteLine($"Parameters: {expr.Parameters[0].Name}");  // p

var binaryExpr = (BinaryExpression)expr.Body;
Console.WriteLine($"Body NodeType: {binaryExpr.NodeType}");  // GreaterThan

var leftSide = (MemberExpression)binaryExpr.Left;
Console.WriteLine($"Left: {leftSide.Member.Name}");  // Price

var rightSide = (ConstantExpression)binaryExpr.Right;
Console.WriteLine($"Right: {rightSide.Value}");  // 100

// Understand: this tree can be walked and translated to SQL!
```

#### **Example 3: The Accidental IEnumerable Conversion**

```csharp
// DANGER: Common performance mistake
var products = dbContext.Products
    .AsEnumerable()  // ← Converts to IEnumerable!
    .Where(p => p.Price > 100)  // Now filters in C# after loading ALL products!
    .ToList();

// SQL executed: SELECT * FROM Products
// Then C# filters the results
// Loads entire table into memory first!

// CORRECT: Keep as IQueryable
var productsCorrect = dbContext.Products
    .Where(p => p.Price > 100)  // Queryable.Where
    .ToList();

// SQL executed: SELECT * FROM Products WHERE Price > 100
// Database filters, less data transferred
```

### 4.3 When IQueryable Breaks Down

```csharp
// Some operations force enumeration
var products = dbContext.Products
    .Where(p => p.Price > 100)  // Queryable - still translates
    .ToList()  // Materializes to memory
    .Where(p => SomeComplexCSharpLogic(p))  // Now Enumerable
    .ToList();

// SQL: SELECT * FROM Products WHERE Price > 100
// Then C# method SomeComplexCSharpLogic filters results

// This is OK! Use database for what it's good at (filtering data),
// then C# for complex business logic
```

### 4.4 Composition Differences

```csharp
// IQueryable composes SQL
IQueryable<Product> BuildQuery(IQueryable<Product> query, decimal minPrice)
{
    return query.Where(p => p.Price >= minPrice);  // Adds to SQL
}

var query = dbContext.Products;
query = BuildQuery(query, 100);
query = query.OrderBy(p => p.Name);
var results = query.ToList();
// Single SQL: SELECT * FROM Products WHERE Price >= 100 ORDER BY Name

// IEnumerable doesn't compose the same way
IEnumerable<Product> BuildFilter(IEnumerable<Product> products, decimal minPrice)
{
    return products.Where(p => p.Price >= minPrice);  // LINQ to Objects
}

var enumerable = dbContext.Products.AsEnumerable();  // Loads all!
enumerable = BuildFilter(enumerable, 100);  // Filters in memory
var results2 = enumerable.OrderBy(p => p.Name).ToList();  // Also in memory
```

### 4.5 Learning Exercise: Trace SQL Generation

```csharp
// Enable SQL logging
var options = new DbContextOptionsBuilder<AppDbContext>()
    .UseSqlServer(connectionString)
    .LogTo(Console.WriteLine, LogLevel.Information)
    .EnableSensitiveDataLogging()
    .Options;

using var dbContext = new AppDbContext(options);

// Exercise: Predict SQL, then verify

// Query 1
var q1 = dbContext.Products
    .Where(p => p.Price > 100)
    .Select(p => new { p.Id, p.Name })
    .ToList();
// What SQL do you expect?
// SELECT Id, Name FROM Products WHERE Price > 100

// Query 2
var q2 = dbContext.Products
    .Where(p => p.Price > 100)
    .ToList()  // ← Materializes here
    .Select(p => new { p.Id, p.Name })
    .ToList();
// What SQL?
// SELECT * FROM Products WHERE Price > 100 (loads all columns!)

// Query 3
var q3 = dbContext.Products
    .AsEnumerable()  // ← Danger!
    .Where(p => p.Price > 100)
    .ToList();
// What SQL?
// SELECT * FROM Products (loads entire table!)
```

### 4.6 Key Takeaways: IEnumerable vs IQueryable

| Aspect | IEnumerable<T> | IQueryable<T> |
|--------|----------------|---------------|
| Represents | In-memory sequence | Translatable query |
| Execution | .NET runtime | Query provider (DB, etc.) |
| Extension methods | LINQ to Objects | LINQ query provider |
| Method parameters | `Func<T, bool>` | `Expression<Func<T, bool>>` |
| Composition | Immediate execution | Builds query |
| Best for | In-memory collections | Database queries |
| Danger | Multiple enumeration | Accidental enumeration |

---

## Module 5: Collections in Specific Contexts

### 5.1 EF Core Context

#### **Best Practices for EF Core Queries**

```csharp
// ✅ GOOD: Project to DTO, return ImmutableArray
public async Task<ImmutableArray<ProductDto>> GetProductsAsync()
{
    return await _dbContext.Products
        .AsNoTracking()  // No change tracking
        .Where(p => p.IsActive)
        .Select(p => new ProductDto(p.Id, p.Name, p.Price))  // Project
        .ToImmutableArrayAsync();  // Materialize directly
}

// ❌ BAD: Return IQueryable from repository
public IQueryable<Product> GetProducts()
{
    return _dbContext.Products.Where(p => p.IsActive);
    // Leaks query composition to caller
    // DbContext lifetime issues
    // Cannot enforce AsNoTracking
}

// ❌ BAD: Return entities with tracking
public async Task<List<Product>> GetProductsAsync()
{
    return await _dbContext.Products
        .Where(p => p.IsActive)
        .ToListAsync();
    // Unnecessary change tracking overhead
    // Exposes entities that might be modified
}

// ✅ GOOD: When you need tracking
public async Task<Product?> GetProductForEditAsync(int id)
{
    return await _dbContext.Products
        // WITH tracking for updates
        .FirstOrDefaultAsync(p => p.Id == id);
}
```

#### **Projection vs. Materialization**

```csharp
// Scenario: Get product names

// ❌ Inefficient: Load full entities then project
var names = await dbContext.Products
    .ToListAsync();  // SELECT * FROM Products (all columns!)
var namesList = names.Select(p => p.Name).ToList();  // Project in C#

// ✅ Efficient: Project in database
var namesEfficient = await dbContext.Products
    .Select(p => p.Name)  // SELECT Name FROM Products (only needed column)
    .ToArrayAsync();

// SQL comparison:
// Bad:  SELECT Id, Name, Price, Description, ... FROM Products
// Good: SELECT Name FROM Products
```

#### **Handling Large Result Sets**

```csharp
// ❌ BAD: Load 100,000 products into memory
var allProducts = await dbContext.Products.ToListAsync();
// Huge memory allocation, slow

// ✅ GOOD: Stream and process
await foreach (var product in dbContext.Products.AsAsyncEnumerable())
{
    ProcessProduct(product);
    // One at a time, minimal memory
}

// ✅ GOOD: Pagination
public async Task<ImmutableArray<ProductDto>> GetProductsPageAsync(
    int page, int pageSize)
{
    return await dbContext.Products
        .AsNoTracking()
        .OrderBy(p => p.Id)
        .Skip(page * pageSize)
        .Take(pageSize)
        .Select(p => new ProductDto(p.Id, p.Name, p.Price))
        .ToImmutableArrayAsync();
}
```

### 5.2 Stream Context

#### **Reading from Streams**

```csharp
// Pattern: Read from stream into collection
public async Task<ImmutableArray<byte>> ReadStreamAsync(Stream stream)
{
    // Don't know size in advance
    List<byte> buffer = new List<byte>();
    
    byte[] chunk = new byte[8192];
    int bytesRead;
    
    while ((bytesRead = await stream.ReadAsync(chunk)) > 0)
    {
        // Add to growing collection
        for (int i = 0; i < bytesRead; i++)
        {
            buffer.Add(chunk[i]);
        }
    }
    
    // Convert to immutable once complete
    return buffer.ToImmutableArray();
}

// Better: Use MemoryStream if you need the bytes
public async Task<byte[]> ReadStreamEfficientAsync(Stream stream)
{
    using var memoryStream = new MemoryStream();
    await stream.CopyToAsync(memoryStream);
    return memoryStream.ToArray();  // Single array allocation
}

// Best: Process streaming without full materialization
public async Task ProcessStreamAsync(Stream stream)
{
    byte[] buffer = new byte[8192];
    int bytesRead;
    
    while ((bytesRead = await stream.ReadAsync(buffer)) > 0)
    {
        ProcessChunk(buffer.AsSpan(0, bytesRead));
        // Never build full collection
    }
}
```

#### **Writing to Streams**

```csharp
// Pattern: Write collection to stream
public async Task WriteToStreamAsync(
    IReadOnlyList<DataRecord> records, 
    Stream stream)
{
    using var writer = new StreamWriter(stream, leaveOpen: true);
    
    foreach (var record in records)
    {
        await writer.WriteLineAsync(record.ToJson());
    }
}

// Efficient for large collections
public async Task WriteToStreamEfficientAsync(
    IAsyncEnumerable<DataRecord> records,
    Stream stream)
{
    using var writer = new StreamWriter(stream, leaveOpen: true);
    
    await foreach (var record in records)
    {
        await writer.WriteLineAsync(record.ToJson());
        // No need to load all records into memory
    }
}
```

### 5.3 Async Context

#### **Async Enumeration**

```csharp
// IAsyncEnumerable<T> - async version of IEnumerable<T>
public async IAsyncEnumerable<Product> StreamProductsAsync(
    [EnumeratorCancellation] CancellationToken cancellationToken = default)
{
    await foreach (var product in _dbContext.Products
        .AsAsyncEnumerable()
        .WithCancellation(cancellationToken))
    {
        // Can do async work per item
        await EnrichProductAsync(product);
        yield return product;
    }
}

// Consumer
await foreach (var product in StreamProductsAsync())
{
    ProcessProduct(product);
}
```

#### **Async Materialization**

```csharp
// Always use Async versions with EF Core
var products = await dbContext.Products
    .ToListAsync();  // ✅ Not .ToList()

var array = await dbContext.Products
    .ToArrayAsync();  // ✅ Not .ToArray()

var first = await dbContext.Products
    .FirstOrDefaultAsync();  // ✅ Not .FirstOrDefault()

// Why? Non-async methods block the thread during database I/O
// Async methods free the thread to handle other requests
```

#### **Parallel Processing with Collections**

```csharp
// Parallel LINQ (PLINQ) for CPU-bound operations
ImmutableArray<Product> products = await GetProductsAsync();

var results = products
    .AsParallel()
    .WithDegreeOfParallelism(Environment.ProcessorCount)
    .Select(p => ExpensiveCalculation(p))
    .ToArray();

// Parallel.ForEach for collections
await Parallel.ForEachAsync(
    products,
    new ParallelOptions { MaxDegreeOfParallelism = 10 },
    async (product, cancellationToken) =>
    {
        await ProcessProductAsync(product, cancellationToken);
    });
```

### 5.4 Thread-Safety Context

#### **Immutable Collections for Thread Safety**

```csharp
// ❌ NOT thread-safe
private List<LogEntry> _logs = new();

public void AddLog(LogEntry entry)
{
    _logs.Add(entry);  // Race condition!
}

// ✅ Thread-safe with ImmutableList
private ImmutableList<LogEntry> _logs = ImmutableList<LogEntry>.Empty;

public void AddLog(LogEntry entry)
{
    ImmutableInterlocked.Update(ref _logs, list => list.Add(entry));
    // Atomic update
}

// ✅ Thread-safe with ConcurrentBag
private ConcurrentBag<LogEntry> _logs = new();

public void AddLog(LogEntry entry)
{
    _logs.Add(entry);  // Thread-safe
}
```

#### **Read-Heavy Scenarios**

```csharp
// Configuration data - read often, write rarely
public class ConfigurationService
{
    private ImmutableDictionary<string, string> _config;
    
    public ConfigurationService()
    {
        _config = LoadConfiguration().ToImmutableDictionary();
        // No locks needed for reads!
    }
    
    public string GetValue(string key) => _config[key];
    
    public void UpdateConfiguration(Dictionary<string, string> newConfig)
    {
        // Atomic replacement
        Interlocked.Exchange(ref _config, newConfig.ToImmutableDictionary());
    }
}

// Alternative: FrozenDictionary for even faster reads (.NET 8+)
private FrozenDictionary<string, string> _config = 
    LoadConfiguration().ToFrozenDictionary();
```

---

## Module 6: Converting Between Collection Types

### 6.1 Conversion Matrix and Costs

**Understand the cost of each conversion:**

```csharp
// From Array
int[] array = Enumerable.Range(0, 1000).ToArray();

// To List - Copies array
List<int> listFromArray = array.ToList();
// or: new List<int>(array);
// Cost: O(n) copy, new allocation

// To ImmutableArray - Copies array
ImmutableArray<int> immArrayFromArray = array.ToImmutableArray();
// or: ImmutableArray.Create(array);
// Cost: O(n) defensive copy

// To ReadOnlyCollection - Wraps array (no copy!)
ReadOnlyCollection<int> readOnlyFromArray = Array.AsReadOnly(array);
// Cost: O(1) wrapper only
// WARNING: Original array can still be modified!
```

```csharp
// From List
List<int> list = Enumerable.Range(0, 1000).ToList();

// To Array - Copies internal array
int[] arrayFromList = list.ToArray();
// Cost: O(n) copy

// To ImmutableArray - Copies
ImmutableArray<int> immArrayFromList = list.ToImmutableArray();
// Cost: O(n) copy

// To ReadOnlyCollection - Wraps list (no copy!)
ReadOnlyCollection<int> readOnlyFromList = list.AsReadOnly();
// Cost: O(1) wrapper only
// WARNING: Original list can still be modified!
```

```csharp
// From ImmutableArray
ImmutableArray<int> immArray = Enumerable.Range(0, 1000).ToImmutableArray();

// To Array - Copies
int[] arrayFromImm = immArray.ToArray();
// Cost: O(n) copy

// To List - Copies
List<int> listFromImm = immArray.ToList();
// Cost: O(n) copy

// To ImmutableList - Converts structure
ImmutableList<int> immListFromImm = immArray.ToImmutableList();
// Cost: O(n) builds tree structure
```

### 6.2 When to Convert

#### **Scenario 1: EF Core Query → Repository Return**

```csharp
// Query result: IQueryable<Product>
// Need: ImmutableArray<ProductDto>

// ✅ BEST: Direct conversion
public async Task<ImmutableArray<ProductDto>> GetProductsAsync()
{
    return await _dbContext.Products
        .AsNoTracking()
        .Select(p => new ProductDto(p.Id, p.Name, p.Price))
        .ToImmutableArrayAsync();  // Single conversion
}

// ❌ AVOID: Multiple conversions
public async Task<ImmutableArray<ProductDto>> GetProductsWrongAsync()
{
    var entities = await _dbContext.Products.ToListAsync();  // Conversion 1
    var dtos = entities.Select(e => new ProductDto(e.Id, e.Name, e.Price))
                      .ToList();  // Conversion 2
    return dtos.ToImmutableArray();  // Conversion 3
    // Three allocations instead of one!
}
```

#### **Scenario 2: Receiving Interface, Need Concrete Type**

```csharp
// Received: IEnumerable<int>
// Need: Fast indexed access

public void ProcessData(IEnumerable<int> data)
{
    // ❌ Don't repeatedly enumerate
    if (data.Any())  // Enumeration 1
    {
        var count = data.Count();  // Enumeration 2
        var first = data.First();  // Enumeration 3
    }
    
    // ✅ Materialize once
    ImmutableArray<int> array = data.ToImmutableArray();
    if (!array.IsEmpty)
    {
        var count = array.Length;  // O(1)
        var first = array[0];  // O(1)
    }
    
    // Alternative: Check if already materialized
    if (data is ICollection<int> collection)
    {
        // Already materialized, use directly
        var count = collection.Count;
    }
    else
    {
        // Need to materialize
        var materialized = data.ToImmutableArray();
    }
}
```

#### **Scenario 3: Building Collections Incrementally**

```csharp
// Building unknown number of items

// ❌ AVOID: Multiple ImmutableArray additions
ImmutableArray<int> values = ImmutableArray<int>.Empty;
for (int i = 0; i < 1000; i++)
{
    values = values.Add(i);  // Each Add creates new array - O(n²)!
}

// ✅ GOOD: Build with List, convert once
List<int> valuesList = new List<int>();
for (int i = 0; i < 1000; i++)
{
    valuesList.Add(i);  // O(1) amortized
}
ImmutableArray<int> values = valuesList.ToImmutableArray();  // O(n) once

// ✅ ALTERNATIVE: ImmutableArray.Builder
var builder = ImmutableArray.CreateBuilder<int>();
for (int i = 0; i < 1000; i++)
{
    builder.Add(i);  // O(1) amortized
}
ImmutableArray<int> values = builder.ToImmutable();  // O(1) if capacity matches
```

### 6.3 Conversion Anti-Patterns to Avoid

```csharp
// ❌ ANTI-PATTERN 1: Unnecessary conversions
var products = await dbContext.Products
    .ToListAsync();  // Conversion 1
var array = products.ToArray();  // Conversion 2
var immutable = array.ToImmutableArray();  // Conversion 3
// Should be: .ToImmutableArrayAsync() directly

// ❌ ANTI-PATTERN 2: Converting in loops
foreach (var category in categories)
{
    var products = category.Products.ToList();  // Wasteful if just iterating
    foreach (var product in products)
    {
        Process(product);
    }
}
// Should iterate IEnumerable directly

// ❌ ANTI-PATTERN 3: Converting for no reason
public IReadOnlyList<Product> GetProducts()
{
    return _products.ToList().AsReadOnly();
    // If _products is already List<Product>:
    // Should be: return _products.AsReadOnly();
}

// ❌ ANTI-PATTERN 4: Multiple queries as list
var activeProducts = dbContext.Products.Where(p => p.IsActive).ToList();
var inactiveProducts = dbContext.Products.Where(p => !p.IsActive).ToList();
// Two database round-trips!
// Should load once, split in memory if needed
```

### 6.4 Performance-Conscious Conversions

```csharp
// Benchmark conversions for your use case

[MemoryDiagnoser]
public class ConversionBenchmarks
{
    private int[] _array;
    private List<int> _list;
    
    [GlobalSetup]
    public void Setup()
    {
        _array = Enumerable.Range(0, 10000).ToArray();
        _list = _array.ToList();
    }
    
    [Benchmark]
    public ImmutableArray<int> ArrayToImmutableArray()
    {
        return _array.ToImmutableArray();
    }
    
    [Benchmark]
    public ImmutableArray<int> ListToImmutableArray()
    {
        return _list.ToImmutableArray();
    }
    
    [Benchmark]
    public List<int> ArrayToList()
    {
        return _array.ToList();
    }
    
    [Benchmark]
    public int[] ListToArray()
    {
        return _list.ToArray();
    }
}

// Run and analyze:
// - Execution time
// - Memory allocations
// - GC pressure
```

---

## Module 7: Practical Exercises

### Exercise 1: Repository Pattern Implementation

Implement a complete repository using best practices:

```csharp
// Requirements:
// 1. Use ImmutableArray<T> for returns
// 2. Project to DTOs
// 3. Use AsNoTracking
// 4. Support async
// 5. Handle empty results properly

public interface IProductRepository
{
    Task<ImmutableArray<ProductDto>> GetAllAsync(CancellationToken ct = default);
    Task<ImmutableArray<ProductDto>> GetByCategoryAsync(int categoryId, CancellationToken ct = default);
    Task<ProductDto?> GetByIdAsync(int id, CancellationToken ct = default);
}

// Implement with optimal conversions
public class ProductRepository : IProductRepository
{
    // TODO: Implement
}
```

### Exercise 2: Collection Performance Analysis

Compare performance of different approaches:

```csharp
// Scenario: Load 10,000 products, filter by price, return DTOs

// Approach 1: Multiple conversions
// Approach 2: Direct projection
// Approach 3: Streaming

// Measure:
// - Execution time
// - Memory usage
// - SQL queries generated
// - Number of allocations
```

### Exercise 3: Thread-Safe Cache

Build a thread-safe cache using immutable collections:

```csharp
public class ProductCache
{
    // Requirements:
    // 1. Thread-safe reads (no locks)
    // 2. Thread-safe updates
    // 3. Return immutable snapshots
    // 4. Support clearing cache
    
    // Choose appropriate collection type
    // Implement atomic updates
}
```

### Exercise 4: Stream Processing

Process a large file without loading entirely into memory:

```csharp
// File contains 1 million JSON records
// Requirements:
// 1. Stream processing
// 2. Filter records
// 3. Convert to DTOs
// 4. Return results in batches

public async IAsyncEnumerable<ImmutableArray<RecordDto>> ProcessFileAsync(
    string filePath,
    [EnumeratorCancellation] CancellationToken ct = default)
{
    // TODO: Implement efficient streaming
    // Yield batches of 1000 records at a time
}
```

---

## Module 8: Reference Materials

### 8.1 Quick Reference Table

| Type | Mutable | Size | Best For | Worst For | Access | Add | Insert | Remove |
|------|---------|------|----------|-----------|--------|-----|--------|--------|
| `T[]` | Elements | Fixed | Max perf, known size | Dynamic size | O(1) | N/A | O(n) | O(n) |
| `List<T>` | Yes | Dynamic | Building collections | Insert/remove middle | O(1) | O(1)* | O(n) | O(n) |
| `ImmutableArray<T>` | No | Fixed | Thread-safe reads | Any mutation | O(1) | O(n) | O(n) | O(n) |
| `ImmutableList<T>` | No | Dynamic | Frequent "changes" | Indexed access | O(log n) | O(log n) | O(log n) | O(log n) |
| `FrozenSet<T>` | No | Fixed | Lookups | Creation, mutations | N/A | N/A | N/A | N/A |
| `ReadOnlyCollection<T>` | Wrapped | Fixed | Hide mutation | True immutability | O(1) | N/A | N/A | N/A |

*O(1) amortized, O(n) when resizing

### 8.2 Decision Tree

```
Need a collection?
├─ Known fixed size?
│  ├─ Yes → Array (T[])
│  └─ No → Continue
├─ Need true immutability?
│  ├─ Yes
│  │  ├─ Frequent changes? → ImmutableList<T>
│  │  ├─ Array-like access? → ImmutableArray<T>
│  │  └─ Lookup-heavy? → FrozenSet/FrozenDictionary
│  └─ No → Continue
├─ Building incrementally?
│  ├─ Yes → List<T>
│  └─ No → Continue
├─ Frequent insertions in middle?
│  ├─ Yes → LinkedList<T>
│  └─ No → Continue
└─ Wrapping existing?
   └─ Yes → ReadOnlyCollection<T>
```

### 8.3 Operation Performance Matrix

| Operation | Array | List<T> | ImmutableArray | ImmutableList | FrozenDict |
|-----------|-------|---------|----------------|---------------|------------|
| Index access | ⚡ O(1) | ⚡ O(1) | ⚡ O(1) | ⚠️ O(log n) | N/A |
| Iteration | ⚡ Fastest | ⚡ Very fast | ⚡ Very fast | ⚠️ Slower | ⚠️ OK |
| Add to end | ❌ N/A | ⚡ O(1)* | ❌ O(n) | ⚡ O(log n) | ❌ N/A |
| Insert middle | ❌ O(n) | ❌ O(n) | ❌ O(n) | ⚡ O(log n) | ❌ N/A |
| Remove middle | ❌ O(n) | ❌ O(n) | ❌ O(n) | ⚡ O(log n) | ❌ N/A |
| Lookup | ⚠️ O(n) | ⚠️ O(n) | ⚠️ O(n) | ⚠️ O(n) | ⚡ O(1) |
| Sort | ⚡ O(n log n) | ⚡ O(n log n) | ❌ O(n) | ❌ O(n log n) | ❌ N/A |
| Thread-safe | ❌ No | ❌ No | ⚡ Yes | ⚡ Yes | ⚡ Yes |

⚡ = Excellent performance
⚠️ = Acceptable performance
❌ = Poor performance or not supported

### 8.4 Further Study

**Official Documentation:**
- [Collections (C#)](https://docs.microsoft.com/dotnet/csharp/programming-guide/concepts/collections)
- [System.Collections.Immutable](https://docs.microsoft.com/dotnet/api/system.collections.immutable)
- [EF Core Performance](https://docs.microsoft.com/ef/core/performance/)

**Source Code:**
- [.NET Runtime Collections](https://github.com/dotnet/runtime/tree/main/src/libraries/System.Collections)
- [EF Core](https://github.com/dotnet/efcore)

**Performance Analysis:**
- Learn BenchmarkDotNet
- Use dotMemory or PerfView
- Enable SQL logging in EF Core

---

## Assessment Checklist

After completing this plan, verify you can:

- [ ] Explain the purpose and design intent of each collection type
- [ ] Describe internal structure of List<T> and ImmutableArray<T>
- [ ] **List which operations are efficient vs inefficient for each type**
- [ ] Choose appropriate collection type for a given scenario
- [ ] Explain IEnumerable vs IQueryable with examples
- [ ] Identify accidental enumeration in EF Core queries
- [ ] Convert between collection types efficiently
- [ ] Implement thread-safe collections using immutable types
- [ ] Process large datasets without excessive memory
- [ ] Use async enumeration appropriately
- [ ] Optimize EF Core queries with proper materialization
- [ ] **Avoid performance anti-patterns based on operation characteristics**

**Congratulations!** You now have a comprehensive understanding of .NET collections, including which operations are fast or slow for each type, enabling you to make informed architectural decisions in enterprise applications.