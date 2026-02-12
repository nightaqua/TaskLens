# Quick Start Guide

## Installation

1. **Copy files** to your vault:
   ```
   YourVault/.obsidian/plugins/semester-dashboard/
   ```

2. **Install dependencies** (for development):
   ```bash
   cd semester-dashboard
   npm cache clean --force
   npm audit
   npm install
   ```

3. **Build the plugin**:
   ```bash
   npm run build
   ```

4. **Enable in Obsidian**:
   - Settings → Community Plugins
   - Reload plugins
   - Enable "Semester Dashboard"

## First Use

### 1. Prepare Your Notes

Add tasks to your course notes with optional dates:

```markdown
# My Course

- [ ] Assignment 1 due:: 2024-03-15
- [ ] Project proposal start:: 2024-03-01 due:: 2024-03-10
- [x] Read chapter 1 due:: 2024-02-28
```

### 2. Configure Settings

Open Settings → Semester Dashboard:

- **Scan folders**: Leave empty for entire vault, or specify folders like `Uni/Spring2024`
- **Course detection**: Choose how to identify courses:
  - "Per File" → Use file name (e.g., CS101.md → CS101)
  - "Per Folder" → Use parent folder (e.g., Uni/CS101/notes.md → CS101)
  - "Frontmatter" → Read from YAML (e.g., `course: CS101`)

### 3. Open Dashboard

Three ways to open:
1. **Command**: `Ctrl/Cmd + P` → "Open Semester Dashboard"
2. **Ribbon**: Click calendar-check icon
3. **Hotkey**: Set custom hotkey in Settings

## Dashboard Overview

```
┌─────────────────────────────────────────┐
│ Semester Dashboard           [Refresh]  │
├─────────────────────────────────────────┤
│ Status: All ▾  Course: All ▾  Sort: Due▾│
├─────────────────────────────────────────┤
│ [15]     [12]      [3]       [5]    [4] │
│ Total  Complete  Overdue  Upcoming Courses│
├─────────────────────────────────────────┤
│ ☐ Assignment 1                          │
│   CS101 | Due: 2024-03-15               │
│                                          │
│ ☐ Project proposal                      │
│   Math201 | Start: 2024-03-01           │
│           | Due: 2024-03-10             │
│                                          │
│ ☑ Read chapter 1                        │
│   CS101 | Due: 2024-02-28               │
└─────────────────────────────────────────┘
```

## Common Tasks

### View Only Overdue Tasks
1. Status filter → "Overdue"
2. See red-highlighted tasks

### Focus on One Course
1. Course filter → Select course
2. Dashboard shows only that course's tasks

### Mark Task Complete
1. Click checkbox in dashboard
2. File is automatically updated
3. Task moves to "Completed" status

### Jump to Task in Note
1. Click task title
2. Note opens at exact line
3. Edit task directly in note

### Weekly Planning
1. Status filter → "Upcoming (7 days)"
2. See what's due this week
3. Sort by due date for priority order

## Customization

### UI Density

Settings → UI density:
- **Compact**: Minimal spacing, fits more tasks
- **Comfortable**: Balanced (default)
- **Spacious**: Generous spacing, easier to read

### Color Scheme

Settings → Color scheme:
- **Inherit**: Use Obsidian theme colors
- **Custom**: Define specific colors for statuses

## Tips

1. **Start Simple**: Begin with just `due::` dates
2. **Add Start Dates**: Use `start::` for long-running tasks
3. **Use Folders**: Organize by semester for easy filtering
4. **Refresh Manually**: Click refresh if tasks seem out of sync
5. **Frontmatter**: Add metadata for advanced organization

## Troubleshooting

### Tasks not appearing?
- Check Settings → Scan folders matches your vault structure
- Verify task format: `- [ ]` with space
- Date format must be `YYYY-MM-DD`

### Dashboard won't open?
- Check plugin is enabled in Settings
- Try reloading Obsidian
- Check developer console for errors

### Tasks not updating?
- Click refresh button
- Close and reopen dashboard
- Check file was actually saved

### Performance issues?
- Limit scan folders to relevant directories
- Disable "Show completed by default"
- Consider archiving old semester files

## Next Steps

- Read [ARCHITECTURE.md](ARCHITECTURE.md) for technical details
- See [EXAMPLES.md](EXAMPLES.md) for more complex setups
- Check [README.md](README.md) for full feature list

## Need Help?

Open an issue on GitHub with:
- Obsidian version
- Plugin version
- Description of issue
- Example task that's not working
