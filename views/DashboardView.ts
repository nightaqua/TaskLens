import { ItemView, WorkspaceLeaf, MarkdownView, setIcon, ViewStateResult } from 'obsidian';
import { Task, TaskStatus } from '../models/Task';
import { TaskManager } from '../services/TaskManager';
import SemesterDashboardPlugin from '../main';
import { TimelineComponent } from './TimelineComponent';
import { TaskListComponent } from './TaskListComponent';
import { HeaderComponent, HeaderState } from './HeaderComponent';

export const VIEW_TYPE_DASHBOARD = 'semester-dashboard-view';

export class DashboardView extends ItemView {
    private leafRootEl: HTMLElement | null = null;
    private tabContainer: HTMLElement | null = null;
    private taskManager: TaskManager;
    private timelineComponent: TimelineComponent | null = null; // Ref to access scrollToToday

    private headerComponent: HeaderComponent | null = null;
    private headerState: HeaderState = { title: null, isCollapsed: false };

    // UI State
    private showControls: boolean = true;
    private showTimeline: boolean = true;
    private showList: boolean = true;
    private showStats: boolean = true;
    private timelineDaysToShow: number = 7;

    constructor(leaf: WorkspaceLeaf, private plugin: SemesterDashboardPlugin) {
        super(leaf);
        // Use the shared task manager from main plugin
        this.taskManager = this.plugin.taskManager;

        this.taskManager.on('tasks-updated', () => this.render());
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file.path.endsWith('.md')) this.taskManager.refreshFileTask(file.path);
            })
        );

        // Default filter 'Active' (Internally 'Open')
        this.taskManager.setStatusFilter(TaskStatus.Open);
    }

    getViewType(): string { return VIEW_TYPE_DASHBOARD; }
    getDisplayText(): string { return 'Personal Dashboard'; }
    getIcon(): string { return 'layout-dashboard'; }

    // --- Persistence Logic ---
    async setState(state: any, result: ViewStateResult): Promise<void> {
        if (state) {
            this.showControls = state.showControls ?? this.showControls;
            this.showTimeline = state.showTimeline ?? this.showTimeline;
            this.showList = state.showList ?? this.showList;
            this.showStats = state.showStats ?? this.showStats;
            this.timelineDaysToShow = state.timelineDaysToShow ?? this.timelineDaysToShow;

            if (state.statusFilter) this.taskManager.setStatusFilter(state.statusFilter);
            if (state.courseFilter) this.taskManager.setCourseFilter(state.courseFilter);
            if (state.headerState) this.headerState = state.headerState;
        }

        await super.setState(state, result);
        this.render();
    }

    getState(): any {
        const filters = this.taskManager.getCurrentFilters();
        if (this.headerComponent) {
            this.headerState = this.headerComponent.getState();
        }
        return {
            showControls: this.showControls,
            showTimeline: this.showTimeline,
            showList: this.showList,
            showStats: this.showStats,
            timelineDaysToShow: this.timelineDaysToShow,
            statusFilter: filters.status,
            courseFilter: filters.course,
            headerState: this.headerState
        };
    }
    // -------------------------

    async onOpen(): Promise<void> {
        // 1) The "Parent Trick": add class to the leaf wrapper (sibling of .view-header)
        const parent = this.containerEl.closest('.workspace-leaf-content') as HTMLElement | null;
        if (parent) parent.classList.add('semester-chromeless');

        // 1b) Find the parent Tab Container (The "Window") and add our hider class
        this.tabContainer = this.containerEl.closest('.workspace-tabs') as HTMLElement | null;
        if (this.tabContainer) this.tabContainer.classList.add('semester-hide-tabs');

        this.leafRootEl = this.containerEl.closest('.workspace-leaf-content') as HTMLElement | null;
        if (this.leafRootEl) this.leafRootEl.classList.add('semester-chromeless');

        this.contentEl.empty();
        this.contentEl.addClass('semester-dashboard-view');

        this.applyColorTheme();

        await this.taskManager.loadTasks();
        this.render();
    }

    // 3. Remove class on close
    async onClose(): Promise<void> {
        // Cleanup: remove hider classes so normal notes show tabs again
        if (this.tabContainer) this.tabContainer.classList.remove('semester-hide-tabs');
        if (this.leafRootEl) this.leafRootEl.classList.remove('semester-chromeless');
    }

    public render(): void {
        this.contentEl.empty();

        this.headerComponent = new HeaderComponent(
            this.contentEl,
            this.headerState,
            'Personal Dashboard',
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
                    await this.taskManager.loadTasks();
                    if (this.timelineComponent) {
                        this.timelineComponent.scrollToToday();
                    }
                },
                onSettings: () => {
                    this.showControls = !this.showControls;
                    if (this.showControls && this.headerState.isCollapsed) {
                        this.headerState.isCollapsed = false;
                    }
                    this.app.workspace.requestSaveLayout();
                    this.render();
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
        filtersDiv.style.display = 'flex';
        filtersDiv.style.gap = '12px';
        filtersDiv.style.flexWrap = 'wrap';

        // Status Filter
        const statusGroup = filtersDiv.createDiv('control-group');
        statusGroup.createEl('label', { text: 'Show:' });
        const statusSelect = statusGroup.createEl('select');

        // UPDATED options (removed Urgent dropdown option)
        const statusOptions = [
            { value: TaskStatus.Open, label: 'Active' }, // Green
            { value: TaskStatus.All, label: 'All Tasks' },
            { value: TaskStatus.Completed, label: 'Completed' },
        ];

        statusOptions.forEach(opt => {
            const option = statusSelect.createEl('option', { value: opt.value, text: opt.label });
            if (opt.value === this.taskManager.getCurrentFilters().status) option.selected = true;
        });

        statusSelect.addEventListener('change', () => {
            this.taskManager.setStatusFilter(statusSelect.value as TaskStatus);
        });

        // Topic Filter
        const courseGroup = filtersDiv.createDiv('control-group');
        courseGroup.createEl('label', { text: 'Topic:' });
        const courseSelect = courseGroup.createEl('select');
        courseSelect.createEl('option', { value: '', text: 'All Topics' });

        this.taskManager.getCourseNames().forEach(course => {
            const option = courseSelect.createEl('option', { value: course, text: course });
            if (course === this.taskManager.getCurrentFilters().course) option.selected = true;
        });
        courseSelect.addEventListener('change', () => {
            this.taskManager.setCourseFilter(courseSelect.value || null);
        });

        const actionsDiv = controls.createDiv('actions-wrapper');
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '12px';
        actionsDiv.style.alignItems = 'center';

        // Render buttons directly (no view group wrapper)
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
            onEdit: async (t, newTitle, newDate) => {
                await this.taskManager.updateTask(t, newTitle, newDate);
            },
            onDelete: async (t) => {
                await this.taskManager.deleteTask(t);
            }
        });

        list.render(this.taskManager.getFilteredTasks());
    }

    public applyColorTheme(): void {
        const cols = this.plugin.settings.colors;
        this.contentEl.style.setProperty('--color-red', cols.overdue);
        this.contentEl.style.setProperty('--color-orange', cols.urgent);
        this.contentEl.style.setProperty('--color-green', cols.active);
        this.contentEl.style.setProperty('--color-blue', cols.completed);
        this.contentEl.style.setProperty('--color-purple', '#7209b7'); // Keep fixed or add setting later
    }

    public refreshFromSettings(): void {
        if (!this.contentEl.isConnected) return;
        this.applyColorTheme();
        this.render();
        this.app.workspace.requestSaveLayout();
    }

    private renderTimeline(): void {
        const container = this.contentEl.createDiv('dashboard-timeline-view');

        const controls = container.createDiv('timeline-controls');

        // Left: Zoom
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

        // Right: Navigation (NEW arrows)
        const navControls = controls.createDiv('nav-controls');
        const scrollLeft = navControls.createEl('button', { cls: 'view-toggle-btn' });
        setIcon(scrollLeft, 'chevron-left');

        const scrollRight = navControls.createEl('button', { cls: 'view-toggle-btn' });
        setIcon(scrollRight, 'chevron-right');

        this.timelineComponent = new TimelineComponent(
            container,
            this.app,
            this.taskManager.getFilteredTasks(),
            this.timelineDaysToShow
        );
        this.timelineComponent.render();

        // Attach listeners
        scrollLeft.addEventListener('click', () => this.timelineComponent?.scroll('left'));
        scrollRight.addEventListener('click', () => this.timelineComponent?.scroll('right'));
    }

    private async openTaskInEditor(task: Task) {
        const file = this.app.vault.getAbstractFileByPath(task.filePath);
        if (file) {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file as any);
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (view) {
                view.editor.setCursor({ line: task.lineNumber, ch: 0 });
                view.editor.scrollIntoView({ from: {line: task.lineNumber, ch: 0}, to: {line: task.lineNumber, ch: 0} }, true);
            }
        }
    }
}
