# Maintainer Decision Log

Approved or rejected proposals from agents. Agents must check this file before proposing any new work to avoid re-surfacing already-decided items.

**Verdict values:** `approved` | `rejected`

---

## Decisions

The `Ref` column is the stable key linking a decision to its origin — a `backlog.md` ID (`GM-/CQ-/FA-###`) and/or the exact `feature-agent/ideas.md` heading it came from. **Match on `Ref` first, then on prose.** Matching by prose alone is unreliable (an agent that re-words a proposal won't recognize the match and will re-propose it — the exact loop this system exists to prevent).

| Date | Verdict | Ref | Agent | Proposal | Reason |
|------|---------|-----|-------|----------|--------|
| 2026-06-19 | approved | (standing policy) | — | Plain commits with no AI attribution / co-author trailers | Maintainer's deliberate choice: clean solo-developer history over per-agent git auditability. `notes.md` is the audit trail instead. |
| 2026-06-19 | **pending** | FA-001 / Sorting Toggles | feature-agent | Add sort toggle button to Task List header. Sort by Urgency (default, overdue-first then due-soonest), Topic (fileName), or File Name. Direction toggle (↑↓). State persisted via existing `DashboardView.getState()`/`setState()`. No new files — changes to `DashboardView.ts` (sort logic + button) and `src/styles.css` only. See `ideas.md § Sorting Toggles` for spec. | Awaiting maintainer approval. New UI element + user-visible functionality. |

---

## How to Use

**Maintainer:** When you approve or reject an agent's proposal (from a PR comment, a flagged item, or a conversation), add a row here. Fill in the `Ref` with the backlog ID and/or `ideas.md` heading so the 