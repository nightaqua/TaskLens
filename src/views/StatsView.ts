import { ItemView, WorkspaceLeaf, ViewStateResult } from 'obsidian';
import TaskLensPlugin from '../main';
import { StatsComponent } from './StatsComponent';
import { HeaderComponent, HeaderState } from './HeaderComponent';

export const VIEW_TYPE_STATS = 'tasklens-stats-view';

export class StatsView extends ItemView {
    private leafRootEl: HTMLElement | null = null;
    private tabContainer: HTMLElement | null = null;
    private headerComponent: HeaderComponent | null = null;
    private headerState: HeaderState = { title: null, isCollapsed: false };
    constructor(leaf: WorkspaceLeaf, private plugin: TaskLensPlugin) {
        super(leaf);
        this.plugin.taskManager.on('tasks-updated', () => this.render());
    }

    getViewType() { return VIEW_TYPE_STATS; }
    getDisplayText() { return 'Dashboard Stats'; }
    getIcon() { return 'bar-chart-3'; }

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

        // Hide the tab header for this container
        this.tabContainer = this.containerEl.closest('.workspace-tabs') as HTMLElement | null;
        if (this.tabContainer) this.tabContainer.classList.add('tasklens-hide-tabs');

        this.contentEl.empty();
        this.contentEl.addClass('tasklens-dashboard-view');
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
            'Statistics',
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

        const stats = new StatsComponent(this.contentEl);
        stats.render(this.plugin.taskManager);
    }
}
