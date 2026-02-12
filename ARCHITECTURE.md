# Semester Dashboard - Architecture Documentation

## Overview

The Semester Dashboard plugin is built with a clear separation between data parsing, state management, and UI rendering. This architecture ensures maintainability, testability, and extensibility.

## Core Principles

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **Event-Driven**: Components communicate through events, not direct coupling
3. **Reactive UI**: View automatically updates when data changes
4. **Immutable Data Flow**: Data flows one direction: Parser → Manager → View
5. **Plugin Integration**: Leverages Obsidian APIs rather than fighting them

## Component Hierarchy

```
main.ts (Plugin)
    ├── Settings (Configuration)
    ├── DashboardView (UI Layer)
    │   ├── TaskManager (State Layer)
    │   │   └── TaskParser (Data Layer)
    │   └── Event Handlers
    └── SettingsTab (Settings UI)
```

## Detailed Component Design

### 1. Main Plugin (`main.ts`)

**Responsibility**: Plugin lifecycle and initialization

**Key Methods**:
- `onload()`: Register views, commands, settings
- `activateDashboardView()`: Open or reveal the dashboard
- `loadSettings()` / `saveSettings()`: Persist configuration

**Why this design**:
- Keeps entry point minimal and focused
- Delegates actual work to specialized components
- Follows Obsidian plugin patterns

### 2. Task Model (`models/Task.ts`)

**Responsibility**: Data structure and status logic

**Key Types**:
- `Task`: Core data structure with all task properties
- `TaskStatus`: Enumeration of filter categories
- `TaskSortBy`: Enumeration of sort options

**Functions**:
- `getTaskStatus(task)`: Determines task's current status
- `taskMatchesStatus(task, status)`: Filter predicate

**Why this design**:
- Centralizes task business logic
- Makes status determination testable
- Separates data structure from parsing/rendering

### 3. Task Parser (`services/TaskParser.ts`)

**Responsibility**: Extract tasks from markdown files

**Key Methods**:
- `parseAllTasks()`: Scan vault and return all tasks
- `parseTasksFromFile(file)`: Parse single file
- `parseTaskMetadata(text)`: Extract inline metadata

**Data Flow**:
```
Vault Files → getFilesToScan() → parseTasksFromFile() 
          → parseTaskMetadata() → Task objects
```

**Why this design**:
- Stateless: Same input always produces same output
- Respects settings for folder scanning
- Uses regex for metadata extraction (fast, reliable)
- Supports multiple course detection methods

**Future Extensions**:
- Additional metadata formats (priority, tags)
- Custom date formats
- Recurring tasks

### 4. Task Manager (`services/TaskManager.ts`)

**Responsibility**: State management, filtering, sorting

**Key Methods**:
- `loadTasks()`: Initial load from parser
- `refreshFileTask(path)`: Update tasks from modified file
- `setStatusFilter()` / `setCourseFilter()` / `setSortBy()`: Apply filters
- `getFilteredTasks()`: Return current view

**State**:
- `tasks`: All parsed tasks (source of truth)
- `filteredTasks`: Current filtered/sorted view
- `currentFilters`: Active filter state

**Events**:
- Emits `tasks-updated` when data changes

**Why this design**:
- Single source of truth for task state
- Reactive: UI subscribes to updates
- Incremental updates: Only re-parses changed files
- Filter/sort logic separated from UI

**Future Extensions**:
- Undo/redo support
- Task caching for large vaults
- Multi-level grouping

### 5. Dashboard View (`views/DashboardView.ts`)

**Responsibility**: UI rendering and user interaction

**Structure**:
```
DashboardView
    ├── renderHeader()
    ├── renderControls()
    ├── renderStatistics()
    └── renderTaskList()
        └── renderTaskItem()
```

**Event Handling**:
- Subscribes to TaskManager's `tasks-updated`
- Listens to vault `modify` events
- Handles user interactions (clicks, filters)

**Why this design**:
- Declarative rendering: Each section is isolated
- Event-driven updates: No manual refresh needed
- Direct file integration: Opens notes at exact lines
- Separation: UI logic separate from business logic

**Future Extensions**:
- Multiple view modes (list, timeline, calendar)
- Drag-and-drop task reordering
- Inline editing
- Keyboard navigation

### 6. Settings (`settings/Settings.ts` & `SettingsTab.ts`)

**Responsibility**: Configuration management and UI

**Settings Structure**:
```typescript
{
    scanFolders: string[],
    scanRecursively: boolean,
    courseDetection: 'per-file' | 'per-folder' | 'frontmatter',
    // ... more settings
}
```

**Why this design**:
- Extensible: Easy to add new settings
- Type-safe: TypeScript interfaces prevent errors
- Persistent: Saved to Obsidian's data.json
- Validated: Settings tab enforces valid values

## Data Flow Diagrams

### Initial Load

```
User Opens Dashboard
    ↓
DashboardView.onOpen()
    ↓
TaskManager.loadTasks()
    ↓
TaskParser.parseAllTasks()
    ↓
[For each file] parseTasksFromFile()
    ↓
TaskManager.applyFiltersAndSort()
    ↓
Emit 'tasks-updated'
    ↓
DashboardView.render()
    ↓
Display to User
```

### File Modification

```
User Edits Note
    ↓
Vault 'modify' Event
    ↓
TaskManager.refreshFileTask(path)
    ↓
TaskParser.parseTasksFromFilePath(path)
    ↓
TaskManager updates internal state
    ↓
TaskManager.applyFiltersAndSort()
    ↓
Emit 'tasks-updated'
    ↓
DashboardView.render()
    ↓
UI Updates
```

### User Interaction (Filter)

```
User Changes Filter
    ↓
DashboardView event handler
    ↓
TaskManager.setStatusFilter(newStatus)
    ↓
TaskManager.applyFiltersAndSort()
    ↓
Emit 'tasks-updated'
    ↓
DashboardView.render()
    ↓
Updated List Display
```

## Extensibility Points

### Adding a New View Mode

1. Add new view type to `views/` directory
2. Extend or create new view class
3. Register in `main.ts`
4. Share the same TaskManager instance

### Adding New Metadata

1. Update `Task` interface in `models/Task.ts`
2. Add parsing logic in `TaskParser.parseTaskMetadata()`
3. Update rendering in `DashboardView.renderTaskItem()`
4. Optionally add filter/sort support in `TaskManager`

### Adding Statistics

1. Add method to `TaskManager.getStatistics()`
2. Update `DashboardView.renderStatistics()`
3. No other changes needed

### Supporting Multiple Semesters

Architecture supports this via:
1. Add semester selection to settings
2. Add date range filtering to TaskManager
3. Extend Task model with semester property
4. Update parser to read semester from frontmatter

## Performance Considerations

### Current Optimizations

1. **Lazy Loading**: Tasks only parsed when dashboard opens
2. **Incremental Updates**: Only modified files re-parsed
3. **In-Memory Filtering**: No repeated disk reads
4. **Event Debouncing**: Could be added for rapid file changes

### Scaling Strategy

For vaults with 1000+ files:
1. Implement task caching with invalidation
2. Add progressive loading (parse visible tasks first)
3. Virtual scrolling for large task lists
4. Worker thread for parsing (future)

## Testing Strategy

### Unit Tests (Future)

```typescript
// models/Task.test.ts
test('getTaskStatus returns overdue for past due dates', () => {
    const task = createTask({ dueDate: yesterday, completed: false });
    expect(getTaskStatus(task)).toBe(TaskStatus.Overdue);
});

// services/TaskParser.test.ts
test('parseTaskMetadata extracts dates correctly', () => {
    const result = parser.parseTaskMetadata('Task due:: 2024-03-15');
    expect(result.dueDate).toEqual(new Date('2024-03-15'));
    expect(result.title).toBe('Task');
});
```

### Integration Tests (Future)

```typescript
// Test full parse → filter → render flow
test('dashboard shows only overdue tasks when filtered', async () => {
    await manager.loadTasks();
    manager.setStatusFilter(TaskStatus.Overdue);
    const tasks = manager.getFilteredTasks();
    expect(tasks.every(t => getTaskStatus(t) === TaskStatus.Overdue)).toBe(true);
});
```

## Security Considerations

- Plugin only reads/writes markdown files (no external network)
- Settings validated before persistence
- No eval() or dynamic code execution
- Respects Obsidian's sandbox environment

## Error Handling

### Current Approach

- Silent failures: Invalid dates ignored, tasks still shown
- Graceful degradation: Missing metadata uses defaults
- No crashes: Try-catch around file operations

### Future Improvements

- User-facing error messages
- Validation warnings in settings
- Debug mode with verbose logging
- Error reporting to dashboard

## Conclusion

This architecture provides:
- ✅ Clear separation of concerns
- ✅ Easy to test individual components
- ✅ Simple to add new features
- ✅ Performant on large vaults
- ✅ Maintainable codebase
- ✅ Extensible design

The event-driven approach ensures components stay decoupled while maintaining reactivity. The stateless parser and centralized state management make behavior predictable and debuggable.
