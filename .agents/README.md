# TaskLens Agent System

Four scheduled agents run against this repository. Each is autonomous within its domain, shares state through files in this directory, and is designed to avoid redundant or conflicting work.

> **Platform note:** This repo is developed on **Windows / PowerShell**. Commands in the prompts are written in bash syntax for readability — if your shell is PowerShell, translate accordingly: no `$(...)` command substitution, no `/tmp`, use `;` or `&&` per your shell, and use literal dates instead of `date`. See each prompt's "Shell & platform" note.

---

## Shared Coordination Files

| File | Purpose |
|------|---------|
| `backlog.md` | Master task tracker **and the single place agents propose work.** Proposals are logged here with status `pending-review`. **Every agent checks this before starting any work.** |
| `decisions.md` | **Maintainer-owned** record of approved / rejected verdicts. Agents only **read** it (to avoid re-proposing); they never write to it. Verdicts are recorded by the maintainer via Cowork (see "Proposal & Approval Workflow"). |
| `known-flaky.md` | Maintainer-maintained allowlist of known-flaky test names. The **only** failures git-manager may treat as flaky. |
| `PAUSE` (if present) | Emergency kill-switch. **Local-only** (gitignored). If this file exists, **every agent stops immediately** — no commits, no tracked-file writes (the single exception is one heartbeat line to `run-log.md`). |
| `.lock` (transient) | Run-lock. **Local-only** (gitignored). Held by the currently-running agent so the agents don't overlap on one working tree. |
| `run-log.md` | **Local-only** (gitignored) run heartbeat. Every agent appends one dated line on **every** exit path (including paused / lock-held / no-op). The maintainer's durable signal that the fleet is alive. |

---

## Execution Model & Safety Infrastructure

The anti-loop / anti-runaway protections are **not** purely prompt-internal — they have infrastructural backstops. The previous bot ("Sentinel") went haywire because nothing outside its prompt could stop it. These mechanisms exist so that can't happen here:

1. **Staggered schedules (primary concurrency guarantee).** The agents are scheduled on **non-overlapping** days/times so two can never fire in the same window. This — not the lock — is the real defense against concurrent operation on the shared `dev` tree:

   | Agent | Schedule |
   |-------|----------|
   | git-manager | **Mon 02:00** |
   | feature-agent | **Tue 02:00 & Fri 02:00** |
   | code-quality | **Wed 02:00** |
   | community | **Thu 02:00** (weekly check; may also be triggered after a release) |

   The lock (below) is a backstop for the rare case of a manual run colliding with a scheduled one — it narrows but does not eliminate the race, because check-then-create is not atomic.
2. **Kill-switch (`.agents/PAUSE`).** The maintainer's emergency brake. Create the file to halt all agents on their next run; delete it to resume. Every prompt checks for it as step 0.0. Local-only (gitignored).
3. **Run-lock (`.agents/.lock`).** Serializes agents so they never operate on the same working tree at once. The lock file contains one line: `<agent-name> | <ISO-8601 timestamp with date AND time>`. An agent that finds a **fresh** lock (under 2 hours old, judged from the timestamp vs current wall-clock time) exits immediately; otherwise it claims the lock and **releases it on every exit path** (see #5). A **stale** lock (≥2 hours, or — if wall-clock is unavailable — dated before today) is assumed abandoned and may be reclaimed. Local-only (gitignored).
4. **Lock released on abort, not just on success (try/finally).** Because many exit paths (recovery stop, flag-and-stop, suite failure, loop guard) don't route through "Finishing Up", every prompt treats lock deletion as a `finally` around all post-acquisition work: the lock is deleted before exiting on *any* path. The only time it should outlive the process is an actual crash (caught by the 2-hour reclaim).
5. **Run-log heartbeat (`.agents/run-log.md`).** Every agent appends one dated line on **every** exit path — including PAUSE, lock-held, loop-guard, and no-op exits — so the maintainer can tell "healthy, nothing to do" from "the scheduler stopped" or "every run aborts on a stale lock". Local-only (gitignored); not committed.
6. **Worktree isolation (preferred).** Each agent should ideally operate in its own git worktree under `.claude/worktrees/<agent>` so `git checkout` / branch state can't collide. When worktrees are in use, the lock is still required for the shared `dev` push and shared `.agents/*.md` edits.
7. **`git pull --rebase` before every push.** Absorbs other agents' commits and prevents non-fast-forward rejections.
8. **Loop Guard.** Each agent inspects its own recent run history and refuses to repeat an action it already performed in 2 of the last 3 runs — the single strongest signal of a runaway loop.
9. **Branch protection (maintainer action).** The "never touch `main`" rule is enforced by **GitHub branch protection on `main`** (require PR + review, block direct pushes, block force-push), **not** by agent goodwill. Verify protection is enabled before relying on these agents.

---

## Agents

### Git Manager (`git-manager/`)
**Schedule:** Weekly — **Mon 02:00**  
**Autonomy:** Fully autonomous  
Handles Dependabot PR triage, bot/orphan branch cleanup, the forward-merge of `main` → `dev`, and CI health. Makes all git housekeeping decisions without maintainer input unless something is genuinely ambiguous. Commits its own notes/backlog updates directly to `dev`; squash-merges routine Dependabot PRs autonomously. **Never edits source files.**

### Code Quality Agent (`code-quality/`)
**Schedule:** Weekly — **Wed 02:00**  
**Autonomy:** Mostly autonomous  
Runs ESLint, checks Obsidian review compliance, identifies refactoring opportunities, polishes UX copy, CSS, and accessibility. Auto-commits safe non-behavioral fixes to `dev` (capped at 3–4 per run). Flags any change that alters runtime behavior for maintainer approval before committing.

### Feature Agent (`feature-agent/`)
**Schedule:** Twice weekly — **Tue 02:00 & Fri 02:00**  
**Autonomy:** Semi-autonomous  
Implements features from `feature-agent/ideas.md` and `backlog.md`, researches Obsidian ecosystem integrations (Dataview, Tasks, Kanban, Calendar), studies competitors, and prototypes. **Opens a PR to `dev` and stops** for maintainer review on any significant feature — it never self-merges to `dev`. Only the narrowest, ref-gated polish (and its own notes/research-log updates) may be committed directly.

### Community Manager (`community/`)
**Schedule:** Weekly — **Thu 02:00** (and may be triggered after a release)  
**Autonomy:** Semi-autonomous — drafts only, never publishes without approval  
Handles the public-facing side: Discord release announcements, Obsidian community-forum thread updates, README / description / docs maintenance, release-notes and changelog quality (written in the maintainer's solo-developer voice). It only acts when there is something **genuinely worth communicating** (a release, a significant feature, an important fix) — never for routine code-quality tweaks. It prepares drafts and logs them in `backlog.md` (`pending-review`) for maintainer approval before anything is posted or pushed.

---

## Proposal & Approval Workflow (how agents get a "yes")

The maintainer approves or rejects proposals **interactively through Cowork conversations**, not by hand-editing markdown. The flow:

1. **Agent proposes** by adding a row to `backlog.md` with status **`pending-review`** (using its `GM-/CQ-/FA-/CM-` prefix and a `Ref`). It does **not** open a feature PR for approval-gated work, and it does **not** write to `decisions.md`.
2. **Maintainer decides** in a Cowork session. The verdict is recorded for the agents in one of two ways: the maintainer (or the Cowork session acting for them) flips the `backlog.md` row to `in-progress`/`todo` (approved) or `rejected`, **and** appends the verdict row to the maintainer-owned `decisions.md`. `decisions.md` remains the durable, append-only record agents read to avoid re-proposing.
3. **Agent checks status every run.** A row still marked `pending-review` means **the maintainer hasn't decided yet — wait.** Do not re-propose, do not nudge, do not start the work. Only a row the maintainer has moved to `todo`/`in-progress` (or an `approved` `decisions.md` row matched on `Ref`) is a green light.

**Agents never write `decisions.md`.** It is maintainer-owned (populated via Cowork). Agents only read it, matching on the `Ref` column first, then prose.

---

## Source Layout (agents must not assume file locations)

`src/` is organized into **subdirectories** — paths move over time, so **discover, don't assume**:

- `src/main.ts`, `src/constants.ts` — only these two are at the `src/` root.
- `src/models/` — `Task.ts`
- `src/services/` — `TaskManager.ts`, `TaskParser.ts`, `TaskSanitizer.ts`
- `src/settings/` — `Settings.ts`, `SettingsTab.ts`
- `src/modals/` — `ConfirmModal.ts`, `QuickAddModal.ts`, `WelcomeModal.ts`
- `src/views/` — `DashboardView.ts`, `TaskListView.ts`, `TimelineView.ts`, `StatsView.ts`, plus components (`BoardComponent`, `HeaderComponent`, `StatsComponent`, `TaskListComponent`, `TimelineComponent`).
- `src/styles.css` — **the CSS source**, tracked in git. The root-level `styles.css` is a **gitignored build artifact** — never edit or `git add` it.

**Always grep recursively** (`grep -rn --include='*.ts' "pattern" src/`). Never assume a file is at `src/<Name>.ts`.

---

## Generated / ignored files — never stage these

`main.js`, `styles.css` (root), `data.json`, `tsconfig.tsbuildinfo`, `coverage/`, `eslint-report.json`. Always use **targeted** `git add <path>` — **never `git add -A`**.

**Local-only control/telemetry files** (gitignored — never commit, never stage): `.agents/.lock`, `.agents/PAUSE`, `.agents/run-log.md`. These carry transient/local state and must never propagate into `dev`.

---

## Build / test environment

- Builds and tests must run with **Node 22** (matches CI in `.github/workflows/ci-build.yml`). If `npm run build` fails for environment reasons (not code), do **not** "fix" source to satisfy a broken toolchain — flag it.
- Available npm scripts: `dev`, `build`, `version`, `test`. **There is no `lint` script** — use `npx eslint .` directly (never invent `npm run lint`).
- `npm run build` runs `tsc -noEmit -skipLibCheck && esbuild`.
- The repo lives deep inside an Obsidian vault (`.obsidian/plugins/tasklens`) and `.obsidian/` is gitignored. **Operate only within the plugin repo root; never wander up into the vault.**

---

## Release flow (so agents don't "help" with releases)

`dev` is the integration branch; `main` is release-only. The maintainer promotes `dev` → `main` and tags releases on their own cadence. **Agents never open release PRs, never push `main`, and never tag.**

---

## When Things Go Wrong (shared recovery procedures)

Each prompt references this section. Default posture: **when in doubt, restore a clean tree, flag in `backlog.md`, and stop.** Never commit a conflicted or red-build state. **On every such abort: release the lock (`delete .agents/.lock`) and append a heartbeat line to `run-log.md` before exiting** — these are the two things that must happen no matter which path you take out.

- **Dirty tree / unknown branch on startup.** If `git status` is dirty, or you're on a `feat/*`/`fix/*` branch you don't recognize from your `notes.md` In-Flight list, clean up first: stash or discard the changes and return to `dev` before doing anything. If `git status` shows an in-progress merge/rebase you didn't start, **stop and flag** — another agent left the tree dirty.
- **Push rejected (non-fast-forward).** Run `git pull --rebase origin dev` and retry the push **once**. If it still fails or conflicts in source, abort, write a `backlog.md` note, and stop. **Never force-push.**
- **Network / `gh` / API failure.** Retry the command **once**. If it still fails, log `"network unavailable — skipped X"` in `notes.md` and continue with offline work only. **Never assume an errored or empty command output means "nothing to do"** — distinguish "no results" from "command failed" (an errored `gh pr list` is not a clean week).
- **Merge / rebase conflict mid-operation.** Any time `git status` shows conflicts you didn't expect: `git merge --abort` / `git rebase --abort`, restore a clean tree, flag in `backlog.md`, stop. Never commit a file containing `<<<<<<<` markers.
- **Verification suite fails after a fix.** Make **one** focused attempt to fix it. If it still fails, `git restore` / `git checkout -- <files>` to discard your changes, flag the attempted fix in `backlog.md`, and move on. Never commit a red build; never iterate on the same failing fix within a run (see each prompt's Loop Guard).

---

## Design Principles

These rules were established after a previous bot went haywire (same prompt for months, always compelled to produce output, no real memory):

1. **Check `backlog.md` first.** No duplicates. If a task is already tracked, don't re-do it. A row still marked `pending-review` is **waiting on the maintainer** — don't start it and don't re-propose it.
2. **Check `decisions.md` first.** Never re-propose a rejected idea. Match on the structured `Ref` column (backlog ID / `ideas.md` heading), then on prose. `decisions.md` is **maintainer-owned and read-only to agents** — verdicts are recorded by the maintainer via Cowork (see "Proposal & Approval Workflow").
3. **Saying "nothing to do" is correct output.** An agent that finds no meaningful work should write a brief status note, append a `no-op` heartbeat to `run-log.md`, and exit cleanly. Do **not** invent work to fill a run.
4. **State lives in `notes.md`.** Each agent tracks what it last did, what it skipped, and why. The Loop Guard reads this history to avoid repeating itself.
5. **Feature branches off `dev`.** Feature PRs are **squash-merged by the maintainer**, not the agent — the agent opens the PR and stops. After a merge, delete the branch (locally if it exists, and remotely if not already removed by the squash-merge). git-manager *does* squash-merge Dependabot PRs autonomously — that is the one exception (`--squash --delete-branch`).
6. **Never touch `main`.** `main` is release-only and managed by the maintainer; enforced by branch protection (see Safety Infrastructure).
7. **Run `npm run build && npx eslint . && npm run test` (Node 22) before any commit.** A commit that breaks the build or adds lint errors is worse than no commit.
8. **Flag behavioral changes.** Any change that could alter runtime behavior needs maintainer approval — including added `normalizePath()` calls and `registerEvent()` wrapping. Style/lint/comment fixes do not.
9. **Plain commits.** No co-author tags, no "Generated by AI" footers. Commits read as normal solo-developer work using conventional commit style (`fix:`, `feat:`, `refactor:`, `chore:`). **Trade-off (recorded in `decisions.md`):** this favours clean history over per-agent auditability — `notes.md` is therefore the authoritative audit trail of which agent did what.
