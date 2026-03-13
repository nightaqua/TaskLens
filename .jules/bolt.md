
## 2025-02-14 - Optimize TaskManager getStatistics
**Learning:** The `getStatistics` method was using multiple `.filter()` and `.map()` passes to gather stats, which called `getTaskStatus` multiple times per task group. `getTaskStatus` creates `Date` objects which made it expensive to run O(3N) times. By combining the loops into a single pass and avoiding `getTaskStatus` for already-completed tasks, we achieved a ~3x performance boost.
**Action:** When calculating derived states or aggregate statistics over collections of models that require object instantiation (like Dates), combine the iteration into a single pass and use short-circuit logic for expensive getters.
