/**
 * Represents a task extracted from a Markdown file
 */
export interface Task {
    /** Unique identifier (file path + line number) */
    id: string;

    /** Task text (cleaned of metadata) */
    title: string;

    /** Whether the task is completed */
    completed: boolean;

    /** Source file path */
    filePath: string;

    /** Source file name (without extension) */
    fileName: string;

    /** Line number in the source file */
    lineNumber: number;

    /** Start date (optional) */
    startDate?: Date;

    /** Due date (optional) */
    dueDate?: Date;

    /** NEW: The date and exact time the task was completed */
    completionDate?: Date | null;

    /** NEW: The recurrence rule string (e.g., 'daily', '2w+') */
    recurrence?: string | null;

    /** Original task text (for reference) */
    originalText: string;
}

/**
 * A recurring-task series collapsed into a single display unit.
 * Non-recurring tasks are wrapped with openCount = 1, isRecurring = false.
 */
export interface TaskGroup {
    /** The task to show: earliest-due open clone for recurring, the task itself otherwise. */
    representative: Task;
    /** Number of open (uncompleted) clones in this series. */
    openCount: number;
    /** True when multiple open clones share the same file + title + recurrence rule. */
    isRecurring: boolean;
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

/**
 * Sorting options for tasks
 */
export enum TaskSortBy {
    DueDate = 'due-date',
    // StartDate = 'start-date', // UNUSED for now
    // FileName = 'file-name',   // UNUSED for now
    // Created = 'created'       // UNUSED for now
}

export function getTaskStatus(task: Task): TaskStatus {
    if (task.completed) return TaskStatus.Completed;

    // v1.2: Recurring tasks gain immediate urgency
    if (task.recurrence) return TaskStatus.Urgent;

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

// UNUSED for now: Commented out to satisfy the linter
/*
export function taskMatchesStatus(task: Task, status: TaskStatus): boolean {
    if (status === TaskStatus.All) return true;
    return getTaskStatus(task) === status;
}
*/