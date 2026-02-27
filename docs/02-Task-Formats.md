# Task Formats

TaskLens is designed to fit naturally into your existing Obsidian workflow. It reads standard markdown tasks with optional inline metadata. You do not need to learn complex query languages; just write your tasks as you normally would.

## Basic Syntax

At its core, TaskLens looks for a standard markdown checkbox followed by your task description and optional date fields.

```markdown
- [ ] Complete assignment due:: 2024-03-15
```

> [!info] Auto-Cleaning
> TaskLens automatically cleans the metadata from the displayed title in your dashboard. If your task is `- [ ] Buy Milk [due:: 2024-05-20]`, the dashboard will display "Buy Milk" and cleanly format the date elsewhere, provided you use the exact format defined in your settings.

## Adding Dates

TaskLens allows you to add specific deadlines or scheduled date ranges to your tasks.

### Due Dates

Use the `due::` key to set a deadline. The plugin's parser now supports both `YYYY-MM-DD` and `DD-MM-YYYY` formats.

```markdown
- [ ] Read chapter 1 due:: 2024-01-15
- [ ] Submit essay due:: 15-01-2024
```

### Start Dates (Date Ranges)

For long-running tasks, you can add a `start::` date. This is especially useful for the Timeline View, as timeline bars will now accurately stretch across multiple days from `startDate` to `dueDate`.

```markdown
- [ ] Implement MergeSort start:: 2024-01-23 due:: 2024-01-30
```

### Emoji Format

If you prefer a more visual style, or if you use other plugins that rely on emoji metadata, TaskLens fully supports the calendar emoji format.

```markdown
- [ ] Call mom 📅 2024-05-20
```

## Mixed Metadata and Flexibility

The parser is highly flexible and can handle various combinations of data in a single file:

```markdown
# Flexible Date Formats

- [ ] Task with standard format due:: 2024-02-15
- [ ] Task with emoji date 📅 2024-02-20
- [ ] Task with both start:: 2024-02-10 due:: 2024-02-25
- [ ] Task with no date (still shows in dashboard)
```

> [!tip] Undated Tasks
> You do not need to use start/due dates for each task, dates are optional but good for visualization within the graphic widget. It is perfectly usable for general todo items, ongoing tasks, or tasks you have not scheduled yet.

---

