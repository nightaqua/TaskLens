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

---

## Competitor Research Targets

Agents should periodically study these for patterns, UX ideas, and integration opportunities:

| Plugin | Author / Repo | Focus |
|--------|--------------|-------|
| tasknotes | callumalpass | How it models recurring tasks and date handling |
| taskgenius-plugin | — | Feature set comparison, UX patterns |
| TaskForge | — | Board/kanban UX, status model |
| obsidian-tasks | — | The incumbent; what users expect; parsing conventions |
| obsidian-tasklens fork | suzutan | What the fork changed — potential upstream cherry-picks |

**Research procedure:** Don't just list features. For each competitor, note: (1) what they do better than TaskLens, (2) what TaskLens does better, (3) one concrete thing we could borrow without breaking our architecture.

---

## Research Directions

- How do large-vault users (5,000+ notes) actually use TaskLens? Are there performance bottlenecks in `getFilesToScan` at scale?
- Obsidian's new Properties UI (frontmatter editor) — does TaskLens correctly parse tasks in files that use YAML frontmatter?
- Calendar plugin integration — can TaskLens tasks show up on the Obsidian Calendar view?
