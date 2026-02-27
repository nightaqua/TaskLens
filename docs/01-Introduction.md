# Introduction to TaskLens

Welcome to TaskLens! TaskLens is a native, widget-based dashboard that turns Obsidian into a powerful task command center.

If you have ever felt overwhelmed by managing scattered tasks across daily notes, project files, and class folders, TaskLens is built for you. It was designed to replace fragile Dataview-based solutions with a proper, maintainable UI, allowing you to visualize deadlines and track progress without leaving your vault or changing how you write.

## Core Philosophy

1. **Native Feel:** TaskLens uses a custom UI environment to feel like a native app inside Obsidian. Custom CSS and DOM manipulation hide standard Obsidian chrome for a focused, app-like layout.
2. **Zero Friction:** You don't need to learn a query language. Just write standard markdown tasks (`- [ ]`) and add simple text tags like `due:: 2024-05-20`.
3. **Your Data is Yours:** TaskLens reads from but does not modify your vault structure. It only modifies individual task checkboxes when you toggle completion directly in the dashboard.

## Installation (github only for now)

You can install TaskLens manually from GitHub:

1. Go to the Releases page of the TaskLens repository.
2. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
3. Place them in your vault's plugins folder: `YourVault/.obsidian/plugins/obsidian-tasklens/`.
4. Restart Obsidian and enable "TaskLens" in Community Plugins.

When you first run the plugin, a Welcome tour will appear to guide you through the basics.

---

