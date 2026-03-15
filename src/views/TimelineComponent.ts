import { Task, TaskGroup, getTaskStatus, TaskStatus } from '../models/Task';
import { App, setIcon } from 'obsidian';
import { SemesterSettings, getTopicColor } from '../settings/Settings';
import { openTaskInEditor } from './TaskListComponent';
import { TaskManager } from '../services/TaskManager';

export class TimelineComponent {
    private readonly container: HTMLElement;
    private readonly groups: TaskGroup[];
    private readonly daysToShow: number;
    private readonly app: App;
    private readonly settings: SemesterSettings;
    private readonly onViewportChange: ((newStart: Date) => void) | null;

    private viewportStart: Date;
    private scrollContainer: HTMLElement | null = null;
    private tooltipEl: HTMLElement | null = null;

    // Persists the nav ribbon panel's open state across re-renders triggered by viewport jumps
    private ribbonNavOpen = false;
    // Stored so it can be removed before re-render
    private ribbonOutsideHandler: ((e: MouseEvent) => void) | null = null;

    // Drag-to-scroll state
    private isDragging = false;
    private startX = 0;
    private scrollLeftPos = 0;

    // The viewport always renders exactly MAX_DAYS columns — the DOM size stays constant
    private static readonly MAX_DAYS = 365;

    // Jump buttons shift the viewport by this many months
    private static readonly JUMP_MONTHS = 6;

    constructor(
        container: HTMLElement,
        app: App,
        groups: TaskGroup[],
        daysToShow: number = 10,
        settings: SemesterSettings,
        viewportStart?: Date,
        onViewportChange?: (newStart: Date) => void
    ) {
        this.container = container;
        this.app = app;
        this.groups = groups;
        this.daysToShow = daysToShow;
        this.settings = settings;
        this.onViewportChange = onViewportChange ?? null;

        // Default: start 3 months before today so today is always comfortably in view
        if (viewportStart) {
            this.viewportStart = new Date(viewportStart);
        } else {
            const defaultStart = new Date();
            defaultStart.setMonth(defaultStart.getMonth() - 3);
            defaultStart.setHours(0, 0, 0, 0);
            this.viewportStart = defaultStart;
        }
    }

    public getViewportStart(): Date {
        return new Date(this.viewportStart);
    }

    // Commits a new viewport start date, fires the change callback, re-renders, and resets pan
    private applyViewportJump(newStart: Date): void {
        this.viewportStart = newStart;
        if (this.onViewportChange) this.onViewportChange(new Date(newStart));
        this.render();
        this.scrollContainer?.scrollTo({ left: 0, behavior: 'auto' });
    }

    // Shifts the viewport by the given number of months and re-renders
    private jumpViewport(monthDelta: number): void {
        const next = new Date(this.viewportStart);
        next.setMonth(next.getMonth() + monthDelta);
        this.applyViewportJump(next);
    }

    // Jumps the viewport so the given date sits near the left edge, then re-renders
    private jumpToDate(date: Date): void {
        const target = new Date(date);
        target.setDate(target.getDate() - 14); // 2-week lead-in
        target.setHours(0, 0, 0, 0);
        this.applyViewportJump(target);
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
        cell.setCssProps({
            width: `${String(span * colWidth)}%`,
            left: `${String(startIdx * colWidth)}%`
        });
    }

    // Builds the fixed-width day array for the current viewport
    private buildViewportDays(): Date[] {
        const days: Date[] = [];
        const curr = new Date(this.viewportStart);
        curr.setHours(0, 0, 0, 0);
        for (let i = 0; i < TimelineComponent.MAX_DAYS; i++) {
            days.push(new Date(curr));
            curr.setDate(curr.getDate() + 1);
        }
        return days;
    }

    private createSideRibbon(allDays: Date[], validTasks: Task[]): void {
        const ribbon = this.container.createDiv('timeline-ribbon');

        // ── Nav section ───────────────────────────────────────────────────────────
        const navSection = ribbon.createDiv('ribbon-section ribbon-section--nav');

        const navHandle = navSection.createDiv('ribbon-handle ribbon-handle--nav');
        navHandle.setAttribute('aria-label', 'Navigate timeline');
        const navIconWrap = navHandle.createDiv('ribbon-handle-icon');
        setIcon(navIconWrap, 'calendar-range');

        const navHoverLabel = navSection.createDiv('ribbon-hover-label');
        navHoverLabel.setText('Navigate');

        const navPanel = navSection.createDiv('ribbon-panel');

        // Define open/close before anything that might call them ──────────────────
        const openNav = (): void => {
            this.ribbonNavOpen = true;
            navSection.addClass('is-open');
            // Guard: don't double-register
            if (this.ribbonOutsideHandler) {
                document.removeEventListener('mousedown', this.ribbonOutsideHandler);
                this.ribbonOutsideHandler = null;
            }
            const handler = (e: MouseEvent): void => {
                const target = e.target;
                if (!(target instanceof Node)) return;
                if (!navSection.contains(target)) {
                    this.ribbonNavOpen = false;
                    navSection.removeClass('is-open');
                    document.removeEventListener('mousedown', handler);
                    this.ribbonOutsideHandler = null;
                }
            };
            this.ribbonOutsideHandler = handler;
            document.addEventListener('mousedown', handler);
        };

        const closeNav = (): void => {
            this.ribbonNavOpen = false;
            navSection.removeClass('is-open');
            if (this.ribbonOutsideHandler) {
                document.removeEventListener('mousedown', this.ribbonOutsideHandler);
                this.ribbonOutsideHandler = null;
            }
        };

        // Restore open state after a viewport-jump re-render — also re-attaches handler
        if (this.ribbonNavOpen) openNav();

        const viewportEnd = new Date(this.viewportStart);
        viewportEnd.setDate(viewportEnd.getDate() + TimelineComponent.MAX_DAYS - 1);
        const startLabel = this.viewportStart.toLocaleString('default', { month: 'short', year: '2-digit' });
        const endLabel = viewportEnd.toLocaleString('default', { month: 'short', year: '2-digit' });

        const navControls = navPanel.createDiv('ribbon-nav-controls');

        const prevBtn = navControls.createEl('button', { cls: 'vp-jump' });
        prevBtn.setText('‹‹');
        prevBtn.setAttribute('aria-label', 'Jump back 6 months');
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.ribbonNavOpen = true;
            this.jumpViewport(-TimelineComponent.JUMP_MONTHS);
        });

        const rangeEl = navControls.createDiv('vp-range');
        rangeEl.createSpan().setText(startLabel);
        rangeEl.createEl('em').setText('/');
        rangeEl.createSpan().setText(endLabel);

        const nextBtn = navControls.createEl('button', { cls: 'vp-jump' });
        nextBtn.setText('››');
        nextBtn.setAttribute('aria-label', 'Jump forward 6 months');
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.ribbonNavOpen = true;
            this.jumpViewport(TimelineComponent.JUMP_MONTHS);
        });

        const windowStart = allDays[0];
        const windowEnd = allDays[allDays.length - 1];
        const outOfRange = validTasks.filter(t => {
            if (!t.dueDate) return false;
            return t.dueDate < windowStart || t.dueDate > windowEnd;
        });

        if (outOfRange.length > 0) {
            const byMonth = new Map<string, { label: string; date: Date; count: number }>();
            outOfRange.forEach(t => {
                if (!t.dueDate) return;
                const key = t.dueDate.toLocaleString('default', { month: 'short', year: 'numeric' });
                const existing = byMonth.get(key);
                if (existing) {
                    existing.count += 1;
                } else {
                    byMonth.set(key, { label: key, date: new Date(t.dueDate), count: 1 });
                }
            });

            const chipsEl = navPanel.createDiv('ribbon-chips');
            byMonth.forEach(({ label, date, count }) => {
                const isPast = date < windowStart;
                const chip = chipsEl.createEl('button', { cls: `chip ${isPast ? 'chip--past' : 'chip--future'}` });
                const countSuffix = count > 1 ? ` \xd7${String(count)}` : '';
                chip.setText(isPast ? `\u2190 ${label}${countSuffix}` : `${label}${countSuffix} \u2192`);
                chip.setAttribute('aria-label', `Jump to ${label}`);
                chip.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.ribbonNavOpen = true;
                    this.jumpToDate(date);
                });
            });
        }

        navHandle.addEventListener('click', () => {
            if (navSection.hasClass('is-open')) {
                closeNav();
            } else {
                openNav();
            }
        });

        // ── Sync section ──────────────────────────────────────────────────────────
        // No panel, no toggle. Hover reveals a floating expand (rightward absolute overlay).
        // Clicking either the handle or the expand fires scrollToToday.
        const syncSection = ribbon.createDiv('ribbon-section ribbon-section--sync');

        const syncHandle = syncSection.createDiv('ribbon-handle ribbon-handle--sync');
        syncHandle.setAttribute('aria-label', 'Scroll to today');
        const syncIconWrap = syncHandle.createDiv('ribbon-handle-icon');
        setIcon(syncIconWrap, 'rotate-ccw');

        // Floating expand — shown on section hover via CSS, positioned rightward
        const syncExpand = syncSection.createDiv('ribbon-sync-expand');
        const syncExpandIcon = syncExpand.createDiv('ribbon-sync-expand-icon');
        setIcon(syncExpandIcon, 'rotate-ccw');
        syncExpand.createSpan({ cls: 'ribbon-sync-expand-label' }).setText('Today');

        syncHandle.addEventListener('click', () => { this.scrollToToday(); });
        syncExpand.addEventListener('click', () => { this.scrollToToday(); });
    }

    public render(): void {
        if (this.ribbonOutsideHandler) {
            document.removeEventListener('mousedown', this.ribbonOutsideHandler);
            this.ribbonOutsideHandler = null;
        }
        this.container.empty();
        this.container.addClass('timeline-wrapper');

        // Extract representative tasks from groups. Each group renders as one bar.
        // Completed-only groups (openCount === 0) are included so completed recurring
        // tasks still appear on the timeline.
        const validGroups = this.groups.filter(g => {
            const t = g.representative;
            return t.dueDate && !isNaN(t.dueDate.getTime());
        });

        if (validGroups.length === 0) {
            const empty = this.container.createDiv('dashboard-empty-state');
            empty.createEl('p', { text: 'No dated tasks to display.' });
            return;
        }

        // Build the fixed-width viewport — always MAX_DAYS columns, no matter what dates exist
        const allDays = this.buildViewportDays();

        // Ribbon is appended to the outer container so it anchors to the pane's left wall,
        // outside the chart entirely. The chart wrapper gets a left margin to match.
        this.createSideRibbon(allDays, validGroups.map(g => g.representative));

        // Left/right hover-overlay arrows for panning within the window — untouched
        this.createNavigationOverlay('left');
        this.createNavigationOverlay('right');

        // Outer scroll container
        this.scrollContainer = this.container.createDiv('timeline-container');
        const scrollContent = this.scrollContainer.createDiv('timeline-scroll-content');
        scrollContent.setCssProps({ width: `${String((allDays.length / this.daysToShow) * 100)}%` });

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
        grid.setCssProps({ 'grid-template-columns': `repeat(${String(allDays.length)}, 1fr)` });

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

        const windowStart = allDays[0];
        const windowEnd = allDays[allDays.length - 1];

        const sortedGroups = [...validGroups].sort((a, b) => {
            const ta = a.representative;
            const tb = b.representative;
            if (ta.fileName !== tb.fileName) {
                return (ta.fileName || '').localeCompare(tb.fileName || '');
            }
            const aStart = ta.startDate?.getTime() ?? ta.dueDate?.getTime() ?? 0;
            const bStart = tb.startDate?.getTime() ?? tb.dueDate?.getTime() ?? 0;
            return aStart - bStart;
        });

        const windowStartMs = windowStart.getTime();
        const windowEndMs = windowEnd.getTime() + 86399999;
        const visibleGroups = sortedGroups.filter(group => {
            const task = group.representative;
            if (!task.dueDate) return false;
            const dueMs = new Date(task.dueDate).setHours(23, 59, 59, 999);
            const startDate = task.startDate ?? task.dueDate;
            const startMs = new Date(startDate).setHours(0, 0, 0, 0);
            return dueMs >= windowStartMs && startMs <= windowEndMs;
        });

        // Precompute date string → column index for O(1) lookups instead of O(N) array scans
        const dayIndexMap = new Map<string, number>();
        for (let i = 0; i < allDays.length; i++) {
            dayIndexMap.set(allDays[i].toDateString(), i);
        }

        visibleGroups.forEach((group) => {
            const task = group.representative;
            if (!task.dueDate) return;

            const taskStart = new Date(task.startDate ?? task.dueDate);
            const taskEnd = new Date(task.dueDate);
            taskStart.setHours(0, 0, 0, 0);
            taskEnd.setHours(0, 0, 0, 0);

            let startIdx = dayIndexMap.get(taskStart.toDateString()) ?? -1;
            let dueIdx = dayIndexMap.get(taskEnd.toDateString()) ?? -1;

            // Clamp tasks that extend beyond the visible range
            if (startIdx === -1 && taskStart < allDays[0]) startIdx = 0;
            if (dueIdx === -1 && taskEnd > allDays[allDays.length - 1]) dueIdx = allDays.length - 1;

            if (startIdx === -1 || dueIdx === -1 || (startIdx === 0 && dueIdx === 0 && taskEnd < allDays[0])) return;

            // Find the first row whose last task has already ended before this one starts
            let rowIndex = rowEndTimes.findIndex(endTime => endTime < taskStart.getTime());
            if (rowIndex === -1) {
                rowIndex = rowEndTimes.length;
                rowEndTimes.push(taskEnd.getTime());

                const rowBg = grid.createDiv('timeline-row-bg');
                rowBg.setCssProps({ 'grid-column': '1 / -1', 'grid-row': String(rowIndex + 2) });
            } else {
                rowEndTimes[rowIndex] = taskEnd.getTime();
            }

            const barLabel = task.title;

            const bar = grid.createDiv('timeline-task-bar');
            bar.setText(barLabel);
            bar.setAttribute('role', 'button');
            bar.setAttribute('tabindex', '0');
            bar.setAttribute('aria-label', `Open task in editor: ${task.title}`);
            bar.setCssProps({
                'grid-column-start': String(startIdx + 1),
                'grid-column-end': `span ${String((dueIdx - startIdx) + 1)}`,
                'grid-row': String(rowIndex + 2)
            });

            if (taskStart < allDays[0]) bar.addClass('is-clamped-left');
            if (taskEnd > allDays[allDays.length - 1]) bar.addClass('is-clamped-right');

            // Colour by course/topic or by urgency status depending on settings
            if (this.settings.colorMode === 'course' && task.fileName) {
                bar.setCssProps({ 'background-color': getTopicColor(task.fileName, this.settings) });
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

            bar.addEventListener('mouseenter', (e) => { this.showTooltip(e, task, group.isRecurring); });
            bar.addEventListener('mouseleave', () => { this.hideTooltip(); });
            bar.addEventListener('mousemove', (e) => { this.moveTooltip(e); });
            bar.addEventListener('click', (e) => {
                e.stopPropagation();
                void openTaskInEditor(this.app, task);
            });
            bar.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    void openTaskInEditor(this.app, task);
                }
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

    // Smoothly centres the viewport on today's column.
    // If today is outside the current window, jumps the viewport to bring it in first.
    public scrollToToday(): void {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const windowEnd = new Date(this.viewportStart);
        windowEnd.setDate(windowEnd.getDate() + TimelineComponent.MAX_DAYS - 1);

        if (today < this.viewportStart || today > windowEnd) {
            const newStart = new Date(today);
            newStart.setMonth(newStart.getMonth() - 3);
            newStart.setHours(0, 0, 0, 0);
            // applyViewportJump re-renders, so we return — the new render will have today in range
            this.applyViewportJump(newStart);
            return;
        }

        if (!this.scrollContainer) return;
        const todayCell = this.scrollContainer.querySelector('.timeline-header-cell.is-today');
        if (todayCell instanceof HTMLElement) {
            const scrollPos = todayCell.offsetLeft
                - (this.scrollContainer.clientWidth / 2)
                + (todayCell.clientWidth / 2);
            this.scrollContainer.scrollTo({ left: Math.max(0, scrollPos), behavior: 'smooth' });
        }
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

    private showTooltip(e: MouseEvent, task: Task, isRecurring: boolean): void {
        if (!this.tooltipEl) {
            this.tooltipEl = document.body.createDiv('dashboard-tooltip');
        }
        this.tooltipEl.empty();
        this.tooltipEl.createDiv('tooltip-title').setText(task.title);
        this.tooltipEl.createDiv('tooltip-meta').setText(`📂 ${task.fileName}`);
        if (task.dueDate) {
            this.tooltipEl.createDiv('tooltip-date').setText(`📅 ${TaskManager.formatDisplayDate(task.dueDate)}`);
        }
        if (isRecurring) {
            this.tooltipEl.createDiv('tooltip-recurrence').setText('🔁 recurring');
        }
        if (task.notes) {
            this.tooltipEl.createDiv('tooltip-notes').setText(task.notes);
        }
        this.tooltipEl.setCssProps({ display: 'block' });
        this.moveTooltip(e);
    }

    private moveTooltip(e: MouseEvent): void {
        if (this.tooltipEl) {
            let left = e.clientX + 15;
            let top = e.clientY + 15;

            // Bounds checking against viewport
            const width = this.tooltipEl.offsetWidth || 0;
            const height = this.tooltipEl.offsetHeight || 0;
            const maxLeft = window.innerWidth - width - 15;
            const maxTop = window.innerHeight - height - 15;

            if (left > maxLeft) left = Math.max(0, e.clientX - width - 15);
            if (top > maxTop) top = Math.max(0, e.clientY - height - 15);

            this.tooltipEl.setCssProps({
                top: `${String(top)}px`,
                left: `${String(left)}px`
            });
        }
    }

    private hideTooltip(): void {
        this.tooltipEl?.setCssProps({ display: 'none' });
    }

    /** Removes DOM nodes owned by this component that live outside its container. */
    public destroy(): void {
        this.hideTooltip();
        this.tooltipEl?.remove();
        this.tooltipEl = null;
        if (this.ribbonOutsideHandler) {
            document.removeEventListener('mousedown', this.ribbonOutsideHandler);
            this.ribbonOutsideHandler = null;
        }
    }

}