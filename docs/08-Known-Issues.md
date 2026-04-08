# Known Issues & Technical Debt

These are confirmed observations that require attention in future patches.

## Render method complexity

- `DashboardView.render()` is 250+ lines and handles too many
  responsibilities. Needs manual extraction into sub-methods.
  Do not delegate to an agent — DOM construction interdependencies
  break silently when reorganised without manual testing.

- `TimelineComponent.render()` is 173 lines. Same concern — grid
  layout, scroll state, task positioning and tooltip management are
  tightly coupled. Manual refactor only.

## ~~`notes` field not surfaced in task list view~~ ✅ Resolved in v1.3.0

`task.notes` is now displayed below the meta row in the task list view
when present. The `.task-notes` CSS was already in place; the DOM
element is now built in `TaskListComponent.renderTaskItem()`.

## ~~`task-actions` DOM element not implemented~~ ✅ Resolved in v1.3.0

Edit and delete buttons are now built in `TaskListComponent.renderTaskItem()`
and wired to the existing `onEdit`/`onDelete` callbacks. The buttons are
hidden by default and can be enabled via **Settings → Appearance → Show task
action buttons**. The edit button opens `QuickAddModal` in edit mode,
pre-populated with the task's current data.

## ~~iOS regex compatibility — lookbehinds not audited~~ ✅ Resolved

A full grep of `src/` confirmed zero lookbehind assertions (`(?<=...)`,
`(?<!...)`) anywhere in the codebase. All regexes use standard capturing
groups and are iOS Safari-compatible.
