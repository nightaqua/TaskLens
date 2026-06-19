# Maintainer Decision Log

Approved or rejected proposals from agents. Agents must check this file before proposing any new work to avoid re-surfacing already-decided items.

> **This file is maintainer-owned. Agents only READ it — they never write to it.** Agents propose work in `backlog.md` with status `pending-review`; the maintainer decides **interactively via Cowork** and records the verdict here (and flips the `backlog.md` row to `todo`/`in-progress` or `rejected`). See README "Proposal & Approval Workflow". There is no `pending` verdict in this file — anything awaiting a decision lives in `backlog.md` as `pending-review`, not here.

**Verdict values:** `approved` | `rejected`

---

## Decisions

The `Ref` column is the stable key linking a decision to its origin — a `backlog.md` ID (`GM-/CQ-/FA-###`) and/or the exact `feature-agent/ideas.md` heading it came from. **Match on `Ref` first, then on prose.** Matching by prose alone is unreliable (an agent that re-words a proposal won't recognize the match and will re-propose it — the exact loop this system exists to prevent).

| Date | Verdict | Ref | Agent | Proposal | Reason |
|------|---------|-----|-------|----------|--------|
| 2026-06-19 | approved | (standing policy) | — | Plain commits with no AI attribution / co-author trailers | Maintainer's deliberate choice: clean solo-developer history over per-agent git auditability. `notes.md` is the audit trail instead. |

<!-- FA-001 (Sorting Toggles) is currently a proposal awaiting a decision — it lives in backlog.md as `pending-review`, not here. A row is added here only once the maintainer approves or rejects it via Cowork. -->

---

## How to Use

**Maintainer:** You approve or reject proposals **interactively through Cowork** — you do not need to hand-edit this file or `backlog.md`. In a Cowork session, review the `pending-review` rows in `backlog.md` and decide; the session records the verdict by (a) adding a row here with the `Ref` (backlog ID and/or `ideas.md` heading) so agents can match it reliably, and (b) flipping the `backlog.md` row to `todo`/`in-progress` (approved) or `rejected`. The agent will then not re-propose it. You *can* still edit the files directly if you prefer — the schema is the same.

**Agents (read-only here):**
- You **never write to this file.** To propose work, add a `pending-review` row to `backlog.md` citing the originating `ideas.md` heading or `backlog.md` ID in the `Ref` column.
- Before proposing, scan this table. **Match on the `Ref` column first** (backlog ID / `ideas.md` heading), **then** on prose. If your proposed work matches a `rejected` row, skip it entirely — do not re-propose, do not re-open, do not mention it.
- If your work matches an `approved` row (by `Ref`), it is a green light to proceed (subject to your own approval boundary).
