## 2024-05-10 - Icon-only buttons accessibility

**Learning:** Obsidian plugins heavily use icon-only buttons via the `setIcon()` helper for visual cleanliness (especially in headers and toolbars), which by default lack context for assistive technology.
**Action:** Always check newly added or existing icon-only buttons created with `setIcon` or similar helpers to ensure they also receive a descriptive `aria-label`.
