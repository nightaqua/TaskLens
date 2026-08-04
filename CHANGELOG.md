# Changelog

All notable changes to TaskLens are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.4.0]

### New features

- **ICS calendar feed export.** TaskLens can now export tasks as a standard `.ics` calendar feed, letting due dates show up in any calendar app that supports ICS subscriptions (FA-008).
- **Quick Add natural language parsing.** The Quick Add modal now parses natural language dates and phrasing (e.g. "next Friday", "in 3 days") directly in the title field instead of requiring the structured date pickers (FA-003).
- **Collapsible group headers in task list.** Task list groups (by status, topic, etc.) can now be collapsed and expanded individually, with state persisted across sessions (FA-006).
- **Inline tag/project filters on board view.** The Kanban board view now has inline filter controls for tags and projects, matching the filtering already available in the task list (FA-007).
- **Ribbon menu additions.** The ribbon menu now includes entries to open the Timeline, Task List, and Statistics views directly, alongside the existing Dashboard entry.

### Bug fixes

- **`processManualUpdate` scope guard.** Manual edits outside TaskLens's managed metadata no longer trigger unintended automation side effects; the update handler now checks that the edit falls within its expected scope before acting (FA-010).
- **Quick Add out-of-scope notice.** The Quick Add modal now surfaces a notice when a typed task falls outside the currently configured scan paths, instead of silently creating a task that will never be picked up (FA-011).
- **Confirmation modal for destructive actions.** Deleting a task now prompts for confirmation before writing the change back to the source file (FA-001).
- **Settings page `display()` fallback restored.** Reintroduced a fallback path for `display()` so the settings tab renders correctly on pre-1.13 desktop Obsidian builds.
- **Right-sidebar titlebar offset fix.** Section toggles in the right sidebar no longer overlap with Obsidian's window control buttons (CQ-009).

### Code quality & accessibility

- CSS variable deduplication across `styles.css`.
- Type guard renames for clarity and consistency with the rest of the codebase.
- Additional accessibility improvements across settings and modals.
- `eslint-plugin-obsidianmd` integrated into the lint pipeline for Obsidian API compliance checks.

### Dependencies

- Multiple Dependabot dependency updates.

---

## [1.3.2]

### Fixes & compliance

- **CSS `!important` cleanup.** Removed ~33 redundant `!important` declarations from `styles.css`. Selectors already win by specificity or source order; the seven remaining instances (Obsidian chrome `display: none` overrides) are intentional and unchanged.
- **Duplicate padding rule removed.** A second `.tasklens-dashboard-content { padding: 12px }` block that conflicted with the first was eliminated; the canonical value is now `12px` in a single rule.
- **License metadata corrected.** `package.json` now uses the proper SPDX identifier `PolyForm-Noncommercial-1.0.0`.
- **Release notes.** The GitHub release workflow now extracts the relevant CHANGELOG section and includes it as the release body.
- **README typo fixed.** "by each widget to your liking" → "by customizing each widget to your liking".

---

## [1.3.1]

### Fixes & compliance

- **Inline styles removed.** All remaining `el.style.*` mutations replaced with CSS classes and custom properties — required for Obsidian community plugin review.
- **minAppVersion bumped to 1.13.0.** Required to use the `setDestructive()` menu API introduced in that release.
- **License restored.** PolyForm Noncommercial 1.0.0 license file was inadvertently overwritten; restored to correct text.
- **Duplicate CSS focus rule removed.** A stray duplicate `.tasklens-input:focus` rule in `styles.css` was eliminated.
- **ESLint sentence-case fixes.** UI-facing strings now consistently use sentence case throughout all views and modals, satisfying the `obsidianmd/prefer-sentence-case` lint rule.

### Dependencies

- `@types/node` `25.0` → `25.9`
- `esbuild` `0.28.0` → latest patch
- `eslint` `10.2` → `10.5`
- `@typescript-eslint` `8.58` → `8.61`
- `vitest` `4.1.2` → `4.1.9`
- `typescript` `5.x` → `6.0`

---

## [1.3.0]

### New features

- **Kanban board view.** A new Board widget groups tasks by status (Active, Upcoming, Urgent, Overdue, Completed) in a drag-friendly column layout. Enable it via **Settings → Show board view**. Dragging a card between columns writes the corresponding date change back to the source Markdown file.
- **Task notes in list view.** Tasks with `[notes:: ...]` metadata now display their notes below the meta row in the task list. The CSS stub was already present; the DOM element is now built.
- **Task action buttons.** Edit (pencil) and delete (trash) buttons now appear on hover for each task in the list view. Hidden by default — enable via **Settings → Appearance → Show task action buttons**.
- **Edit modal.** The edit button opens `QuickAddModal` in edit mode, pre-populated with the task's existing title, due date, start date, and recurrence.
- **Start date field in Quick Add.** The Quick Add / Edit modal now includes a start date picker alongside the existing due date field.
- **Recurrence dropdown.** The recurrence input in Quick Add is now a structured dropdown (daily, weekly, biweekly, monthly, quarterly, yearly) instead of a free-text field.
- **7-day velocity histogram.** `getStatistics()` now returns a `velocity7Days` array with daily completion counts for the past seven days, ready for charting.
- **Topic urgency analysis.** Statistics now expose `mostUrgentTopic` — the course or folder with the highest ratio of urgent-to-total tasks — surfaced in the Stats widget.

### Bug fixes

- **Stats boxes now respect topic filter.** The statistics cards in the Dashboard correctly update when a topic filter is applied, rather than always showing all-task counts.
- **Stat box highlight colors restored.** The "Upcoming" stat box was using class `stat-upcoming` which had no CSS rule; corrected to `stat-active`. The "Total" box was referencing an undefined `--color-purple` variable; corrected to `var(--interactive-accent)`.
- **Custom metadata keys now respected.** Plugin settings allow changing `start::` and `due::` to custom key names. These were previously ignored — `TaskParser.ts` regexes and all write paths in `TaskManager.ts` and `QuickAddModal.ts` now use the configured values dynamically.
- **StatsView color theme.** The standalone Stats view now applies the same color-theme CSS variables as the Dashboard, so stat box borders and highlights are visually consistent.
- **Date timezone off-by-one.** `QuickAddModal` was constructing dates as `new Date(isoString)` which parsed as UTC midnight and shifted the displayed day by ±1 in non-UTC timezones. Fixed to `new Date('YYYY-MM-DDT00:00:00')`.

### Accessibility

- `title` attributes added to every icon-only button across all components (Timeline, Board, Header, Task list, Dashboard) so native browser tooltips describe each button on hover.
- `aria-label: 'Edit dashboard title'` added to the inline title-editing input in the header.
- `aria-expanded` and `aria-controls` on collapsible sidebar/timeline menus (PR #54).
- Filter dropdowns linked to their labels via `for`/`id` attributes (PR #60).
- Quick Add modal supports Enter key submission from any field (PR #62).

### Performance

- Statistics, grouped task lists, and scanned file paths are now cached and invalidated lazily. Repeated calls to `getStatistics()` and `getAllGroupedTasks()` within a single render cycle hit the cache instead of reprocessing the full task list.

### Dependencies

- esbuild `0.27` → `0.28`
- eslint `10.0` → `10.2`
- @typescript-eslint `8.57` → `8.58`
- vitest `4.1.0` → `4.1.2`
- Added `jsdom` for Vitest DOM test support.

---

## [1.2.2]

### Bug fixes

- **Restored dynamic recurring urgency logic.** Recurring tasks no longer bypass chronological filters to become unconditionally 'Urgent' immediately upon parsing. Tasks natively slide from Upcoming -> Urgent -> Overdue based on their parsed distance from `dueDate`, regardless of sequence.
- **Improved data integrity in `updateTask()`.** Modifying a task title via the UI now surgically replaces only the title text, preserving all other metadata like `start::`, `repeat::`, and completion stamps.
- **Fixed memory leak inside `DashboardView.ts` and `TimelineView.ts`.** Event hooks bound to `tasks-updated` and timeline tooltips appended to the document body are now properly cleaned up on view closure.
- **Added missing `vault.modify` listeners to all views.** `TimelineView`, `StatsView`, and `TaskListView` now update live when tasks are edited in the Markdown editor, even when the main dashboard is closed.
- **Restored Obsidian view state persistence.** Fixed a bug where `StatsView` was dropping internal leaf state; Obsidian can now correctly remember active folder/file context for this view across restarts.
- **Added missing `npm run test` CI gate.** The GitHub Actions workflow now correctly aborts builds if any `vitest` logic checks fail.
- **Resolved floating ribbon creation promise.** Fixed an unhandled async call in `main.ts` for safer plugin initialization.

### Improvements & Optimization

- **Optimized Timeline layout performance.** Built a precomputed date lookup map for the timeline render loop, reducing layout complexity from $O(N^2)$ to $O(N)$ for visible tasks.
- **Hardened type safety and interface consistency.** Collapsed double-optional `Date | null` fields on the `Task` interface to standard `?: Date` and enforced `private readonly` on all service class dependencies.
- **Cleaned up View vs CSS class naming.** Decoupled the `CLASS_DASHBOARD_VIEW` CSS constant from the Obsidian view identifier to prevent latent collision bugs.
- **Removed `TaskSortBy` definitions.** Stripped dead code algorithms targeting obsolete sorting states to lean down memory footprints.
- **Eliminated repetitive regex allocations.** Parser regexes have been moved to static class properties, significantly reducing garbage collection pressure during vault scans.

---

## [1.2.1]

### Bug fixes

- **Completion stamp now overwrites stale format.** If a task already had a
  `completion:: yyyy-mm-dd` stamp (written before the format change in 1.2.0),
  checking it again would silently do nothing — `addCompletionMetadata` bailed
  out the moment it saw any existing completion marker. It now strips the stale
  stamp first and writes a fresh `dd-mm-yyyy HH:mm` one. Existing stamps from
  other plugins (e.g. Tasks `✅`) are handled the same way.

- **Dashboard timeline now respects the Show filter.** An earlier fix
  incorrectly switched the dashboard timeline from `getGroupedFilteredTasks()`
  to `getAllGroupedTasks()` to work around what looked like a filter problem,
  but was actually a UTC date-parsing bug (fixed in the same session). The
  revert restores the intended behaviour: Active/All/Completed in the Show
  dropdown filters both the list and the timeline together.

- **Recurring icon now shows for Tasks-plugin emoji recurrence.** Tasks written
  with `🔁`/`🔄` (Tasks-plugin format) now populate `task.recurrence` so the
  chip appears without requiring a TaskLens completion cycle first.

- **Date parsing accepts dd-mm-yyyy.** All date fields accept both `yyyy-mm-dd`
  and `dd-mm-yyyy`. Dates are parsed as local midnight to prevent off-by-one-day
  errors in non-UTC timezones.

- **Completion timestamps written as dd-mm-yyyy HH:mm** to match the display
  format. Existing `yyyy-mm-dd` stamps still parse correctly.

### Improvements

- **×N badge counts completed cycles** (`doneCount`) rather than open backlog
  (`openCount`). Badge only appears once at least one cycle has been done.

- **Date display changed to dd-mm-yyyy** across the list view chip and timeline
  tooltip.

- **Timeline nav buttons more visible.** `.vp-jump`, `.ribbon-handle`, and
  `.chip` now have a border, tinted background, and accent colour at rest (CSS
  patch — add `styles-patch.css` contents to `styles.css`).

- **Right-panel overlap fix.** When docked in the right split, Obsidian's window
  control buttons no longer cover the section toggles (CSS patch).

---

## [1.2.0]

### Bug fixes

- **Checkmark flicker eliminated.** Checking a task directly in the editor no
  longer reverts to unchecked after ~2 seconds. The `isInternalChange` lock is
  now set before the first async read so no concurrent `modify` event can
  interleave mid-write.

- **Uncheck now correctly clears completion metadata.** Unchecking a task that
  had been stamped with `[completion:: ...]` previously left the metadata on the
  line. On re-check, TaskLens would see the existing stamp and silently skip
  writing a new one. Both transitions (`[ ]→[x]` and `[x]→[ ]`) are now handled
  correctly.

- **Automation works in focus mode.** When focus mode was active on startup, no
  TaskLens views were open, so `this.tasks` was never populated. Any manual
  checkbox change was silently ignored because the transition detector had no
  cached state to compare against. TaskLens now loads all tasks on startup
  regardless of what views are open.

- **Automation works for repeated transitions on the same task.** After any
  completion write, the in-memory task cache is now refreshed immediately so the
  next transition on the same line is always detectable.

- **Restored missing "Upcoming" stats card.** The dashboard was rendering 4 of
  5 statistics cards; the `Upcoming` card was lost in a refactor.

- **Monthly/yearly recurrence date overflow fixed.** Adding one month to
  January 31 was producing March 3 instead of February 28.

- **`saveSettings` no longer triggers a full vault rescan.** Previously, every
  settings write called `loadTasks()`, causing all open views to re-render on
  startup and on every settings change. Settings that affect task parsing (scan
  paths, recursive scan, key names) now call `loadTasks()` explicitly; all other
  settings do not.

### Improvements

- **Recurring tasks no longer flood views.** Open clones of the same recurring
  task are collapsed into one row in the list view and one bar on the timeline.
  A ×N badge appears when more than one copy is pending. Statistics are
  group-based — 8 copies of "Weekly reading" count as 1 task in the totals.

- **Plugin compatibility (Tasks + Dataview).** The new `TaskSanitizer` module
  detects completion and recurrence metadata written by the Tasks plugin
  (`✅ YYYY-MM-DD`, `🔁`, `🏁`) and Dataview inline fields
  (`[completion:: ...]`, `(completion:: ...)`) before writing, preventing
  double-stamping when multiple task plugins are active in the same vault.

- **Per-view "Completed" stat format.** The completion count stat can now be
  toggled between "All-time" and "Today" independently on each dashboard widget
  via the controls panel. It was previously a single global setting. The choice
  persists across Obsidian restarts via workspace layout state.

- **Settings tab remembers which sections were open.** The accordion sections
  (Vault scanning, Task parsing & automation, Appearance & colors) now save
  their open/closed state and restore it the next time you open settings.

- **Startup chrome flash reduced.** TaskLens views now hide their tab headers
  and view chrome via CSS `data-type` selectors that Obsidian applies
  synchronously before the first paint, eliminating the brief flash of native
  chrome on startup.

### Code quality

- `TaskSanitizer` functions (`hasCompletionMetadata`, `hasRecurrenceMetadata`,
  `stripCompletionMetadata`) now cover both TaskLens/Dataview inline-field
  format and Tasks-plugin emoji format throughout all write paths.
- `setupViewDOM` now returns `{ leafRootEl: HTMLElement | null; tabContainer:
  HTMLElement | null }` with an explicit return type; `instanceof` checks are
  performed inside the function, removing duplication from all callers.
- `getFilteredTasks()` removed — all callers were migrated to
  `getGroupedFilteredTasks()` when `TaskGroup` was introduced.
- Per-file cache refresh (`refreshFileTask`) replaces a full vault `loadTasks()`
  in `processManualUpdate`'s no-transition path — avoids an O(vault) rescan on
  every plain-text markdown save.
- `private readonly` applied to all constructor-injected properties throughout.

---

## [1.1.0]
### Added
- **Focus Mode:** Added native workspace layout saving. Instantly hide all widgets/sidebars to write, and restore them flawlessly.
- **Smart Topic Colors:** Tasks can now be dynamically color-coded based on their source file/topic via a customizable palette in settings.
- **Unified Ribbon Menu:** Replaced scattered ribbon buttons with a single, sleek native context menu.
- **Task Spanning:** Timeline bars now accurately stretch across multiple days from `startDate` to `dueDate`.
- **Advanced Date Parsing:** The parser now supports both `YYYY-MM-DD` and `DD-MM-YYYY` formats, handles shared brackets, and strips empty brackets.

### Changed
- Dashboard spawning is now "smart" and will split the view instead of overwriting the user's active note.
- Checkboxes and task titles now use responsive CSS Container Queries to wrap cleanly in narrow sidebars (borderless mode).
- Removed redundant inline edit/delete buttons; clicking a task title now opens the source file natively.

## [1.0.0] - Initial Release
- Widget-based dashboard (Timeline, Task List, Stats).
- Chromeless mode with layout lock.
- Quick Add modal.