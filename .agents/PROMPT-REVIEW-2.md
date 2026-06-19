# Prompt Review #2 — TaskLens Scheduled Agents (fresh-eyes pass)

**Reviewer:** second prompt-engineering pass
**Date:** 2026-06-19
**Scope:** Current state of `git-manager/PROMPT.md`, `code-quality/PROMPT.md`, `feature-agent/PROMPT.md`, shared `README.md`, `backlog.md`, `decisions.md`, `feature-agent/ideas.md` — **plus the actually-deployed scheduled task files**:
- `…/Documents/Claude/Scheduled/tasklens-git-manager/SKILL.md`
- `…/Documents/Claude/Scheduled/tasklens-code-quality/SKILL.md`
- `…/Documents/Claude/Scheduled/tasklens-feature-agent/SKILL.md`

**Cross-referenced:** `AGENTS.md`, `package.json`.

Severity: 🔴 **critical** (unsafe / undoes a review-1 fix / breaks the design) · 🟠 **important** · 🟡 **nice-to-have**

---

## TL;DR — the headline

The first review fixed the **`PROMPT.md`** files well. But the agents **do not run from the `PROMPT.md` files** — they run from the three `SKILL.md` files under `Documents/Claude/Scheduled/`. Those were written separately, are ~45 lines each, and **silently dropped or reversed most of review-1's fixes.** The `PROMPT.md` files are now effectively design docs that nothing executes.

**The single most dangerous finding:** the deployed **feature-agent SKILL.md tells the agent to squash-merge its own feature branches straight into `dev` and never open a PR** (§6: *"Squash-merge your feature branch to dev … Do NOT push feature branches to remote"*). This deletes the entire maintainer-approval gate that the whole system — and the anti-Sentinel design — is built around. After a few weeks `dev` fills with unreviewed agent-authored features.

The fix for almost everything below is the same: **regenerate the three SKILL.md files from the corresponding PROMPT.md**, or add a line at the top of each SKILL telling the agent to read and obey its PROMPT.md. I document the specific divergences so they can be fixed either way.

---

## Part A — PROMPT.md ↔ deployed SKILL.md divergences

### A1. 🔴 Feature-agent self-merges features to `dev` with no PR and no approval
**Where:** `tasklens-feature-agent/SKILL.md` §6 (Workflow) and "Never push feature branches to remote (only dev)".
**Says:** *"Merge: Squash-merge your feature branch to dev. Delete the local feature branch. Do NOT push feature branches to remote."*
**Contradicts:** `feature-agent/PROMPT.md` §2 + §3 + README design principle #5 — *"Do not merge the PR yourself. Feature PRs are squash-merged by the maintainer. You open the PR and stop."*

This is the core safety boundary of the system and the deployed task inverts it. It's also **internally contradictory**: the same SKILL §3 says significant features must be *"log in decisions.md for maintainer approval BEFORE implementing"* and the "What NOT to do" list says report and stop — but §6 unconditionally merges to `dev`. An LLM handed both will usually follow the concrete imperative ("squash-merge to dev") over the abstract one.

**Exact fix — replace SKILL §6 with:**
```
6. **Open a PR (significant work) or commit small polish to dev:**
   - If the change is over ~50 lines, touches TaskParser.ts / TaskManager.ts / main.ts,
     or adds any UI/setting: push the feature branch to remote and open a PR to `dev`
     with `gh pr create --base dev`. Then STOP — do NOT merge it yourself. The
     maintainer squash-merges feature PRs. Record the PR under "In-Flight Work" in notes.md.
   - Only commit directly to `dev` when ALL of these hold: under ~50 lines total;
     does not touch TaskParser.ts / TaskManager.ts / main.ts; adds no UI/settings/UX
     change; and you can cite a specific backlog.md ID or decisions.md approved row it
     serves. Otherwise → PR + approval. There is no middle tier.
```
And delete *"Never push feature branches to remote (only dev)"* from "What NOT to do" — it makes the required PR workflow impossible.

---

### A2. 🔴 git-manager SKILL drops the entire Dependabot safety rubric
**Where:** `tasklens-git-manager/SKILL.md` §1 (Responsibilities).
**Says only:** *"Merge patch/minor dev-dep bumps if CI passes. Flag major bumps or security-critical ones."*
**Drops every nuance review-1 added to `git-manager/PROMPT.md` §1a/§2:**
- The exact required-check name (`CI Build / Build plugin`) and that the **ESLint SARIF workflow is informational (`continue-on-error`) and must be ignored** — "if CI passes" is undefined and an agent may read the green-but-uninformative ESLint job as the gate, or block on it.
- The **github-actions ecosystem** branch (auto-merge patch/minor action bumps, flag majors). Dependabot covers npm *and* github-actions; the SKILL only reasons about npm.
- The **pre-1.0 dev-tool minor rule.** This is not academic: `package.json` ships `eslint-plugin-obsidianmd@^0.3.0`. A `0.3 → 0.4` minor can add lint rules. Because the ESLint workflow is `continue-on-error`, the new rules won't fail the *required* build check — so the SKILL would auto-merge a bump that quietly starts flagging unrelated code. The PROMPT.md guard exists precisely for this.
- The **runtime vs devDependency** distinction. (Today every dep is a devDependency, but the SKILL's "dev-dep" shorthand gives no rule for the day a runtime `dependencies` entry appears.)
- The **`known-flaky.md` allowlist gate.** SKILL says "if CI passes"; PROMPT says a red required check *always* blocks unless the test name is pre-listed by the maintainer. The SKILL gives the agent latitude to merge on a judgment call.

**Exact fix:** copy `git-manager/PROMPT.md` §1a verbatim into the SKILL (required-check name, ESLint-informational note, npm rules incl. pre-1.0, github-actions branch, flag list) and add the §2 known-flaky gate to "What NOT to do".

---

### A3. 🔴 git-manager SKILL: "close duplicate PRs without commenting" / "never comment on PRs"
**Where:** `tasklens-git-manager/SKILL.md` §1.1, §2, and "What NOT to do".
**Two problems:**
1. **"Close duplicate PRs" is a new, undefined, destructive behavior** that appears nowhere in `git-manager/PROMPT.md`. "Duplicate" is never defined. Dependabot already supersedes its own stale PRs automatically; an agent guessing at duplicates can close legitimate distinct bumps. There is no recovery instruction for a wrongly-closed PR.
2. **"Never comment on PRs (just close or merge silently)"** directly contradicts PROMPT.md, whose flagging procedure is *"add a comment to the PR: 'Auto-merge blocked: [reason]. Maintainer review needed.'"* and whose merge uses `gh pr review --approve --body "…"`. With the SKILL rule, a blocked PR is closed/left silently with no audit trail for the maintainer.

**Exact fix:** delete both the "close duplicate PRs" instruction and the "never comment" rule. Replace with PROMPT.md's behavior: flag-with-comment + backlog row for blocked PRs; approve-with-body for merges. If silent operation is genuinely wanted, it must be a recorded `decisions.md` policy — but it conflicts with leaving the maintainer any signal.

---

### A4. 🔴 All three SKILLs tell agents to **write rows into `decisions.md`** with a wrong schema
**Where:** every SKILL's "Backlog & Decisions" section, e.g.
`Log decisions needed in .agents/decisions.md with: | GM-NNN | description | pending | YYYY-MM-DD |`
**Problems:**
- `decisions.md` is the **maintainer's** log. Its real table is `| Date | Verdict | Ref | Agent | Proposal | Reason |` and its verdict values are `approved | rejected`. The SKILL's 4-column `| ID | description | pending | date |` row **doesn't match the schema** and introduces an invalid verdict (`pending`). Agents writing these will corrupt the table the matcher relies on.
- Conceptually, agents flag work in **`backlog.md`** (status `todo`, with a `Ref`); the maintainer later records the verdict in `decisions.md`. The SKILLs collapse that separation, so over weeks `decisions.md` becomes a pile of agent-authored "pending" rows and the "match on Ref first" anti-re-proposal mechanism degrades.

**Exact fix — in all three SKILLs, replace the "log in decisions.md" lines with:**
```
- To flag work for the maintainer, add a row to .agents/backlog.md (status `todo`)
  using your prefix (GM-/CQ-/FA-), and put the originating ideas.md heading or PR URL
  in the Ref column. Do NOT write to decisions.md — that file is maintainer-owned;
  you only READ it (match on Ref first, then prose) to avoid re-proposing rejected work.
```
Also fix feature-agent SKILL §3 ("log in .agents/decisions.md for maintainer approval") and code-quality SKILL "Requires maintainer approval (log in decisions.md)" the same way → flag in `backlog.md`, don't write `decisions.md`.

---

### A5. 🔴 git-manager SKILL drops the forward-merge `main` → `dev` (dev drifts behind main)
**Where:** `tasklens-git-manager/SKILL.md` §5 only says *"If dev has conflicts with any open PR, note it."*
**Drops:** PROMPT.md §1d (keep `dev` current with `main` via a guarded `git merge origin/main`, `git merge --abort` on conflict).
**4-week failure mode:** the maintainer ships a hotfix straight to `main` (or tags a release and back-merges). `dev` never catches up. Feature-agent keeps branching off an increasingly stale `dev`; conflicts grow every run; eventually a feature PR can't merge cleanly and the agent thrashes.

**Exact fix:** port PROMPT.md §1d into the SKILL (check `git log origin/dev..origin/main`, guarded forward-merge, abort-and-flag on conflict, never hand-resolve).

---

### A6. 🟠 All three SKILLs: blind "if dirty, stash changes before proceeding" (0.3)
**Where:** every SKILL startup step 0.3.
**Contradicts:** README "When Things Go Wrong" → *"If `git status` shows an in-progress merge/rebase you didn't start, **stop and flag** — another agent left the tree dirty."*
**Why it's wrong:** unconditional `git stash` will (a) hide another agent's half-finished or conflicted work, (b) hide a real problem instead of surfacing it, and (c) **never gets popped** — so stashes accumulate silently. After 4 weeks you have a stack of orphan stashes and lost work, with no error ever raised.

**Exact fix — replace 0.3 in all three SKILLs:**
```
0.3 — Run `git status`. If a merge/rebase is in progress that you did not start, STOP
      and flag in backlog.md (another agent left the tree dirty) — do not stash over it.
      If the tree is merely dirty with stray edits, discard or stash them and note it,
      then `git checkout dev && git pull --rebase origin dev`.
```

---

### A7. 🟠 SKILLs dropped a cluster of review-1 safety rules
These were added to the PROMPT.md files and are simply absent from the deployed SKILLs. Each is a real regression:

| Dropped rule | In PROMPT.md | Missing from | Consequence |
|---|---|---|---|
| **Never `git add -A`; stage only named files; never stage `main.js` / root `styles.css` / `data.json` / `eslint-report.json`** | all three | all three SKILLs | a stray build artifact gets committed to `dev` |
| **Gate the notes/backlog commit on a real diff (`git diff --cached --quiet`)** | all three | all three SKILLs (they "Commit … Push" unconditionally) | a `chore(agents): … run DATE` commit every single run → exactly the history noise review-1 §2.2 set out to kill |
| **Reference README "When Things Go Wrong"** for push-rejected / network / conflict / suite-fail | all three | all three SKILLs | no recovery path; agent improvises on first failure |
| **Build/test with Node 22; don't "fix" source for a broken toolchain** | all three | all three SKILLs | agent may edit source to satisfy a local-Node mismatch |
| **Literal date; never `$(date …)` (PowerShell host)** | all three | all SKILLs (only show `YYYY-MM-DD` placeholder) | borderline — placeholder implies literal, but no explicit ban on `$(date)` |
| **Branch-deletion guards: merged & >7 days, keep if active <14 days, keep if named in backlog as in-progress, flag unknown prefixes** | git-manager §1b | git-manager SKILL (just "delete merged remote branches", "stale >30 days") | could delete a branch the maintainer wants to keep; no in-progress guard |
| **Cap of 3–4 fixes per run** | code-quality §2 | code-quality SKILL | a single run can make a sprawling sweep, raising conflict + review surface |
| **Stale `in-progress` reset after 14 days** | backlog.md rules | none of the SKILLs mention it | abandoned rows wedge forever |
| **Auto-commit requires citing a concrete backlog/decisions Ref** | feature-agent §2, code-quality §1 | feature-agent SKILL ("Can implement directly" list has no Ref requirement) | reopens the "rationalize make-work" loophole review-1 §5.3 closed |
| **Worktree isolation as preferred execution model** | README §3 | all SKILLs (single shared tree) | only the (non-atomic) lock protects concurrency — see B3 |

**Exact fix:** fold each missing rule into the corresponding SKILL section. The cleanest path is to **prepend to every SKILL**: *"Before doing anything, read `.agents/<agent>/PROMPT.md` and `.agents/README.md` in the repo and follow them; this file is a summary and the PROMPT.md governs on any conflict."*

---

### A8. 🟡 Source-layout lists in SKILLs are incomplete (undercuts "discover, don't assume")
**Where:** feature-agent SKILL "Source Structure" lists Views as *(BoardComponent, DashboardView, TaskListComponent, TimelineComponent)* — missing `TaskListView`, `TimelineView`, `StatsView`; Services missing `TaskSanitizer`; omits `constants.ts`. code-quality SKILL §4 lists the directories but not the recursive-grep-only principle as forcefully.
**Fix:** mirror README's "Source Layout" map and the "always grep recursively; never assume `src/<Name>.ts`" rule into both SKILLs.

---

## Part B — Issues in the current PROMPT.md / shared files (beyond review #1)

### B1. 🟠 The run-lock's "2 hours old" is not computable from what the agent is guaranteed to know
**Where:** all three PROMPT.md §0.2 and all SKILL 0.2.
The agent is repeatedly told it *"knows today's date"* (date only, for stamping). Judging whether `.agents/.lock` is *"under 2 hours old"* needs **wall-clock time**, which is never established. There's also no stated method (file mtime? a timestamp written inside the lock?). An agent with only date-granularity can't evaluate the staleness window and will either always treat the lock as fresh or always as stale.
**Fix — make the mechanism concrete in §0.2:**
```
Write the lock as `.agents/.lock` containing your agent name and an ISO timestamp
(date + time). Determine "age" from that timestamp vs the current time from your run
environment (not the date-stamp you use for notes). If you cannot obtain a current
wall-clock time, treat a lock whose date is today as fresh (exit) and any older date
as stale (reclaim).
```

### B2. 🟠 Early-abort paths can strand the lock
**Where:** all three PROMPT.md. §0.2 says *"delete it in Finishing Up (and only then)."* Many abort paths ("flag in backlog and stop", §0.3 recovery, suite-fail) don't route through Finishing Up, so an abort *after* acquiring the lock leaves it held until the 2-hour reclaim — blocking other agents that fire in that window for no reason.
**Fix — add to §0.2:** *"If you abort the run for any reason after acquiring the lock (recovery stop, flag-and-stop, suite failure), delete `.agents/.lock` before exiting. The only time the lock should outlive your process is an actual crash."*

### B3. 🟠 Lock acquisition is check-then-create (TOCTOU) — and schedules aren't staggered
Two agents that fire in the same minute both read "no lock", both create it, both proceed on the same working tree. The file lock narrows but doesn't eliminate the race because the read+write isn't atomic. The real defense is **non-overlapping schedules**, but the SKILL frontmatter carries no schedule and nothing documents staggering.
**Fix:** stagger the scheduled-task cron times so they can never coincide, e.g. git-manager Mon 02:00, code-quality Wed 02:00, feature-agent Tue & Fri 02:00. Document the chosen times in README §"Execution Model" and note that staggering — not the lock — is the primary concurrency guarantee.

### B4. 🟡 `ideas.md` "Failed fetches" counter never resets on success
**Where:** `ideas.md` competitor table + feature-agent §6 / PROMPT note *"after 2 consecutive failed fetches, drop the target."* The counter only increments; nothing says to **reset to 0 after a successful fetch.** Over months, a target that fails once, succeeds, fails once, succeeds… will eventually accumulate to 2 and be wrongly dropped as dead.
**Fix — add to ideas.md "Research procedure" and feature-agent §6:** *"On a successful fetch, reset the target's Failed-fetches count to 0. Only **consecutive** failures count toward the drop-after-2 rule."*

### B5. 🟡 Three of five competitor targets are unactionable from day one
`ideas.md` lists `taskgenius-plugin` and `TaskForge` with author/repo `—`, and `obsidian-tasks` with no repo. With no URL the agent can't fetch → every attempt is a "failed fetch" → they burn the 2-strike counter and get marked dead within ~2 runs, wasting research budget. (Review-1 §9.4 flagged staleness generally; the specific empties are still empty.)
**Fix:** fill in the repos (`obsidian-tasks` = `obsidian-tasks-group/obsidian-tasks`; resolve the others) or remove the rows so they don't consume research runs.

### B6. 🟡 `.agents/.lock` and `.agents/PAUSE` are not declared gitignored
The targeted-add discipline mostly prevents committing them, but nothing guarantees it, and a committed-then-pushed `.lock`/`PAUSE` would propagate transient/local state into `dev`.
**Fix:** add `.agents/.lock` and `.agents/PAUSE` to `.gitignore`, and note in README that these are local-only control files.

---

## Part C — Operational / monitoring (thin across both layers)

### C1. 🟠 No run-completion heartbeat → maintainer can't tell the fleet is alive
Several exit paths (PAUSE present, fresh lock, loop-guard, "nothing to do" before notes update) leave **no durable trace** in the repo. After 4 weeks of quiet the maintainer can't distinguish "healthy, nothing to do" from "the scheduler stopped firing" or "every run aborts on a stale lock". The SKILLs' "report 'All clear'" goes only to the transient scheduled-run output.
**Fix:** require **every** run — including PAUSE/lock/loop-guard/no-op exits — to append one dated line to a shared `.agents/run-log.md` (or each agent's notes Run History) before exiting: `2026-06-19 | git-manager | exit: paused` / `exit: lock-held` / `exit: no-op` / `exit: committed GM-007`. This is the cheap monitoring backstop; pair it with the existing notes archival so it stays bounded.

### C2. 🟡 No escalation if PAUSE is left on, or if a lock is reclaimed repeatedly
A forgotten `PAUSE` silently disables the whole fleet indefinitely; a crash-loop that keeps stranding the lock degrades to "first run each window wins, rest no-op" with no alarm.
**Fix:** in the run-log line (C1), when an agent reclaims a stale lock, record `reclaimed-stale-lock` and when it skips on PAUSE record `paused`. A maintainer scanning run-log.md then sees N consecutive `paused`/`reclaimed-stale-lock` lines as the signal. Optionally: if PAUSE has existed for >14 days, the agent may add a single backlog row "agents paused >14d — intentional?" (once, guarded by the loop-guard so it isn't repeated).

### C3. 🟡 `backlog.md` Completed/Rejected sections grow unbounded
ID allocation requires scanning all rows (Active+Completed+Rejected) for the prefix max, so these sections **can't** be archived without breaking "IDs never reused". That's the right tradeoff, but the file grows forever and every agent reads it every run.
**Fix:** keep full Completed/Rejected history but record only `ID | (closed)` stub rows once an item is >90 days done, collapsing the prose — enough to preserve the max-ID scan while shrinking what each run must parse. Note the policy in backlog.md's header.

---

## Consolidated fix checklist (priority order)

**🔴 Fix before the next scheduled run (deployed tasks are unsafe as written):**
- [ ] feature-agent SKILL: stop self-merging to `dev`; restore PR-and-stop for significant work, ref-gated small commits only (A1)
- [ ] git-manager SKILL: restore the full Dependabot rubric — required-check name, ESLint-informational, github-actions branch, pre-1.0 minor guard, known-flaky gate (A2)
- [ ] git-manager SKILL: drop "close duplicate PRs" + "never comment"; restore comment-on-flag / approve-with-body (A3)
- [ ] all SKILLs: stop writing to `decisions.md`; flag in `backlog.md` with a Ref instead (A4)
- [ ] git-manager SKILL: restore the guarded forward-merge `main`→`dev` (A5)
- [ ] **Simplest umbrella fix:** prepend each SKILL with "read and obey `.agents/<agent>/PROMPT.md` + README; PROMPT.md wins on conflict" (covers A1–A8)

**🟠 Important:**
- [ ] all SKILLs: replace blind 0.3 stash with the README recovery procedure (A6)
- [ ] all SKILLs: restore targeted-add ban on `-A`, notes-commit diff gate, Node-22 note, branch-deletion guards, 3–4 fix cap, stale-in-progress reset, ref-gated auto-commit (A7)
- [ ] PROMPT.md + SKILLs: make lock age computable (define timestamp + clock source) (B1)
- [ ] PROMPT.md: release lock on early-abort paths (B2)
- [ ] stagger the three schedules so they can't coincide; document it (B3)
- [ ] add a run-log heartbeat written on every exit path (C1)

**🟡 Durability:**
- [ ] reset `ideas.md` Failed-fetches to 0 on success; count only consecutive failures (B4)
- [ ] fill in or remove the empty competitor repos (B5)
- [ ] gitignore `.agents/.lock` and `.agents/PAUSE` (B6)
- [ ] PAUSE/stale-lock escalation signal (C2)
- [ ] bounded `backlog.md` history while preserving the ID-scan (C3)
- [ ] mirror full source-layout map into the SKILLs (A8)

---

### Bottom line
Review #1 hardened the wrong artifacts relative to what's actually scheduled. The `PROMPT.md` files are now solid; the **`SKILL.md` files that the cron jobs actually execute are a pre-review-1 snapshot** that re-introduces the exact failure classes the system exists to prevent — unreviewed self-merges, unsafe auto-merges, a corruptible decision log, and silent dirty-tree stashing. Closing the gap is mostly mechanical: make each SKILL defer to its PROMPT.md (or regenerate it from PROMPT.md), then layer on the few genuinely-new items (lock-age computability, lock release on abort, schedule staggering, a run-log heartbeat, and the failed-fetch reset).
