import { ItemView, WorkspaceLeaf, ViewStateResult } from 'obsidian';
import TaskLensPlugin, { RefreshableView } from '../main';
import { TimelineComponent } from './TimelineComponent';
import { HeaderComponent, HeaderState } from './HeaderComponent';
import { setupViewDOM, cleanUpViewDOM } from './DashboardView';

export const VIEW_TYPE_TIMELINE = 'tasklens-timeline-view';

export class TimelineView extends ItemView implements RefreshableView {
    private leafRootEl: HTMLElement | null = null;
    private tabContainer: HTMLElement | null = null;
    private timelineComponent: TimelineComponent | null = null;
    private headerComponent: HeaderComponent | null = null;
    private headerState: HeaderState = { title: null, isCollapsed: false };
    private timelineDaysToShow = 10;

    constructor(leaf: WorkspaceLeaf, private plugin: TaskLensPlugin) {
        super(leaf);
        this.plugin.taskManager.on('tasks-updated', this.onTasksUpdated);
    }

    getViewType(): string { return VIEW_TYPE_TIMELINE; }
    getDisplayText(): string { return 'Timeline view'; }
    getIcon(): string { return 'clock'; }

    // Named event handler to prevent listener stacking
    private onTasksUpdated = (): void => {
        this.render();
    };

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        await super.setState(state, result);

        if (state && typeof state === 'object') {
            const s = state as Record<string, unknown>;
            if (Object.prototype.hasOwnProperty.call(s, 'headerState')) this.headerState = s.headerState as HeaderState;
            if (Object.prototype.hasOwnProperty.call(s, 'zoomLevel')) this.timelineDaysToShow = s.zoomLevel as number;
        }

        this.render();
        setTimeout(() => { this.timelineComponent?.scrollToToday(); }, 300);
    }

    getState(): Record<string, unknown> {
        return Object.assign(super.getState(), {
            headerState: this.headerComponent ? this.headerComponent.getState() : this.headerState,
            zoomLevel: this.timelineDaysToShow
        });
    }

    onOpen(): Promise<void> {
        // Use shared utility for UI consistency
        const { leafRootEl, tabContainer } = setupViewDOM(this.containerEl, this.plugin.isLayoutLocked);
        this.leafRootEl = leafRootEl as HTMLElement;
        this.tabContainer = tabContainer as HTMLElement;

        this.contentEl.empty();
        this.contentEl.addClass('tasklens-dashboard-view');

        void this.plugin.taskManager.loadTasks().then(() => {
            this.render();
            setTimeout(() => { this.timelineComponent?.scrollToToday(); }, 500);
        });

        return Promise.resolve();
    }

    onClose(): Promise<void> {
        this.plugin.taskManager.off('tasks-updated', this.onTasksUpdated);
        this.performCleanUp();
        return Promise.resolve();
    }

    private performCleanUp(): void {
        cleanUpViewDOM(this.leafRootEl, this.tabContainer);
    }

    public render(): void {
        this.contentEl.empty();

        this.headerComponent = new HeaderComponent(
            this.contentEl,
            this.headerState,
            'Timeline',
            {
                onStateChange: () => {
                    if (this.headerComponent) this.headerState = this.headerComponent.getState();
                    this.app.workspace.requestSaveLayout();
                    this.render();
                },
                onRefresh: () => { void this.plugin.taskManager.loadTasks(); },
            }
        );
        this.headerComponent.render();

        const container = this.contentEl.createDiv('dashboard-timeline-view');
        this.timelineComponent = new TimelineComponent(
            container,
            this.app,
            this.plugin.taskManager.getFilteredTasks(),
            this.timelineDaysToShow,
            this.plugin.settings
        );
        this.timelineComponent.render();
    }

    public refreshFromSettings(): void {
        this.render();
    }
}
