import { Task, getTaskStatus, TaskStatus } from '../models/Task';
import { App, MarkdownView, TFile } from 'obsidian';

export class TimelineComponent {
    private container: HTMLElement;
    private tasks: Task[];
    private daysToShow: number;
    private app: App;

    private scrollContainer: HTMLElement | null = null;
    private tooltipEl: HTMLElement | null = null;

    // Drag state
    private isDragging = false;
    private startX = 0;
    private scrollLeftPos = 0;

    constructor(container: HTMLElement, app: App, tasks: Task[], daysToShow: number = 14) {
        this.container = container;
        this.app = app;
        this.tasks = tasks;
        this.daysToShow = daysToShow;
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

        const dates = validTasks.map(t => t.dueDate!);
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

        // 1. ADD NAVIGATION ARROWS (Hover Overlays)
        this.createNavigationOverlay('left');
        this.createNavigationOverlay('right');

        // 2. SETUP CONTAINERS
        this.scrollContainer = this.container.createDiv('timeline-container');
        const scrollContent = this.scrollContainer.createDiv('timeline-scroll-content');

        // Ensure width scales perfectly to fit all days
        const totalWidthPercent = (allDays.length / this.daysToShow) * 100;
        scrollContent.style.width = `${totalWidthPercent}%`;

        const colWidthPercent = 100 / allDays.length;

        // 3. MONTH HEADER ROW
        const monthHeader = scrollContent.createDiv('timeline-month-row');

        let currentMonth = -1;
        let monthStartIdx = 0;

        allDays.forEach((day, idx) => {
            const m = day.getMonth();
            if (m !== currentMonth) {
                if (currentMonth !== -1) {
                    const span = idx - monthStartIdx;
                    const monthName = allDays[monthStartIdx].toLocaleString('default', { month: 'long', year: 'numeric' });
                    const mDiv = monthHeader.createDiv('timeline-month-cell');
                    mDiv.setText(monthName);
                    mDiv.style.width = `${span * colWidthPercent}%`;
                    mDiv.style.left = `${monthStartIdx * colWidthPercent}%`;
                }
                currentMonth = m;
                monthStartIdx = idx;
            }
        });

        const span = allDays.length - monthStartIdx;
        const monthName = allDays[monthStartIdx].toLocaleString('default', { month: 'long', year: 'numeric' });
        const mDiv = monthHeader.createDiv('timeline-month-cell');
        mDiv.setText(monthName);
        mDiv.style.width = `${span * colWidthPercent}%`;
        mDiv.style.left = `${monthStartIdx * colWidthPercent}%`;

        // 4. GRID & DAYS (Solid grid lines)
        const grid = scrollContent.createDiv('timeline-grid');
        grid.style.gridTemplateColumns = `repeat(${allDays.length}, 1fr)`;

        allDays.forEach((day, idx) => {
            const cell = grid.createDiv('timeline-header-cell');
            cell.setText(day.getDate().toString());
            const dayName = day.toLocaleString('default', { weekday: 'short' });
            cell.createDiv('timeline-day-name').setText(dayName);
            cell.style.gridColumn = `${idx + 1}`;
            cell.style.gridRow = `1`;

            const bgCell = grid.createDiv('timeline-bg-cell');
            bgCell.style.gridColumn = `${idx + 1}`;
            bgCell.style.gridRow = `2 / -1`;

            if (day.getDate() === 1) {
                cell.addClass('is-month-start');
                bgCell.addClass('is-month-start-bg');
            }

            if (day.toDateString() === new Date().toDateString()) {
                cell.addClass('is-today');
                bgCell.addClass('is-today-bg');

                const marker = grid.createDiv('timeline-today-marker');
                marker.style.gridColumn = `${idx + 1}`;
                marker.style.gridRow = `1 / -1`;
            }
        });

        // 5. TASKS
        validTasks.forEach((task, rowIndex) => {
            const rowBg = grid.createDiv('timeline-row-bg');
            rowBg.style.gridColumn = `1 / -1`;
            rowBg.style.gridRow = `${rowIndex + 2}`;

            // Treat start date as due date if no start date exists
            const taskStart = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!);
            const taskEnd = new Date(task.dueDate!);

            // Normalize times to midnight to avoid timezone shifting bugs
            taskStart.setHours(0,0,0,0);
            taskEnd.setHours(0,0,0,0);

            // Find columns
            let startIdx = allDays.findIndex(d => d.toDateString() === taskStart.toDateString());
            let dueIdx = allDays.findIndex(d => d.toDateString() === taskEnd.toDateString());

            // If task starts before our rendered timeline, snap it to the left edge
            if (startIdx === -1 && taskStart < allDays[0]) startIdx = 0;
            // If task ends after our rendered timeline, snap it to the right edge
            if (dueIdx === -1 && taskEnd > allDays[allDays.length - 1]) dueIdx = allDays.length - 1;

            if (dueIdx >= 0 && startIdx >= 0) {
                const bar = grid.createDiv('timeline-task-bar');
                bar.setText(task.title);

                const status = getTaskStatus(task);
                if (status === TaskStatus.Overdue) bar.addClass('status-overdue');
                if (status === TaskStatus.Urgent) bar.addClass('status-urgent');
                if (status === TaskStatus.Completed) bar.addClass('status-completed');
                if (status === TaskStatus.UpcomingWeek) bar.addClass('status-active');

                // Calculate how many days the task spans (minimum 1 day)
                const span = (dueIdx - startIdx) + 1;

                bar.style.gridColumnStart = `${startIdx + 1}`;
                bar.style.gridColumnEnd = `span ${span}`;
                bar.style.gridRow = `${rowIndex + 2}`;

                bar.addEventListener('mouseenter', (e) => this.showTooltip(e, task));
                bar.addEventListener('mouseleave', () => this.hideTooltip());
                bar.addEventListener('mousemove', (e) => this.moveTooltip(e));

                bar.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openTaskFile(task);
                });
            }
        });

        // 6. INITIALIZE DRAGGING & SCROLL
        this.setupEventListeners(this.scrollContainer);
    }

    public getScrollPosition(): number {
        return this.scrollContainer ? this.scrollContainer.scrollLeft : 0;
    }

    public setScrollPosition(pos: number): void {
        if (this.scrollContainer) {
            this.scrollContainer.scrollTo({ left: pos, behavior: 'auto' });
        }
    }
    public scrollToToday(): void {
        setTimeout(() => {
            if (!this.scrollContainer) return;
            const todayCell = this.scrollContainer.querySelector('.timeline-header-cell.is-today') as HTMLElement;
            if (todayCell) {
                const scrollPos = todayCell.offsetLeft - (this.scrollContainer.clientWidth / 2) + (todayCell.clientWidth / 2);
                this.scrollContainer.scrollTo({ left: scrollPos, behavior: 'smooth' });
            }
        }, 100);
    }

    // --- PUBLIC SCROLL METHOD (Fixes DashboardView error) ---
    public scroll(direction: 'left' | 'right'): void {
        if (!this.scrollContainer) return;
        const scrollAmount = this.scrollContainer.clientWidth * 0.8;
        this.scrollContainer.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    }

    private createNavigationOverlay(direction: 'left' | 'right'): void {
        const overlay = this.container.createDiv(`timeline-nav-overlay nav-${direction}`);
        overlay.createDiv('nav-arrow').setText(direction === 'left' ? '‹' : '›');

        overlay.addEventListener('click', (e) => {
            e.stopPropagation();
            this.scroll(direction); // Reuse the release method
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
            const walk = (x - this.startX) * 1.5;
            container.scrollLeft = this.scrollLeftPos - walk;
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

        this.tooltipEl.style.display = 'block';
        this.moveTooltip(e);
    }

    private moveTooltip(e: MouseEvent): void {
        if (this.tooltipEl) {
            this.tooltipEl.style.top = `${e.clientY + 15}px`;
            this.tooltipEl.style.left = `${e.clientX + 15}px`;
        }
    }

    private hideTooltip(): void {
        if (this.tooltipEl) {
            this.tooltipEl.style.display = 'none';
        }
    }

    private async openTaskFile(task: Task): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(task.filePath);
        if (file instanceof TFile) {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);

            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (view) {
                view.editor.setCursor({ line: task.lineNumber, ch: 0 });
                view.editor.scrollIntoView({ from: {line: task.lineNumber, ch: 0}, to: {line: task.lineNumber, ch: 0} }, true);
            }
        }
    }
}
