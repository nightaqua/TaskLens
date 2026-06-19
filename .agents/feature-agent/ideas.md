# Feature Agent — Ideas Backlog

Seed list of feature ideas and research directions. The Feature Agent works through this list, picks up items from `backlog.md`, and adds newly discovered ideas here before proposing them.

**Before picking up any item:** check `decisions.md` to confirm it hasn't been rejected, and check `backlog.md` to confirm it isn't already in-progress.

---

## Feature Ideas

### Sorting Toggles
**Area:** Task List UX  
**Idea:** Add ↑↓ sort button in the Task List header. Allow sorting by Urgency, Topic, and File Name. Should persist sort preference across restarts (store in plugin data.json via existing settings mechanism).  
**Complexity:** Low-medium.  
**Notes:** Check existing sort/filter infrastructure before implementing — may already have partial support.

### Dataview Compatibility
**Area:** Parsing / Performance  
**Idea:** Support Dataview inline field date formats (e.g. `[due:: 2026-01-15]`). Optionally, read the Dataview index if the plugin is present to skip re-scanning files that Dataview has already parsed — could dramatically speed up large vault scans.  
**Complexity:** Medium. Need to handle "Dataview not installed" gracefully.  
**Notes:** Research Dataview's plugin API first — it exposes an index via `app.plugins.plugins.dataview?.api`.

### Saved Widget States
**Area:** Timeline UX  
**Idea:** Timeline view should remember its zoom level (days/weeks/months) between restarts. Store in workspace state via `getState()` / `setState()` — the mechanism already exists in the codebase.  
**Complexity:** Low.

### Task Templates (Quick Add)
**Area:** Task Creation  
**Idea:** User-defined templates for the Quick Add modal. Templates could pre-fill topic, urgency, recurring pattern. Stored in plugin settings.  
**Complexity:** Medium. Requires settings UI additions.

### Kanban Plugin Integration
**Area:** Interoperability  
**Idea:** Detect when the Obsidian Kanban plugin is installed and offer to sync board statuses with TaskLens statuses, or at minimum not conflict with Kanban's frontmatter.  
**Complexity:** Medium-high. Research Kanban's data format before proposing implementation.

### Scraper Improvements
**Area:** Data Input  
**Idea:** The web scraper (if present) could be made more customizable — user-configurable field mappings, potential lightweight settings GUI. Audit current scraper code before proposing specifics.  
**Complexity:** Unknown — audit first.

### Docs: Known Issues Redo
**Area:** Documentation  
**Idea:** The known-issues section of the docs is outdated. Audit open GitHub issues, compare against current behavior, and rewrite to reflect v1.3.x reality.  
**Complexity:** Low.

### Repo Restructure
**Area:** Project Structure  
**Idea:** Introduce `config/`, `scripts/`, `docs/` top-level directories to organize loose root files.  
**Complexity:** Low (file moves), but high coordination cost (all open PRs would conflict). Only pursue if no other PRs are open. **Note:** per AGENTS.md §11, cosmetic-only restructures that move files without behavior change are rejected — make sure any restructure is bundled with meaningful changes or justified by concrete developer pain.

### Timer Display (FA-002)
**Area:** Task List UX  
**Idea:** Tasks tagged with `#countdown`, `#elapsed`, or `#countdown-elapsed` show a live timer chip in the task list. Countdown reads the due date; elapsed reads the start date. Color shifts green→blue→orange→red as deadline approaches or time accumulates. Inspired by suzutan fork (2026-06-19).  
**Complexity:** Medium-high. Needs an interval-based updater, parser change to recognise the tags, and new CSS. No settings schema change if tags are the activation mechanism.  
**Notes:** The suzutan fork implements this in Preact with signals; our vanilla-DOM approach would use `window.setInterval` and targeted DOM updates. Propose in decisions.md before starting — this is unambiguously a new user-visible feature.

### Priority Field Support (FA-003)
**Area:** Parsing / Compatibility  
**Idea:** Parse obsidian-tasks priority emojis (⏫ highest, 🔼 high, 🔽 low) from task text and expose a `priority` field on the Task model. Surface in the Task List and Timeline as a sort key, and as a filter option in DashboardView. Improves interoperability with vaults that already use obsidian-tasks format.  
**Complexity:** Low-medium. Parser change + model field + sort/filter wiring. No new UI primitives needed beyond an extra sort option (piggybacks on FA-001 Sorting Toggles if approved).  
**Notes:** obsidian-tasks also uses `🔁` for recurrence (already supported) and `✅` for completion date, `📅` for due date (already supported). Priority is the main missing field.

---

## Competitor Research Targets

Agents should periodically study these for patterns, UX ideas, and integration opportunities:

| Plugin | Author / Repo | Focus | Last verified | Failed fetches |
|--------|--------------|-------|---------------|----------------|
| tasknotes | callumalpass/obsidian-tasknotes | How it models recurring tasks and date handling | — | 0 |
| obsidian-tasks | obsidian-tasks-group/obsidian-tasks | The incumbent; what users expect; parsing conventions | 2026-06-19 | 0 |
| obsidian-tasklens fork | suzutan/obsidian-tasklens | What the fork changed — potential upstream cherry-picks | 2026-06-19 | 0 |

<!-- Removed 2026-06-19: taskgenius-plugin and TaskForge had no resolvable author/repo (`—`), so every fetch would have failed and burned the drop-after-2 counter within ~2 runs, wasting research budget. Re-add them here only with a concrete `owner/repo`. -->

**Research procedure:** Don't just list features. For each competitor, note: (1) what they do better than TaskLens, (2) what TaskLens does better, (3) one concrete thing we could borrow without breaking our architecture. Research each target **at most once per 30 days** (per `feature-agent/PROMPT.md` §6) and update its **"Last verified"** date when you do.

**Failed-fetch counter rules:**
- On a **successful** fetch, set the target's **"Failed fetches"** count back to **0** and update "Last verified". Only **consecutive** failures count toward the drop rule — a target that fails once, succeeds, then fails again is healthy, not dying.
- On a **failed** fetch, increment "Failed fetches". After **2 consecutive** failures, drop the target (strike it through and note it dead) rather than chasing a dead link every run.
- Never add a target without a concrete `owner/repo` — a row with no repo can never succeed and will be wrongly marked dead within two runs.

---

## Research Directions

- How do large-vault users (5,000+ notes) actually use TaskLens? Are there performance bottlenecks in `getFilesToScan` at scale?
- Obsidian's new Properties UI (frontmatter editor) — does TaskLens correctly parse tasks in files that use YAML frontmatter?
- Calendar plugin integration — can TaskLens tasks show up on the Obsidian Calendar view?

---

## Competitor Research Notes

### obsidian-tasks (obsidian-tasks-group) — 2026-06-19

**What they do better:**
- Full query language: `sort by due date`, `sort by priority desc`, `group by filename`, `limit N`, boolean filters with AND/OR/NOT
- Priority system (⏫🔼🔽 emojis) baked into the task model
- Custom status types (IN_PROGRESS, CANCELLED, NON_TASK)
- Urgency score calculated from multiple fields, used as default sort
- Advanced custom sorting via functions (Tasks 6.0.0+)

**What TaskLens does better:**
- Native dashboard widget with visual timeline, board, and stats cards — obsidian-tasks is query-embedded-in-notes only
- TaskGroup abstraction for recurring tasks (obsidian-tasks shows each recurrence as a separate item)
- More approachable for non-power users — no query syntax needed

**One thing to borrow:** Urgency score as a default sort key. Currently TaskLens list order is arbitrary (file-scan order). Sorting by an urgency score (derived from overdue + due-soon status) would immediately make the list more actionable. This is the core value of the Sorting Toggles feature (FA-001).

---

### suzutan/obsidian-tasklens fork — 2026-06-19

**What they do better (features upstream lacks):**
- Live countdown/elapsed timers on tasks (`#countdown`, `#elapsed`, `#countdown-elapsed` labels)
- Priority emojis from obsidian-tasks format (⏫🔼🔽)
- Scheduled date (⏳) and start date (🛫) as first-class fields
- Drag-and-drop task reordering within the list
- Subtasks via indentation
- Natural language date parsing in Quick Add
- Tag autocomplete (`#` in Quick Add suggests existing tags)
- Section picker in Quick Add (choose `##` heading in destination file)
- 3-column layout (sidebar filters + main list + detail panel)

**What TaskLens upstream does better:**
- Timeline and board views (fork has neither)
- Stats cards / dashboard overview
- Simpler architecture (plain TS, no Preact dependency)
- More stable / more releases

**One concrete thing to borrow:** Tag autocomplete in Quick Add. The fork collects all `#tags` from scanned tasks and offers them as completions. TaskManager already indexes tasks so we have the data; adding autocomplete to the Quick Add input field is a contained UI improvement (~50 lines, existing modal) → could qualify as a small enhancement. Flag for decisions.md before implementing since it adds new UX to an existing modal.
