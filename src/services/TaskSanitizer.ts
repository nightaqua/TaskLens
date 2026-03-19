/**
 * TaskSanitizer
 *
 * Exported utility functions for reading and removing completion/recurrence
 * metadata from raw markdown lines. Prevents TaskLens from duplicating or
 * breaking metadata written by the Tasks plugin (emoji format) or Dataview.
 *
 * External formats recognised:
 *   Tasks plugin  — ✅ YYYY-MM-DD  (completion)
*                 — 🔁             (recurrence)
 *   Dataview      — [completion:: ...] / (completion:: ...)
 *   TaskLens      — [completion:: ...] / [repeat:: ...]
 *
 * Regex char-class notes used throughout:
 *   [^\])]  — any char that is NOT ] or )   (no escape needed on ) inside [])
 *   [\])]   — literal ] or )
 */

/** True if the line already carries ANY completion marker (ours or external). */
export function hasCompletionMetadata(line: string): boolean {
    return /\u2705\s*\d{4}-\d{2}-\d{2}/.test(line) || /completion::/i.test(line);
}

/**
 * True if the line already carries ANY recurrence marker (ours or external).
 * Used before writing a cloned recurring task line to prevent double-stamping
 * when the Tasks plugin's 🔁 or 🔄 emoji is already present.
 */
export function hasRecurrenceMetadata(line: string): boolean {
    // Tasks plugin repeat emojis: 🔁 (U+1F501) and 🔄 (U+1F504)
    return /\u{1F501}|\u{1F504}/u.test(line) || /repeat::/i.test(line);
}

/**
 * Strips all completion metadata from a line and returns the cleaned string.
 * Handles both TaskLens/Dataview inline-field format and Tasks-plugin emoji format.
 * Does NOT modify the checkbox state.
 */
export function stripCompletionMetadata(line: string): string {
    let result = line;

    // TaskLens / Dataview: [completion:: YYYY-MM-DD HH:mm] or (completion:: ...)
    result = result.replace(/\s*\[?\(?\s*completion::\s*[^\])]+[\])]?/gi, '');

    // Tasks plugin: ✅ YYYY-MM-DD
    result = result.replace(/\s*\u2705\s*\d{4}-\d{2}-\d{2}/g, '');

    return result.replace(/\s+/g, ' ').trim();
}