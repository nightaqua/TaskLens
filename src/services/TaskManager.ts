import { TFile, Events, App } from 'obsidian';
import { Task, TaskGroup, TaskStatus, getTaskStatus } from '../models/Task';
import { TaskParser } from './TaskParser';
import { hasCompletionMetadata, hasRecurrenceMetadata, stripCompletionMetadata } from './TaskSanitizer';

export class TaskManager extends Events {
    private tasks: Task[] = [];
    private filteredTasks: Task[] = [];
    private isInternalChange = false;

    private currentStatusFilter: TaskStatus = TaskStatus.Open;
    private currentCourseFilter: string | null = null;

    private cachedStats: ReturnType<typeof this.calculateStatistics> | null = null;
    private lastTasksRef: Task[] | null = null;

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
            const cachedTasksMap = new Map(cachedTasks.map(t => [t.lineNumber, t]));

            for (const fresh of freshTasks) {
                const cached = cachedTasksMap.get(fresh.lineNumber);

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

        // Refresh just this file's tasks so this.tasks stays in sync for the next
        // processManualUpdate call on the same file. Using refreshFileTask instead
        // of loadTasks avoids a full vault rescan on every plain-text markdown edit.
        await this.refreshFileTask(file.path);
    }

    /**
     * Builds the cloned line for a recurring task after completion.
     * Handles three date configurations:
     *  - due:: only → advance due:: to next occurrence.
     *  - due:: + start:: → advance both, preserving the original start-to-due window.
     *  - start:: only → use start:: as the scheduling anchor, advance it to next occurrence.
     *    (A recurring task with no due date is ambiguous; start:: is the best available anchor.)
     * In all cases the checkbox is reset to [ ] and the completion metadata is NOT copied.
     */
    private buildClonedLine(originalLine: string, task: Task, completionDate: Date): string {
        const anchor = task.dueDate ?? task.startDate ?? null;
        const nextDate = this.calculateNextDueDate(anchor, task.recurrence ?? '', completionDate);
        const dateStr = this.formatDate(nextDate);

        let clonedLine = originalLine;

        if (task.dueDate) {
            // Advance due:: to next occurrence
            const dueRegex = /(\[?due::\s*)(\d{4}-\d{2}-\d{2})([\])]?)/i;
            clonedLine = clonedLine.replace(dueRegex, `$1${dateStr}$3`);

            // If start:: is also present, advance it by the same interval so the
            // start-to-due window is preserved across every recurrence.
            if (task.startDate) {
                const windowMs = task.dueDate.getTime() - task.startDate.getTime();
                const nextStart = new Date(nextDate.getTime() - windowMs);
                const startRegex = /(\[?start::\s*)(\d{4}-\d{2}-\d{2})([\])]?)/i;
                clonedLine = clonedLine.replace(startRegex, `$1${this.formatDate(nextStart)}$3`);
            }
        } else if (task.startDate) {
            // start:: is the only anchor — advance it to the next occurrence
            const startRegex = /(\[?start::\s*)(\d{4}-\d{2}-\d{2})([\])]?)/i;
            clonedLine = clonedLine.replace(startRegex, `$1${dateStr}$3`);
        }
        // Neither date: clone is created with no date, identical to original body.
        // This is unusual but not illegal — the task can still recur without scheduling.

        // Reset to open and strip completion stamp from the clone
        clonedLine = clonedLine.replace(/\[[xX]]/, '[ ]');
        clonedLine = stripCompletionMetadata(clonedLine);

        // Guard: don't write a TaskLens repeat:: tag if another plugin already owns recurrence
        if (!hasRecurrenceMetadata(clonedLine) && task.recurrence) {
            clonedLine += ` [repeat:: ${task.recurrence}]`;
        }

        return clonedLine;
    }

    /**
     * Inserts a cloned recurring task line immediately after the completed one,
     * unless an open clone of the same task already exists on the next line.
     * Extracted because addCompletionMetadata and toggleTaskCompletion both need
     * exactly this logic.
     */
    private spliceCloneIfNeeded(lines: string[], task: Task, clonedLine: string): void {
        const nextLine = lines[task.lineNumber + 1] ?? '';
        const nextIsOpenTask = /\[ ]/.test(nextLine);
        const normalise = (l: string) =>
            l.replace(/\[(?:completion|repeat|due|start)::[^\]]*]/gi, '').replace(/\s+/g, ' ').trim();
        const alreadyCloned = nextIsOpenTask && normalise(nextLine).includes(normalise(task.title));
        if (!alreadyCloned) {
            lines.splice(task.lineNumber + 1, 0, clonedLine);
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

        // Strip any stale completion stamp first (e.g. yyyy-mm-dd from before the
        // format change, or a stamp left by another plugin). This ensures we always
        // write a fresh, correctly-formatted stamp rather than silently bailing out.
        const stripped = hasCompletionMetadata(originalLine)
            ? stripCompletionMetadata(originalLine)
            : originalLine;

        const completionDate = new Date();
        const compStr = this.formatCompletionDate(completionDate);
        lines[task.lineNumber] = stripped + ` [completion:: ${compStr}]`;

        if (task.recurrence) {
            this.spliceCloneIfNeeded(lines, task, this.buildClonedLine(originalLine, task, completionDate));
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
                    this.spliceCloneIfNeeded(lines, task, this.buildClonedLine(originalLine, task, completionDate));
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
     * Updates a task's status based on drag-and-drop actions.
     */
    async updateTaskStatus(task: Task, newStatus: TaskStatus): Promise<void> {
        if (newStatus === TaskStatus.Completed) {
            if (!task.completed) {
                await this.toggleTaskCompletion(task);
            }
            return;
        }

        // If moving out of completed, uncheck it first
        if (task.completed) {
            await this.toggleTaskCompletion(task);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let newDate: Date | null = null;
        if (newStatus === TaskStatus.UpcomingWeek) {
            newDate = new Date(today);
            newDate.setDate(today.getDate() + 7);
        } else if (newStatus === TaskStatus.Urgent) {
            newDate = new Date(today);
            newDate.setDate(today.getDate() + 1);
        } else if (newStatus === TaskStatus.Overdue) {
            newDate = new Date(today);
            newDate.setDate(today.getDate() - 1);
        }

        // Update the date, or clear it if null (NoDate case - handled by passing null)
        await this.updateTask(task, task.title, newDate);
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
        if (!(file instanceof TFile)) return;

        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        if (!lines[task.lineNumber]) return;

        const originalLine = lines[task.lineNumber];
        const match = originalLine.match(/^(\s*[-*]\s\[.\]\s)(.*)$/);
        if (!match) return;

        const prefix = match[1];
        const body = match[2];

        // Isolate the bare title by stripping all known metadata tokens from a copy
        // of the body. We replace only the title portion in the original body so that
        // start::, repeat::, completion:: and any other metadata survive untouched.
        const metaPattern = /\[?\(?(?:due|start|completion|repeat)::[^\])]*[\])]?/gi;
        const titleOnly = body.replace(metaPattern, '').replace(/\s+/g, ' ').trim();

        let newBody: string;
        if (titleOnly.length > 0) {
            // Replace just the title substring; leave everything else intact
            newBody = body.replace(titleOnly, newTitle);
        } else {
            // Edge case: couldn't isolate a title — use new title as the full body
            newBody = newTitle;
        }

        // Update, append, or explicitly remove the due:: field
        if (newDate) {
            const dateStr = this.formatDate(newDate);
            const dueRegex = /(\[?\(?due::\s*)(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})([\])]?)/i;
            if (dueRegex.test(newBody)) {
                newBody = newBody.replace(dueRegex, `$1${dateStr}$3`);
            } else {
                newBody = `${newBody} [due:: ${dateStr}]`;
            }
        } else {
            // Strip the due:: tag entirely
            const dueRegex = /\[?\(?due::\s*(?:\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})[\])]?/i;
            newBody = newBody.replace(dueRegex, '').replace(/\s+/g, ' ').trim();
        }

        lines[task.lineNumber] = `${prefix}${newBody}`;
        await this.app.vault.modify(file, lines.join('\n'));
        await this.refreshFileTask(task.filePath);
    }
    async refreshFileTask(filePath: string): Promise<void> {
        const fileTasks = await this.parser.getTasksFromFile(filePath);
        this.tasks = this.tasks.filter(t => t.filePath !== filePath);
        this.tasks.push(...fileTasks);
        this.applyFiltersAndSort();
        this.trigger('tasks-updated');
    }

    getAllTasks(): Task[] { return [...this.tasks]; }

    /**
     * Collapses recurring clones into one TaskGroup per series.
     * Non-recurring tasks each become their own group (openCount: 1, isRecurring: false).
     * The representative is the earliest-due open clone, falling back to the latest
     * completed task when all clones in a series are done.
     *
     * allTasks is the unfiltered task list — used to count completed cycles accurately
     * even when the caller passes a filtered subset as `tasks`.
     */
    private groupTasks(tasks: Task[], allTasks: Task[] = tasks): TaskGroup[] {
        const seriesMap = new Map<string, Task[]>();
        const insertionOrder: string[] = [];

        for (const task of tasks) {
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

        // Build a done-count lookup from the FULL task list so completed cycles are
        // visible even when the caller is passing filtered (e.g. open-only) tasks.
        const doneMap = new Map<string, number>();
        for (const task of allTasks) {
            if (!task.completed || !task.recurrence) continue;
            const key = `${task.filePath}::${task.title}::${task.recurrence}`;
            doneMap.set(key, (doneMap.get(key) ?? 0) + 1);
        }

        return insertionOrder.map(key => {
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
                doneCount: doneMap.get(key) ?? 0,
                isRecurring: !!clones[0]?.recurrence,
            };
        });
    }

    /** For the task list view: filtered tasks collapsed into recurring groups. */
    public getGroupedFilteredTasks(): TaskGroup[] {
        return this.groupTasks(this.filteredTasks, this.tasks);
    }

    /** For the timeline: all tasks (no status filter) collapsed into recurring groups. */
    public getAllGroupedTasks(): TaskGroup[] {
        return this.groupTasks(this.tasks);
    }

    getScannedFiles(): string[] {
        return this.parser.getFilesToScan().map(file => file.path);
    }

    getStatistics() {
        if (this.lastTasksRef === this.tasks && this.cachedStats) {
            return this.cachedStats;
        }

        this.cachedStats = this.calculateStatistics();
        this.lastTasksRef = this.tasks;
        return this.cachedStats;
    }

    private calculateStatistics() {
        // Group first so recurring clones count as one work item, not N lines.
        const groups = this.groupTasks(this.tasks);

        const now = new Date();
        const todayStr = this.formatDate(now);
        now.setHours(0, 0, 0, 0);

        // 7-day trailing velocity
        const velocity7Days = [0, 0, 0, 0, 0, 0, 0];

        for (const task of this.tasks) {
            if (task.completed && task.completionDate) {
                const compDate = new Date(task.completionDate);
                compDate.setHours(0, 0, 0, 0);
                const diffTime = now.getTime() - compDate.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays >= 0 && diffDays < 7) {
                    velocity7Days[6 - diffDays]++;
                }
            }
        }

        // Topic urgency analysis
        const topicStats = new Map<string, { totalOpen: number, urgent: number }>();

        for (const task of this.tasks) {
            if (!task.completed) {
                const stats = topicStats.get(task.fileName) ?? { totalOpen: 0, urgent: 0 };
                stats.totalOpen++;
                if (getTaskStatus(task) === TaskStatus.Urgent) {
                    stats.urgent++;
                }
                topicStats.set(task.fileName, stats);
            }
        }

        let mostUrgentTopic: { name: string, ratio: number, urgent: number, total: number } | null = null;
        let maxRatio = -1;

        for (const [name, stats] of topicStats.entries()) {
            if (stats.totalOpen > 0) {
                const ratio = stats.urgent / stats.totalOpen;
                if (ratio > maxRatio || (ratio === maxRatio && mostUrgentTopic !== null && stats.urgent > mostUrgentTopic.urgent)) {
                    maxRatio = ratio;
                    mostUrgentTopic = { name, ratio, urgent: stats.urgent, total: stats.totalOpen };
                }
            }
        }

        return {
            total: groups.length,
            completed: groups.filter(g => g.representative.completed).length,
            completedToday: this.tasks.filter(t =>
                t.completed && t.completionDate && this.formatDate(t.completionDate) === todayStr
            ).length,
            overdue: groups.filter(g => getTaskStatus(g.representative) === TaskStatus.Overdue).length,
            upcoming: groups.filter(g => getTaskStatus(g.representative) === TaskStatus.UpcomingWeek).length,
            urgent: groups.filter(g => getTaskStatus(g.representative) === TaskStatus.Urgent).length,
            courses: new Set(this.tasks.map(t => t.fileName)).size,
            velocity7Days,
            mostUrgentTopic
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


    getCurrentFilters() {
        return {
            status: this.currentStatusFilter,
            course: this.currentCourseFilter
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

    /** Display format: dd-mm-yyyy. Storage format (formatDate) stays yyyy-mm-dd. */
    public static formatDisplayDate(date: Date): string {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${String(y)}`;
    }

    public formatCompletionDate(date: Date): string {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const dd = pad(date.getDate());
        const mm = pad(date.getMonth() + 1);
        const yyyy = date.getFullYear();
        const hh = pad(date.getHours());
        const min = pad(date.getMinutes());
        return `${dd}-${mm}-${String(yyyy)} ${hh}:${min}`;
    }

    /** Helper to calculate the bumped due date for recurring tasks */
    public calculateNextDueDate(dueDate: Date | null, recurrence: string, completionDate: Date): Date {
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