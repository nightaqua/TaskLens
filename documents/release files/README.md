# TaskLens for Obsidian

TaskLens is a native, widget-based dashboard that turns Obsidian into a task command center. Visualize deadlines, manage tasks, and track progress without leaving your vault.

## Key Features

- Widget system: Timeline, Task List, and Stats widgets can be arranged in your workspace.
- Timeline: Month header row, hover tooltips, and click-to-open behavior.
- Task list: Inline edit/delete/toggle with quick add in the header.
- Stats: Clickable cards that apply status filters.
- Chromeless mode: Hide Obsidian chrome for a focused layout.

## Installation

### Prerequisites
- Node.js 16 or higher
- Obsidian 0.15.0 or higher

### Build and Install
1. npm install
2. npm run build
3. Copy these files into your vault:
   - main.js
   - manifest.json
   - styles.css

Folder:
YourVault/.obsidian/plugins/tasklens/

## Task Format

Tasks are standard markdown checkboxes with optional inline dates:

- [ ] Task title due:: 2024-03-15
- [ ] Task title start:: 2024-03-10 due:: 2024-03-20

## Usage

- Open the dashboard: Command palette -> Open Dashboard (All-in-One)
- Quick add: Plus button in the Task List header or Quick Add Task command
- Click task title or timeline bar to open the source file
- Click stats cards to filter by status

## Troubleshooting

See documents/internal doc/TROUBLESHOOTING.md for common fixes.
