# Prompt Review — TaskLens Scheduled Agents

**Reviewer:** prompt-engineering pass
**Date:** 2026-06-19
**Scope:** `git-manager/PROMPT.md`, `code-quality/PROMPT.md`, `feature-agent/PROMPT.md`, plus shared `README.md`, `backlog.md`, `decisions.md`, `feature-agent/ideas.md`.
**Cross-referenced against:** `AGENTS.md`, `package.json`, `.gitignore`, `.github/workflows/*`, `.github/dependabot.yml`, and the actual `src/` layout.

These agents are meant to replace a solo developer's maintenance/feature loop and run unattended. The design intent (anti-Sentinel: memory in `notes.md`, "nothing to do is valid", check `backlog`/`decisions` first) is sound. But several instructions **will fail on the first run on this machine**, and the anti-loop protection is weaker than it looks because it lives entirely inside the prompt with no infrastructural backstop.

Severity legend: 🔴 **Critical** (breaks on run / unsafe) · 🟠 **High** (real risk of wrong behavior) · 🟡 **Medium** (degrades over time / gray area) · 🔵 **Low** (polish).

---

## Executive summary — fix these first

1. 🔴 **Shell mismatch.** Every commit command uses `$(date +%Y-%m-%d)` and `/tmp/...`. This host is **Windows / PowerShell** — `date +%Y-%m-%d` errors and `/tmp` doesn't exist. The finishing-up commit in *all three* prompts fails as written. (Verified.)
2. 🔴 **`styles.css` is gitignored and not tracked**, yet code-quality is told to edit and `git add styles.css`. `git add` on an ignored file errors; the agent has no idea where real CSS source lives.
3. 🔴 **Hardcoded source paths are wrong.** `src/TimelineView.ts` / `src/TaskListView.ts` don't exist (they're in `src/views/`); `grep ... src/*.ts` misses 17 of 19 source files because `src/` is organized into subdirectories.
4. 🟠 **No circuit-breaker / kill-switch and no concurrency safety.** Three agents share one working tree and one `dev` branch with no lock, no `git pull --rebase`, no pause file, and no "I've tried this exact thing N times — stop" guard. This is the actual Sentinel risk, and it's currently unaddressed at the infrastructure level.
5. 🟠 **No ID-allocation scheme for `backlog.md`.** The example uses `BQ-001` but nothing tells agents how to mint unique IDs — two agents will collide.

---

## 1. Completeness — gaps & missing procedures

### 1.1 🔴 Wrong/incomplete source paths (code-quality §2c, §2g)
`code-quality/PROMPT.md` §2c runs:
```
grep -n "vault\.\(on\|modify\|create\|delete\|rename\)" src/TimelineView.ts src/TaskListView.ts
```
Those files do **not** exist at that path. Actual layout (verified via `git ls-files`):
```
src/views/TimelineView.ts
src/views/TaskListView.ts
src/services/TaskParser.ts
src/services/TaskManager.ts
src/main.ts            ← only main.ts is at src/ root
```
§2g `grep -n "as any\|as HTMLElement\|as TFile" src/*.ts` matches only the two top-level files (`constants.ts`, `main.ts`) — it silently skips `modals/`, `models/`, `services/`, `settings/`, `views/` (17 of 19 `.ts` files).

**Fix — replace §2c grep with:**
```bash
grep -rn "vault\.\(on\|modify\|create\|delete\|rename\)" src/views/TimelineView.ts src/views/TaskListView.ts
```
**Fix — replace §2g grep with a recursive search:**
```bash
grep -rn --include='*.ts' "as any\|as HTMLElement\|as TFile" src/
```
Add a general note to both code-quality and feature-agent prompts:
> **Source layout:** `src/` is organized into subdirectories — `modals/`, `models/`, `services/` (`TaskManager`, `TaskParser`, `TaskSanitizer`), `settings/`, `views/` (`DashboardView`, `TaskListView`, `TimelineView`, `StatsView`, `BoardComponent`, etc.). `main.ts` and `constants.ts` are at `src/` root. **Always grep recursively (`grep -r --include='*.ts' src/`); never assume a file is at `src/<Name>.ts`.**

### 1.2 🔴 `styles.css` is a build artifact, not source (code-quality §1, §2b, §2e, §3)
`.gitignore` line 9 lists `/styles.css` and `git check-ignore` confirms it's ignored and untracked. `AGENTS.md` §14 confirms it's a generated artifact attached to releases. But:
- §1 lists "Fixing a hard-coded hex color to use an Obsidian CSS variable" as **auto-commit safe**.
- §2b greps `styles.css`; §2e says "Scan `styles.css`".
- §3 example: `git add src/SpecificFile.ts styles.css`.

`git add styles.css` on an ignored file **errors** (`use -f if you really mean it`). If the agent "fixes" it anyway, either nothing is committed or it force-adds a build artifact — exactly the thing `AGENTS.md` §14 forbids. And the agent is never told where CSS source actually lives (the esbuild CSS entry point).

**Fix:** The maintainer must tell the agents where CSS source is. Add to `AGENTS.md` and code-quality §2e:
> **CSS source location:** `styles.css` at repo root is a **generated build artifact (gitignored)** — never edit or `git add` it. CSS source lives at `<REAL PATH — maintainer to fill in, e.g. src/styles/*.css or a `styles/` entry bundled by esbuild>`. All CSS hygiene fixes target the source file(s) only. If you cannot locate the CSS source, **flag in `backlog.md` and do not touch `styles.css`.**

Until that path is filled in, §2e and the §1 "hardcoded hex color" auto-commit item should be marked **blocked**, because the agent literally cannot do them correctly.

### 1.3 🟠 "Required checks" is undefined (git-manager §1a)
git-manager auto-merges Dependabot PRs when "all required checks green." The repo has three workflows: `ci-build`, `eslint` (which runs with `continue-on-error: true` and only uploads SARIF — it can be "green" while reporting violations), and `claude`. The agent isn't told which check **names** gate a merge.

**Fix — add to §1a:**
> **Required checks** for an auto-merge are exactly: `CI Build / Build plugin`. The `ESLint` SARIF workflow is informational (`continue-on-error`) and does **not** gate merges — ignore its conclusion. If a required check is missing entirely (not just failing), treat as "not green" and flag.

### 1.4 🟡 No procedure for `package-lock.json` / lockfile in Dependabot merges
Dependabot bumps touch `package-lock.json`. AGENTS.md §11 forbids unrelated lockfile churn in *logic* PRs, but Dependabot PRs legitimately carry it. The prompt doesn't acknowledge this, risking the agent "cleaning up" the lockfile. Add: "Dependabot PRs are expected to modify `package-lock.json` — that is correct, do not revert it."

### 1.5 🟡 Missing: what counts as "done" for a flagged item
Flagged items get a `backlog.md` row with status `todo`, but nothing tells an agent to **check whether the maintainer already actioned it** before re-flagging next week. See §3.3 (no stable IDs) — this is how duplicates re-appear.

---

## 2. Anti-loop robustness — the Sentinel problem

The stated protection is: (a) read `backlog`/`decisions` first, (b) memory in `notes.md`, (c) "nothing to do is valid output." That's necessary but **not sufficient**. Sentinel's failure mode — "compelled to produce output, repeating the same fixes for months" — can still happen here:

### 2.1 🔴 No infrastructural backstop. Protection is 100% prompt-internal.
A scheduled agent that drifts, hallucinates its notes, or gets a subtly different prompt has nothing stopping it. The prompt cannot enforce its own cadence ("runs weekly" is a claim, not a guarantee). **The real anti-Sentinel defenses are infrastructural and currently absent:**

**Fix A — Kill-switch file (cheap, powerful).** Add to §0 of *all three* prompts as the literal first step:
> **0.0 — Check for a pause file.** If `.agents/PAUSE` exists, immediately stop. Write nothing, commit nothing, exit. This is the maintainer's emergency brake.

**Fix B — Self-circuit-breaker.** Add to §0 of all three:
> **0.1 — Loop guard.** Read the last 3 entries in your `notes.md` run history. If you are about to perform an action (same fix, same file, same PR, same branch deletion) that appears in **2 or more** of the last 3 runs, **do not repeat it.** Instead, write a `backlog.md` row flagging "repeated action not converging — needs maintainer" and skip it. Repetition across runs is the #1 signal of a runaway agent.

**Fix C — Branch protection (maintainer action, document it).** Add to `README.md`:
> The "never touch `main`" rule is enforced by GitHub branch protection on `main` (require PR + review, no direct pushes, no force-push), **not** by agent goodwill. Verify protection is enabled before relying on these agents.

### 2.2 🟠 "Nothing to do" still produces a commit every run
All three finishing-up sections commit `notes.md`/`backlog.md` **even when nothing changed** ("commit the notes files if modified… even if you committed no code fixes"). Over 6 months that's ~25–50 `chore: X agent run DATE` commits with no real content on `dev` — history noise, the very thing the system is trying to avoid.

**Fix — gate the notes commit on a real change.** Replace the finishing-up commit blocks with:
```bash
# Only commit if there is an actual content change beyond the date stamp.
git add .agents/<agent>/notes.md .agents/backlog.md
if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "chore: <agent> run <DATE>"   # see §4 for DATE handling
  git push origin dev
fi
```
And soften the instruction from "commit even if no code changed" to "commit **only if `notes.md` or `backlog.md` actually changed**."

### 2.3 🟡 "Research mode" is an infinite make-work generator
feature-agent §6 makes research the always-available fallback ("If there's nothing ready to implement, research is the fallback"). Competitor/ecosystem research never "runs out" — there is always one more README to read. This directly undercuts §8 ("do not invent work to fill the run"). Sentinel-shaped.

**Fix — cap and date-gate research.** Add to §6:
> Research is **rate-limited**: do not research the same competitor or ecosystem target more than once per **30 days** (check the dates in `notes.md`). If every target was researched within the last 30 days and there is nothing ready to implement, the correct output is **"No ready work"** per §8 — do **not** re-research for the sake of producing output.

### 2.4 🟡 No notes/backlog rotation → context bloat over time
`notes.md` run-history tables and `backlog.md` grow unboundedly. By month 3–6 the agent reads ever-larger stale tables each run, increasing cost and the chance it misreads its own history.

**Fix — add to each Finishing Up section:**
> If `notes.md` run history exceeds 20 rows, move rows older than 60 days into a `## Archive` section at the bottom (or a sibling `notes-archive.md`). Keep the active table short.

---

## 3. Inter-agent coordination

### 3.1 🟠 No concurrency safety — three agents, one working tree, one `dev`
All three `git checkout dev` / `git push origin dev` against the **same clone**. If schedules overlap (git-manager weekly + code-quality weekly + feature twice-weekly can land on the same day/hour), they will:
- step on each other's `git checkout` (feature-agent on a `feat/*` branch while git-manager runs `git checkout dev; git merge`),
- race on `git push origin dev` → non-fast-forward rejection with no recovery instruction (see §8.1),
- double-edit `backlog.md` → merge conflict.

**Fix A — serialize via a lock file.** Add to §0 of all three:
> **0.2 — Acquire the run lock.** If `.agents/.lock` exists and its timestamp is under 2 hours old, another agent is running — exit immediately. Otherwise create `.agents/.lock` containing your agent name and start time. Delete it in your Finishing Up step (and only then). If you crash, the 2-hour staleness window lets the next run reclaim it.

**Fix B — always rebase before push.** Add to every push:
> Before any `git push origin dev`, run `git pull --rebase origin dev` to absorb other agents' commits. If the rebase conflicts in `.agents/*.md`, prefer the union of both changes (keep all backlog rows). If it conflicts in source, abort, leave a `backlog.md` note, and stop.

**Fix C (stronger) — worktree isolation.** Recommend each agent operate in its own git worktree (`.claude/worktrees/<agent>` already exists in the tree) so `git checkout` state can't collide. Note this in `README.md` as the preferred execution model.

### 3.2 🟠 No `backlog.md` ID-allocation scheme
The code-quality example mints `BQ-001`. Nothing defines the prefix per agent or how to find the next free number. Two agents (or two runs) both pick `BQ-001`.

**Fix — add to `backlog.md` header and each prompt's flagging section:**
> **ID format:** `<PREFIX>-<NNN>` where PREFIX is `GM` (git-manager), `CQ` (code-quality), `FA` (feature-agent). To allocate: scan all existing rows (Active + Completed + Rejected) for your prefix, take the highest number, add 1. IDs are never reused.

### 3.3 🟠 `decisions.md` matching is fuzzy free-text → re-proposal risk
Agents must "scan this table; if your proposal matches a `rejected` row, skip it." Matching is by prose. An agent that words a proposal differently won't recognize the match and will re-propose — the exact Sentinel loop. There is no stable key linking `ideas.md` ↔ `backlog.md` ↔ `decisions.md`.

**Fix:** Give `decisions.md` a `Ref` column tied to the backlog ID and/or the `ideas.md` heading, and require agents to record the ref when flagging:
```
| Date | Verdict | Ref | Agent | Proposal | Reason |
```
And in each prompt: "When you flag work, cite the originating `ideas.md` heading or backlog ID. When checking `decisions.md`, match on that ref first, then on prose."

### 3.4 🟡 `in-progress` rows can wedge forever
"Set status to `in-progress`" with no timeout. If an agent abandons a task (crash, blocked), the row stays `in-progress` and every future run skips it as "already being handled."

**Fix — add to `backlog.md` instructions:**
> An `in-progress` row older than **14 days** with no commits on its branch is **stale** — any agent may reset it to `todo` (note the reset in `notes.md`).

### 3.5 🟡 Agents don't read each other's `notes.md`
Cross-agent state flows only through `backlog.md`. feature-agent can't see that git-manager left `dev` mid-conflict. Acceptable if §3.1 lock + rebase land, but worth a line: "If `git status` shows an in-progress merge/rebase you didn't start, stop and flag — another agent left the tree dirty."

---

## 4. Git discipline

### 4.1 🔴 `$(date +%Y-%m-%d)` fails on Windows/PowerShell (all three prompts)
Finishing Up in all three uses `git commit -m "chore: ... run $(date +%Y-%m-%d)"`. This host is PowerShell; `date +%Y-%m-%d` returns *"Cannot convert value '+%Y-%m-%d' to type DateTime"* (verified). The commit fails. Even the ` ```bash ` fences don't help unless the agent is guaranteed to shell out to git-bash, which isn't stated.

**Fix — make it shell-agnostic.** Tell agents to compute the date themselves and inline a literal:
> Use today's date as a literal `YYYY-MM-DD` string in commit messages (you already know it — you stamped `notes.md` with it). Do **not** use shell command substitution like `$(date ...)`; this repo is developed on Windows/PowerShell where that syntax fails. Example: `git commit -m "chore: code quality agent run 2026-06-19"`.

Audit every fenced block: `/tmp/eslint-report.json` (code-quality §2a) likewise doesn't exist on Windows.

**Fix — replace §2a with a repo-local, cross-platform path:**
```bash
npx eslint . --format json > eslint-report.json   # repo-local; add to .gitignore
```
And add `eslint-report.json` to `.gitignore` so it's never committed.

### 4.2 🟠 `git push origin --delete` after a squash-merge will error (feature-agent §3)
"After a PR is merged, delete the local and remote branch: `git push origin --delete feat/...`." But if the maintainer merged via GitHub's squash-merge with "delete branch" (the README's stated model, design principle #5), the remote branch is **already gone** → the command errors. The agent runs twice weekly, so by next run this is the common case.

**Fix:**
```bash
# Remote branch may already be deleted by the squash-merge. Guard it.
git branch -d feat/... 2>/dev/null || true
git push origin --delete feat/... 2>/dev/null || echo "Remote branch already removed."
```

### 4.3 🟠 Who actually squash-merges? (README principle #5 vs feature-agent §2)
README design principle #5: "Squash-merge when done." feature-agent §2: "Do not merge the PR yourself." These are only consistent if the **maintainer** does the squash-merge — but that's never stated, so "squash-merge when done" reads as an agent instruction the agent is also told not to do.

**Fix — clarify in README #5 and feature-agent §2:**
> Feature PRs are **squash-merged by the maintainer**, not the agent. The agent opens the PR and stops. (git-manager *does* squash-merge Dependabot PRs autonomously — that's the one exception, and it uses `--squash --delete-branch`.)

### 4.4 🟠 Forward-merge can leave `dev` dirty with no cleanup (git-manager §1d)
`git merge origin/main --no-edit` with conflicts → working tree left in a conflicted, half-merged state. §1d says "add a row to backlog and leave a note" but never runs `git merge --abort`, so the next agent inherits a broken tree.

**Fix — §1d on conflict:**
```bash
git merge origin/main --no-edit -m "chore: merge main into dev" || {
  git merge --abort
  echo "Forward-merge conflict — aborted, tree restored. Flagging for maintainer."
  # add backlog row + notes entry
}
```
Also: before §1d's checkout, verify a clean tree (`git status --porcelain`) and that no other agent holds the lock (§3.1).

### 4.5 🟡 No reminder to git-manager about artifacts / `git add -A`
code-quality and feature-agent forbid `git add -A` and `main.js`; git-manager has no equivalent guard. Its adds are targeted (good) but a one-line "never `git add -A`; never stage `main.js`/`styles.css`/`data.json`" parallel to the others would harden it.

### 4.6 🔵 README wording: git-manager "commits directly to dev for local fixes"
git-manager §2 says "Never touch source files." So "local fixes" really means only `notes.md`/`backlog.md`. Reword README to "commits its own notes/backlog updates directly to `dev`" to avoid implying it edits code.

---

## 5. Autonomy boundaries — auto-commit vs approval

### 5.1 🟠 "Safe" list contains genuinely behavioral changes (code-quality §1)
The boundary test is "Could this change cause a different outcome at runtime?" Two items on the **safe/auto-commit** side fail that test:
- **"Adding missing `normalizePath()` calls"** — normalization changes path comparison/resolution results. That *is* a runtime behavior change (intended, but still behavioral, and AGENTS.md §4 notes scan-folder paths are *already* normalized as of v1.3.0, so a redundant call could even double-normalize).
- **"Fixing event listener registration to use `registerEvent()`"** — changes plugin lifecycle/cleanup behavior. AGENTS.md §9 explicitly says `TimelineView`/`TaskListView` "**require verification**" — i.e., these are *not* mechanical.

Listing these as auto-commit contradicts the boundary and re-opens the "agent confidently changes behavior unattended" risk.

**Fix — move both to the flag-for-approval side**, or carve a tight exception:
> `registerEvent()` wrapping and added `normalizePath()` calls are **behavioral** — flag them in `backlog.md` with the exact diff and wait for approval. The *only* mechanical exception: wrapping a raw `vault.on(...)` whose return value is currently discarded, in a view that already imports and uses `registerEvent` elsewhere — and even then, run the full suite and note it explicitly as "behavioral, low-risk" in `notes.md`.

### 5.2 🟠 The 50–100 line dead zone (feature-agent §1 vs §2)
§1: "significant feature = >~100 lines." §2: auto-commit only if "<~50 lines." A 70-line change is *not* significant per §1 yet *not* auto-committable per §2. Undefined behavior.

**Fix — make the thresholds align:**
> Anything over **~50 lines total**, or touching `TaskParser.ts`/`TaskManager.ts`/`main.ts`, or adding UI/settings → **PR + approval**. There is no middle tier. The ~100-line figure in §1 is only a label for "obviously significant"; the *binding* gate is the 50-line / file-list / UI test in §2.

### 5.3 🟡 "Obvious polish item" / "clearly aligned" is subjective (feature-agent §2)
"Clearly aligned with an existing approved feature or an obvious polish item" is exactly the latitude that lets an agent rationalize make-work. Tighten: "If you cannot point to a specific `backlog.md` ID or `decisions.md` approved row that this change serves, it is **not** auto-committable — open a PR or skip."

### 5.4 🟡 "Known flaky test" merge exception is a loophole (git-manager §2)
"Never merge a PR with failing CI **unless the failure is a known flaky test**." An autonomous agent deciding what's "flaky" can rationalize merging real failures.

**Fix:** Require the flaky test to be **pre-listed by the maintainer**:
> Only treat a failure as flaky if the test name appears in a maintainer-maintained `.agents/known-flaky.md` allowlist. Otherwise a red check always blocks the merge — no agent judgment calls.

---

## 6. Prompt clarity — ambiguities & contradictions

| # | Sev | Location | Issue | Fix |
|---|-----|----------|-------|-----|
| 6.1 | 🟠 | feature-agent §1 vs §2 | 50–100 line dead zone | See §5.2 |
| 6.2 | 🟠 | code-quality §1 | "safe" list includes behavioral items | See §5.1 |
| 6.3 | 🟡 | code-quality §6 | "no flagged items in backlog → do nothing" can be misread as "skip the eslint check entirely" | Reword: "Always run the ESLint/compliance checks. *If those come back clean* **and** no flagged items remain, then do nothing." |
| 6.4 | 🟡 | README #5 | "Squash-merge when done. Delete the branch locally." Dependabot branches are never local; feature branches are squash-merged by the maintainer | See §4.3; reword "delete the branch (locally if it exists, and remotely)". |
| 6.5 | 🟡 | git-manager §1b | Branch-pattern list (`palette/*`, `ux/*`, `fix-*`, `jules-*`) is a historical allowlist with no source of truth | Note: "These patterns are examples of *known bot prefixes*; when unsure whether a prefix is a bot branch, **flag, don't delete.**" |
| 6.6 | 🔵 | code-quality §2b | `grep '#[0-9a-fA-F]{3,6}'` matches non-colors (`#region`, hex IDs, comments) | Add: "Confirm each hit is actually a color value in a style context before treating it as a violation." |
| 6.7 | 🔵 | all | ` ```bash ` fences imply a bash runtime that isn't guaranteed on this Windows host | Add a top-of-prompt note: "Commands are shown in bash syntax. This repo lives on Windows — if your shell is PowerShell, translate accordingly (no `$(...)`, no `/tmp`, use `;`/`&&` per your shell)." |

---

## 7. Missing project context the agents need

The prompts lean on `AGENTS.md` (good) but omit operational context an unattended agent can't infer:

1. 🔴 **Build/test environment.** CI uses Node 22 (`ci-build.yml`). The local Windows host's Node version is unstated. `npm run build` runs `tsc -noEmit -skipLibCheck && esbuild`. If local Node ≠ CI Node, the agent may see failures CI doesn't (or vice versa). **Add to each prompt:** "Builds/tests must be run with Node 22 (matches CI). If `npm run build` fails for environment reasons (not code), do **not** 'fix' source to satisfy a broken toolchain — flag it."
2. 🔴 **`npm` scripts available** are `dev`, `build`, `version`, `test`. There is **no `lint` script** — `npx eslint .` is correct, but state it so an agent doesn't invent `npm run lint`.
3. 🟠 **Repo lives deep inside an Obsidian vault** (`.obsidian/plugins/tasklens`) and `.obsidian/` is gitignored. An agent shelling out must not wander up into the vault. Add: "Operate only within the plugin repo root; never touch files outside it."
4. 🟠 **Generated/ignored files:** `main.js`, `styles.css`, `data.json`, `tsconfig.tsbuildinfo`, `coverage/` are gitignored. Only `main.js`/`data.json` are currently called out (and not in every prompt). List them once, centrally (see §1.2, §4.5).
5. 🟡 **Dependabot config specifics:** targets `dev` (not `main`), weekly, label `dependencies`, covers **both npm and github-actions** ecosystems. git-manager §1a only reasons about npm devDeps — it has no rule for **github-actions** bumps (e.g. `actions/checkout@v6 → v7`). Add an explicit github-actions branch: "Action version bumps: auto-merge patch/minor if CI green; flag majors."
6. 🟡 **What `dev` vs `main` mean in the release flow.** Agents know "never push main" but not the release cadence (when/how `dev`→`main` happens, who tags). One sentence prevents an agent from "helpfully" opening a release PR.

---

## 8. Failure modes & recovery

Currently almost no failure path is specified. Add a shared **"When things go wrong"** section (could live in `README.md` and be referenced by each prompt):

### 8.1 🟠 Push rejected (non-fast-forward)
Common with concurrent agents. No instruction exists. **Add:** "If `git push origin dev` is rejected, run `git pull --rebase origin dev` and retry once. If it still fails or conflicts in source, abort, write a `backlog.md` note, and stop — never force-push."

### 8.2 🟠 Network / `gh` / API failure
`gh pr list`, `gh api`, `gh run list`, competitor README fetches all need network. No retry/abort guidance. **Add:** "If a `gh`/network command fails, retry once. If it still fails, log 'network unavailable — skipped X' in `notes.md` and continue with offline work only. Never assume a command's empty/error output means 'nothing to do' — distinguish 'no results' from 'command failed.'" (This last point is important: an errored `gh pr list` returning nothing could be misread as "no Dependabot PRs" and the agent reports a clean week.)

### 8.3 🟠 Merge conflict mid-operation
Covered partially for §1d forward-merge (§4.4) — generalize: any time `git status` shows conflicts the agent didn't expect, **`git merge/rebase --abort`, restore clean tree, flag, stop.** Never commit a conflicted/`<<<<<<<`-laden file.

### 8.4 🟠 Verification suite fails after a fix
code-quality §3 / feature-agent §3 say "fix the failures before committing." But if the agent **can't** fix them, there's no off-ramp — risk of thrashing. **Add:** "If the suite still fails after one focused attempt, `git restore`/`git checkout -- <files>` to discard your changes, flag the attempted fix in `backlog.md`, and move on. Never commit a red build; never keep iterating on the same failing fix within a run (see Loop Guard §0.1)."

### 8.5 🟡 Partial work / crash recovery
If an agent dies after `git checkout -b feat/...` but before pushing, the next run finds an orphan local branch and a dirty tree. **Add to §0:** "On startup, if `git status` is dirty or you're on a `feat/*`/`fix/*` branch you don't recognize from `notes.md` In-Flight, clean up (stash or discard) and return to `dev` before doing anything."

### 8.6 🟡 `data.json` / local plugin state
Gitignored, but a careless `git add -A` (already forbidden) or a build could surface it. Reinforce the targeted-add rule everywhere.

---

## 9. Scalability — will this hold at 3 / 6 months?

1. 🟠 **Hardcoded paths already rotted** (§1.1) and will keep rotting as files move. **Fix:** never hardcode `src/<File>.ts`; always `grep -r`. Add a "paths may move — discover, don't assume" principle.
2. 🟠 **AGENTS.md section numbers are cited as `§8`, `§9`, `§11`, `§12`** across all prompts. Renumbering `AGENTS.md` silently breaks every reference. **Fix:** cite by rule *name* ("the sentence-case rule", "the registerEvent memory-management rule") or add stable anchors/IDs to AGENTS.md headings and reference those.
3. 🟡 **Unbounded growth** of `backlog.md`, `notes.md`, `ideas.md` → context bloat and slower, costlier, more error-prone runs (§2.4). Add archival policy.
4. 🟡 **`ideas.md` competitor list will go stale** (forks abandoned, repos renamed — `taskgenius-plugin`, `TaskForge` already have no repo/author filled in). The research procedure will waste runs chasing dead links. **Fix:** add a "last verified" date column; drop a target after 2 consecutive failed fetches and note it.
5. 🟡 **No versioning of the prompts themselves.** When the maintainer edits a PROMPT.md, there's no changelog, so a misbehaving run can't be traced to a prompt change. **Fix:** add a `## Changelog` footer to each PROMPT.md (date + one line per edit).
6. 🟡 **Dependency drift in auto-merge policy.** Today eslint 10 / typescript 6 / vitest 4 are current. As majors keep landing (the policy correctly flags them), but minor bumps of `eslint-plugin-obsidianmd` (0.3.x, pre-1.0) can introduce new rules that suddenly fail CI on unrelated code. **Fix:** "Pre-1.0 dev tools (e.g. `eslint-plugin-obsidianmd@0.x`): treat **minor** bumps as breaking — flag, don't auto-merge, because 0.x minors may add lint rules."
7. 🔵 **Co-author / attribution policy is a standing decision, not a bug — but flag it.** All three prompts mandate "commits read as normal solo-developer work, no AI attribution." That's the maintainer's call, but it trades away auditability: when something breaks, you can't tell which agent did it from `git log`. Consider a non-obtrusive trailer (`Agent: code-quality`) or at least ensure `notes.md` is a reliable audit trail. Worth a conscious decision recorded in `decisions.md`.

---

## Consolidated fix checklist (priority order)

**Must fix before first unattended run (🔴):**
- [ ] Replace all `$(date +%Y-%m-%d)` with literal dates; replace `/tmp/...` with repo-local paths (§4.1).
- [ ] Resolve the `styles.css` contradiction — tell agents the real CSS source path or block CSS work (§1.2).
- [ ] Fix hardcoded source paths; switch to recursive `grep -r --include='*.ts' src/` (§1.1).
- [ ] Add the `.agents/PAUSE` kill-switch and the Loop Guard to §0 of all three (§2.1).
- [ ] Add Node-22 / no-`lint`-script / generated-files context (§7.1, §7.2, §7.4).

**Should fix (🟠):**
- [ ] Run lock + `git pull --rebase` before push; clarify single-tree vs worktree model (§3.1).
- [ ] ID-allocation scheme for `backlog.md` (§3.2); ref column in `decisions.md` (§3.3).
- [ ] Move `normalizePath()`/`registerEvent()` off the auto-commit list (§5.1).
- [ ] Close the 50–100 line dead zone (§5.2).
- [ ] Guard `git push origin --delete` after squash-merge; clarify who squash-merges (§4.2, §4.3).
- [ ] `git merge --abort` on forward-merge conflict (§4.4).
- [ ] Define "required checks"; add github-actions Dependabot branch (§1.3, §7.5).
- [ ] Add the "When things go wrong" recovery section (§8).

**Improve durability (🟡/🔵):**
- [ ] Gate notes commits on real changes; archive old notes/backlog rows (§2.2, §2.4).
- [ ] Rate-limit research; add last-verified dates to competitor list (§2.3, §9.4).
- [ ] Stale `in-progress` and known-flaky allowlist (§3.4, §5.4).
- [ ] Cite AGENTS.md rules by name, not number; add prompt changelogs (§9.2, §9.5).
- [ ] Decide & record the attribution policy consciously (§9.7).

---

### Bottom line
The architecture (per-agent memory, shared backlog/decisions, "nothing to do is valid") is the right shape and meaningfully better than Sentinel. But as written the prompts (1) **break on the first run on this Windows host**, (2) **point at files that don't exist**, and (3) **rely entirely on prose for anti-loop and concurrency safety** with no kill-switch, lock, or branch protection behind them. The 🔴 items are quick mechanical fixes; the 🟠 concurrency/circuit-breaker items are what actually prevent a second Sentinel and deserve the most attention.
