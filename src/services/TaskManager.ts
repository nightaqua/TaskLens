import { TFile, Events, App } from 'obsidian';
import { Task, TaskGroup, TaskStatus, TaskSortBy, getTaskStatus } from '../models/Task';
import { TaskParser } from './TaskParser';
import { hasCompletionMetadata, hasRecurrenceMetadata, stripCompletionMetadata } from './TaskSanitizer';

export class TaskManager extends Events {
    private tasks: Task[] = [];
    private filteredTasks: Task[] = [];
    private isInternalChange = false;

    private currentStatusFilter: TaskStatus = TaskStatus.Open;
    private currentCourseFilter: string | null = null;
    private currentSortBy: TaskSortBy = TaskSortBy.DueDate;

    constructor(private readonly parser: TaskParser, private readonly app: App) {
        super();
    }

    async loadTasks(): Promise<void> {
        this.tasks = await this.parser.findAllTasks();
        this.applyFiltersAndSort();
        this.trigger('tasks-updated');
    }

    public getIsInternalChange(): boolean { return this.isInternalChange; }

    /**
     * Identifies manual state changes in a file and applies automation (adds metadata).
     *
     * The lock is set BEFORE the first await so no second modify event can slip
     * through while we are reading the file. We call addCompletionMetadata instead
     * of toggleTaskCompletion because the task is already [x] in the file at this
     * point — calling a toggle would un-check it, causing the flicker.
     */
    public async processManualUpdate(file: TFile): Promise<void> {
        if (this.isInternalChange) return;

        // Snapshot the current in-memory state BEFORE yielding.
        const cachedTasks = this.tasks.filter(t => t.filePath === file.path);

        // Lock BEFORE the first await so concurrent modify events are blocked.
        this.isInternalChange = true;
        try {
            const freshTasks = await this.parser.getTasksFromFile(file.path);

            for (const fresh of freshTasks) {
                const cached = cachedTasks.find(c => c.lineNumber === fresh.lineNumber);

                // Detection: line went from [ ] → [x] manually
                if (cached && !cached.completed && fresh.completed) {
                    await this.addCompletionMetadata(fresh);
                    return;
                }

                // Detection: line went from [x] → [ ] manually — strip completion metadata
                if (cached && cached.completed && !fresh.completed) {
                    await this.removeCompletionMetadata(fresh);
                    return;
                }
            }
        } finally {
            this.isInternalChange = false;
        }
    }

    /**
     * Adds completion metadata and handles recurrence for a task that was
     * already checked [x] by the user directly in the editor.
     * Unlike toggleTaskCompletion, this method never changes the checkbox state.
     */
    private async addCompletionMetadata(task: Task): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(task.filePath);
        if (!(file instanceof TFile)) return;

        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        const originalLine = lines[task.lineNumber];

        // Guard: if the line isn't actually checked, do nothing to avoid data loss.
        if (!/\[[xX]]/.test(originalLine)) return;

        // Guard: completion metadata already present from TaskLens or another plugin (e.g. Tasks ✅).
        if (hasCompletionMetadata(originalLine)) return;

        const completionDate = new Date();
        const compStr = this.formatCompletionDate(completionDate);
        lines[task.lineNumber] = originalLine + ` [completion:: ${compStr}]`;

        if (task.recurrence) {
            const nextDate = this.calculateNextDueDate(task.dueDate || null, task.recurrence, completionDate);
            let clonedLine = originalLine;
            const dueRegex = /(\[?due::\s*)(\d{4}-\d{2}-\d{2})([)\]]?)/i;
            const dateStr = this.formatDate(nextDate);
            clonedLine = clonedLine.replace(dueRegex, `$1${dateStr}$3`);
            // The cloned recurrence line must start as an open task
            clonedLine = clonedLine.replace(/\[[xX]]/, '[ ]');
            // Guard: don't write a TaskLens repeat:: tag if another plugin already owns recurrence on this line
            if (!hasRecurrenceMetadata(clonedLine) && task.recurrence) {
                clonedLine += ` [repeat:: ${task.recurrence}]`;
            }
            lines.splice(task.lineNumber + 1, 0, clonedLine);
        }

        await this.app.vault.modify(file, lines.join('\n'));
        await this.refreshFileTask(task.filePath);
    }

    /**
     * Strips completion metadata from a task that was unchecked directly in the editor.
     * Mirrors addCompletionMetadata: never touches the checkbox state, only the metadata.
     */
    private async removeCompletionMetadata(task: Task): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(task.filePath);
        if (!(file instanceof TFile)) return;

        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        const originalLine = lines[task.lineNumber];

        // Guard: line is somehow still checked — do nothing to avoid data loss.
        if (/\[[xX]]/.test(originalLine)) return;

        const cleaned = stripCompletionMetadata(originalLine);
        // No-op if nothing changed — avoids a needless vault write and re-render cycle.
        if (cleaned === originalLine) return;

        lines[task.lineNumber] = cleaned;
        await this.app.vault.modify(file, lines.join('\n'));
        await this.refreshFileTask(task.filePath);
    }

    /**
     * Toggle a task's completion state in its file
     */
    async toggleTaskCompletion(task: Task): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(task.filePath);
        if (!(file instanceof TFile)) return;
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        const originalLine = lines[task.lineNumber];

        // Fix: Removed redundant escape
        const isCurrentlyCompleted = /\[[xX]]/.test(originalLine);

        if (isCurrentlyCompleted) {
            let newLine = originalLine.replace(/\[[xX]]/, '[ ]');
            newLine = stripCompletionMetadata(newLine);
            lines[task.lineNumber] = newLine;
        } else {
            // Guard: don't double-stamp if another plugin already marked completion.
            if (!hasCompletionMetadata(originalLine)) {
                const completionDate = new Date();
                const compStr = this.formatCompletionDate(completionDate);
                let newLine = originalLine.replace(/\[ ]/, '[x]');
                newLine += ` [completion:: ${compStr}]`;
                lines[task.lineNumber] = newLine;

                if (task.recurrence) {
                    const nextDate = this.calculateNextDueDate(task.dueDate || null, task.recurrence, completionDate);
                    let clonedLine = originalLine;
                    const dueRegex = /(\[?due::\s*)(\d{4}-\d{2}-\d{2})([)\]]?)/i;
                    const dateStr = this.formatDate(nextDate);
                    clonedLine = clonedLine.replace(dueRegex, `$1${dateStr}$3`);
                    // Guard: don't write a TaskLens repeat:: tag if another plugin already owns recurrence on this line
                    if (!hasRecurrenceMetadata(clonedLine) && task.recurrence) {
                        clonedLine += ` [repeat:: ${task.recurrence}]`;
                    }
                    lines.splice(task.lineNumber + 1, 0, clonedLine);
                }
            } else {
                // Another plugin already has completion metadata — just flip the checkbox.
                lines[task.lineNumber] = originalLine.replace(/\[ ]/, '[x]');
            }
        }
        await this.app.vault.modify(file, lines.join('\n'));
        await this.refreshFileTask(task.filePath);
    }

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
                const match = originalLine.match(/^(\s*-\s\[.]\s)(.*)$/);

                if (match) {
                    const prefix = match[1]; // "- [ ] "

                    // Reconstruct the line
                    let newLine = `${prefix}${newTitle}`;
                    if (newDate) {
                        const dateStr = this.formatDate(newDate);
                        newLine += ` [due:: ${dateStr}]`;
                    }

                    // Keep other existing metadata if it was not touched?
                    // For now, this replaces the end of the line.
                    // To be safer, I need to parse the old line more carefully,
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

    /**
     * Collapses recurring clones into one TaskGroup per series.
     * Non-recurring tasks each become their own group (openCount: 1, isRecurring: false).
     * The representative is the earliest-due open clone, falling back to the latest
     * completed task when all clones in a series are done.
     */
    private groupTasks(tasks: Task[]): TaskGroup[] {
        const seriesMap = new Map<string, Task[]>();
        const insertionOrder: string[] = [];

        for (const task of tasks) {
            // Non-recurring: unique key per task so they never merge
            const key = task.recurrence
                ? `${task.filePath}::${task.title}::${task.recurrence}`
                : task.id;

            let series = seriesMap.get(key);
            if (series === undefined) {
                series = [];
                seriesMap.set(key, series);
                insertionOrder.push(key);
            }
            series.push(task);
        }

        return insertionOrder.map(key => {
            // We built this map ourselves — every key in insertionOrder has an entry.
            // Fall back to an empty array to satisfy TypeScript without a non-null assertion.
            const clones = seriesMap.get(key) ?? [];
            const open = clones.filter(t => !t.completed);
            const pool = open.length > 0 ? open : clones;

            const representative = pool.reduce((earliest, t) => {
                const eTime = earliest.dueDate?.getTime() ?? Infinity;
                const tTime = t.dueDate?.getTime() ?? Infinity;
                return tTime < eTime ? t : earliest;
            });

            return {
                representative,
                openCount: open.length,
                isRecurring: !!clones[0].recurrence && clones.length > 1,
            };
        });
    }

    /** For the task list view: filtered tasks collapsed into recurring groups. */
    public getGroupedFilteredTasks(): TaskGroup[] {
        return this.groupTasks(this.filteredTasks);
    }

    /** For the timeline: all tasks (no status filter) collapsed into recurring groups. */
    public getAllGroupedTasks(): TaskGroup[] {
        return this.groupTasks(this.tasks);
    }

    getScannedFiles(): string[] {
        return this.parser.getFilesToScan().map(file => file.path);
    }

    getStatistics() {
        // Group first so recurring clones count as one work item, not N lines.
        const groups = this.groupTasks(this.tasks);
        const todayStr = this.formatDate(new Date());
        return {
            total: groups.length,
            completed: groups.filter(g => g.representative.completed).length,
            completedToday: this.tasks.filter(t =>
                t.completed && t.completionDate && this.formatDate(t.completionDate) === todayStr
            ).length,
            overdue: groups.filter(g => getTaskStatus(g.representative) === TaskStatus.Overdue).length,
            upcoming: groups.filter(g => getTaskStatus(g.representative) === TaskStatus.UpcomingWeek).length,
            urgent: groups.filter(g => getTaskStatus(g.representative) === TaskStatus.Urgent).length,
            courses: new Set(this.tasks.map(t => t.fileName)).size
        };
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

// UNUSED for now
// setSortBy(sortBy: TaskSortBy) {
//        this.currentSortBy = sortBy;
//        this.applyFiltersAndSort();
//        this.trigger('tasks-updated');
//    }

    getCurrentFilters() {
        return {
            status: this.currentStatusFilter,
            course: this.currentCourseFilter,
            sortBy: this.currentSortBy
        };
    }

    async addTask(title: string, date: Date | null, filePath: string, recurrence?: string): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            const content = await this.app.vault.read(file);
            let taskLine = `\n- [ ] ${title}`;
            if (date) taskLine += ` [due:: ${this.formatDate(date)}]`;
            if (recurrence) taskLine += ` [repeat:: ${recurrence}]`; // NEW

            await this.app.vault.modify(file, content + taskLine);
            await this.refreshFileTask(filePath);
        }
    }

    private formatDate(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${String(y)}-${m}-${d}`;
    }

    public formatCompletionDate(date: Date): string {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const yyyy = date.getFullYear();
        const mm = pad(date.getMonth() + 1);
        const dd = pad(date.getDate());
        const hh = pad(date.getHours());
        const min = pad(date.getMinutes());

        return `${String(yyyy)}-${mm}-${dd} ${hh}:${min}`;
    }

    /** Helper to calculate the bumped due date for recurring tasks */
    private calculateNextDueDate(dueDate: Date | null, recurrence: string, completionDate: Date): Date {
        const isFlexible = recurrence.endsWith('+');
        const rule = recurrence.replace('+', '').trim().toLowerCase();

        const baseDate = new Date((isFlexible || !dueDate) ? completionDate : dueDate);
        const nextDate = new Date(baseDate);

        let amount = 1;
        let unit = 'd';

        if (rule === 'daily' || rule === 'd') { unit = 'd'; }
        else if (rule === 'weekly' || rule === 'w') { unit = 'w'; }
        else if (rule === 'monthly' || rule === 'm') { unit = 'm'; }
        else if (rule === 'yearly' || rule === 'y') { unit = 'y'; }
        else {
            const match = rule.match(/^(\d+)([dwmy])$/);
            if (match) {
                amount = parseInt(match[1], 10);
                unit = match[2];
            }
        }

        switch (unit) {
            case 'd': nextDate.setDate(nextDate.getDate() + amount); break;
            case 'w': nextDate.setDate(nextDate.getDate() + (amount * 7)); break;
            case 'm': {
                // JS setMonth overflows into the next month when the current day
                // doesn't exist in the target month (e.g. Jan 31 + 1m → Mar 3).
                // Fix: pin to day 1, advance the month, then clamp to the last valid day.
                const originalDay = nextDate.getDate();
                nextDate.setDate(1);
                nextDate.setMonth(nextDate.getMonth() + amount);
                const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
                nextDate.setDate(Math.min(originalDay, lastDayOfMonth));
                break;
            }
            case 'y': {
                // Same overflow fix for Feb 29 on non-leap years.
                const originalDay = nextDate.getDate();
                nextDate.setDate(1);
                nextDate.setFullYear(nextDate.getFullYear() + amount);
                const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
                nextDate.setDate(Math.min(originalDay, lastDayOfMonth));
                break;
            }
        }

        return nextDate;
    }

    private applyFiltersAndSort(): void {
        this.filteredTasks = this.tasks.filter(task => {
            if (this.currentCourseFilter && task.fileName !== this.currentCourseFilter) return false;
            if (this.currentStatusFilter === TaskStatus.All) return true;
            if (this.currentStatusFilter === TaskStatus.Open) return !task.completed;
            return getTaskStatus(task) === this.currentStatusFilter;
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