# Semester Dashboard Plugin for Obsidian

A native Obsidian plugin that provides a comprehensive dashboard for managing university courses and task deadlines. Built to replace fragile Dataview-based solutions with a proper, maintainable UI.

## Features

- **Native Obsidian View**: Opens as a proper pane, not embedded markdown
- **Automatic Task Parsing**: Reads standard markdown tasks with optional metadata
- **Flexible Filtering**: Filter by status (overdue, upcoming, completed) and course
- **Smart Sorting**: Sort by due date, start date, or course name
- **Live Updates**: Automatically refreshes when files change
- **Click-to-Navigate**: Click any task to open the source note at the exact line
- **Statistics Dashboard**: See totals, overdue, upcoming, and completed tasks at a glance
- **Configurable**: Extensive settings for scanning, course detection, and UI preferences

## Installation

### Prerequisites

- Node.js 16 or higher
- npm (comes with Node.js)
- Obsidian 0.15.0 or higher

### Quick Install

1. **Download or clone** this repository
2. **Navigate to the plugin directory**:
   ```bash
   cd semester-dashboard
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Build the plugin**:
   ```bash
   npm run build
   ```
   
   Or use the verification script:
   - **Windows**: Double-click `verify-build.bat`
   - **Mac/Linux**: Run `./verify-build.sh`

5. **Copy to Obsidian**:
   Copy the entire `semester-dashboard` folder to:
   ```
   YourVault/.obsidian/plugins/semester-dashboard/
   ```

6. **Enable in Obsidian**:
   - Settings → Community Plugins → Reload
   - Enable "Semester Dashboard"

### Manual Installation

1. Copy the plugin files to your vault's `.obsidian/plugins/semester-dashboard/` directory
2. Reload Obsidian
3. Enable "Semester Dashboard" in Settings → Community Plugins

### Development

```bash
# Install dependencies
npm install

# Start development build (watches for changes)
npm run dev

# Production build
npm run build
```

## Usage

### Basic Task Format

Tasks are standard markdown tasks with optional inline metadata:

```markdown
- [ ] Complete assignment due:: 2024-03-15
- [ ] Start project start:: 2024-03-01 due:: 2024-03-20
- [x] Review lecture notes due:: 2024-03-10
```

### Supported Metadata

- `start:: YYYY-MM-DD` - Task start date (optional)
- `due:: YYYY-MM-DD` - Task due date (optional)
- Alternative emoji format also supported: `📅 YYYY-MM-DD`

### Opening the Dashboard

1. **Command Palette**: `Ctrl/Cmd + P` → "Open Semester Dashboard"
2. **Ribbon Icon**: Click the calendar-check icon in the left sidebar
3. **Hotkey**: Assign a custom hotkey in Settings → Hotkeys

### Dashboard Features

**Statistics Cards**: Overview of total tasks, completed, overdue, upcoming, and course count

**Filters**:
- Status: All, Open, Completed, Overdue, Upcoming (7 days), No Due Date
- Course: Filter by specific course/file
- Sort: By due date, start date, or course name

**Task Interactions**:
- Click task title to open the source note at that task
- Click checkbox to toggle completion (updates the file directly)

## Architecture

The plugin follows a clean separation of concerns:

```
semester-dashboard/
├── main.ts                      # Plugin entry point
├── models/
│   └── Task.ts                  # Data models and enums
├── services/
│   ├── TaskParser.ts            # Parse tasks from vault
│   └── TaskManager.ts           # State management & filtering
├── views/
│   └── DashboardView.ts         # Main UI rendering
├── settings/
│   ├── Settings.ts              # Settings model
│   └── SettingsTab.ts           # Settings UI
└── styles.css                   # Dashboard styles
```

### Data Flow

1. **TaskParser** scans configured folders and extracts tasks from markdown files
2. **TaskManager** maintains state, applies filters, and emits update events
3. **DashboardView** subscribes to updates and renders the UI
4. File modifications trigger automatic refresh via Obsidian's vault events

### Key Design Decisions

- **No Dataview Dependency**: Uses Obsidian's native MetadataCache and file APIs
- **Event-Driven Updates**: TaskManager uses event emitter pattern for reactive UI
- **Stateless Parsing**: Task parsing is pure and repeatable
- **Extensible Settings**: Settings structure designed for future additions
- **Vault Integration**: Respects Obsidian's file structure and modification APIs

## Configuration

### Vault Scanning

- **Scan Folders**: Specify which folders to scan (empty = scan entire vault)
- **Scan Recursively**: Whether to include subfolders

### Course Detection

Three methods to identify which course a task belongs to:

1. **Per File**: Use the file name as the course name
2. **Per Folder**: Use the parent folder name
3. **Frontmatter**: Read from a frontmatter property (e.g., `course: CS101`)

### Task Behavior

- Allow tasks without due dates
- Show completed tasks by default
- Default sort order

### UI Preferences

- **UI Density**: Compact, Comfortable, or Spacious
- **Color Scheme**: Inherit from Obsidian theme or use custom colors
- **Custom Colors**: Set specific colors for overdue, upcoming, and completed tasks

## Future Extensions

The architecture is designed to support:

- **Timeline View**: Gantt-style visualization using start → due dates
- **Calendar View**: Month/week calendar layout
- **Course Colors**: Per-course color coding
- **Semester Switching**: Support multiple semesters with date ranges
- **Advanced Filters**: Priority levels, tags, custom metadata
- **Statistics Tracking**: Historical completion rates
- **Export**: Export tasks to various formats

## Technical Details

### Task Metadata Parsing

The parser uses regex to extract inline metadata:
- Matches `start:: YYYY-MM-DD` and `due:: YYYY-MM-DD`
- Cleans metadata from displayed title
- Also supports emoji format `📅 YYYY-MM-DD`

### Status Determination

Tasks are categorized as:
- **Overdue**: Due date is in the past and not completed
- **Upcoming**: Due within next 7 days
- **Completed**: Checkbox is marked [x]
- **No Date**: No due date specified
- **Open**: All other open tasks

### Performance

- Lazy loading: Tasks only parsed when dashboard opens
- Incremental updates: Only re-parses modified files
- Efficient filtering: In-memory operations on parsed data
- Works with large vaults (1000+ files tested)

## Contributing

Contributions are welcome! Key areas for improvement:

- Timeline/Gantt visualization
- Calendar integration
- Advanced filtering UI
- Performance optimizations
- Mobile-specific UI improvements

## Troubleshooting

Having issues? Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for solutions to common problems including:
- Build errors
- Tasks not appearing
- Dashboard won't open
- Performance issues
- Date parsing problems

## License

MIT

## Support

For issues, feature requests, or questions, please open an issue on GitHub.

---

**Note**: This plugin reads from but does not modify your vault structure. It only modifies individual task checkboxes when you toggle completion in the dashboard.
