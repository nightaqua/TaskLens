# Recurrence input redesign

## Current state

The recurrence field is a plain free-text `<input>` rendered by `QuickAddModal.onOpen()` (lines 136–143 of `src/modals/QuickAddModal.ts`). The label is "Repeat" with a hint description of `'Example: daily, weekly, every two days'`. Whatever the user types is stored verbatim in `this.recurrence` and written directly into the task line as `[repeat:: <value>]`.

There is only one place in the UI where a user can enter a recurrence value at task-creation time: this single text field in the QuickAdd modal. There is no edit-task modal; recurrence can only be changed by editing the markdown directly after the task is created.

### Valid recurrence strings (as handled by `TaskManager.calculateNextDueDate`)

| String(s) | Meaning |
|-----------|---------|
| `daily`, `d` | Every 1 day |
| `weekly`, `w` | Every 7 days |
| `monthly`, `m` | Every 1 month |
| `yearly`, `y` | Every 1 year |
| `Nd` (e.g. `2d`, `14d`) | Every N days |
| `Nw` (e.g. `2w`, `3w`) | Every N weeks |
| `Nm` (e.g. `3m`, `6m`) | Every N months |
| `Ny` (e.g. `2y`) | Every N years |
| Any of the above + `+` suffix (e.g. `2w+`, `monthly+`) | Same interval but "flexible" — next occurrence is measured from completion date rather than due date |

Strings that do not match any branch fall through silently: the regex `^(\d+)([dwmy])$` fails to match, `amount` stays `1` and `unit` stays `'d'`, so the task repeats in exactly 1 day with no warning to the user.

### Emoji format

The parser also recognises the Tasks-plugin emoji format (`🔁 weekly` / `🔄 weekly`) as a read-only fallback via `EMOJI_RECUR_MATCH_REGEX`. This is parsed into `task.recurrence` so the recurring chip is displayed correctly, but the QuickAdd modal and `TaskManager.addTask()` never write this format — they always write `[repeat:: ...]`. There is no code path that converts an emoji-format recurrence back to the bracket format on save.

## Problem

- Free-text input with no validation — typos silently fall back to "repeat in 1 day" (the `amount = 1, unit = 'd'` default in `calculateNextDueDate` when no branch matches).
- No discoverability — users must read documentation to know that `2w+` is a valid value, or that `week` (without the trailing `ly`) is not.
- Inconsistent: the emoji format (`🔁 weekly`) is parsed read-only but never written; the modal always writes `[repeat:: ...]` format. A user who copies recurrence syntax from another Tasks-plugin note may get unexpected behaviour.
- Testing gap: the parser's recurrence branch is only correct if the exact string matches; near-misses like `"Weekly"` (capital W) or `"week"` fall back silently. (`TaskParser.parseTaskMetadata` lower-cases the captured string before storing, so `"Weekly"` in the markdown becomes `"weekly"` in `task.recurrence` and is handled correctly — but `"week"` or `"bi-weekly"` still silently fall back to 1 day.)

## Proposed solution

Replace the free-text `<input>` for recurrence in `QuickAddModal` with a two-part UI:

1. A `<select>` (or button group) for the unit: Daily / Weekly / Monthly / Yearly
2. An optional numeric `<input>` (default 1) for the interval (e.g. "every 2 weeks")
3. A toggle checkbox for "flexible" (`+` suffix — repeat from completion date rather than due date)

This produces validated, structured output that maps directly to the `Nd`/`Nw`/`Nm`/`Ny` format the parser already handles, eliminating the free-text ambiguity.

## Acceptance criteria

- [ ] QuickAddModal renders a select + number input + flexible toggle instead of a text field for recurrence
- [ ] The assembled string (e.g. `2w+`) is written into the task line as `[repeat:: 2w+]`
- [ ] The parser and TaskManager require no changes (they already handle this format)
- [ ] Any existing tasks with free-text recurrences (`daily`, `weekly`, etc.) continue to work — the parser already handles those as aliases

## Files to change

- `src/modals/QuickAddModal.ts` — replace recurrence input element (the `Setting` block at lines 136–143)
- (No changes to TaskParser, TaskManager, or Task model)

## Known unknowns / risks

- **No edit-task UI exists yet.** Recurrence can only be set at task-creation time via QuickAddModal. If an edit modal is added in the future it will need the same structured input — a free-text field there would re-introduce the same problem.
- **Direct markdown editing bypasses the UI entirely.** Users who type recurrence strings directly into their notes are not covered by this change; the parser still accepts any string and silently falls back on unrecognised values. A follow-up validation warning (e.g. a lint command or a notice on file scan) would be needed to catch those cases.
- **Emoji-format recurrence from other plugins.** Tasks imported from the Tasks plugin may carry `🔁 weekly` in their source lines. These are parsed correctly into `task.recurrence` but if the user ever re-saves such a task through TaskLens (e.g. via a future edit modal), the emoji token will remain in the markdown alongside or instead of the `[repeat:: ...]` bracket it should become. This is a pre-existing issue unrelated to this redesign, but worth documenting.
- **"every two days" hint is misleading.** The current `setDesc('Example: daily, weekly, every two days')` implies natural-language input is supported. It is not — `"every two days"` is not a valid recurrence string and would silently produce 1-day repeats. The new UI eliminates this confusion, but any release note or documentation update should clarify that natural-language recurrence is not supported.
