# Example Course Files

These example files demonstrate how to structure your notes for TaskLens.

## Example 1: Computer Science 101 (CS101.md)

```markdown
---
course: CS101
semester: Spring 2024
---

# Computer Science 101

## Week 1 - Introduction to Programming

- [x] Read chapter 1 due:: 2024-01-15
- [x] Complete Lab 1 start:: 2024-01-10 due:: 2024-01-17
- [ ] Watch intro videos due:: 2024-01-12

## Week 2 - Variables and Data Types

- [ ] Assignment 1: Variables start:: 2024-01-20 due:: 2024-01-27
- [ ] Read chapters 2-3 due:: 2024-01-22
- [ ] Quiz 1 preparation due:: 2024-01-24

## Week 3 - Control Flow

- [ ] Lab 2: If statements start:: 2024-01-27 due:: 2024-02-03
- [ ] Assignment 2: Loops due:: 2024-02-05
- [ ] Study for midterm start:: 2024-02-01 due:: 2024-02-10
```

## Example 2: Mathematics 201 (Math201.md)

```markdown
# Mathematics 201 - Calculus

## Assignments

- [x] Problem Set 1 due:: 2024-01-18
- [x] Problem Set 2 due:: 2024-01-25
- [ ] Problem Set 3 start:: 2024-01-26 due:: 2024-02-01
- [ ] Problem Set 4 due:: 2024-02-08

## Exams

- [ ] Midterm prep start:: 2024-02-05 due:: 2024-02-15
- [ ] Review session notes due:: 2024-02-14

## Office Hours

- [ ] Ask about derivatives due:: 2024-01-30
- [ ] Get feedback on PS3 start:: 2024-01-28 due:: 2024-01-31
```

## Example 3: Using Folder Structure

If using per-folder course detection:

```
Uni/
|-- Spring2024/
|   |-- CS101/
|   |   |-- Week1.md
|   |   |-- Week2.md
|   |   `-- Week3.md
|   |-- Math201/
|   |   |-- Assignments.md
|   |   `-- Notes.md
|   `-- Physics101/
|       `-- Labs.md
```

Each file can have tasks, and they will be grouped by the folder name (CS101, Math201, Physics101).

## Example 4: Mixed Metadata Formats

The parser supports multiple date formats:

```markdown
# Flexible Date Formats

- [ ] Task with standard format due:: 2024-02-15
- [ ] Task with emoji date 2024-02-20
- [ ] Task with both start:: 2024-02-10 due:: 2024-02-25
- [ ] Task with no date (still shows in dashboard)
```

## Example 5: Complex Course Notes

```markdown
---
course: Advanced Algorithms
instructor: Dr. Smith
semester: Spring 2024
---

# Advanced Algorithms

## Module 1: Sorting

### Readings
- [x] CLRS Chapter 2 due:: 2024-01-20
- [x] Research paper on QuickSort due:: 2024-01-22

### Assignments
- [ ] Implement MergeSort start:: 2024-01-23 due:: 2024-01-30
- [ ] Analysis of sorting algorithms due:: 2024-02-02

### Project
- [ ] Choose project topic start:: 2024-01-25 due:: 2024-02-01
- [ ] Submit proposal start:: 2024-02-01 due:: 2024-02-10
- [ ] First checkpoint start:: 2024-02-10 due:: 2024-02-20

## Module 2: Graph Algorithms

- [ ] Review BFS/DFS due:: 2024-02-08
- [ ] Dijkstra's algorithm implementation start:: 2024-02-12 due:: 2024-02-19
```

## Tips for Best Results

1. Consistent naming for courses
2. Use YYYY-MM-DD for dates
3. Use start dates for long-running tasks
4. Use frontmatter if you want explicit course metadata
5. Group related tasks under headings

## Settings Configuration Examples

### Scan Specific Folders

In plugin settings, set Scan folders to:
```
Uni/Spring2024
Uni/Fall2024
```

### Use Frontmatter for Course Names

1. Set course detection method to Frontmatter
2. Set frontmatter property to course
3. Add course: CourseName to each file's frontmatter

### Allow Tasks Without Due Dates

Enable Allow tasks without due dates to see:
- [ ] General todo items
- [ ] Ongoing tasks
- [ ] Tasks you have not scheduled yet

## Dashboard Workflow

1. Morning review: filter to Upcoming Week
2. Priority check: scan overdue tasks
3. Course focus: filter by course
4. Quick navigation: click a task to open it
5. Weekly planning: view all open tasks sorted by due date
