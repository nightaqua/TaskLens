import { Task, TaskStatus, TaskSortBy, taskMatchesStatus, getTaskStatus } from '../models/Task';
import { TaskParser } from './TaskParser';
import { Events } from 'obsidian';

/**
 * Manages task state, filtering, and sorting
 * Emits events when task data changes
 */
export class TaskManager extends Events {
    private tasks: Task[] = [];
    private filteredTasks: Task[] = [];

    private currentStatusFilter: TaskStatus = TaskStatus.Open; // Default to Open/Active
    private currentCourseFilter: string | null = null;
    private currentSortBy: TaskSortBy = TaskSortBy.DueDate;

    constructor(private parser: TaskParser) {
        super();
    }

    /**
     * Load all tasks from vault
     */
    async loadTasks(): Promise<void> {
        this.tasks = await this.parser.parseAllTasks();
        this.applyFiltersAndSort();
        this.trigger('tasks-updated', this.filteredTasks);
    }

    /**
     * Refresh tasks from a specific file
     */
    async refreshFileTask(filePath: string): Promise<void> {
        // Remove existing tasks from this file
        this.tasks = this.tasks.filter(t => t.filePath !== filePath);

        // Add new tasks from this file
        const newTasks = await this.parser.parseTasksFromFilePath(filePath);
        this.tasks.push(...newTasks);

        this.applyFiltersAndSort();
        this.trigger('tasks-updated', this.filteredTasks);
    }

    /**
     * Get all tasks
     */
    getAllTasks(): Task[] {
        return [...this.tasks];
    }

    /**
     * Get filtered and sorted tasks
     */
    getFilteredTasks(): Task[] {
        return [...this.filteredTasks];
    }

    /**
     * Get unique course names
     */
    getCourseNames(): string[] {
        const courses = new Set(this.tasks.map(t => t.fileName));
        return Array.from(courses).sort();
    }

    /**
     * Set status filter
     */
    setStatusFilter(status: TaskStatus): void {
        this.currentStatusFilter = status;
        this.applyFiltersAndSort();
        this.trigger('tasks-updated', this.filteredTasks);
    }

    /**
     * Set course filter
     */
    setCourseFilter(course: string | null): void {
        this.currentCourseFilter = course;
        this.applyFiltersAndSort();
        this.trigger('tasks-updated', this.filteredTasks);
    }

    /**
     * Set sort order
     */
    setSortBy(sortBy: TaskSortBy): void {
        this.currentSortBy = sortBy;
        this.applyFiltersAndSort();
        this.trigger('tasks-updated', this.filteredTasks);
    }

    /**
     * Get current filters
     */
    getCurrentFilters(): {
        status: TaskStatus;
        course: string | null;
        sortBy: TaskSortBy;
    } {
        return {
            status: this.currentStatusFilter,
            course: this.currentCourseFilter,
            sortBy: this.currentSortBy
        };
    }

    /**
     * Apply current filters and sorting
     */
    private applyFiltersAndSort(): void {
        // Apply filters
        this.filteredTasks = this.tasks.filter(task => {
            // Status filter
            if (this.currentStatusFilter !== TaskStatus.All) {
                // "Open" view = anything not completed (overdue + urgent + upcoming + no-date)
                if (this.currentStatusFilter === TaskStatus.Open) {
                    if (task.completed) return false;
                } else {
                    if (!taskMatchesStatus(task, this.currentStatusFilter)) return false;
                }
            }

            // Course filter
            if (this.currentCourseFilter && task.fileName !== this.currentCourseFilter) {
                return false;
            }

            return true;
        });

        // Apply sorting (Priority Sorting first: Overdue > Urgent > Open > Completed)
        this.filteredTasks.sort((a, b) => {
            const weightA = this.getStatusWeight(a);
            const weightB = this.getStatusWeight(b);

            if (weightA !== weightB) {
                return weightA - weightB; // lower weight = higher priority
            }

            // Within same priority bucket, apply selected sort
            switch (this.currentSortBy) {
                case TaskSortBy.DueDate: {
                    const byDue = this.compareDates(a.dueDate, b.dueDate);
                    if (byDue !== 0) return byDue;
                    return a.fileName.localeCompare(b.fileName);
                }

                case TaskSortBy.StartDate: {
                    const byStart = this.compareDates(a.startDate, b.startDate);
                    if (byStart !== 0) return byStart;
                    return this.compareDates(a.dueDate, b.dueDate);
                }

                case TaskSortBy.FileName: {
                    const byFile = a.fileName.localeCompare(b.fileName);
                    if (byFile !== 0) return byFile;
                    return this.compareDates(a.dueDate, b.dueDate);
                }

                default:
                    return 0;
            }
        });
    }

    /**
     * Status priority weight (Overdue > Urgent > Open > Completed)
     * Note: "Open" is represented by UpcomingWeek + NoDate (i.e., not completed and not overdue/urgent)
     */
    private getStatusWeight(task: Task): number {
        const status = getTaskStatus(task);

        switch (status) {
            case TaskStatus.Overdue:
                return 1; // highest priority
            case TaskStatus.Urgent:
                return 2; // high priority
            case TaskStatus.UpcomingWeek:
                return 3; // normal open
            case TaskStatus.NoDate:
                return 4; // open, but less actionable
            case TaskStatus.Completed:
                return 5; // lowest priority
            default:
                return 3;
        }
    }

    /**
     * Compare two dates for sorting (null dates go to end)
     */
    private compareDates(a: Date | undefined, b: Date | undefined): number {
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        return a.getTime() - b.getTime();
    }

    /**
     * Get statistics
     * - `upcoming` is the count of UpcomingWeek tasks (renamed from `upcomingWeek` to match the views)
     */
    getStatistics(): {
        total: number;
        completed: number;
        overdue: number;
        urgent: number;
        upcoming: number;
        courses: number;
    } {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;

        // Use getTaskStatus for consistent logic
        const overdue = this.tasks.filter(t => getTaskStatus(t) === TaskStatus.Overdue).length;
        const urgent = this.tasks.filter(t => getTaskStatus(t) === TaskStatus.Urgent).length;
        const upcoming = this.tasks.filter(t => getTaskStatus(t) === TaskStatus.UpcomingWeek).length;

        const courses = this.getCourseNames().length;

        return {
            total,
            completed,
            overdue,
            urgent,
            upcoming,
            courses
        };
    }
}