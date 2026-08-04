/**
 * obsidian-tasks compatible priority levels.
 * Numeric values are sort weights: lower = higher priority.
 */
export type TaskPriority = 'highest' | 'high' | 'normal' | 'low' | 'lowest';

/** Map from TaskPriority to sort weight (lower = shown first). */
export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
    highest: 1,
    high:    2,
    normal:  3,
    low:     4,
    lowest:  5,
};

/** Type guard for a raw string (e.g. a dropdown value) that may be a TaskPriority. */
export function isTaskPriority(value: string): value is TaskPriority {
    switch (value) {
        case 'highest':
        case 'high':
        case 'normal':
        case 'low':
        case 'lowest':
            return true;
        default:
            return false;
    }
}

/**
 * obsidian-tasks priority emoji for a given level.
 * 'normal' (and undefined) have no emoji and return ''.
 */
export function priorityToEmoji(priority?: TaskPriority): string {
    switch (priority) {
        case 'highest': return '\u{1F53A}'; // 🔺
        case 'high':    return '\u{23EB}';  // ⏫
        case 'low':     return '\u{1F53D}'; // 🔽
        case 'lowest':  return '\u{23EC}';  // ⏬
        default:        return '';
    }
}

/** Maps an obsidian-tasks priority emoji to its level, or undefined (normal) if unrecognised. */
export function emojiToPriority(emoji: string): TaskPriority | undefined {
    switch (emoji) {
        case '\u{1F53A}': return 'highest'; // 🔺
        case '\u{23EB}':  return 'high';    // ⏫
        // obsidian-tasks 🔼 "medium" has no TaskLens equivalent; read it as the
        // nearest level (high) rather than dropping it silently.
        case '\u{1F53C}': return 'high';    // 🔼 (medium → high)
        case '\u{1F53D}': return 'low';     // 🔽
        case '\u{23EC}':  return 'lowest';  // ⏬
        default:          return undefined;
    }
}

/**
 * Represents a task extracted from a Markdown file
 */
export interface Task {
    /** Unique identifier (file path + line number) */
    readonly id: string;

    /** Task text (cleaned of metadata) */
    title: string;

    /** Whether the task is completed */
    completed: boolean;

    /** Source file path */
    readonly filePath: string;

    /** Source file name (without extension) */
    readonly fileName: string;

    /** Line number in the source file */
    readonly lineNumber: number;

    /** Start date (optional) */
    startDate?: Date;

    /** Due date (optional) */
    dueDate?: Date;

    /** The date and exact time the task was completed */
    completionDate?: Date;

    /** The recurrence rule string (e.g., 'daily', '2w+') */
    recurrence?: string;

    /** Extracted notes content, e.g. [notes:: ...] (optional) */
    notes?: string;

    /** obsidian-tasks priority level (🔺⏫🔽⏬) — undefined means normal priority. */
    priority?: TaskPriority;

    /**
     * Live-timer mode from #countdown / #elapsed / #countdown-elapsed tags.
     * 'countdown' counts down to dueDate, 'elapsed' counts up from startDate,
     * 'both' shows both chips. Undefined means no timer chip.
     */
    timerMode?: 'countdown' | 'elapsed' | 'both';

    /** Original task text (for reference) */
    readonly originalText: string;
}

/**
 * A recurring-task series collapsed into a single display unit.
 * Non-recurring tasks are wrapped with openCount = 1, isRecurring = false.
 */
export interface TaskGroup {
    /** The task to show: earliest-due open clone for recurring, the task itself otherwise. */
    readonly representative: Task;
    /** Number of open (uncompleted) clones in this series. */
    openCount: number;
    /** Number of completed clones in this series — how many cycles have been done. */
    doneCount: number;
    /** True when the task has a recurrence rule. */
    readonly isRecurring: boolean;
}

/**
 * Task status categories for filtering
 */
export enum TaskStatus {
    All = 'all',
    Open = 'open',
    Completed = 'completed',
    Overdue = 'overdue',
    UpcomingWeek = 'upcoming_week',
    NoDate = 'no_date',
    Urgent = 'urgent'
}

export function getTaskStatus(task: Task): TaskStatus {
    if (task.completed) return TaskStatus.Completed;

    if (task.dueDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const due = new Date(task.dueDate);
        due.setHours(0, 0, 0, 0);

        if (due < today) return TaskStatus.Overdue;

        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Urgent if due within 3 days
        if (diffDays <= 3 && diffDays >= 0) return TaskStatus.Urgent;

        return TaskStatus.UpcomingWeek;
    }

    return TaskStatus.NoDate;
}
