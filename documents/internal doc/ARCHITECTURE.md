# TaskLens - Architecture Documentation

## Overview

TaskLens is a widget-based task management plugin for Obsidian. It uses a modular view architecture where multiple specialized views share a single state manager.

## Core Principles

1. Shared State: All views (DashboardView, TimelineView, TaskListView, StatsView) subscribe to a singleton TaskManager.
2. Component-Based UI: Reusable components (HeaderComponent, TimelineComponent, TaskListComponent) keep behavior consistent across widgets.
3. Chromeless UX: Custom CSS and DOM manipulation hide standard Obsidian chrome for a focused, app-like layout.
4. Reactive Updates: Changes in one view trigger TaskManager events that re-render all other views.

## Component Hierarchy

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

## Detailed Component Design

### 1. TaskManager (services/TaskManager.ts)
Responsibility: Central task state and file IO.
- State: Holds the master list of Task objects.
- CRUD: addTask, updateTask, deleteTask, toggleTaskCompletion modify markdown files.
- Events: Emits tasks-updated whenever state changes.
- Filtering: Status filters use getTaskStatus for Overdue, Urgent, UpcomingWeek, Completed, etc.

### 2. HeaderComponent (views/HeaderComponent.ts)
Responsibility: Standardized widget header.
- Features: Inline title edit, collapse/expand, refresh, quick add.
- Persistence: Saves title and collapsed state per leaf via ViewState.

### 3. TaskListComponent (views/TaskListComponent.ts)
Responsibility: Render task list with edit/delete/toggle.
- Callback contract:
  - onToggle(task)
  - onEdit(task, newTitle, newDate)
  - onDelete(task)

### 4. TimelineComponent (views/TimelineComponent.ts)
Responsibility: Render timeline grid.
- Constructor: (container, app, tasks, daysToShow)
- Month Row: Dedicated row showing month spans.
- Grid: Cell borders are rendered with standard borders.
- Interactivity:
  - Hover tooltip with file and due date
  - Click opens the source file
  - Auto-centers on Today

### 5. Chromeless Mode (CSS and Logic)
Responsibility: Hide Obsidian UI chrome.
- Implementation: Adds semester-chromeless on workspace-leaf-content.
- CSS: Hides view headers and tab headers.
- Interaction: A sidebar handle can reveal the header when collapsed.

## Data Flow (Edit Task)

1. User clicks Edit in TaskListComponent.
2. TaskListComponent calls TaskManager.updateTask.
3. TaskManager writes to vault.
4. TaskManager refreshes that file.
5. TaskManager emits tasks-updated.
6. All open views re-render.

## Persistence Strategy

TaskLens uses Obsidian ViewState to save widget configuration:
- Title
- Collapsed state
- Filter settings
- Timeline zoom days

Stored in .obsidian/workspace.json so each widget remembers its own state.
