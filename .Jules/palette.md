## 2025-03-24 - [Keyboard Submission in Obsidian Modals]
**Learning:** Adding a keyboard submission event handler (e.g. `Enter` key) to Obsidian Settings UI components (like text inputs) requires attaching the listener to the `.inputEl` property instead of the `Setting` component itself.
**Action:** When implementing quick-submission flows in modals, always use `text.inputEl.addEventListener('keydown', handleEnter)` for the text inputs, and securely store the `ButtonComponent` reference to manage `isSubmitting` states (disabling the button and changing text) within a `try...finally` block.
## 2026-04-09 - [Missing native tooltips for icon-only buttons]
**Learning:** While `aria-label` is great for screen readers, mouse users rely on the `title` attribute for native hover tooltips. Icon-only buttons often lack this, leaving mouse users without textual context.
**Action:** When adding or auditing icon-only buttons (like Edit, Delete, scroll overlays, or recurrence chips), always add a `title` attribute that exactly mirrors the `aria-label`.
## 2026-04-10 - [Unified tooltips on composite UI elements]
**Learning:** When a UI component is composed of multiple visual elements (like an icon next to a badge, such as the recurring task chip), screen readers and mouse users benefit more from a single, unified tooltip on the parent container rather than fragmented tooltips on child elements.
**Action:** When auditing or adding tooltips to composite components, apply the `aria-label` and `title` to the outermost wrapper element instead of inner elements.
