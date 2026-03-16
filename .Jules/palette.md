## 2024-05-10 - Icon-only buttons accessibility

**Learning:** Obsidian plugins heavily use icon-only buttons via the `setIcon()` helper for visual cleanliness (especially in headers and toolbars), which by default lack context for assistive technology.
**Action:** Always check newly added or existing icon-only buttons created with `setIcon` or similar helpers to ensure they also receive a descriptive `aria-label`.

## 2024-05-16 - Accessible interactive elements with Obsidian DOM API

**Learning:** Obsidian's DOM API helpers (`createDiv`, `createEl`) create non-semantic elements by default (e.g., plain `div`s). When these elements act as interactive components (like clickable stat cards or task items), they lack native keyboard accessibility and semantic meaning.
**Action:** Always add manual `role="button"` (or other appropriate role), `tabindex="0"`, and `aria-label` to custom interactive elements created via DOM helpers. Additionally, attach `keydown` event listeners for the 'Enter' and ' ' (Space) keys to ensure full keyboard operability.
