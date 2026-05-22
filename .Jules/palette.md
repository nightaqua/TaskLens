## 2025-03-24 - [Keyboard Submission in Obsidian Modals]
**Learning:** Adding a keyboard submission event handler (e.g. `Enter` key) to Obsidian Settings UI components (like text inputs) requires attaching the listener to the `.inputEl` property instead of the `Setting` component itself.
**Action:** When implementing quick-submission flows in modals, always use `text.inputEl.addEventListener('keydown', handleEnter)` for the text inputs, and securely store the `ButtonComponent` reference to manage `isSubmitting` states (disabling the button and changing text) within a `try...finally` block.
## 2026-04-09 - [Missing native tooltips for icon-only buttons]
**Learning:** While `aria-label` is great for screen readers, mouse users rely on the `title` attribute for native hover tooltips. Icon-only buttons often lack this, leaving mouse users without textual context.
**Action:** When adding or auditing icon-only buttons (like Edit, Delete, scroll overlays, or recurrence chips), always add a `title` attribute that exactly mirrors the `aria-label`.

## 2026-04-12 - Unified ARIA labels for UI chips
**Learning:** When grouping multiple visual elements (like an icon and text) into a single logical UI component like a chip, labeling individual child elements causes poor screen reader and tooltip experience.
**Action:** Always apply unified `aria-label` and `title` attributes to the parent container to create a single, comprehensive hover target and screen reader announcement.

## 2024-05-24 - Unified accessible labels for info-graphics
**Learning:** Adding separate `aria-label`s to child elements of a visual info-graphic (like a stat card or histogram bar) creates a disjointed screen reader experience and lacks visual context for mouse users.
**Action:** Apply `role="group"` or `role="status"` to the parent wrapper along with a concise `aria-label` and matching `title` attribute. This provides a unified hover target and screen reader announcement, avoiding the need for nested labels.
