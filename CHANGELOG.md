# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - Upcoming (In Progress)
### Added
- **Clone & Bump Recurrence:** Implemented "Tasks-style" recurring logic. Tasks with `[repeat:: daily/weekly/Nd]` now automatically clone themselves to the next interval when completed.
- **Completion Timestamps:** Added automatic metadata stamping for completed tasks: `[completion:: YYYY-MM-DD HH:mm]`.
- **App-Wide Automation:** Recurrence and date stamping now trigger even when tasks are checked directly in the Markdown editor, not just via the Dashboard.
- **Smart Urgency:** All incomplete recurring tasks are now automatically treated as "Urgent" to ensure they stay visible in the daily flow.
- **Flexible Stats:** Added a toggle to switch the "Completed" stats box between all-time totals and "Done Today" productivity metrics.

### Changed
- Stats component now supports a 5-card layout to include Active, Urgent, Overdue, and Completion metrics simultaneously.
- Refactored task status logic to prioritize recurrence over standard due dates.

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