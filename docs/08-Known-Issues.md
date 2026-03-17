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

## `notes` field not surfaced in task list view

PR #25 (rich timeline tooltips) added `task.notes` parsing and
displays it in the timeline tooltip only. It was accepted with a
follow-up note that `notes` should also appear in the task list
view before the next release. Not yet implemented.

## `task-actions` DOM element not implemented

A CSS stub for `.task-actions` exists in `styles.css` but the
actual DOM element is not present in `TaskListComponent.ts`.
The CSS is dead until the element is built.

## iOS regex compatibility — lookbehinds not audited

`TaskParser.ts` contains multiple complex static regexes. These have
not been audited for lookbehind assertions (`(?<=...)`, `(?<!...)`),
which are unsupported on iOS Safari < 16.4. A scan is needed before
the plugin is marked mobile-compatible.
