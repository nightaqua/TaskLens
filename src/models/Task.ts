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

    /** The date and exact time the task was completed */
    completionDate?: Date;

    /** The recurrence rule string (e.g., 'daily', '2w+') */
    recurrence?: string;

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
    /** Number of completed clones in this series — how many cycles have been done. */
    doneCount: number;
    /** True when the task has a recurrence rule. */
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
