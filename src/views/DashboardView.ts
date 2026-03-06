import { ItemView, WorkspaceLeaf, setIcon, ViewStateResult } from 'obsidian';
import { TaskStatus } from '../models/Task';
import { TaskManager } from '../services/TaskManager';
import TaskLensPlugin, { RefreshableView } from '../main';
import { TimelineComponent } from './TimelineComponent';
import { TaskListComponent } from './TaskListComponent';
import { HeaderComponent, HeaderState } from './HeaderComponent';
import { QuickAddModal } from '../modals/QuickAddModal';

export const VIEW_TYPE_DASHBOARD = 'tasklens-dashboard-view';

// Applies chromeless styling to the leaf and optionally hides tabs when the layout is locked
export function setupViewDOM(containerEl: HTMLElement, isLocked: boolean) {
    const leafRootEl = containerEl.closest('.workspace-leaf-content');
    if (leafRootEl) leafRootEl.classList.add('tasklens-chromeless');
    const tabContainer = containerEl.closest('.workspace-tabs');
    if (tabContainer && isLocked) tabContainer.classList.add('tasklens-hide-tabs');
    return { leafRootEl, tabContainer };
}

// Reverses the DOM changes made by setupViewDOM on close
export function cleanUpViewDOM(leafRootEl: HTMLElement | null, tabContainer: HTMLElement | null): void {
    if (tabContainer instanceof HTMLElement) tabContainer.classList.remove('tasklens-hide-tabs');
    if (leafRootEl instanceof HTMLElement) leafRootEl.classList.remove('tasklens-chromeless');
}

export class DashboardView extends ItemView implements RefreshableView {
    private leafRootEl: HTMLElement | null = null;
    private tabContainer: HTMLElement | null = null;
    private taskManager: TaskManager;
    private timelineComponent: TimelineComponent | null = null;
    private headerComponent: HeaderComponent | null = null;
    private headerState: HeaderState = { title: null, isCollapsed: false };

    // Section visibility toggles — persisted via getState/setState
    private showControls: boolean = true;
    private showTimeline: boolean = true;
    private showList: boolean = true;
    private showStats: boolean = true;

    private timelineDaysToShow: number = 10;
    private renderTimer: NodeJS.Timeout | null = null;

    // Tracks scroll position so re-renders don't jump the timeline,
    // unless a forced scroll-to-today is requested
    private lastTimelineScroll: number | null = null;
    private forceScrollToToday: boolean = false;

    constructor(leaf: WorkspaceLeaf, private plugin: TaskLensPlugin) {
        super(leaf);
        this.taskManager = this.plugin.taskManager;

        // Debounce renders triggered by task updates to avoid rapid successive redraws
        this.taskManager.on('tasks-updated', () => {
            if (this.renderTimer) clearTimeout(this.renderTimer);

            this.renderTimer = setTimeout(() => {
                if (this.timelineComponent && !this.forceScrollToToday) {
                    this.lastTimelineScroll = this.timelineComponent.getScrollPosition();
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
        });

        // Refresh tasks whenever a Markdown file is saved
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file.path.endsWith('.md')) {
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

        if (!state || typeof state !== 'object') {
            this.render();
            return;
        }

        // Unwrap nested state object if present (Obsidian sometimes wraps it)
        let s = state as Record<string, unknown>;
        if (s.state && typeof s.state === 'object') {
            s = s.state as Record<string, unknown>;
        }

        if (Object.keys(s).length > 0) {
            if (Object.prototype.hasOwnProperty.call(s, 'showControls')) this.showControls = s.showControls as boolean;
            if (Object.prototype.hasOwnProperty.call(s, 'showTimeline')) this.showTimeline = s.showTimeline as boolean;
            if (Object.prototype.hasOwnProperty.call(s, 'showList')) this.showList = s.showList as boolean;
            if (Object.prototype.hasOwnProperty.call(s, 'showStats')) this.showStats = s.showStats as boolean;
            if (Object.prototype.hasOwnProperty.call(s, 'zoomLevel')) this.timelineDaysToShow = s.zoomLevel as number;

            if (s.statusFilter) this.taskManager.setStatusFilter(s.statusFilter as TaskStatus);
            if (s.courseFilter) this.taskManager.setCourseFilter(s.courseFilter as string);
            if (s.headerState) this.headerState = s.headerState as HeaderState;
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
            zoomLevel: this.timelineDaysToShow,
            statusFilter: filters.status,
            courseFilter: filters.course,
            headerState: this.headerComponent ? this.headerComponent.getState() : this.headerState,
        });
    }

    onOpen(): Promise<void> {
        // Apply chromeless styling and conditionally hide tabs
        const parent = this.containerEl.closest('.workspace-leaf-content');
        if (parent) parent.classList.add('tasklens-chromeless');

        this.tabContainer = this.containerEl.closest('.workspace-tabs');
        if (this.plugin.isLayoutLocked && this.tabContainer) {
            this.tabContainer.classList.add('tasklens-hide-tabs');
        }

        this.leafRootEl = this.containerEl.closest('.workspace-leaf-content');
        if (this.leafRootEl) this.leafRootEl.classList.add('tasklens-chromeless');

        this.contentEl.empty();
        this.contentEl.addClass('tasklens-dashboard-view');
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
        if (this.tabContainer) this.tabContainer.classList.remove('tasklens-hide-tabs');
        if (this.leafRootEl) this.leafRootEl.classList.remove('tasklens-chromeless');
        return Promise.resolve();
    }

    public render(): void {
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
        ['stats', 'timeline', 'list'].forEach(component => {
            if (component === 'stats' && this.showStats) this.renderStatistics();
            if (component === 'timeline' && this.showTimeline) this.renderTimeline();
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
        statusGroup.createEl('label', { text: 'Show:' });
        const statusSelect = statusGroup.createEl('select');

        const statusOptions = [
            { value: TaskStatus.Open, label: 'Active' },
            { value: TaskStatus.All, label: 'All tasks' },
            { value: TaskStatus.Completed, label: 'Completed' },
        ];
        statusOptions.forEach(opt => {
            const option = statusSelect.createEl('option', { value: opt.value, text: opt.label });
            if (opt.value === this.taskManager.getCurrentFilters().status) option.selected = true;
        });
        statusSelect.addEventListener('change', () => {
            this.taskManager.setStatusFilter(statusSelect.value as TaskStatus);
        });

        const courseGroup = filtersDiv.createDiv('control-group');
        courseGroup.createEl('label', { text: 'Topic:' });
        const courseSelect = courseGroup.createEl('select');
        courseSelect.createEl('option', { value: '', text: 'All topics' });

        this.taskManager.getCourseNames().forEach(course => {
            const option = courseSelect.createEl('option', { value: course, text: course });
            if (course === this.taskManager.getCurrentFilters().course) option.selected = true;
        });
        courseSelect.addEventListener('change', () => {
            this.taskManager.setCourseFilter(courseSelect.value || null);
        });

        // Right side: section visibility toggles
        const actionsDiv = controls.createDiv('actions-wrapper');
        actionsDiv.setCssProps({ display: 'flex', gap: '12px', 'align-items': 'center' });

        const toggles = [
            { label: 'Timeline', getter: () => this.showTimeline, setter: (v: boolean) => { this.showTimeline = v; } },
            { label: 'List', getter: () => this.showList, setter: (v: boolean) => { this.showList = v; } },
            { label: 'Stats', getter: () => this.showStats, setter: (v: boolean) => { this.showStats = v; } },
        ];

        toggles.forEach(({ label, getter, setter }) => {
            const btn = actionsDiv.createEl('button', {
                cls: `view-toggle-btn ${getter() ? 'is-active' : ''}`,
                text: label,
            });
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

        const statCards = [
            { label: 'Total',     value: stats.total,     cls: 'stat-total',     filter: TaskStatus.All },
            { label: 'Active',    value: stats.upcoming,  cls: 'stat-active',    filter: TaskStatus.UpcomingWeek },
            { label: 'Urgent',    value: stats.urgent,    cls: 'stat-urgent',    filter: TaskStatus.Urgent },
            { label: 'Overdue',   value: stats.overdue,   cls: 'stat-overdue',   filter: TaskStatus.Overdue },
            { label: 'Completed', value: stats.completed, cls: 'stat-completed', filter: TaskStatus.Completed },
        ];

        // Each card acts as a filter shortcut — clicking it filters the list to that status
        statCards.forEach(stat => {
            const card = container.createDiv({ cls: ['stat-card', stat.cls] });
            card.addClass('is-clickable');
            card.addEventListener('click', () => { this.taskManager.setStatusFilter(stat.filter); });
            card.createDiv('stat-value').setText(String(stat.value));
            card.createDiv('stat-label').setText(stat.label);
        });
    }

    private renderTaskList(): void {
        const container = this.contentEl.createDiv();

        const list = new TaskListComponent(container, this.app, {
            onToggle: (t) => { void this.taskManager.toggleTaskCompletion(t); },
            onEdit: (t, newTitle, newDate) => { void this.taskManager.updateTask(t, newTitle, newDate); },
            onDelete: (t) => { void this.taskManager.deleteTask(t); },
        }, this.plugin.settings);

        list.render(this.taskManager.getFilteredTasks());
    }

    public applyColorTheme(): void {
        const cols = this.plugin.settings.colors;
        this.contentEl.setCssProps({
            '--color-red': cols.overdue,
            '--color-orange': cols.urgent,
            '--color-green': cols.active,
            '--color-blue': cols.completed,
            '--color-purple': '#7209b7',
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
        zoomOut.addEventListener('click', () => {
            this.timelineDaysToShow = Math.min(30, this.timelineDaysToShow + 1);
            this.render();
        });
        zoomControls.createSpan({ text: ` ${String(this.timelineDaysToShow)} Days ` });
        const zoomIn = zoomControls.createEl('button', { text: '+', cls: 'view-toggle-btn' });
        zoomIn.addEventListener('click', () => {
            this.timelineDaysToShow = Math.max(3, this.timelineDaysToShow - 1);
            this.render();
        });

        // Manual scroll buttons — delegate to TimelineComponent.scroll()
        const navControls = controls.createDiv('nav-controls');
        const scrollLeft = navControls.createEl('button', { cls: 'view-toggle-btn' });
        setIcon(scrollLeft, 'chevron-left');
        const scrollRight = navControls.createEl('button', { cls: 'view-toggle-btn' });
        setIcon(scrollRight, 'chevron-right');

        this.timelineComponent = new TimelineComponent(
            container,
            this.app,
            this.taskManager.getFilteredTasks(),
            this.timelineDaysToShow,
            this.plugin.settings
        );
        this.timelineComponent.render();

        scrollLeft.addEventListener('click', () => { this.timelineComponent?.scroll('left'); });
        scrollRight.addEventListener('click', () => { this.timelineComponent?.scroll('right'); });
    }
}
