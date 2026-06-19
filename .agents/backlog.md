# TaskLens Agent Backlog

Shared task tracker for all scheduled agents. Every agent reads this before starting work.

**Status values:** `todo` | `in-progress` | `done` | `rejected`

When picking up a task, change status to `in-progress` and add your agent name and the date. When done, move to `done` with a brief outcome note.

---

## ID allocation (read before adding a row)

**ID format:** `<PREFIX>-<NNN>` where PREFIX identifies the originating agent:

| Prefix | Agent |
|--------|-------|
| `GM` | git-manager |
| `CQ` | code-quality |
| `FA` | feature-agent |

**To allocate an ID:** scan **all** rows in this file (Active **and** Completed **and** Rejected) for your prefix, take the highest number, add 1. **IDs are never reused.** This prevents two agents — or two runs — from colliding on the same ID.

**Ref / cross-linking:** When a row originates from a `feature-agent/ideas.md` heading, put that heading text in the `Ref` column so it can be matched against `decisions.md`. For PR-related rows, the PR URL is the ref.

**Stale `in-progress`:** An `in-progress` row older than **14 days** with no commits on its branch is **stale** — any agent may reset it to `todo` (and must note the reset in its `notes.md`). This prevents abandoned tasks from being skipped forever as "already being handled."

---

## Active

<!-- Agents: add tasks here with status: todo or in-progress -->

| ID | Status | Agent | Task | Ref | Added | Notes |
|----|--------|-------|------|-----|-------|-------|
| FA-001 | todo | feature-agent | Sorting Toggles for Task List (sort by Urgency, Topic, File Name) | Sorting Toggles | 2026-06-19 | Awaiting maintainer approval in decisions.md before implementation |
| FA-002 | todo | feature-agent | Timer Display (#countdown / #elapsed chips) | Timer Display (FA-002) | 2026-06-19 | Inspired by suzutan fork; prop