import { ItemView, WorkspaceLeaf, ViewStateResult } from 'obsidian';
import SemesterDashboardPlugin from '../main';
import { TaskListComponent } from './TaskListComponent';
import { Task } from '../models/Task';
import { HeaderComponent, HeaderState } from './HeaderComponent';

export const VIEW_TYPE_LIST = 'semester-list-view';

export class TaskListView extends ItemView {
    private leafRootEl: HTMLElement | null = null;
    private tabContainer: HTMLElement | null = null;
    private isOpen = false;
    private headerComponent: HeaderComponent | null = null;
    private headerState: HeaderState = { title: null, isCollapsed: false };
    private onTasksUpdated = () => {
        // Extra-safe: ignore updates if the view is not open/attached
        if (!this.isOpen || !this.contentEl?.isConnected) return;
        this.render();
    };

    constructor(leaf: WorkspaceLeaf, private plugin: SemesterDashboardPlugin) {
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
        if (this.leafRootEl) this.leafRootEl.classList.add('semester-chromeless');

        // Hide the tab header for this container
        this.tabContainer = this.containerEl.closest('.workspace-tabs') as HTMLElement | null;
        if (this.tabContainer) this.tabContainer.classList.add('semester-hide-tabs');

        this.contentEl.empty();
        this.contentEl.addClass('semester-dashboard-view');
        this.contentEl.addClass('is-single-view');
        this.isOpen = true;
        this.render();
    }

    async onClose(): Promise<void> {
        this.isOpen = false;
        if (this.tabContainer) this.tabContainer.classList.remove('semester-hide-tabs');
        if (this.leafRootEl) this.leafRootEl.classList.remove('semester-chromeless');
    }

    render() {
        // Extra-safe: Obsidian can sometimes call render paths during transitions
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
                }
            }
        );
        this.headerComponent.render();

        const list = new TaskListComponent(this.contentEl, this.app);
        list.render(this.plugin.taskManager.getFilteredTasks(), (t) => this.toggleTask(t));
    }

    private async toggleTask(task: Task) {
        // For now, simple file edit:
        const file = this.app.vault.getAbstractFileByPath(task.filePath);
        if (file) {
            const content = await this.app.vault.read(file as any);
            const lines = content.split('\n');
            if (lines[task.lineNumber]) {
                lines[task.lineNumber] = lines[task.lineNumber].includes('[x]')
                    ? lines[task.lineNumber].replace('[x]', '[ ]')
                    : lines[task.lineNumber].replace('[ ]', '[x]');
                await this.app.vault.modify(file as any, lines.join('\n'));
                // TaskManager will detect file change and trigger update for ALL views
            }
        }
    }
}
