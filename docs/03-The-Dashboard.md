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

* **Statistics Cards:** Provides an overview of total tasks, completed, overdue, upcoming, and course counts at a glance.
* **Timeline View:** A grid where tasks dynamically span multiple days. It features a sticky month header, vertical month dividers, hover tooltips, and click-to-open behavior.
* **Task List:** Render task list with edit/delete/toggle functionality. Clicking a task title now opens the source file natively.

---
