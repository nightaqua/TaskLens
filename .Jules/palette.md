## 2024-05-18 - Obsidian Setting Element Accessibility
**Learning:** Obsidian `Setting` elements like `.addDropdown()` and `.addText()` do not automatically render semantic `<label>` elements linked to their inputs. This causes form fields to lack accessible names for screen reader users and missing native hover tooltips.
**Action:** When using Obsidian DOM helpers to create form fields inside settings or modals, always manually add `aria-label` and `title` attributes directly to the exposed `inputEl` or `selectEl` objects.
