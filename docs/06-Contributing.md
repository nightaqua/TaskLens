# TaskLens Architecture

TaskLens is a widget-based task management plugin for Obsidian. It uses a modular view architecture where multiple specialized views share a single state manager.

## Core Principles

1. **Shared State:** All views (`DashboardView`, `TimelineView`, `TaskListView`, `StatsView`) subscribe to a singleton `TaskManager`.
2. **Component-Based UI:** Reusable components (`HeaderComponent`, `TimelineComponent`, `TaskListComponent`) keep behavior consistent across widgets.
3. **Chromeless UX:** Custom CSS and DOM manipulation hide standard Obsidian chrome for a focused, app-like layout.
4. **Reactive Updates:** Changes in one view trigger `TaskManager` events that re-render all other views.

## Component Hierarchy

```text
main.ts (Plugin Entry)
|-- TaskManager (Singleton State)
|   `-- TaskParser (Data Layer)
|-- Modals
|   |-- WelcomeModal.ts (First-run tour)
|   `-- QuickAddModal.ts (Task capture)
`-- Views (Widgets)
    |-- DashboardView.ts (Container/Grid)
    |-- TimelineView.ts
    |   `-- TimelineComponent.ts (Gantt/Timeline logic)
    |-- TaskListView.ts
    |   `-- TaskListComponent.ts (List logic)
    `-- StatsView.ts
        `-- StatsComponent.ts
```

*(Source: Architecture Map)*

## Detailed Component Design

### 1. TaskManager (`services/TaskManager.ts`)

The `TaskManager` is responsible for central task state and file IO.

* **State:** Holds the master list of `Task` objects.
* **CRUD Operations:** `addTask`, `updateTask`, `deleteTask`, and `toggleTaskCompletion` directly modify the underlying markdown files.
* **Events:** Emits `tasks-updated` whenever the state changes.

### 2. TimelineComponent (`views/TimelineComponent.ts`)

Responsible for rendering the interactive timeline grid.

* **Grid Rendering:** Features a dedicated month row and cell borders rendered with standard borders.
* **Interactivity:** Includes a hover tooltip showing the source file and due date, auto-centers on "Today", and opens the source file natively when a task is clicked.

### 3. Chromeless Mode (CSS and Logic)

TaskLens aims to hide Obsidian UI chrome to feel like a standalone app.

* **Implementation:** Adds the `tasklens-chromeless` class on the `workspace-leaf-content`.
* **Interaction:** Hides view headers and tab headers. A sidebar handle can reveal the header when collapsed.

## Data Flow (Example: Edit Task)

The plugin follows a clean, event-driven reactive flow:

1. User clicks Edit in `TaskListComponent`.
2. `TaskListComponent` calls `TaskManager.updateTask`.
3. `TaskManager` writes the changes securely to the vault.
4. `TaskManager` refreshes that specific file.
5. `TaskManager` emits the `tasks-updated` event.
6. All open views instantly re-render to reflect the new state.

## Persistence Strategy

TaskLens uses Obsidian's `ViewState` to save widget configurations so each widget remembers its own state. This data is stored safely in `.obsidian/workspace.json`. Saved properties include:

* Widget Title
* Collapsed state
* Filter settings
* Timeline zoom days

---

# Local Setup & Build Guide

This guide covers how to set up your local development environment for TaskLens, build the plugin from source, and avoid common TypeScript compilation errors.

## Prerequisites

Before you begin, ensure you have the following installed:

* **Node.js**: Version 16 or higher (The project types currently target Node `^20.11.5`).
* **npm**: Comes bundled with Node.js.
* **Obsidian**: Version 0.15.0 or higher.

The project dependencies are kept up-to-date to ensure stable builds, currently utilizing **TypeScript `^5.3.3**` and **esbuild `^0.19.11**`.

## Initial Setup

1. **Clone the repository** into your local workspace.
2. **Navigate to the directory**:
```bash
cd TaskLens
```


3. **Install dependencies**:
```bash
npm install
```


**

## Building the Plugin

TaskLens includes custom scripts to ensure your build environment is configured correctly.

### 1. The Verification Script (Optional)

Instead of a raw build command, it is possible to use the verification scripts. These scripts check your Node/npm versions, verify all files are present, run TypeScript validation, compile the plugin, and confirm the output files.

* **Windows**: Run `verify-build.bat`
* **Mac/Linux**: Run `./verify-build.sh` (you may need to run `chmod +x verify-build.sh` first)

> [!warning] I initially created this script to help myself with development. 
> Your windows defender may block it. I just left these here because I use it, you do *not* have to.

### 2. Manual Build Commands

If you prefer standard npm scripts:

* **Development Build**: `npm run dev` (Watches for file changes and rebuilds automatically).
* **Production Build**: `npm run build`.

### 3. Version Management

When cutting a new release, use the included `version-bump.mjs` script. This automatically syncs the version numbers between your `package.json` and Obsidian's required `manifest.json`.

## Build Output

After a successful build, the following files will be generated in your project directory:

```text
TaskLens/
├── main.js          ← Compiled plugin (created by build)
├── main.js.map      ← Source map (if dev build)
├── styles.css       ← Dashboard styles
├── manifest.json    ← Plugin metadata
└── ...
```

**

To test the plugin locally, copy `main.js`, `styles.css`, and `manifest.json` into your test vault at `YourVault/.obsidian/plugins/TaskLens/`.

---

## 🛠 Historical Build Fixes (Reference)

If you are modifying core views or the Obsidian API integration, please be aware of these previously resolved TypeScript errors to prevent regressions.

### 1. View Container Scope

* **Previous Error**: `Property 'containerEl' is private in type 'DashboardView' but not in type 'View'.`
* **The Fix**: Do not declare a duplicate `containerEl`. The `DashboardView` class must properly use the inherited `contentEl` from the Obsidian `ItemView` API.

### 2. WorkspaceLeaf Null Safety

* **Previous Error**: `Type 'WorkspaceLeaf | null' is not assignable to type 'WorkspaceLeaf'.`
* **The Fix**: Always use strict null checking when requesting leaves in `main.ts`. Use a fallback routing logic:
```typescript
const rightLeaf = workspace.getRightLeaf(false);
if (rightLeaf) {
    leaf = rightLeaf;
} else {
    // Fallback to main workspace
    leaf = workspace.getLeaf(true);
}
```


**

### 3. DOM Element Creation

* **Previous Error**: `Argument of type 'string[]' is not assignable to parameter of type 'string | DomElementInfo | undefined'.`
* **The Fix**: Obsidian's `createDiv` does not accept an array of strings for classes. Create the div explicitly and append classes afterward:
```typescript
const card = statsContainer.createDiv('stat-card');
card.addClass(stat.className);
```


**

### 4. Global Script Errors

* **Previous Error**: `'index.ts' cannot be compiled under '--isolatedModules'`
* **The Fix**: Ensure there is no global `src/index.ts` file floating in the directory, as it conflicts with the plugin's isolated module compilation.

---

