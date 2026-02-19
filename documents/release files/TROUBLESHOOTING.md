# Troubleshooting Guide

## Common Issues

### ❌ My tasks aren't showing up
If your dashboard is empty, check these common culprits:

1.  **Check the Task Format:**
    TaskLens looks for standard markdown tasks with inline fields.
    * **Correct:** `- [ ] Finish essay [due:: 2024-05-20]`
    * **Incorrect:** `Finish essay due: 2024-05-20` (Missing dash/checkbox/brackets)
2.  **Check the Date Format:**
    The date must be `YYYY-MM-DD`.
    * **Correct:** `2024-03-05`
    * **Incorrect:** `03/05/2024` or `March 5th`
3.  **Check "Scan Folders":**
    Go to **Settings > TaskLens**.
    * If "Scan Folders" is empty, it scans your whole vault.
    * If you added folders (e.g., "Uni"), make sure your tasks are actually inside those folders!

### 🔒 I can't move or resize the widgets
By default, TaskLens locks the layout to look like an app.
1.  Look at the **Left Ribbon** in Obsidian.
2.  Click the **"Move" icon** (Toggle Dashboard Layout).
3.  You will see tab headers appear. You can now drag, split, and resize windows.
4.  Click the icon again to lock your new layout.

### 📅 The Timeline is empty or shows "No dated tasks"
The timeline only shows tasks that have valid dates.
1.  Ensure you are using `[due:: YYYY-MM-DD]` or `[start:: YYYY-MM-DD]`.
2.  Check if your tasks are **Completed**. By default, the timeline might focus on active tasks. Check your filter settings in the Dashboard Widget.
3.  Click the **Refresh (Sync)** button in the dashboard header to force a re-scan.

### 🎨 The layout looks broken / Colors are weird
1.  **Theme Conflict:** Some custom Obsidian themes apply heavy styling to headers.
2.  **Fix:** Go to **Settings > TaskLens** and try changing the **Color Scheme** to "Custom" to override theme colors.
3.  **Chromeless Mode:** If headers are disappearing when you don't want them to, hover over the top-left edge of the widget to find the hidden "Show Header" handle.

### ➕ The "Quick Add" button is missing
The `+` button is located in the **Task List** widget header.
* If you don't see the Task List widget, open it via command: `Open Task List`.
* Alternatively, use the command palette (`Ctrl/Cmd + P`) and search for `Quick Add Task`.

## Advanced

### 📝 Metadata is showing in my task title
If your task looks like: `Buy Milk [due:: 2024-05-20]`, but you want the date hidden:
TaskLens attempts to clean up the title automatically. If it fails, ensure you are using the exact format defined in your settings (Default: `due::` inside brackets).

### 🐌 Performance is slow
If you have a massive vault (10,000+ files):
1.  Go to **Settings**.
2.  Add specific folders to **"Scan Folders"** (e.g., just your active projects).
3.  This prevents TaskLens from reading your Archive or Journal unnecessarily.

---
**Still stuck?**
Report an issue on [GitHub](https://github.com/nightaqua/tasklens/issues) with a screenshot of your task and your settings.