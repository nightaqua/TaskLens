import { ItemView, WorkspaceLeaf, setIcon, ViewStateResult } from 'obsidian';
import { TaskStatus } from '../models/Task';
import { TaskManager } from '../services/TaskManager';
import TaskLensPlugin, { RefreshableView } from '../main';
import { TimelineComponent } from './TimelineComponent';
import { TaskListComponent } from './TaskListComponent';
import { BoardComponent } from './BoardComponent';
import { HeaderComponent, HeaderState } from './HeaderComponent';
import { QuickAddModal } from '../modals/QuickAddModal';
import { VIEW_TYPE_DASHBOARD, CLASS_CHROMELESS, CLASS_HIDE_TABS, CLASS_DASHBOARD_VIEW } from '../constants';


function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
}

function isTaskStatus(v: unknown): v is TaskStatus {
    if (typeof v !== 'string') return false;
    return (Object.values(TaskStatus) as string[]).includes(v);
}

function isHeaderState(v: unknown): v is HeaderState {
    return typeof v === 'object' && v !== null;
}

// Applies chromeless styling to the leaf and optionally hides tabs when the layout is locked
export function setupViewDOM(
    containerEl: HTMLElement,
    isLocked: boolean
): { leafRootEl: HTMLElement | null; tabContainer: HTMLElement | null } {
    const leafRootRaw = containerEl.closest('.workspace-leaf-content');
    const tabContainerRaw = containerEl.closest('.workspace-tabs');

    const leafRootEl = leafRootRaw instanceof HTMLElement ? leafRootRaw : null;
    const tabContainer = tabContainerRaw instanceof HTMLElement ? tabContainerRaw : null;

    if (leafRootEl) leafRootEl.classList.add(CLASS_CHROMELESS);
    if (tabContainer && isLocked) tabContainer.classList.add(CLASS_HIDE_TABS);

    return { leafRootEl, tabContainer };
}

// Reverses the DOM changes made by setupViewDOM on close
export function cleanUpViewDOM(leafRootEl: HTMLElement | null, tabContainer: HTMLElement | null): void {
    if (tabContainer instanceof HTMLElement) tabContainer.classList.remove(CLASS_HIDE_TABS);
    if (leafRootEl instanceof HTMLElement) leafRootEl.classList.remove(CLASS_CHROMELESS);
}

export class DashboardView extends ItemView implements RefreshableView {
    private leafRootEl: HTMLElement | null = null;
    private tabContainer: HTMLElement | null = null;
    private taskManager: TaskManager;
    private timelineComponent: TimelineComponent | null = null;
    private boardComponent: BoardComponent | null = null;
    private headerComponent: HeaderComponent | null = null;
    private headerState: HeaderState = { title: null, isCollapsed: false };

    // Section visibility toggles — persisted via getState/setState
    private showControls: boolean = true;
    private showTimeline: boolean = true;
    private showList: boolean = true;
    private showStats: boolean = true;
    private showBoard: boolean = false;

    // Per-view stats display preference — persisted via getState/setState
    // Removed from global Settings so each dashboard widget can have its own value.
    private statsCompletionFormat: 'all' | 'today' = 'all';

    private timelineDaysToShow: number = 10;
    private renderTimer: ReturnType<typeof setTimeout> | null = null;

    // Tracks scroll position so re-renders don't jump the timeline,
    // unless a forced scroll-to-today is requested
    private lastTimelineScroll: number | null = null;
    private lastViewportStart: Date | null = null;
    private forceScrollToToday: boolean = false;

    private readonly onTasksUpdated = (): void => {
        if (this.renderTimer) clearTimeout(this.renderTimer);

        this.renderTimer = setTimeout(() => {
            if (this.timelineComponent && !this.forceScrollToToday) {
                this.lastTimelineScroll = this.timelineComponent.getScrollPosition();
                this.lastViewportStart = this.timelineComponent.getViewportStart();
            }

            this.render();

            if (this.timelineComponent) {
                if (this.forceScrollToToday) {
                    this.timelineComponent.scrollToToday();
                    this.forceScrollToToday = false;
                } else if (this.lastTimelineScroll !== null) {
                    this.timelineComponent.setScrollPosition(this.lastTimelineScroll);
                }
            }
        }, 500);
    };

    constructor(leaf: WorkspaceLeaf, private readonly plugin: TaskLensPlugin) {
        super(leaf);
        this.taskManager = this.plugin.taskManager;

        // Debounce renders triggered by task updates to avoid rapid successive redraws
        this.taskManager.on('tasks-updated', this.onTasksUpdated);

        // Refresh tasks when a Markdown file is saved externally.
        // The isInternalChange guard prevents this from racing with processManualUpdate:
        // when TaskManager is mid-write (adding completion metadata), we must not
        // trigger a refreshFileTask that would reload a half-written state.
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file.path.endsWith('.md') && !this.taskManager.getIsInternalChange()) {
                    void this.taskManager.refreshFileTask(file.path);
                }
            })
        );

        this.taskManager.setStatusFilter(TaskStatus.Open);
    }

    getViewType(): string { return VIEW_TYPE_DASHBOARD; }
    getDisplayText(): string { return 'Tasklens dashboard'; }
    getIcon(): string { return 'layout-dashboard'; }

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        await super.setState(state, result);

        if (!isRecord(state)) {
            this.render();
            return;
        }

        // Unwrap nested state object if present (Obsidian sometimes wraps it)
        let s = state;
        if (isRecord(s.state)) {
            s = s.state;
        }

        if (Object.keys(s).length > 0) {
            if (typeof s.showControls === 'boolean') this.showControls = s.showControls;
            if (typeof s.showTimeline === 'boolean') this.showTimeline = s.showTimeline;
            if (typeof s.showList === 'boolean') this.showList = s.showList;
            if (typeof s.showStats === 'boolean') this.showStats = s.showStats;
            if (typeof s.showBoard === 'boolean') this.showBoard = s.showBoard;
            if (typeof s.zoomLevel === 'number') this.timelineDaysToShow = s.zoomLevel;
            if (s.statsCompletionFormat === 'all' || s.statsCompletionFormat === 'today') this.statsCompletionFormat = s.statsCompletionFormat;

            if (isTaskStatus(s.statusFilter)) this.taskManager.setStatusFilter(s.statusFilter);
            if (typeof s.courseFilter === 'string') this.taskManager.setCourseFilter(s.courseFilter);
            if (isHeaderState(s.headerState)) this.headerState = s.headerState;
        }

        this.render();

        // Delay scroll until the timeline DOM is ready
        setTimeout(() => {
            if (this.timelineComponent) this.timelineComponent.scrollToToday();
        }, 500);
    }

    getState(): Record<string, unknown> {
        const filters = this.taskManager.getCurrentFilters();

        return Object.assign(super.getState(), {
            showControls: this.showControls,
            showTimeline: this.showTimeline,
            showList: this.showList,
            showStats: this.showStats,
            showBoard: this.showBoard,
            zoomLevel: this.timelineDaysToShow,
            statsCompletionFormat: this.statsCompletionFormat,
            statusFilter: filters.status,
            courseFilter: filters.course,
            headerState: this.headerComponent ? this.headerComponent.getState() : this.headerState,
        });
    }

    onOpen(): Promise<void> {
        // Delegate chromeless styling and tab-hiding to the shared helper
        // so DashboardView, TimelineView etc. all behave identically.
        const { leafRootEl, tabContainer } = setupViewDOM(this.containerEl, this.plugin.isLayoutLocked);
        this.leafRootEl = leafRootEl;
        this.tabContainer = tabContainer;

        this.contentEl.empty();
        this.contentEl.addClass(CLASS_DASHBOARD_VIEW);
        this.applyColorTheme();

        void this.taskManager.loadTasks().then(() => {
            this.render();
            this.forceScrollToToday = true;
            setTimeout(() => {
                if (this.timelineComponent) {
                    this.timelineComponent.scrollToToday();
                }
            }, 500);
        });

        return Promise.resolve();
    }

    onClose(): Promise<void> {
        this.taskManager.off('tasks-updated', this.onTasksUpdated);
        this.timelineComponent?.destroy();
        this.boardComponent?.destroy();
        cleanUpViewDOM(this.leafRootEl, this.tabContainer);
        return Promise.resolve();
    }

    public render(): void {
        // Snapshot viewport state before wiping the DOM
        if (this.timelineComponent && !this.forceScrollToToday) {
            this.lastViewportStart = this.timelineComponent.getViewportStart();
            this.lastTimelineScroll = this.timelineComponent.getScrollPosition();
        }
        // Clean up out-of-container DOM nodes before wiping contentEl
        this.timelineComponent?.destroy();
        this.boardComponent?.destroy();

        this.contentEl.empty();

        this.headerComponent = new HeaderComponent(
            this.contentEl,
            this.headerState,
            'Tasklens dashboard',
            {
                onStateChange: () => {
                    if (this.headerComponent) {
                        this.headerState = this.headerComponent.getState();
                    }
                    // Collapsing the header also hides controls
                    if (this.headerState.isCollapsed) {
                        this.showControls = false;
                    }
                    this.app.workspace.requestSaveLayout();
                    this.render();
                },
                onRefresh: () => {
                    this.forceScrollToToday = true;
                    void this.taskManager.loadTasks();
                },
                onSettings: () => {
                    this.showControls = !this.showControls;
                    // Expanding controls requires the header to be uncollapsed
                    if (this.showControls && this.headerState.isCollapsed) {
                        this.headerState.isCollapsed = false;
                    }
                    this.app.workspace.requestSaveLayout();
                    this.render();
                },
                onAdd: () => {
                    new QuickAddModal(this.app, this.taskManager).open();
                }
            },
            {
                highlightAddButton: !this.plugin.settings.hasSeenWelcome,
                onHighlightDismiss: () => {
                    this.plugin.settings.hasSeenWelcome = true;
                    void this.plugin.saveSettings().then(() => { this.plugin.refreshViews(); });
                }
            }
        );
        this.headerComponent.render();

        this.renderControls();

        // Render sections in order; each is gated by its visibility toggle
        ['stats', 'timeline', 'board', 'list'].forEach(component => {
            if (component === 'stats' && this.showStats) this.renderStatistics();
            if (component === 'timeline' && this.showTimeline) this.renderTimeline();
            if (component === 'board' && this.showBoard) this.renderBoard();
            if (component === 'list' && this.showList) this.renderTaskList();
        });
    }

    private renderControls(): void {
        if (!this.showControls) return;

        const controls = this.contentEl.createDiv('dashboard-controls');

        // Left side: status and topic filter dropdowns
        const filtersDiv = controls.createDiv('filters-wrapper');
        filtersDiv.setCssProps({ display: 'flex', gap: '12px', 'flex-wrap': 'wrap' });

        const statusGroup = filtersDiv.createDiv('control-group');
        statusGroup.createEl('label', { text: 'Show:', attr: { for: 'dashboard-status-filter' } });
        const statusSelect = statusGroup.createEl('select', { attr: { id: 'dashboard-status-filter' } });
        statusSelect.setAttribute('aria-label', 'Filter by status');

        const statusOptions = [
            { value: TaskStatus.Open, label: 'Active (All)' },
            { value: TaskStatus.UpcomingWeek, label: 'Upcoming' },
            { value: TaskStatus.Urgent, label: 'Urgent' },
            { value: TaskStatus.Overdue, label: 'Overdue' },
            { value: TaskStatus.Completed, label: 'Completed' },
            { value: TaskStatus.All, label: 'All tasks' },
        ];
        statusOptions.forEach(opt => {
            const option = statusSelect.createEl('option', { value: opt.value, text: opt.label });
            if (opt.value === this.taskManager.getCurrentFilters().status) option.selected = true;
        });
        statusSelect.addEventListener('change', () => {
            this.taskManager.setStatusFilter(statusSelect.value as TaskStatus);
        });

        const courseGroup = filtersDiv.createDiv('control-group');
        courseGroup.createEl('label', { text: 'Topic:', attr: { for: 'dashboard-course-filter' } });
        const courseSelect = courseGroup.createEl('select', { attr: { id: 'dashboard-course-filter' } });
        courseSelect.setAttribute('aria-label', 'Filter by topic');
        courseSelect.createEl('option', { value: '', text: 'All topics' });

        this.taskManager.getCourseNames().forEach(course => {
            const option = courseSelect.createEl('option', { value: course, text: course });
            if (course === this.taskManager.getCurrentFilters().course) option.selected = true;
        });
        courseSelect.addEventListener('change', () => {
            this.taskManager.setCourseFilter(courseSelect.value || null);
        });

        const completionGroup = filtersDiv.createDiv('control-group');
        completionGroup.createEl('label', { text: 'Completed:', attr: { for: 'dashboard-completion-filter' } });
        const completionSelect = completionGroup.createEl('select', { attr: { id: 'dashboard-completion-filter' } });
        completionSelect.setAttribute('aria-label', 'Filter by completion date');
        [
            { value: 'all',   text: 'All-time' },
            { value: 'today', text: 'Today' },
        ].forEach(opt => {
            const option = completionSelect.createEl('option', { value: opt.value, text: opt.text });
            if (opt.value === this.statsCompletionFormat) option.selected = true;
        });
        completionSelect.addEventListener('change', () => {
            this.statsCompletionFormat = completionSelect.value as 'all' | 'today';
            this.app.workspace.requestSaveLayout();
            this.render();
        });

        // Right side: section visibility toggles
        const actionsDiv = controls.createDiv('actions-wrapper');
        actionsDiv.setCssProps({ display: 'flex', gap: '12px', 'align-items': 'center' });

        const toggles = [
            { label: 'Timeline', getter: () => this.showTimeline, setter: (v: boolean) => { this.showTimeline = v; } },
            { label: 'Board', getter: () => this.showBoard, setter: (v: boolean) => { this.showBoard = v; } },
            { label: 'List', getter: () => this.showList, setter: (v: boolean) => { this.showList = v; } },
            { label: 'Stats', getter: () => this.showStats, setter: (v: boolean) => { this.showStats = v; } },
        ];

        toggles.forEach(({ label, getter, setter }) => {
            const isActive = getter();
            const btn = actionsDiv.createEl('button', {
                cls: `view-toggle-btn ${isActive ? 'is-active' : ''}`,
                text: label,
            });
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            btn.addEventListener('click', () => {
                setter(!getter());
                this.app.workspace.requestSaveLayout();
                this.render();
            });
        });
    }

    private renderStatistics(): void {
        const stats = this.taskManager.getStatistics();
        const container = this.contentEl.createDiv('dashboard-stats');

        // Determine which value to show based on user settings
        const showToday = this.statsCompletionFormat === 'today';
        const completionValue = showToday ? stats.completedToday : stats.completed;
        const completionLabel = showToday ? 'Done today' : 'Completed';

        const statCards = [
            { label: 'Total',     value: stats.total,      cls: 'stat-total',     filter: TaskStatus.All },
            { label: 'Upcoming',  value: stats.upcoming,   cls: 'stat-upcoming',  filter: TaskStatus.UpcomingWeek },
            { label: 'Urgent',    value: stats.urgent,     cls: 'stat-urgent',    filter: TaskStatus.Urgent },
            { label: 'Overdue',   value: stats.overdue,    cls: 'stat-overdue',   filter: TaskStatus.Overdue },
            { label: completionLabel, value: completionValue, cls: 'stat-completed', filter: TaskStatus.Completed },
        ];

        statCards.forEach(stat => {
            const card = container.createDiv({ cls: ['stat-card', stat.cls, 'is-clickable'] });
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', `Filter by ${stat.label} tasks`);

            const triggerFilter = () => { this.taskManager.setStatusFilter(stat.filter); };
            card.addEventListener('click', triggerFilter);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    triggerFilter();
                }
            });

            card.createDiv('stat-value').setText(String(stat.value));
            card.createDiv('stat-label').setText(stat.label);
        });
    }

    private renderBoard(): void {
        const container = this.contentEl.createDiv();

        this.boardComponent = new BoardComponent(
            container,
            this.app,
            this.taskManager,
            this.plugin.settings
        );
        this.boardComponent.render(this.taskManager.getGroupedFilteredTasks());
    }

    private renderTaskList(): void {
        const container = this.contentEl.createDiv();

        const list = new TaskListComponent(container, this.app, {
            onToggle: (t) => { void this.taskManager.toggleTaskCompletion(t); },
            onEdit: (t, newTitle, newDate) => { void this.taskManager.updateTask(t, newTitle, newDate); },
            onDelete: (t) => { void this.taskManager.deleteTask(t); },
        }, this.plugin.settings);

        list.render(this.taskManager.getGroupedFilteredTasks());
    }

    public applyColorTheme(): void {
        const cols = this.plugin.settings.colors;
        this.contentEl.setCssProps({
            '--color-red': cols.overdue,
            '--color-orange': cols.urgent,
            '--color-green': cols.active,
            '--color-blue': cols.completed,
            '--color-purple': 'var(--color-purple)',
        });
    }

    public refreshFromSettings() {
        this.applyColorTheme();
        this.render();
    }

    private renderTimeline(): void {
        const container = this.contentEl.createDiv('dashboard-timeline-view');
        const controls = container.createDiv('timeline-controls');

        // Zoom out = more days visible (wider view); zoom in = fewer days (narrower/tighter)
        const zoomControls = controls.createDiv('zoom-controls');
        zoomControls.createSpan({ text: 'Zoom: ' });

        const zoomOut = zoomControls.createEl('button', { text: '-', cls: 'view-toggle-btn' });
        zoomOut.setAttribute('aria-label', 'Zoom out timeline');
        zoomOut.addEventListener('click', () => {
            this.timelineDaysToShow = Math.min(30, this.timelineDaysToShow + 1);
            this.render();
        });
        zoomControls.createSpan({ text: ` ${String(this.timelineDaysToShow)} days ` });
        const zoomIn = zoomControls.createEl('button', { text: '+', cls: 'view-toggle-btn' });
        zoomIn.setAttribute('aria-label', 'Zoom in timeline');
        zoomIn.addEventListener('click', () => {
            this.timelineDaysToShow = Math.max(3, this.timelineDaysToShow - 1);
            this.render();
        });

        // Manual scroll buttons — delegate to TimelineComponent.scroll()
        const navControls = controls.createDiv('nav-controls');
        const scrollLeft = navControls.createEl('button', { cls: 'view-toggle-btn' });
        scrollLeft.setAttribute('aria-label', 'Scroll left');
        setIcon(scrollLeft, 'chevron-left');
        const scrollRight = navControls.createEl('button', { cls: 'view-toggle-btn' });
        scrollRight.setAttribute('aria-label', 'Scroll right');
        setIcon(scrollRight, 'chevron-right');

        this.timelineComponent = new TimelineComponent(
            container,
            this.app,
            this.taskManager.getGroupedFilteredTasks(),
            this.timelineDaysToShow,
            this.plugin.settings,
            this.lastViewportStart ?? undefined,
            (newStart) => { this.lastViewportStart = newStart; }
        );
        this.timelineComponent.render();

        scrollLeft.addEventListener('click', () => { this.timelineComponent?.scroll('left'); });
        scrollRight.addEventListener('click', () => { this.timelineComponent?.scroll('right'); });
    }
}