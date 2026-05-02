## 2025-03-24 - [Keyboard Submission in Obsidian Modals]
**Learning:** Adding a keyboard submission event handler (e.g. `Enter` key) to Obsidian Settings UI components (like text inputs) requires attaching the listener to the `.inputEl` property instead of the `Setting` component itself.
**Action:** When implementing quick-submission flows in modals, always use `text.inputEl.addEventListener('keydown', handleEnter)` for the text inputs, and securely store the `ButtonComponent` reference to manage `isSubmitting` states (disabling the button and changing text) within a `try...finally` block.
## 2026-04-09 - [Missing native tooltips for icon-only buttons]
**Learning:** While `aria-label` is great for screen readers, mouse users rely on the `title` attribute for native hover tooltips. Icon-only buttons often lack this, leaving mouse users without textual context.
**Action:** When adding or auditing icon-only buttons (like Edit, Delete, scroll overlays, or recurrence chips), always add a `title` attribute that exactly mirrors the `aria-label`.

## 2026-04-12 - Unified ARIA labels for UI chips
**Learning:** When grouping multiple visual elements (like an icon and text) into a single logical UI component like a chip, labeling individual child elements causes poor screen reader and tooltip experience.
**Action:** Always apply unified `aria-label` and `title` attributes to the parent container to create a single, comprehensive hover target and screen reader announcement.

## 2024-05-02 - Accessible Obsidian Setting Components
**Learning:** Obsidian's `Setting` components (like `.addText()`, `.addDropdown()`, `.addTextArea()`) do not render semantic `<label>` elements or automatically link their text descriptions to the generated inputs. This hides context from screen readers and leaves custom inputs without native tooltips.
**Action:** When creating form inputs via Obsidian's DOM API or `Setting` helpers, explicitly access the exposed input element (e.g., `.inputEl` or `.selectEl`) and set `aria-label` and `title` attributes matching the input's purpose to ensure full accessibility for screen reader and mouse users.
