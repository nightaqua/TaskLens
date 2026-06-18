# Maintainer Decision Log

Approved or rejected proposals from agents. Agents must check this file before proposing any new work to avoid re-surfacing already-decided items.

**Verdict values:** `approved` | `rejected`

---

## Decisions

The `Ref` column is the stable key linking a decision to its origin — a `backlog.md` ID (`GM-/CQ-/FA-###`) and/or the exact `feature-agent/ideas.md` heading it came from. **Match on `Ref` first, then on prose.** Matching by prose alone is unreliable (an agent that re-words a proposal won't recognize the match and will re-propose it — the exact loop this system exists to prevent).

| Date | Verdict | Ref | Agent | Proposal | Reason |
|------|---------|-----|-------|----------|--------|
| 2026-06-19 | approved | (standing policy) | — | Plain commits with no AI attribution / co-author trailers | Maintainer's deliberate choice: clean solo-developer history over per-agent git auditability. `notes.md` is the audit trail instead. |

---

## How to Use

**Maintainer:** When you approve or reject an agent's proposal (from a PR comment, a flagged item, or a conversation), add a row here. Fill in the `Ref` with the backlog ID and/or `ideas.md` heading so the agent can match it reliably. The agent will not re-propose it.

**Agents:**
- When you flag work or open a PR, **cite the originating `ideas.md` heading or `backlog.md` ID** in the row's `Ref` so a later decision can be tied back to it.
- Before adding a task to `backlog.md` or opening a PR, scan this table. **Match on the `Ref` column first** (backlog ID / `ideas.md` heading), **then** on prose. If your proposed work matches a `rejected` row, skip it entirely — do not re-propose, do not re-open, do not mention it.
