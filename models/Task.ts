/**
 * Represents a task extracted from a markdown file
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
    
    /** Original task text (for reference) */
    originalText: string;
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
    StartDate = 'start-date',
    FileName = 'file-name',
    Created = 'created'
}

export function getTaskStatus(task: Task): TaskStatus {
    if (task.completed) return TaskStatus.Completed;

    if (task.dueDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const due = new Date(task.dueDate);
        due.setHours(0, 0, 0, 0);

        // Check Overdue
        if (due < today) return TaskStatus.Overdue;

        // Check Urgent (Between Today and Today + 3 days)
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (diffDays <= 3 && diffDays >= 0) return TaskStatus.Urgent;

        return TaskStatus.UpcomingWeek; // Or generic upcoming
    }

    return TaskStatus.NoDate;
}

/**
 * Checks if a task matches a given status filter
 */
export function taskMatchesStatus(task: Task, status: TaskStatus): boolean {
    if (status === TaskStatus.All) {
        return true;
    }
    
    return getTaskStatus(task) === status;
}
