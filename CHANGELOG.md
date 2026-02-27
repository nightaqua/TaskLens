# Changelog

All notable changes to this project will be documented in this file.

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