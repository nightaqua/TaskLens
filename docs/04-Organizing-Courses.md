# Organizing Courses & Topics

TaskLens doesn't just present a flat list of tasks; it intelligently groups them by their context. TaskLens works equally well for general project management and for university semesters.

You can configure exactly how TaskLens identifies which "Course" (or Project) a task belongs to.

## Course Detection Methods

In the plugin settings, there are three methods to identify which course a task belongs to:

### 1. Per File (Default)

This method uses the note's file name as the course name.

* If you write tasks inside a file named `Mathematics 201.md`, TaskLens will group all those tasks under the label "Mathematics 201".
* This is perfect for users who keep one running document per class or project.

### 2. Per Folder

This method uses the parent folder name to identify the course. This is ideal if you like to split your notes into multiple files per subject.

For example, if your vault looks like this:

```text
Uni/
|-- Spring2024/
|   |-- CS101/
|   |   |-- Week1.md
|   |   |-- Week2.md
|   |   `-- Week3.md
|   |-- Math201/
|   |   |-- Assignments.md
|   |   `-- Notes.md
```

Any task found inside `Week1.md` or `Week2.md` will automatically be grouped under the **CS101** course. Tasks in `Assignments.md` will be grouped under **Math201**.

### 3. Frontmatter (Advanced)

If you prefer explicit metadata, you can instruct TaskLens to read from a frontmatter property (e.g., `course: CS101`).

To use this method:

1. Set the course detection method to "Frontmatter" in Settings.
2. Add the `course:` property to each file's YAML block.

```markdown
---
course: Advanced Algorithms
instructor: Dr. Smith
semester: Spring 2024
---

# Advanced Algorithms

- [ ] Implement MergeSort start:: 2024-01-23 due:: 2024-01-30
- [ ] Analysis of sorting algorithms due:: 2024-02-02
```

> [!tip] Vault Scanning Performance
> If you have a massive vault (10,000+ files), going to **Settings** and adding specific folders to **"Scan Folders"** (e.g., `Uni/Spring2024`) prevents TaskLens from unnecessarily reading your Archive or Journal folders.

## Smart Topic Colors

Introduced in version 1.1.0, TaskLens brings your dashboard to life with **Smart Topic Colors**.

Tasks can now be dynamically color-coded based on their source file or topic. This allows you to visually distinguish between a "Physics" assignment and an "English" essay at a single glance.

* You can customize the specific color palette via the plugin settings.
* If you experience layout issues or theme conflicts, you can also change the **Color Scheme** to "Custom" to override your Obsidian theme's default colors.

## Filtering by Course

Once your courses are detected, the Master Dashboard becomes incredibly powerful:

1. **Course Focus:** Use the Course filter dropdown in the dashboard to select a specific class.
2. The dashboard will instantly update to show *only* that course's tasks.
3. **Weekly Planning:** Combine this with the Status filter (e.g., "Upcoming Week") to see exactly what is due for a specific subject.

---
