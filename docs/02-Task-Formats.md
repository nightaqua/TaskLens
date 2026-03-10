# Task Formats

TaskLens is designed to fit naturally into your existing Obsidian workflow. It reads standard markdown tasks with optional inline metadata. You do not need to learn complex query languages; just write your tasks as you normally would.

## Basic syntax

At its core, TaskLens looks for a standard markdown checkbox followed by your task description and optional date fields.

```markdown
- [ ] Complete assignment due:: 2024-03-15
```

> [!info] Auto-cleaning
> TaskLens automatically cleans the metadata from the displayed title in your dashboard. If your task is `- [ ] Buy Milk [due:: 2024-05-20]`, the dashboard will display "Buy Milk" and cleanly format the date elsewhere, provided you use the exact format defined in your settings.

## Adding dates

TaskLens allows you to add specific deadlines or scheduled date ranges to your tasks.

### Due dates

Use the `due::` key to set a deadline. The parser supports both `YYYY-MM-DD` and `DD-MM-YYYY` formats, and both bare and bracket-wrapped syntax:

```markdown
- [ ] Read chapter 1 due:: 2024-01-15
- [ ] Submit essay [due:: 2024-01-15]
```

Both lines are treated identically. You can use whichever style fits your vault's conventions.

### Start dates (date ranges)

For long-running tasks, you can add a `start::` date. This is especially useful for the timeline view, as bars will accurately stretch across multiple days from `start::` to `due::`.

```markdown
- [ ] Implement MergeSort start:: 2024-01-23 due:: 2024-01-30
- [ ] Write report [start:: 2024-01-23 due:: 2024-01-30]
```

### Emoji format

If you prefer a more visual style, or if you use other plugins that rely on emoji metadata, TaskLens fully supports the calendar emoji format for due dates.

```markdown
- [ ] Call mom 📅 2024-05-20
```

## Metadata written by TaskLens

When TaskLens writes metadata automatically (on task completion or recurrence), it uses the **bracketed inline-field format**:

```markdown
- [x] Weekly reading [completion:: 2024-03-15 14:30] [repeat:: weekly]
```

This format is compatible with Dataview and readable as plain text. TaskLens also recognises and respects metadata written by the Tasks plugin (`✅ YYYY-MM-DD`, `🔁`, `🏁`) — it will never double-stamp a line that already carries completion or recurrence metadata from another plugin.

## Recurring tasks

To mark a task as recurring, add a `repeat::` key with a frequency:

```markdown
- [ ] Weekly reading [due:: 2024-03-15] [repeat:: weekly]
- [ ] Monthly review [due:: 2024-03-01] [repeat:: monthly]
```

When you check a recurring task, TaskLens:
1. Stamps `[completion:: ...]` on the completed line.
2. Inserts a new open clone immediately below with the next calculated due date.
3. Skips cloning if a future open instance of the same task already exists on the next line, preventing duplicates.

In the list view and timeline, all open clones of the same recurring series are collapsed into a single row with a ×N badge showing how many are pending.

## Mixed metadata and flexibility

The parser handles various combinations in a single file:

```markdown
- [ ] Task with standard format due:: 2024-02-15
- [ ] Task with bracketed format [due:: 2024-02-15]
- [ ] Task with emoji date 📅 2024-02-20
- [ ] Task with date range start:: 2024-02-10 due:: 2024-02-25
- [ ] Task with no date (still shows in dashboard)
```

> [!tip] Undated tasks
> Dates are optional but improve visualization in the timeline widget. TaskLens is perfectly usable for general to-do items, ongoing tasks, or tasks you have not scheduled yet.

---