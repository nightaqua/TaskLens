# Troubleshooting

If things aren't working quite right, check this guide for solutions to the most common issues.

## ❌ My tasks aren't showing up

If your dashboard is empty, check these common culprits:

1. **Check the Task Format:** TaskLens looks for standard markdown tasks with inline fields.
* **Correct:** `- [ ] Finish essay [due:: 2024-05-20]`
* **Incorrect:** `Finish essay due: 2024-05-20` *(Missing dash, checkbox, or brackets)*


2. **Check the Date Format:** The parser supports `YYYY-MM-DD` and `DD-MM-YYYY` formats. Ensure you aren't using formats like `03/05/2024` or `March 5th`.
3. **Check "Scan Folders":** Go to **Settings > TaskLens**.
* If "Scan Folders" is empty, it scans your whole vault.
* If you added specific folders (e.g., "Uni"), make sure your tasks are actually saved inside those folders!



## 📅 The Timeline is empty or shows "No dated tasks"

The timeline only shows tasks that have valid dates.

* Ensure you are using `[due:: YYYY-MM-DD]` or `[start:: YYYY-MM-DD]`.
* Check if your tasks are already marked **Completed**. By default, the timeline might focus on active tasks. Check your filter settings in the Dashboard Widget.
* Click the **Refresh (Sync)** button in the dashboard header to force a re-scan of your vault.

## 🔒 I can't move or resize the widgets

By default, TaskLens locks the layout to look and feel like an app.

To rearrange your workspace:

1. Look at the **Left Ribbon** in Obsidian and click the **"Move" icon** to toggle the Dashboard Layout.
2. You will see standard Obsidian tab headers appear. You can now drag, split, and resize windows.
3. Click the icon again to lock your new layout.

## 🎨 Layout and Visual Issues

### The layout looks broken or colors are weird

This is usually a **Theme Conflict**. Some custom Obsidian themes apply heavy styling to headers.

* **Fix:** Go to **Settings > TaskLens** and try changing the **Color Scheme** to "Custom" to override your theme's default colors.

### Metadata is showing in my task title

If your task looks like: `Buy Milk [due:: 2024-05-20]`, but you want the date hidden: TaskLens attempts to clean up the title automatically. If it fails, ensure you are using the exact format defined in your settings (Default: `due::` inside brackets).

## 🐌 Performance is slow

If you have a massive vault (10,000+ files):

1. Go to **Settings**.
2. Add specific folders to **"Scan Folders"** (e.g., just your active projects or current semester).
3. This prevents TaskLens from reading your Archive or Journal folders unnecessarily.

---
