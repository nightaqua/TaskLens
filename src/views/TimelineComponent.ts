import { Task, getTaskStatus, TaskStatus } from '../models/Task';
import { App, MarkdownView, TFile } from 'obsidian';
import { SemesterSettings } from '../settings/Settings';

export class TimelineComponent {
    private readonly container: HTMLElement;
    private readonly tasks: Task[];
    private readonly daysToShow: number;
    private readonly app: App;
    private readonly settings: SemesterSettings;

    private scrollContainer: HTMLElement | null = null;
    private tooltipEl: HTMLElement | null = null;

    // Drag-to-scroll state
    private isDragging = false;
    private startX = 0;
    private scrollLeftPos = 0;

    constructor(
        container: HTMLElement,
        app: App,
        tasks: Task[],
        daysToShow: number = 10,
        settings: SemesterSettings
    ) {
        this.container = container;
        this.app = app;
        this.tasks = tasks;
        this.daysToShow = daysToShow;
        this.settings = settings;
    }

    // Cycles through a fixed palette by index — used as a fallback color
    private getPaletteColor(index: number): string {
        const palette = ['#4cc9f0', '#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4caf50'];
        return palette[index % palette.length];
    }

    // Returns a deterministic color per topic: uses explicit setting if defined, otherwise hashes the name
    private getTopicColor(topic: string): string {
        if (this.settings.topicColors[topic]) return this.settings.topicColors[topic];
        let hash = 0;
        for (let i = 0; i < topic.length; i++) hash = topic.charCodeAt(i) + ((hash << 5) - hash);
        return this.getPaletteColor(Math.abs(hash));
    }

    // Renders a single month label cell in the month header row
    private renderMonthCell(
        headerRow: HTMLElement,
        day: Date,
        span: number,
        colWidth: number,
        startIdx: number
    ): void {
        const monthName = day.toLocaleString('default', { month: 'long', year: 'numeric' });
        const cell = headerRow.createDiv('timeline-month-cell');
        cell.setText(monthName);
        cell.style.width = `${String(span * colWidth)}%`;
        cell.style.left = `${String(startIdx * colWidth)}%`;
    }

    public render(): void {
        this.container.empty();
        this.container.addClass('timeline-wrapper');

        const validTasks = this.tasks.filter(t => t.dueDate && !isNaN(t.dueDate.getTime()));
        if (validTasks.length === 0) {
            const empty = this.container.createDiv('dashboard-empty-state');
            empty.createEl('p', { text: 'No dated tasks to display.' });
            return;
        }

        // Build the date range: from the earliest task date to the latest, with padding
        const dates = validTasks
            .map(t => t.dueDate)
            .filter((d): d is Date => Boolean(d));
        dates.push(new Date());

        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        minDate.setDate(minDate.getDate() - 2);
        maxDate.setDate(maxDate.getDate() + this.daysToShow + 2);

        const allDays: Date[] = [];
        const curr = new Date(minDate);
        while (curr <= maxDate) {
            allDays.push(new Date(curr));
            curr.setDate(curr.getDate() + 1);
        }

        // Left/right hover-overlay arrows for scrolling
        this.createNavigationOverlay('left');
        this.createNavigationOverlay('right');

        // Outer scroll container; inner content scaled to represent all days proportionally
        this.scrollContainer = this.container.createDiv('timeline-container');
        const scrollContent = this.scrollContainer.createDiv('timeline-scroll-content');
        scrollContent.style.width = `${String((allDays.length / this.daysToShow) * 100)}%`;

        const colWidthPercent = 100 / allDays.length;

        // Month header: groups day columns under their respective month labels
        const monthHeader = scrollContent.createDiv('timeline-month-row');
        let currentMonth = -1;
        let monthStartIdx = 0;

        allDays.forEach((day, idx) => {
            const m = day.getMonth();
            if (m !== currentMonth) {
                if (currentMonth !== -1) {
                    this.renderMonthCell(monthHeader, allDays[monthStartIdx], idx - monthStartIdx, colWidthPercent, monthStartIdx);
                }
                currentMonth = m;
                monthStartIdx = idx;
            }
        });
        // Flush the final month segment
        this.renderMonthCell(monthHeader, allDays[monthStartIdx], allDays.length - monthStartIdx, colWidthPercent, monthStartIdx);

        // CSS grid for day columns — row 1 is the date header, rows 2+ hold task bars
        const grid = scrollContent.createDiv('timeline-grid');
        grid.style.gridTemplateColumns = `repeat(${String(allDays.length)}, 1fr)`;

        allDays.forEach((day, idx) => {
            // Day number + weekday label in the header row
            const cell = grid.createDiv('timeline-header-cell');
            cell.setText(day.getDate().toString());
            cell.createDiv('timeline-day-name').setText(day.toLocaleString('default', { weekday: 'short' }));
            cell.setCssProps({ 'grid-column': String(idx + 1), 'grid-row': '1' });

            // Background column cell spanning all task rows
            const bgCell = grid.createDiv('timeline-bg-cell');
            bgCell.setCssProps({ 'grid-column': String(idx + 1), 'grid-row': '2 / -1' });

            if (day.getDate() === 1) {
                cell.addClass('is-month-start');
                bgCell.addClass('is-month-start-bg');
            }

            if (day.toDateString() === new Date().toDateString()) {
                cell.addClass('is-today');
                bgCell.addClass('is-today-bg');

                // Vertical line marking today across all rows
                const marker = grid.createDiv('timeline-today-marker');
                marker.setCssProps({ 'grid-column': String(idx + 1), 'grid-row': '1 / -1' });
            }
        });

        // Task bar layout: compact row-packing sorted by topic then start date.
        // Tracks the latest end time per row to find the first available slot for each task.
        const rowEndTimes: number[] = [];

        const sortedTasks = [...validTasks].sort((a, b) => {
            if (a.fileName !== b.fileName) {
                return (a.fileName || '').localeCompare(b.fileName || '');
            }
            const aStart = a.startDate?.getTime() || a.dueDate?.getTime() || 0;
            const bStart = b.startDate?.getTime() || b.dueDate?.getTime() || 0;
            return aStart - bStart;
        });

        sortedTasks.forEach((task) => {
            if (!task.dueDate) return;

            const taskStart = new Date(task.startDate ?? task.dueDate);
            const taskEnd = new Date(task.dueDate);
            taskStart.setHours(0, 0, 0, 0);
            taskEnd.setHours(0, 0, 0, 0);

            let startIdx = allDays.findIndex(d => d.toDateString() === taskStart.toDateString());
            let dueIdx = allDays.findIndex(d => d.toDateString() === taskEnd.toDateString());

            // Clamp tasks that extend beyond the visible range
            if (startIdx === -1 && taskStart < allDays[0]) startIdx = 0;
            if (dueIdx === -1 && taskEnd > allDays[allDays.length - 1]) dueIdx = allDays.length - 1;

            if (startIdx < 0 || dueIdx < 0) return;

            // Find the first row whose last task has already ended before this one starts
            let rowIndex = rowEndTimes.findIndex(endTime => endTime < taskStart.getTime());
            if (rowIndex === -1) {
                // All rows occupied — open a new one with a background stripe
                rowIndex = rowEndTimes.length;
                rowEndTimes.push(taskEnd.getTime());

                const rowBg = grid.createDiv('timeline-row-bg');
                rowBg.setCssProps({ 'grid-column': '1 / -1', 'grid-row': String(rowIndex + 2) });
            } else {
                rowEndTimes[rowIndex] = taskEnd.getTime();
            }

            const bar = grid.createDiv('timeline-task-bar');
            bar.setText(task.title);
            bar.style.gridColumnStart = String(startIdx + 1);
            bar.style.gridColumnEnd = `span ${String((dueIdx - startIdx) + 1)}`;
            bar.style.gridRow = String(rowIndex + 2);

            // Color by course/topic or by urgency status depending on settings
            if (this.settings.colorMode === 'course' && task.fileName) {
                bar.style.backgroundColor = this.getTopicColor(task.fileName);
            } else {
                const statusClass: Record<string, string> = {
                    [TaskStatus.Overdue]: 'status-overdue',
                    [TaskStatus.Urgent]: 'status-urgent',
                    [TaskStatus.Completed]: 'status-completed',
                    [TaskStatus.UpcomingWeek]: 'status-active',
                };
                const cls = statusClass[getTaskStatus(task)];
                if (cls) bar.addClass(cls);
            }

            bar.addEventListener('mouseenter', (e) => { this.showTooltip(e, task); });
            bar.addEventListener('mouseleave', () => { this.hideTooltip(); });
            bar.addEventListener('mousemove', (e) => { this.moveTooltip(e); });
            bar.addEventListener('click', (e) => {
                e.stopPropagation();
                void this.openTaskFile(task);
            });
        });

        this.setupEventListeners(this.scrollContainer);
    }

    public getScrollPosition(): number {
        return this.scrollContainer?.scrollLeft ?? 0;
    }

    public setScrollPosition(pos: number): void {
        this.scrollContainer?.scrollTo({ left: pos, behavior: 'auto' });
    }

    // Smoothly centers the viewport on today's column
    public scrollToToday(): void {
        setTimeout(() => {
            if (!this.scrollContainer) return;
            const todayCell = this.scrollContainer.querySelector('.timeline-header-cell.is-today');
            if (todayCell instanceof HTMLElement) {
                const scrollPos = todayCell.offsetLeft
                    - (this.scrollContainer.clientWidth / 2)
                    + (todayCell.clientWidth / 2);
                this.scrollContainer.scrollTo({ left: Math.max(0, scrollPos), behavior: 'smooth' });
            }
        }, 300); // Delay ensures the widget is fully rendered before calculating offsets
    }

    public scroll(direction: 'left' | 'right'): void {
        if (!this.scrollContainer) return;
        const amount = this.scrollContainer.clientWidth * 0.8;
        this.scrollContainer.scrollBy({
            left: direction === 'left' ? -amount : amount,
            behavior: 'smooth',
        });
    }

    private createNavigationOverlay(direction: 'left' | 'right'): void {
        const overlay = this.container.createDiv(`timeline-nav-overlay nav-${direction}`);
        overlay.createDiv('nav-arrow').setText(direction === 'left' ? '‹' : '›');
        overlay.addEventListener('click', (e) => {
            e.stopPropagation();
            this.scroll(direction);
        });
    }

    private setupEventListeners(container: HTMLElement): void {
        container.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            container.addClass('is-dragging');
            this.startX = e.pageX - container.offsetLeft;
            this.scrollLeftPos = container.scrollLeft;
        });

        container.addEventListener('mouseleave', () => {
            this.isDragging = false;
            container.removeClass('is-dragging');
        });

        container.addEventListener('mouseup', () => {
            this.isDragging = false;
            container.removeClass('is-dragging');
        });

        container.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            container.scrollLeft = this.scrollLeftPos - (x - this.startX) * 1.5;
        });
    }

    private showTooltip(e: MouseEvent, task: Task): void {
        if (!this.tooltipEl) {
            this.tooltipEl = document.body.createDiv('dashboard-tooltip');
        }
        this.tooltipEl.empty();
        this.tooltipEl.createDiv('tooltip-title').setText(task.title);
        this.tooltipEl.createDiv('tooltip-meta').setText(`📂 ${task.fileName}`);
        if (task.dueDate) {
            this.tooltipEl.createDiv('tooltip-date').setText(`📅 ${task.dueDate.toDateString()}`);
        }
        this.tooltipEl.setCssProps({ display: 'block' });
        this.moveTooltip(e);
    }

    private moveTooltip(e: MouseEvent): void {
        if (this.tooltipEl) {
            this.tooltipEl.style.top = `${String(e.clientY + 15)}px`;
            this.tooltipEl.style.left = `${String(e.clientX + 15)}px`;
        }
    }

    private hideTooltip(): void {
        this.tooltipEl?.setCssProps({ display: 'none' });
    }

    private async openTaskFile(task: Task): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(task.filePath);
        if (!(file instanceof TFile)) return;

        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file);

        // Move the editor cursor to the exact line of the task
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
            const pos = { line: task.lineNumber, ch: 0 };
            view.editor.setCursor(pos);
            view.editor.scrollIntoView({ from: pos, to: pos }, true);
        }
    }
}