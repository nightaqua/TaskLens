# TaskLens Agent Backlog

Shared task tracker for all scheduled agents. Every agent reads this before starting work.

**Status values:** `pending-review` | `todo` | `in-progress` | `done` | `rejected`

- **`pending-review`** — an agent has *proposed* this work and is waiting on the maintainer. The maintainer decides via Cowork (see README "Proposal & Approval Workflow") and moves the row to `todo`/`in-progress` (approved) or `rejected`. **While a row is `pending-review`, no agent starts it and no agent re-proposes it.**
- **`todo`** — approved/queued work an agent may pick up.
- When picking up a task, change status to `in-progress` and add your agent name and the date. When done, move to `done` with a brief outcome note.

**Agents never write `decisions.md`** — that file is maintainer-owned. Agents propose here with `pending-review`; the maintainer records the verdict in `decisions.md` via Cowork.

---

## ID allocation (read before adding a row)

**ID format:** `<PREFIX>-<NNN>` where PREFIX identifies the originating agent:

| Prefix | Agent |
|--------|-------|
| `GM` | git-manager |
| `CQ` | code-quality |
| `FA` | feature-agent |
| `CM` | community |

**To allocate an ID:** scan **all** rows in this file (Active **and** Completed **and** Rejected) for your prefix, take the highest number, add 1. **IDs are never reused.** This prevents two agents — or two runs — from colliding on the same ID.

**Ref / cross-linking:** When a row originates from a `feature-agent/ideas.md` heading, put that heading text in the `Ref` column so it can be matched against `decisions.md`. For PR-related rows, the PR URL is the ref.

**Stale `in-progress`:** An `in-progress` row older than **14 days** with no commits on its branch is **stale** — any agent may reset it to `todo` (and must note the reset in its `notes.md`). This prevents abandoned tasks from being skipped forever as "already being handled."

**Bounded history (Completed / Rejected):** ID allocation scans **all** rows (Active + Completed + Rejected) for the prefix max, so these sections can never be deleted without breaking "IDs are never reused." To keep the file from growing without bound while preserving the max-ID scan: once a Completed/Rejected item is **older than 90 days**, collapse its row to a stub — keep `ID | (closed)` and drop the prose. Every run still parses far fewer characters; the ID scan still works.

---

## Active

<!-- Agents: add tasks here with status: todo or in-progress -->

| ID | Status | Agent | Task | Ref | Added | Notes |
|----|--------|-------|------|-----|-------|-------|
| FA-001 | pending-review | feature-agent | Sorting Toggles for Task List (sort by Urgency, Topic, File Name) | Sorting Toggles | 2026-06-19 | Proposed; awaiting maintainer decision via Cowork. Do not start while pending-review. |
| FA-002 | todo | feature-agent | Timer Display (#countdown / #elapsed chips) | Timer Display (FA-002) | 2026-06-19 | Inspired by suzutan fork; proposal not yet submitted |
| FA-003 | todo | feature-agent | Priority Field Support (⏫🔼🔽 obsidian-tasks emojis) | Priority Field Support (FA-003) | 2026-06-19 | Pairs well with FA-001 sort; proposal not yet submitted |

---

## Completed

<!-- Move items here when done -->

| ID | Status | Agent | Task | Ref | Completed | Outcome |
|----|--------|-------|------|-----|-----------|---------|

---

## Rejected

<!-- Move items here when the maintainer rejects them via Cowork. The maintainer also records the verdict in decisions.md — agents never write decisions.md themselves. -->

| ID | Status | Ref | Reason | Task |
|----|--------|-----|--------|------|
