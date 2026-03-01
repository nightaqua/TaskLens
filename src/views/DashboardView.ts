import { ItemView, WorkspaceLeaf, setIcon, ViewStateResult } from 'obsidian';
import { TaskStatus } from '../models/Task';
import { TaskManager } from '../services/TaskManager';
import TaskLensPlugin, { RefreshableView } from '../main';
import { TimelineComponent } from './TimelineComponent';
import { TaskListComponent } from './TaskListComponent';
import { HeaderComponent, HeaderState } from './HeaderComponent';
import { QuickAddModal } from '../modals/QuickAddModal';

export const VIEW_TYPE_DASHBOARD = 'tasklens-dashboard-view';

export function setupViewDOM(containerEl: HTMLElement, isLocked: boolean) {
    const leafRootEl = containerEl.closest('.workspace-leaf-content') as HTMLElement | null;
    if (leafRootEl) leafRootEl.classList.add('tasklens-chromeless');
    const tabContainer = containerEl.closest('.workspace-tabs') as HTMLElement | null;
    if (tabContainer && isLocked) tabContainer.classList.add('tasklens-hide-tabs');
    return { leafRootEl, tabContainer };
}

export function cleanupViewDOM(leafRootEl: HTMLElement | null, tabContainer: HTMLElement | null) {
    if (tabContainer) tabContainer.classList.remove('tasklens-hide-tabs');
    if (leafRootEl) leafRootEl.classList.remove('tasklens-chromeless');
}

export class DashboardView extends ItemView implements RefreshableView {
    private leafRootEl: HTMLElement | null = null;
    private tabContainer: HTMLElement | null = null;
    private taskManager: TaskManager;
    private timelineComponent: TimelineComponent | null = null;

    private headerComponent: HeaderComponent | null = null;
    private headerState: HeaderState = { title: null, isCollapsed: false };

    private showControls: boolean = true;
    private showTimeline: boolean = true;
    private showList: boolean = true;
    private showStats: boolean = true;
    private timelineDaysToShow: number = 10;
    private renderTimer: NodeJS.Timeout | null = null;
    private lastTimelineScroll: number | null = null;
    private forceScrollToToday: boolean = false;

    constructor(leaf: WorkspaceLeaf, private plugin: TaskLensPlugin) {
        super(leaf);
        this.taskManager = this.plugin.taskManager;

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
    getDisplayText(): string { return 'TaskLens dashboard'; }
    getIcon(): string { return 'layout-dashboard'; }

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        if (state) {
            const parsedState = state as any;
            this.showControls = parsedState.showControls ?? this.showControls;
            this.showTimeline = parsedState.showTimeline ?? this.showTimeline;
            this.showList = parsedState.showList ?? this.showList;
            this.showStats = parsedState.showStats ?? this.showStats;
            this.timelineDaysToShow = parsedState.zoomLevel ?? 10;

            if (parsedState.statusFilter) this.taskManager.setStatusFilter(parsedState.statusFilter);
            if (parsedState.courseFilter) this.taskManager.setCourseFilter(parsedState.courseFilter);
            if (parsedState.headerState) this.headerState = parsedState.headerState;
        }

        await super.setState(state, result);
        this.render();
    }

    getState(): Record<string, unknown> {
        const filters = this.taskManager.getCurrentFilters();
        if (this.headerComponent) {
            this.headerState = this.headerComponent.getState();
        }
        return {
            showControls: this.showControls,
            showTimeline: this.showTimeline,
            showList: this.showList,
            showStats: this.showStats,
            zoomLevel: this.timelineDaysToShow,
            statusFilter: filters.status,
            courseFilter: filters.course,
            headerState: this.headerState as unknown
        };
    }

    async onOpen(): Promise<void> {
        const dom = setupViewDOM(this.containerEl, this.plugin.isLayoutLocked);
        this.leafRootEl = dom.leafRootEl;
        this.tabContainer = dom.tabContainer;

        this.contentEl.empty();
        this.contentEl.addClass('tasklens-dashboard-view');

        this.applyColorTheme();
        await this.taskManager.loadTasks();
        this.render();

        setTimeout(() => {
            if (this.timelineComponent) {
                this.timelineComponent.scrollToToday();
            }
        }, 250);
    }

    onClose(): Promise<void> {
        cleanupViewDOM(this.leafRootEl, this.tabContainer);
        return Promise.resolve();
    }

    public render(): void {
        this.contentEl.empty();

        this.headerComponent = new HeaderComponent(
            this.contentEl,
            this.headerState,
            'TaskLens dashboard',
            {
                onStateChange: () => {
                    if (this.headerComponent) {
                        this.headerState = this.headerComponent.getState();
                    }
                    if (this.headerState.isCollapsed) {
                        this.showControls = false;
                    }
                    this.app.workspace.requestSaveLayout();
                    this.render();
                },
                onRefresh: async () => {
                    this.forceScrollToToday = true;
                    await this.taskManager.loadTasks();
                },
                onSettings: () => {
                    this.showControls = !this.showControls;
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
                    void this.plugin.saveSettings().then(() => this.plugin.refreshViews());
                }
            }
        );
        this.headerComponent.render();

        this.renderControls();

        const layoutOrder = ['stats', 'timeline', 'list'];

        layoutOrder.forEach(component => {
            if (component === 'stats' && this.showStats) this.renderStatistics();
            if (component === 'timeline' && this.showTimeline) this.renderTimeline();
            if (component === 'list' && this.showList) this.renderTaskList();
        });
    }

    private renderControls(): void {
        if (!this.showControls) return;
        const controls = this.contentEl.createDiv('dashboard-controls');

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

        const actionsDiv = controls.createDiv('actions-wrapper');
        actionsDiv.setCssProps({ display: 'flex', gap: '12px', 'align-items': 'center' });

        const toggleTimeline = actionsDiv.createEl('button', {
            cls: `view-toggle-btn ${this.showTimeline ? 'is-active' : ''}`,
            text: 'Timeline'
        });
        toggleTimeline.addEventListener('click', () => {
            this.showTimeline = !this.showTimeline;
            this.app.workspace.requestSaveLayout();
            this.render();
        });

        const toggleList = actionsDiv.createEl('button', {
            cls: `view-toggle-btn ${this.showList ? 'is-active' : ''}`,
            text: 'List'
        });
        toggleList.addEventListener('click', () => {
            this.showList = !this.showList;
            this.app.workspace.requestSaveLayout();
            this.render();
        });

        const statsBtn = actionsDiv.createEl('button', {
            cls: `view-toggle-btn ${this.showStats ? 'is-active' : ''}`,
            text: 'Stats'
        });
        statsBtn.addEventListener('click', () => {
            this.showStats = !this.showStats;
            this.app.workspace.requestSaveLayout();
            this.render();
        });
    }

    private renderStatistics(): void {
        const stats = this.taskManager.getStatistics();
        const container = this.contentEl.createDiv('dashboard-stats');

        const statCards = [
            { label: 'Total', value: stats.total, cls: 'stat-total', filter: TaskStatus.All },
            { label: 'Active', value: stats.upcoming, cls: 'stat-active', filter: TaskStatus.UpcomingWeek },
            { label: 'Urgent', value: stats.urgent, cls: 'stat-urgent', filter: TaskStatus.Urgent },
            { label: 'Overdue', value: stats.overdue, cls: 'stat-overdue', filter: TaskStatus.Overdue },
            { label: 'Completed', value: stats.completed, cls: 'stat-completed', filter: TaskStatus.Completed }
        ];

        statCards.forEach(stat => {
            const card = container.createDiv({ cls: ['stat-card', stat.cls] });
            card.addClass('is-clickable');
            card.addEventListener('click', () => {
                this.taskManager.setStatusFilter(stat.filter);
            });
            card.createDiv('stat-value').setText(String(stat.value));
            card.createDiv('stat-label').setText(stat.label);
        });
    }

    private renderTaskList(): void {
        const container = this.contentEl.createDiv();

        const list = new TaskListComponent(container, this.app, {
            onToggle: (t) => this.taskManager.toggleTaskCompletion(t),
            onEdit: async (t, newTitle, newDate) => { await this.taskManager.updateTask(t, newTitle, newDate); },
            onDelete: async (t) => { await this.taskManager.deleteTask(t); }
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
            '--color-purple': '#7209b7'
        });
    }

    public refreshFromSettings() {
        this.applyColorTheme();
        this.render();
    }

    private renderTimeline(): void {
        const container = this.contentEl.createDiv('dashboard-timeline-view');

        const controls = container.createDiv('timeline-controls');

        const zoomControls = controls.createDiv('zoom-controls');
        zoomControls.createSpan({ text: 'Zoom: ' });
        const zoomOut = zoomControls.createEl('button', { text: '-', cls: 'view-toggle-btn' });
        zoomOut.addEventListener('click', () => {
            this.timelineDaysToShow = Math.min(30, this.timelineDaysToShow + 1);
            this.render();
        });
        zoomControls.createSpan({ text: ` ${this.timelineDaysToShow} Days ` });
        const zoomIn = zoomControls.createEl('button', { text: '+', cls: 'view-toggle-btn' });
        zoomIn.addEventListener('click', () => {
            this.timelineDaysToShow = Math.max(3, this.timelineDaysToShow - 1);
            this.render();
        });

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

        scrollLeft.addEventListener('click', () => this.timelineComponent?.scroll('left'));
        scrollRight.addEventListener('click', () => this.timelineComponent?.scroll('right'));
    }
}