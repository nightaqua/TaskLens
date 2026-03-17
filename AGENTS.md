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

| Helper                            | Home file              |
| --------------------------------- | ---------------------- |
| `setupViewDOM` / `cleanUpViewDOM` | `DashboardView.ts`     |
| `getTopicColor`                   | `Settings.ts`          |
| `openTaskInEditor`                | `TaskListComponent.ts` |

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
  `` `value: ${String(n)}` `` not `` `value: ${n}` ``.
- **No static-only classes.** Use exported module functions instead
  (`@typescript-eslint/no-extraneous-class`).
- **British English** for internal method/variable names where relevant
  (e.g. `cleanUpViewDOM` not `cleanupViewDOM`).

---

## 3. Asynchronous Code & Promises

- **No floating promises.** Every promise must be handled. Inside synchronous
  callbacks use `void`:
  ```ts
  button.addEventListener("click", () => {
    void this.activateView();
  });
  ```
- **Lifecycle methods.** `onOpen()` and `onClose()` in `ItemView` must return
  `Promise<void>`. Return `Promise.resolve()` even when synchronous.

---

## 4. Obsidian API & DOM Best Practices

- **Never use `innerHTML` or `insertAdjacentHTML`.** These are a security
  violation (XSS risk) and a policy violation. Use only Obsidian DOM helpers:
  `createEl()`, `createDiv()`, `createSpan()`, `el.setText()`, `el.empty()`.
- **Never mutate `.style` directly.** Use CSS classes or
  `.setCssProps({ display: 'none' })`.
- **State persistence.** Always merge with Obsidian's internal state:
  ```ts
  return Object.assign(super.getState(), { myKey: myValue });
  ```
- **Modal focus.** Capture `app.workspace.getActiveViewOfType(MarkdownView)` in
  the constructor, not in `onOpen()` — modals steal focus before `onOpen` runs.
- **Path normalisation.** Every file/folder path taken from user input or
  constructed programmatically must be passed through `normalizePath()` before
  use in any Vault operation or string comparison. Never assume forward slashes
  or absence of leading/trailing whitespace.
- **File lookups by path.** Use `app.vault.getFileByPath()` or
  `app.vault.getAbstractFileByPath()` for single-file lookups. Never iterate
  `getMarkdownFiles()` to find a specific file by path — those cache-backed
  methods are O(1); iteration is O(N).
- **Command naming.** Obsidian automatically prepends the plugin name to every
  command in the palette. Register commands with bare action descriptions:
  `"Open dashboard"` not `"TaskLens: Open dashboard"`. The latter produces
  `"TaskLens: TaskLens: Open dashboard"` in the palette.

---

## 5. Memory Management & Event Listeners

- **Use `registerEvent()` for vault and workspace events.** All subscriptions
  to `app.vault`, `app.workspace`, or any Obsidian `Events` emitter must use
  `this.registerEvent(...)`. This ensures automatic cleanup when the plugin
  unloads. Manual `.on()` without a corresponding `.off()` in `onunload()` or
  `onClose()` creates ghost listeners that persist after the plugin is disabled.
- **Unregister in `onClose`.** Any listener registered on `TaskManager` (which
  uses the Obsidian `Events` base class) must be explicitly removed in
  `onClose()` with `.off()`.
- **Arrow function handlers.** Use class arrow functions to avoid `this` scoping
  issues and satisfy `@typescript-eslint/unbound-method`:
  ```ts
  private readonly onTasksUpdated = (): void => { this.render(); };
  // in constructor:
  this.plugin.taskManager.on('tasks-updated', this.onTasksUpdated);
  // in onClose:
  this.plugin.taskManager.off('tasks-updated', this.onTasksUpdated);
  ```
- **Detach leaves on unload.** Any `WorkspaceLeaf` opened by the plugin persists
  in the user's workspace even after the plugin is disabled unless explicitly
  detached. `main.ts`'s `onunload()` must call `detach()` on all leaves the
  plugin has opened (Dashboard, Timeline, Stats, TaskList views).

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

| Purpose                                    | Format             |
| ------------------------------------------ | ------------------ |
| Storage (`due::`, `start::`, cloned lines) | `yyyy-mm-dd`       |
| Display (list chip, timeline tooltip)      | `dd-mm-yyyy`       |
| Completion timestamps (written to file)    | `dd-mm-yyyy HH:mm` |

- Always parse date strings with a `T00:00:00` suffix:
  `new Date('2026-03-10T00:00:00')` not `new Date('2026-03-10')`.
  The bare form is parsed as UTC midnight, which shifts the displayed day by
  ±1 in non-UTC timezones.
- Use `TaskManager.formatDisplayDate(date)` for display.
- Use the private `formatDate(date)` for storage (returns `yyyy-mm-dd`).

---

## 8. UI & Copywriting Conventions

- **Sentence case.** All UI strings — button labels, setting names, column
  headers, menu items, modal titles — must use sentence case.
  Write `"Quick add task"` not `"Quick Add Task"`. Proper nouns and trademarks
  (Markdown, PDF, TaskLens) stay capitalised.
- **Settings headings.** Never include the plugin name or the words "Settings"
  or "Options" in a section header. Use descriptive names: `"Visuals & colours"`
  not `"TaskLens Visual Settings"`. The user is already in the plugin's settings
  tab; repetition creates clutter.
- **CSS cursors.** In Obsidian, `cursor: pointer` is reserved strictly for `<a>`
  link elements. Buttons and interactive divs must use the default system cursor.
  Do not add `cursor: pointer` to any non-link element.
- **CSS variables.** Never use hard-coded hex colours or pixel values for
  theme-dependent properties. Use Obsidian's CSS variables (`--background-primary`,
  `--color-red`, `--text-muted`, etc.) so the plugin adapts automatically to
  light/dark themes and user accent colours.

---

## 9. Mobile & Cross-Platform Compatibility

- **No regex lookbehinds.** Lookbehind assertions (`(?<=...)`, `(?<!...)`) are
  not supported on iOS < 16.4. Rewrite all regexes to use forward-scanning
  alternatives. This applies to every regex in `TaskParser.ts` and
  `TaskSanitizer.ts`.
- **No Node.js / Electron APIs** unless `isDesktopOnly: true` is set in
  `manifest.json`. APIs like `fs`, `path`, `crypto`, and `electron` are
  unavailable on mobile. Use Obsidian's own abstractions (`normalizePath()`,
  `Platform`, the Vault API) instead.

---

## 10. Testing

Pure logic functions are safe to unit test — set up Vitest and target:

- `TaskParser.parseTaskMetadata` — date formats, bracket variants, emoji
  fallback, title stripping
- `TaskParser.getFilesToScan` — folder matching, recursive vs non-recursive,
  edge cases (prefix collision, root `/`)
- `TaskManager.calculateNextDueDate` — all recurrence rules, month overflow
- `TaskManager.formatDisplayDate` / `formatCompletionDate` — padding, leap
  year, time component ignored
- `TaskSanitizer` — all metadata formats, strip idempotency
- `TaskManager.processManualUpdate` — error path resets `isInternalChange`

Do **not** attempt to test anything that calls the Obsidian API directly.
There is no mock environment for `app.vault`, `app.workspace`, or `ItemView`.

---

## 11. Commit & PR Rules

- **Conventional commits:** `fix:`, `feat:`, `refactor:`, `test:`, `chore:`.
  Keep the subject line under 72 characters. Body lines under 100 characters.
- **One squashed commit per PR.** Do not submit PRs with multiple commits
  carrying identical or near-identical messages. Squash before opening the PR.
- **No unrelated dependency bumps.** Do not include `package.json` or
  `package-lock.json` version changes in a PR scoped to logic or tests. Deps
  belong in a dedicated `chore: bump dependencies` PR.
- **Never commit `main.js`.** It is a build artifact managed by CI and
  attached to GitHub Releases. It must not appear in source-tree commits.
  If it appears in your diff, remove it before submitting.
- **No cosmetic-only refactors.** Do not open PRs that only rename files or
  folders, reorganise directory structure, or reorder code without any
  behavioural change. These create merge conflicts and history noise for zero
  benefit.

---

## 12. Performance — What Not to Optimise

Do **not** open PRs for micro-optimisations on methods that run at most once
per user interaction on realistic task counts (typically < 500 tasks):

- `getStatistics` / `calculateStatistics` — single-pass rewrites are rejected.
- `groupTasks` — any caching scheme beyond what exists is rejected.
- `getTaskStatus` — date object allocation reduction is rejected.
- `TaskParser` regex consolidation into a single-pass loop is rejected.

If a change has no measurable effect on a real user's vault, it is not a
performance improvement — it is readability debt. Do not benchmark synthetic
10,000-task scenarios and present the result as justification.

---

## 13. Mandatory Verification

Before finalising any task, successfully run:

```bash
npm run build
npx eslint .
npm run test
```

If any of these fail, fix the errors before concluding. Do not submit a PR with
build errors, linter warnings, or failing tests.

---

## 14. Release Checklist (for maintainer reference)

- `manifest.json` version matches `package.json` version exactly (no `v` prefix
  anywhere).
- `minAppVersion` in `manifest.json` reflects the oldest Obsidian version that
  supports every API the plugin calls. Update this whenever a new API is adopted.
- GitHub release name matches `manifest.json` version exactly.
- `main.js`, `manifest.json`, and `styles.css` are attached as individual assets
  on the GitHub Release — not inside a zip.
- `main.js` and `styles.css` are listed in `.gitignore` and not present in the
  source tree.