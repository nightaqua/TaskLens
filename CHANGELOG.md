# Changelog

All notable changes to TaskLens are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.2.1]

### Bug fixes

- **Recurring task icon now shows on import.** Tasks written with the Tasks
  plugin's `🔁`/`🔄` emoji recurrence notation are now recognised by the parser
  — `isRecurring` is set correctly and the chip appears without needing a
  completion cycle first.

- **Timeline in dashboard no longer respects list filter.** The timeline widget
  was passing the filtered task set to `TimelineComponent`, so tasks outside the
  active status filter (e.g. upcoming tasks while viewing "Overdue") were
  invisible. It now always uses the full unfiltered task set, matching the
  behaviour of the standalone Timeline view.

- **Date parsing accepts dd-mm-yyyy.** All date fields (`due::`, `start::`,
  `completion::`, 📅 emoji) now accept both `yyyy-mm-dd` and `dd-mm-yyyy`.
  Dates are parsed as local midnight (`T00:00:00`) to prevent off-by-one-day
  errors in UTC-west timezones.

- **Completion stamp format corrected.** Completion timestamps are now written
  as `dd-mm-yyyy HH:mm` to match the display format. Existing `yyyy-mm-dd`
  stamps in files are still read correctly.

### Improvements

- **×N badge now counts completed cycles.** The recurring task chip shows `×N`
  based on `doneCount` (how many clones of this series are already completed)
  rather than `openCount` (how many are still open). The badge only appears
  once at least one cycle has been done.

- **Date display changed to dd-mm-yyyy** across the list view chip and timeline
  tooltip.

- **ESLint clean.** Fixed two `restrict-template-expressions` warnings from
  bare `number` variables in `formatDisplayDate` and `formatCompletionDate`.

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