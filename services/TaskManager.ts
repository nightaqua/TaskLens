import { TFile, Events, App } from 'obsidian';
import { Task, TaskStatus, TaskSortBy, getTaskStatus } from '../models/Task';
import { TaskParser } from './TaskParser';

export class TaskManager extends Events {
    private tasks: Task[] = [];
    private filteredTasks: Task[] = [];

    private currentStatusFilter: TaskStatus = TaskStatus.Open;
    private currentCourseFilter: string | null = null;
    private currentSortBy: TaskSortBy = TaskSortBy.DueDate;

    constructor(private parser: TaskParser, private app: App) {
        super();
    }

    async loadTasks(): Promise<void> {
        this.tasks = await this.parser.findAllTasks();
        this.applyFiltersAndSort();
        this.trigger('tasks-updated');
    }
// ... inside TaskManager class ...

    /**
     * Delete a task from its file
     */
    async deleteTask(task: Task): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(task.filePath);
        if (file instanceof TFile) {
            const content = await this.app.vault.read(file);
            const lines = content.split('\n');

            // Safety check: ensure the line hasn't moved
            if (lines[task.lineNumber] && lines[task.lineNumber].includes(task.title)) {
                lines.splice(task.lineNumber, 1); // Remove the line
                await this.app.vault.modify(file, lines.join('\n'));
                await this.refreshFileTask(task.filePath);
            } else {
                console.warn('Task line mismatch, skipping delete to prevent data loss.');
            }
        }
    }

    /**
     * Update a task's title and/or due date
     */
    async updateTask(task: Task, newTitle: string, newDate: Date | null): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(task.filePath);
        if (file instanceof TFile) {
            const content = await this.app.vault.read(file);
            const lines = content.split('\n');

            if (lines[task.lineNumber]) {
                const originalLine = lines[task.lineNumber];

                // Preserve indentation and checkbox status
                // Regex: (Whitespace)(- [x]) (Rest)
                const match = originalLine.match(/^(\s*-\s\[.\]\s)(.*)$/);

                if (match) {
                    const prefix = match[1]; // "- [ ] "

                    // Reconstruct the line
                    let newLine = `${prefix}${newTitle}`;
                    if (newDate) {
                        const dateStr = this.formatDate(newDate);
                        newLine += ` [due:: ${dateStr}]`;
                    }

                    // Keep other existing metadata if we didn't touch it?
                    // For now, this replaces the end of the line.
                    // To be safer, we'd need to parse the old line more carefully,
                    // but this covers the [due::] format perfectly.

                    lines[task.lineNumber] = newLine;
                    await this.app.vault.modify(file, lines.join('\n'));
                    await this.refreshFileTask(task.filePath);
                }
            }
        }
    }
    async refreshFileTask(filePath: string): Promise<void> {
        const fileTasks = await this.parser.getTasksFromFile(filePath);
        this.tasks = this.tasks.filter(t => t.filePath !== filePath);
        this.tasks.push(...fileTasks);
        this.applyFiltersAndSort();
        this.trigger('tasks-updated');
    }

    getAllTasks(): Task[] { return [...this.tasks]; }
    getFilteredTasks(): Task[] { return [...this.filteredTasks]; }

    getStatistics() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const overdue = this.tasks.filter(t => getTaskStatus(t) === TaskStatus.Overdue).length;
        const upcoming = this.tasks.filter(t => getTaskStatus(t) === TaskStatus.UpcomingWeek).length;
        const urgent = this.tasks.filter(t => getTaskStatus(t) === TaskStatus.Urgent).length;
        const courses = new Set(this.tasks.map(t => t.fileName)).size;

        return { total, completed, overdue, upcoming, urgent, courses };
    }

    getCourseNames(): string[] {
        return Array.from(new Set(this.tasks.map(t => t.fileName))).sort();
    }

    setStatusFilter(status: TaskStatus) {
        this.currentStatusFilter = status;
        this.applyFiltersAndSort();
        this.trigger('tasks-updated');
    }

    setCourseFilter(course: string | null) {
        this.currentCourseFilter = course;
        this.applyFiltersAndSort();
        this.trigger('tasks-updated');
    }

    setSortBy(sortBy: TaskSortBy) {
        this.currentSortBy = sortBy;
        this.applyFiltersAndSort();
        this.trigger('tasks-updated');
    }

    getCurrentFilters() {
        return {
            status: this.currentStatusFilter,
            course: this.currentCourseFilter,
            sortBy: this.currentSortBy
        };
    }

    async addTask(title: string, date: Date | null, filePath: string): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            let content = await this.app.vault.read(file);
            let taskLine = `\n- [ ] ${title}`;
            if (date) {
                const dateStr = this.formatDate(date);
                taskLine += ` [due:: ${dateStr}]`;
            }
            await this.app.vault.modify(file, content + taskLine);
            await this.refreshFileTask(filePath);
        }
    }

    private formatDate(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    private applyFiltersAndSort(): void {
        this.filteredTasks = this.tasks.filter(task => {
            if (this.currentStatusFilter !== TaskStatus.All) {
                if (this.currentStatusFilter === TaskStatus.Open) {
                    return !task.completed;
                }
                if (this.currentStatusFilter === TaskStatus.Completed && !task.completed) return false;
            }
            if (this.currentCourseFilter && task.fileName !== this.currentCourseFilter) return false;
            return true;
        });

        this.filteredTasks.sort((a, b) => {
            const weightA = this.getStatusWeight(a);
            const weightB = this.getStatusWeight(b);
            if (weightA !== weightB) return weightA - weightB;
            if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            return 0;
        });
    }

    private getStatusWeight(task: Task): number {
        const status = getTaskStatus(task);
        switch (status) {
            case TaskStatus.Overdue: return 1;
            case TaskStatus.Urgent: return 2;
            case TaskStatus.UpcomingWeek: return 3;
            case TaskStatus.NoDate: return 4;
            case TaskStatus.Completed: return 5;
            default: return 3;
        }
    }
}