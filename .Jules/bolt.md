## 2025-02-14 - Rejected single-pass loop optimization in getStatistics

**Learning:** Collapsing multiple `filter` expressions into a single loop for O(3N) to O(N) gains is an anti-pattern when N is realistically low (e.g., <200 tasks in a personal vault). The performance gain is unmeasurable noise in practice, but the cost to readability and maintenance is high because it replaces declarative, intent-revealing code with imperative counters.
**Action:** Do not sacrifice declarative, functional code for imperative loops unless there is a proven, real-world bottleneck. If an expensive getter like `getTaskStatus` becomes an actual problem, the correct approach is memoization at the getter level, not obscuring the caller's logic.

## 2025-02-14 - Optimize Timeline Grid Rendering

**Learning:** `Array.findIndex` inside a loop evaluating `.toDateString()` on every iteration is extremely slow (O(N^2)). Precomputing a Map from date string to array index reduces this to O(N).
**Action:** When mapping values against a known array by a derived string key (like a date string), construct a lookup Map upfront instead of repeatedly searching the array in nested loops.
