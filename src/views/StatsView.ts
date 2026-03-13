import { ItemView, WorkspaceLeaf, ViewStateResult } from 'obsidian';
import TaskLensPlugin from '../main';
import { StatsComponent } from './StatsComponent';
import { HeaderComponent, HeaderState } from './HeaderComponent';
import { setupViewDOM, cleanUpViewDOM } from './DashboardView';
import { VIEW_TYPE_STATS, CLASS_DASHBOARD_VIEW } from '../constants';


export class StatsView extends ItemView {
    private leafRootEl: HTMLElement | null = null;
    private tabContainer: HTMLElement | null = null;
    private headerComponent: HeaderComponent | null = null;
    private headerState: HeaderState = { title: null, isCollapsed: false };
    private readonly onTasksUpdated = (): void => { this.render(); };

    constructor(leaf: WorkspaceLeaf, private readonly plugin: TaskLensPlugin) {
        super(leaf);
        this.plugin.taskManager.on('tasks-updated', this.onTasksUpdated);
    }

    getViewType(): string { return VIEW_TYPE_STATS; }
    getDisplayText(): string { return 'Dashboard stats'; }
    getIcon(): string { return 'bar-chart-3'; }

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        if (state && typeof state === 'object') {
            const s = state as Record<string, unknown>;
            if (Object.prototype.hasOwnProperty.call(s, 'headerState')) {
                this.headerState = s.headerState as HeaderState;
            }
        }
        await super.setState(state, result);
        this.render();
    }

    getState(): Record<string, unknown> {
        if (this.headerComponent) {
            this.headerState = this.headerComponent.getState();
        }
        return Object.assign(super.getState(), { headerState: this.headerState });
    }

    onOpen(): Promise<void> {
        const { leafRootEl, tabContainer } = setupViewDOM(this.containerEl, true);
        this.leafRootEl = leafRootEl;
        this.tabContainer = tabContainer;

        this.contentEl.empty();
        this.contentEl.addClass(CLASS_DASHBOARD_VIEW);
        this.render();

        // Keep stats live when the user edits tasks outside the dashboard
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file.path.endsWith('.md') && !this.plugin.taskManager.getIsInternalChange()) {
                    void this.plugin.taskManager.refreshFileTask(file.path);
                }
            })
        );

        return Promise.resolve();
    }

    onClose(): Promise<void> {
        this.plugin.taskManager.off('tasks-updated', this.onTasksUpdated);
        cleanUpViewDOM(this.leafRootEl, this.tabContainer);
        return Promise.resolve();
    }

    render(): void {
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
                onRefresh: () => { void this.plugin.taskManager.loadTasks(); },
            }
        );
        this.headerComponent.render();

        const stats = new StatsComponent(this.contentEl);
        stats.render(this.plugin.taskManager);
    }
}
