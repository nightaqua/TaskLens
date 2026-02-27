import { ItemView, WorkspaceLeaf, ViewStateResult } from 'obsidian';
import TaskLensPlugin from '../main';
import { TaskListComponent } from './TaskListComponent';
import { Task } from '../models/Task';
import { HeaderComponent, HeaderState } from './HeaderComponent';
import { QuickAddModal } from '../modals/QuickAddModal'; // <--- Ensure this import exists

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
    getDisplayText() { return 'Task List'; }
    getIcon() { return 'list-todo'; }

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

        this.tabContainer = this.containerEl.closest('.workspace-tabs') as HTMLElement | null;
        if (this.tabContainer) this.tabContainer.classList.add('tasklens-hide-tabs');

        this.contentEl.empty();
        this.contentEl.addClass('tasklens-dashboard-view');
        this.contentEl.addClass('is-single-view');
        this.isOpen = true;
        this.render();
    }

    async onClose(): Promise<void> {
        this.isOpen = false;
        if (this.tabContainer) this.tabContainer.classList.remove('tasklens-hide-tabs');
        if (this.leafRootEl) this.leafRootEl.classList.remove('tasklens-chromeless');
    }

    render() {
        if (!this.isOpen || !this.contentEl?.isConnected) return;

        this.contentEl.empty();

        this.headerComponent = new HeaderComponent(
            this.contentEl,
            this.headerState,
            'My Tasks',
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
                // <--- Pass the callback to open the modal
                onAdd: () => {
                    new QuickAddModal(this.app, this.plugin.taskManager).open();
                }
            },
            {
                highlightAddButton: !this.plugin.settings.hasSeenWelcome,
                onHighlightDismiss: async () => {
                    this.plugin.settings.hasSeenWelcome = true;
                    await this.plugin.saveSettings();
                    this.plugin.refreshViews();
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
