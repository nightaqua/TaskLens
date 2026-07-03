# TaskLens

TaskLens is a unified, customizable workspace view combining an interactive Timeline, Task List, and Statistics. It is built to replace fragile Dataview-based solutions with a proper, maintainable UI.

## Opening the Dashboard

TaskLens operates entirely from a single, unified Ribbon Icon (the magnifying glass checkmark).

1. Click the **Magnifying Glass Checkmark** in the left sidebar.
2. The dashboard spawning is now "smart" and will split the view instead of overwriting your active note.

## Widget Layouts & Chromeless Mode

TaskLens uses a custom UI environment to feel like a native app inside Obsidian.

### Locking and Unlocking the Layout

By default, TaskLens locks the layout to look like an app. Custom CSS and DOM manipulation hide standard Obsidian chrome for a focused, app-like layout.

If you want to move or resize the widgets:

1. Click the **Move icon** in the Ribbon to unlock the layout.
2. Tab headers will appear, allowing you to drag, split, and resize windows.
3. Click the icon again to lock your new layout.

> [!warning] Hidden Headers
> If you are in Chromeless mode and need to access a widget's specific header, hover over the top-left edge of the widget to find the hidden "Show Header" handle.

## Focus Mode

Introduced in version 1.1.0, Focus Mode adds native workspace layout saving.

When you need to write without distractions, you can instantly hide all TaskLens widgets and collapse your sidebars. Once you are done writing, clicking the toggle again will restore your exact window layout perfectly.

## Dashboard Views

* **Statistics Cards:** Provides an overview of total tasks, completed, overdue, upcoming, and course counts at a glance. The cards respect the active topic filter — switch topics and the stats update instantly. The Stats widget also surfaces a 7-day completion velocity and highlights the topic with the highest proportion of urgent tasks.
* **Timeline View:** A grid where tasks dynamically span multiple days from `start::` to `due::`. Features a sticky month header, vertical month dividers, rich hover tooltips, and click-to-open behavior.
* **Board View (Kanban):** Groups tasks into status columns — Active, Upcoming, Urgent, Overdue, and Completed. Enable it via **Settings → Show board view**. Drag a card to a different column to reschedule the task; the change is written directly to the source Markdown file.
* **Task List:** Displays tasks with completion toggle, status chips, date chips, recurrence badges, and optional notes. Clicking the title opens the source file. With **Show task action buttons** enabled in Settings, each row also shows an edit (pencil) and delete (trash) button on hover.

### Task action buttons

When enabled (**Settings → Appearance → Show task action buttons**), a pencil and trash icon appear on every task row:

- **Pencil (edit):** Opens the Quick Add / Edit modal pre-populated with the task's current title, start date, due date, and recurrence. Changes are written back to the source file.
- **Trash (delete):** Removes the task line from the source file immediately.

Buttons are hidden by default to keep the UI clean for users who prefer to edit tasks directly in Markdown.

## Quick Add modal

Open the Quick Add modal from the **+** button in the Dashboard header (keyboard shortcut: configurable in Obsidian's hotkeys panel).

### Tag autocomplete

When typing in the **Task title** field, type `#` to open a tag suggestion dropdown. The dropdown searches all tags in your vault — both inline tags and frontmatter tags — and filters as you type.

**Keyboard navigation:**

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move selection up / down |
| `Enter` or `Tab` | Insert the selected tag |
| `Escape` | Dismiss the dropdown |

Mouse clicks also work. The dropdown closes automatically when you delete the `#` trigger character or move the cursor past the tag fragment.

Nested tags (`#project/feature`) and hyphenated tags (`#sub-team`) are fully supported — the suggestion stays open as you type the full path.

### Date fields

Both the **Due date** and **Start date** fields accept natural language — see [Natural language dates in Quick Add](02-Task-Formats.md#natural-language-dates-in-quick-add) for the full list of supported expressions. A 📅 calendar button on the right of each field opens the native date picker if you prefer to browse a month view.


---
