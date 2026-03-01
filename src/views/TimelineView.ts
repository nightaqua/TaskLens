import { ItemView, WorkspaceLeaf, ViewStateResult } from 'obsidian';
import TaskLensPlugin from '../main';
import { TimelineComponent } from './TimelineComponent';
import { HeaderComponent, HeaderState } from './HeaderComponent';
import { setupViewDOM, cleanupViewDOM } from './DashboardView';

export const VIEW_TYPE_TIMELINE = 'tasklens-timeline-view';

export class TimelineView extends ItemView {
    private leafRootEl: HTMLElement | null = null;
    private tabContainer: HTMLElement | null = null;
    private headerComponent: HeaderComponent | null = null;
    private headerState: HeaderState = { title: null, isCollapsed: false };

    constructor(leaf: WorkspaceLeaf, private plugin: TaskLensPlugin) {
        super(leaf);
        this.plugin.taskManager.on('tasks-updated', () => this.render());
    }

    getViewType() { return VIEW_TYPE_TIMELINE; }
    getDisplayText() { return 'Timeline'; }
    getIcon() { return 'calendar-range'; }

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        const parsedState = state as any;
        if (parsedState?.headerState) {
            this.headerState = parsedState.headerState;
        }
        await super.setState(state, result);
        this.render();
    }

    getState(): Record<string, unknown> {
        if (this.headerComponent) {
            this.headerState = this.headerComponent.getState();
        }
        return { headerState: this.headerState as unknown };
    }

    async onOpen() {
        const dom = setupViewDOM(this.containerEl, true);
        this.leafRootEl = dom.leafRootEl;
        this.tabContainer = dom.tabContainer;

        this.contentEl.empty();
        this.contentEl.addClass('tasklens-dashboard-view');
        this.contentEl.addClass('is-single-view');

        await this.plugin.taskManager.loadTasks();
        this.render();
    }

    async onClose(): Promise<void> {
        cleanupViewDOM(this.leafRootEl, this.tabContainer);
    }

    render() {
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
                onRefresh: async () => {
                    await this.plugin.taskManager.loadTasks();
                }
            }
        );
        this.headerComponent.render();

        const timeline = new TimelineComponent(this.contentEl, this.app, this.plugin.taskManager.getFilteredTasks(), 7, this.plugin.settings);
        timeline.render();
    }
}