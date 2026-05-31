## 2024-05-31 - Obsidian Setting Component Accessibility
**Learning:** Obsidian `Setting` components do not render semantic `<label>` elements for inputs, which causes screen reader accessibility issues.
**Action:** When adding form elements like `.addText()`, `.addTextArea()`, or `.addDropdown()` via the `Setting` builder, manually set both an `aria-label` and `title` on the underlying `inputEl` or `selectEl`.
