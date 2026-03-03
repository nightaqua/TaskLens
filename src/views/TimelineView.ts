import { ItemView, WorkspaceLeaf, ViewStateResult } from 'obsidian';
import TaskLensPlugin from '../main';
import { TimelineComponent } from './TimelineComponent';
import { HeaderComponent, HeaderState } from './HeaderComponent';
import { setupViewDOM, cleanupViewDOM } from './DashboardView'; // <-- Missing import added

export const VIEW_TYPE_TIMELINE = 'tasklens-timeline-view';

export class TimelineView extends ItemView {
    private leafRootEl: Element | null = null;
    private tabContainer: Element | null = null;
    private headerComponent: HeaderComponent | null = null;
    private headerState: HeaderState = { title: null, isCollapsed: false };
    private isOpen = false; // <-- Missing property added

    constructor(leaf: WorkspaceLeaf, private plugin: TaskLensPlugin) {
        super(leaf);
        // Subscribe to shared updates
        this.plugin.taskManager.on('tasks-updated', () => {
            if (this.isOpen) this.render();
        });
    }

    getViewType() { return VIEW_TYPE_TIMELINE; }
    getDisplayText() { return 'Timeline'; }
    getIcon() { return 'calendar-range'; }

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        const parsedState = state as Record<string, unknown>;
        if (parsedState.headerState) {
            this.headerState = parsedState.headerState as HeaderState;
        }
        await super.setState(state, result);
        this.render();
    }

    getState(): Record<string, unknown> {
        if (this.headerComponent) {
            this.headerState = this.headerComponent.getState();
        }
        return { headerState: this.headerState as unknown } as Record<string, unknown>;
    }

    onOpen(): Promise<void> {
        const dom = setupViewDOM(this.containerEl, true);
        this.leafRootEl = dom.leafRootEl;
        this.tabContainer = dom.tabContainer;

        this.contentEl.empty();
        this.contentEl.addClass('tasklens-dashboard-view');
        this.contentEl.addClass('is-single-view');
        this.isOpen = true;

        void this.plugin.taskManager.loadTasks().then(() => { this.render(); });

        return Promise.resolve();
    }

    onClose(): Promise<void> {
        this.isOpen = false;
        cleanupViewDOM(this.leafRootEl, this.tabContainer);

        return Promise.resolve();
    }

    render() {
        if (!this.isOpen || !this.contentEl.isConnected) return;
        this.contentEl.empty();

        this.headerComponent = new HeaderComponent(
            this.contentEl,
            this.headerState,
            'Timeline',
            {
                onStateChange: () => {
                    if (this.headerComponent) {
                        this.headerState = this.headerComponent.getState();
                    }
                    this.app.workspace.requestSaveLayout();
                    this.render();
                },
                onRefresh: () => {
                    void this.plugin.taskManager.loadTasks();
                }
            }
        );
        this.headerComponent.render();

        const timeline = new TimelineComponent(this.contentEl, this.app, this.plugin.taskManager.getFilteredTasks(), 7, this.plugin.settings);
        timeline.render();
    }
}
