## 2024-03-23 - Add `id` and `for` attributes to filter dropdowns for better accessibility

**Learning:** When using `<label>` and `<select>` elements dynamically created via `createEl`, it is crucial to explicitly link them using `id` on the input element and `for` on the label element. Without this linkage, screen readers cannot properly associate the label with the input field. Also found this explicit directive in memory: "When creating form elements like `<select>` dropdowns via Obsidian DOM helpers, ensure they are programmatically linked to their visual `<label>` counterparts using `id` and `for` attributes, or provide an `aria-label` to maintain accessibility for screen readers."

**Action:** Update `src/views/DashboardView.ts` to add `id` attributes to `<select>` elements and `for` attributes to their corresponding `<label>` elements within the `renderControls` function.
