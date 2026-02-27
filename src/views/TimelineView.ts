import { ItemView, WorkspaceLeaf, ViewStateResult } from 'obsidian';
import TaskLensPlugin from '../main';
import { TimelineComponent } from './TimelineComponent';
import { HeaderComponent, HeaderState } from './HeaderComponent';

export const VIEW_TYPE_TIMELINE = 'tasklens-timeline-view';

export class TimelineView extends ItemView {
    private leafRootEl: HTMLElement | null = null;
    private tabContainer: HTMLElement | null = null;
    private headerComponent: HeaderComponent | null = null;
    private headerState: HeaderState = { title: null, isCollapsed: false };
    constructor(leaf: WorkspaceLeaf, private plugin: TaskLensPlugin) {
        super(leaf);
        // Subscribe to shared updates
        this.plugin.taskManager.on('tasks-updated', () => this.render());
    }

    getViewType() { return VIEW_TYPE_TIMELINE; }
    getDisplayText() { return 'Timeline'; }
    getIcon() { return 'calendar-range'; }

    async setState(state: any, result: ViewStateResult): Promise<void> {
        if (state?.headerState) {
            this.headerState = state.headerState;
        }
        await super.setState(state, result);
        this.render();
    }

    getState(): any {
        if (this.headerComponent) {
            this.headerState = this.headerComponent.getState();
        }
        return { headerState: this.headerState };
    }

    async onOpen() {
        this.leafRootEl = this.containerEl.closest('.workspace-leaf-content') as HTMLElement | null;
        if (this.leafRootEl) this.leafRootEl.classList.add('tasklens-chromeless');

        // Find and flag the parent tab container to hide its header strip
        this.tabContainer = this.containerEl.closest('.workspace-tabs') as HTMLElement | null;
        if (this.tabContainer) this.tabContainer.classList.add('tasklens-hide-tabs');

        this.contentEl.empty();
        this.contentEl.addClass('tasklens-dashboard-view');
        this.contentEl.addClass('is-single-view');

        await this.plugin.taskManager.loadTasks();
        this.render();
    }

    async onClose(): Promise<void> {
        if (this.tabContainer) this.tabContainer.classList.remove('tasklens-hide-tabs');
        if (this.leafRootEl) this.leafRootEl.classList.remove('tasklens-chromeless');
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
