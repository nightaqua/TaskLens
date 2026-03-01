import { ItemView, WorkspaceLeaf, ViewStateResult } from 'obsidian';
import TaskLensPlugin from '../main';
import { TaskListComponent } from './TaskListComponent';
import { Task } from '../models/Task';
import { HeaderComponent, HeaderState } from './HeaderComponent';
import { QuickAddModal } from '../modals/QuickAddModal';
import { setupViewDOM, cleanupViewDOM } from './DashboardView';

export const VIEW_TYPE_LIST = 'tasklens-list-view';

export class TaskListView extends ItemView {
    private leafRootEl: HTMLElement | null = null;
    private tabContainer: HTMLElement | null = null;
    private isOpen = false;
    private headerComponent: HeaderComponent | null = null;
    private headerState: HeaderState = { title: null, isCollapsed: false };

    private onTasksUpdated = () => {
        if (!this.isOpen || !this.contentEl?.isConnected) return;
        this.render();
    };

    constructor(leaf: WorkspaceLeaf, private plugin: TaskLensPlugin) {
        super(leaf);
        this.plugin.taskManager.on('tasks-updated', this.onTasksUpdated);
    }

    getViewType() { return VIEW_TYPE_LIST; }
    getDisplayText() { return 'Task list'; }
    getIcon() { return 'list-todo'; }

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

    onOpen(): Promise<void> {
        const dom = setupViewDOM(this.containerEl, true); // Always true for single views
        this.leafRootEl = dom.leafRootEl;
        this.tabContainer = dom.tabContainer;

        this.contentEl.empty();
        this.contentEl.addClass('tasklens-dashboard-view');
        this.contentEl.addClass('is-single-view');
        this.isOpen = true;
        this.render();
        return Promise.resolve();
    }

    onClose(): Promise<void> {
        this.isOpen = false;
        cleanupViewDOM(this.leafRootEl, this.tabContainer);
        return Promise.resolve();
    }

    render() {
        if (!this.isOpen || !this.contentEl?.isConnected) return;

        this.contentEl.empty();

        this.headerComponent = new HeaderComponent(
            this.contentEl,
            this.headerState,
            'My tasks',
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
                },
                onAdd: () => {
                    new QuickAddModal(this.app, this.plugin.taskManager).open();
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

        const list = new TaskListComponent(this.contentEl, this.app, {
            onToggle: (t: Task) => this.plugin.taskManager.toggleTaskCompletion(t),
            onEdit: async (t: Task, newTitle: string, newDate: Date | null) => {
                await this.plugin.taskManager.updateTask(t, newTitle, newDate);
            },
            onDelete: async (t: Task) => {
                await this.plugin.taskManager.deleteTask(t);
            }
        }, this.plugin.settings);
        list.render(this.plugin.taskManager.getFilteredTasks());
    }
}