import { ItemView, WorkspaceLeaf, ViewStateResult } from 'obsidian';
import TaskLensPlugin from '../main';
import { TaskListComponent } from './TaskListComponent';
import { Task } from '../models/Task';
import { HeaderComponent, HeaderState } from './HeaderComponent';
import { setupViewDOM, cleanUpViewDOM } from './DashboardView';
import { QuickAddModal } from '../modals/QuickAddModal';
import { VIEW_TYPE_LIST, CLASS_DASHBOARD_VIEW } from '../constants';


export class TaskListView extends ItemView {
    private leafRootEl: HTMLElement | null = null;
    private tabContainer: HTMLElement | null = null;
    private isOpen = false;
    private headerComponent: HeaderComponent | null = null;
    private headerState: HeaderState = { title: null, isCollapsed: false };

    private onTasksUpdated = () => {
        if (!this.isOpen || !this.contentEl.isConnected) return;
        this.render();
    };

    constructor(leaf: WorkspaceLeaf, private readonly plugin: TaskLensPlugin) {
        super(leaf);
        this.plugin.taskManager.on('tasks-updated', this.onTasksUpdated);
    }

    getViewType() { return VIEW_TYPE_LIST; }
    getDisplayText() { return 'Task list'; }
    getIcon() { return 'list-todo'; }

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
        const { leafRootEl, tabContainer } = setupViewDOM(this.containerEl, true);
        this.leafRootEl = leafRootEl;
        this.tabContainer = tabContainer;

        this.contentEl.empty();
        this.contentEl.addClass(CLASS_DASHBOARD_VIEW);
        this.contentEl.addClass('is-single-view');
        this.isOpen = true;
        this.render();

        return Promise.resolve();
    }

    onClose(): Promise<void> {
        this.isOpen = false;
        this.plugin.taskManager.off('tasks-updated', this.onTasksUpdated);
        cleanUpViewDOM(this.leafRootEl, this.tabContainer);
        return Promise.resolve();
    }

    render() {
        if (!this.isOpen || !this.contentEl.isConnected) return;

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
                onRefresh: () => {
                    void this.plugin.taskManager.loadTasks();
                },
                onAdd: () => {
                    // Make sure QuickAddModal handles this properly without async issues
                    const modal = new QuickAddModal(this.app, this.plugin.taskManager);
                    modal.open();
                }
            },
            {
                highlightAddButton: !this.plugin.settings.hasSeenWelcome,
                onHighlightDismiss: () => {
                    this.plugin.settings.hasSeenWelcome = true;
                    void this.plugin.saveSettings().then(() => { this.plugin.refreshViews(); });
                }
            }
        );
        this.headerComponent.render();

        const list = new TaskListComponent(this.contentEl, this.app, {
            onToggle: (t: Task) => { void this.plugin.taskManager.toggleTaskCompletion(t); },
            onEdit: (t: Task, newTitle: string, newDate: Date | null) => {
                void this.plugin.taskManager.updateTask(t, newTitle, newDate);
            },
            onDelete: (t: Task) => {
                void this.plugin.taskManager.deleteTask(t);
            }
        }, this.plugin.settings);
        list.render(this.plugin.taskManager.getGroupedFilteredTasks());
    }
}