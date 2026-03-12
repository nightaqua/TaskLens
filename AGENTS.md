# 🤖 Agent Instructions for TaskLens

Hello! If you are an AI coding agent (hey Jules) contributing to this
repository, please read these instructions carefully before writing or
modifying any code.

TaskLens is an Obsidian community plugin written in strict TypeScript. It
provides a visual dashboard, timeline, and task management system by parsing
raw Markdown files.

---

## 1. Core Architecture & Context

- **Environment:** Obsidian Plugin API (Node/Browser hybrid). Never run output
  in Node directly — it only runs inside Obsidian.
- **Data storage:** No databases. All tasks are parsed from and written back to
  standard Markdown files (`.md`).
- **UI framework:** Native DOM manipulation via Obsidian helpers (`createEl`,
  `createDiv`, `setCssProps`). No React, Vue, or Svelte.
- **Build:** `npm run build` → esbuild bundle → `main.js`.

### File ownership — no `utils/` directory

Shared helpers live as named exports in the file that owns them most naturally:

| Helper | Home file |
|---|---|
| `setupViewDOM` / `cleanUpViewDOM` | `DashboardView.ts` |
| `getTopicColor` | `Settings.ts` |
| `openTaskInEditor` | `TaskListComponent.ts` |

Do not create a `utils/` or `helpers/` directory.

### Component boundaries

- `TaskManager` — singleton, owns all task state and file writes.
- `TaskParser` — pure parsing, no side effects, no Obsidian API calls.
- `TaskSanitizer` — exported module functions (no class).
- Views (`DashboardView`, `TaskListView`, `TimelineView`, `StatsView`) — never
  write to files directly; always call `TaskManager` methods.

---

## 2. Strict TypeScript & Linter Rules

This project enforces a **zero-tolerance policy** for linter warnings. Run
`npx eslint .` and confirm 0 errors before submitting a PR.

- **No `any` types.** Use `unknown` and type-narrow, or `Record<string, unknown>`
  for generic objects.
- **Type guards over casting.** Never use `as` to force a type
  (e.g. `file as TFile`). Use runtime guards: `if (file instanceof TFile)`.
- **No `as HTMLElement`.** Use `instanceof HTMLElement ? x : null`.
- **Readonly fields.** Mark constructor-only properties `private readonly`
  (`app`, `container`, `settings`, etc.).
- **No unnecessary conditionals.** Do not check existence when TypeScript
  already guarantees it.
- **No bare numbers in template literals.** Wrap with `String()`:
  `\`value: ${String(n)}\`` not `\`value: ${n}\``.
- **No static-only classes.** Use exported module functions instead
  (`@typescript-eslint/no-extraneous-class`).
- **British English** for internal method/variable names where relevant
  (e.g. `cleanUpViewDOM` not `cleanupViewDOM`).

---

## 3. Asynchronous Code & Promises

- **No floating promises.** Every promise must be handled. Inside synchronous
  callbacks use `void`:
  ```ts
  button.addEventListener('click', () => { void this.activateView(); });
  ```
- **Lifecycle methods.** `onOpen()` and `onClose()` in `ItemView` must return
  `Promise<void>`. Return `Promise.resolve()` even when synchronous.

---

## 4. Obsidian API & DOM Best Practices

- **Never mutate `.style` directly.** Use CSS classes or
  `.setCssProps({ display: 'none' })`.
- **State persistence.** Always merge with Obsidian's internal state:
  ```ts
  return Object.assign(super.getState(), { myKey: myValue });
  ```
- **Modal focus.** Capture `app.workspace.getActiveViewOfType(MarkdownView)` in
  the constructor, not in `onOpen()` — modals steal focus before `onOpen` runs.

---

## 5. Memory Management & Event Listeners

- **Unregister in `onClose`.** Any listener registered on `app.workspace`,
  `app.vault`, or `TaskManager` must be removed in `onClose()` with `.off()`.
- **Arrow function handlers.** Use class arrow functions to avoid `this` scoping
  issues and satisfy `@typescript-eslint/unbound-method`:
  ```ts
  private readonly onTasksUpdated = (): void => { this.render(); };
  // in constructor:
  this.plugin.taskManager.on('tasks-updated', this.onTasksUpdated);
  // in onClose:
  this.plugin.taskManager.off('tasks-updated', this.onTasksUpdated);
  ```

---

## 6. File Write Rules (critical)

- All vault writes go through `TaskManager`. Never call `app.vault.modify`
  from a view.
- Set `isInternalChange = true` **before the first `await`** in any write path;
  clear it in `finally`.
- After any write, call `refreshFileTask(filePath)` — never `loadTasks()`.
  `loadTasks()` rescans the entire vault; `refreshFileTask` is O(1 file).

---

## 7. Date Conventions

| Purpose | Format |
|---|---|
| Storage (`due::`, `start::`, cloned lines) | `yyyy-mm-dd` |
| Display (list chip, timeline tooltip) | `dd-mm-yyyy` |
| Completion timestamps (written to file) | `dd-mm-yyyy HH:mm` |

- Always parse date strings with a `T00:00:00` suffix:
  `new Date('2026-03-10T00:00:00')` not `new Date('2026-03-10')`.
  The bare form is parsed as UTC midnight, which shifts the displayed day by
  ±1 in non-UTC timezones.
- Use `TaskManager.formatDisplayDate(date)` for display.
- Use the private `formatDate(date)` for storage (returns `yyyy-mm-dd`).

---

## 8. UI & Copywriting Conventions

- **Sentence case.** Write "Quick add task" not "Quick Add Task".
- **Settings headings.** Never include the plugin name or the word "Settings"
  in a section header. Use descriptive names: "Visuals & colours" not
  "TaskLens Visual Settings".

---

## 9. Testing

Pure logic functions are safe to unit test — set up Vitest and target:

- `TaskParser.parseTaskMetadata` — date formats, bracket variants, emoji
  fallback, title stripping
- `TaskManager.calculateNextDueDate` — all recurrence rules, month overflow
- `TaskSanitizer` — all metadata formats, strip idempotency

Do **not** attempt to test anything that calls the Obsidian API directly.
There is no mock environment for `app.vault`, `app.workspace`, or `ItemView`.

---

## 10. Commit Style

Conventional commits: `fix:`, `feat:`, `refactor:`, `test:`, `chore:`.
Keep the subject line under 72 characters. Body lines under 80 characters.

---

## 11. Mandatory Verification

Before finalising any task, successfully run:

```bash
npm run build
npx eslint .
```

If either fails, fix the errors before concluding. Do not submit a PR with
build errors or linter warnings.