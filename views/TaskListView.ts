import { ItemView, WorkspaceLeaf, ViewStateResult } from 'obsidian';
import SemesterDashboardPlugin from '../main';
import { TaskListComponent } from './TaskListComponent';
import { Task } from '../models/Task';
import { HeaderComponent, HeaderState } from './HeaderComponent';
import { QuickAddModal } from '../modals/QuickAddModal'; // Import Modal

export const VIEW_TYPE_LIST = 'semester-list-view';

interface ListViewState {
    headerState: HeaderState;
}

export class TaskListView extends ItemView {
    private headerComponent: HeaderComponent;
    private headerState: HeaderState = { title: null, isCollapsed: false };
    private leafRootEl: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf, private plugin: SemesterDashboardPlugin) {
        super(leaf);
        this.plugin.taskManager.on('tasks-updated', () => this.render());
    }

    getViewType() { return VIEW_TYPE_LIST; }
    getDisplayText() { return 'Task List'; }
    getIcon() { return 'list-todo'; }

    async onOpen() {
        this.leafRootEl = this.containerEl.closest('.workspace-leaf-content') as HTMLElement | null;
        if (this.leafRootEl) this.leafRootEl.classList.add('semester-chromeless');
        this.contentEl.empty();
        this.contentEl.addClass('semester-dashboard-view');
        this.contentEl.addClass('is-single-view');
        this.render();
    }

    async onClose() {
        if (this.leafRootEl) this.leafRootEl.classList.remove('semester-chromeless');
    }

    async setState(state: any, result: ViewStateResult): Promise<void> {
        if (state?.headerState) this.headerState = state.headerState;
        await super.setState(state, result);
        this.render();
    }

    getState(): any {
        if (this.headerComponent) this.headerState = this.headerComponent.getState();
        return { headerState: this.headerState };
    }

    render() {
        this.contentEl.empty();

        this.headerComponent = new HeaderComponent(
            this.contentEl,
            this.headerState,
            'My Tasks',
            {
                onStateChange: () => {
                    this.headerState = this.headerComponent.getState();
                    this.app.workspace.requestSaveLayout();
                    this.render();
                },
                onRefresh: async () => {
                    await this.plugin.taskManager.loadTasks();
                },
                // NEW: Open Quick Add Modal
                onAdd: () => {
                    new QuickAddModal(this.app, this.plugin.taskManager).open();
                }
            }
        );
        this.headerComponent.render();

        const list = new TaskListComponent(this.contentEl, this.app, {
            onToggle: (t) => this.toggleTask(t),
            onEdit: async (t, newTitle, newDate) => {
                await this.plugin.taskManager.updateTask(t, newTitle, newDate);
            },
            onDelete: async (t) => {
                await this.plugin.taskManager.deleteTask(t);
            }
        });
        list.render(this.plugin.taskManager.getFilteredTasks());
    }

    async toggleTask(task: Task) {
        const file = this.app.vault.getAbstractFileByPath(task.filePath);
        if (file) {
            const content = await this.app.vault.read(file as any);
            const lines = content.split('\n');
            if (lines[task.lineNumber]) {
                lines[task.lineNumber] = lines[task.lineNumber].includes('[x]')
                    ? lines[task.lineNumber].replace('[x]', '[ ]')
                    : lines[task.lineNumber].replace('[ ]', '[x]');
                await this.app.vault.modify(file as any, lines.join('\n'));
            }
        }
    }
}
