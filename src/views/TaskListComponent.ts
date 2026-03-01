import { Task, getTaskStatus, TaskStatus } from '../models/Task';
import { App, MarkdownView, TFile } from 'obsidian';
import { SemesterSettings, getTopicColor } from '../settings/Settings';

export class TaskListComponent {
    constructor(
        private container: HTMLElement,
        private app: App,
        private callbacks: {
            onToggle: (t: Task) => void,
            onEdit: (t: Task, newTitle: string, newDate: Date | null) => void,
            onDelete: (t: Task) => void
        },
        private settings: SemesterSettings
    ) {}

    render(tasks: Task[]) {
        this.container.empty();

        if (tasks.length === 0) {
            const empty = this.container.createDiv('dashboard-empty-state');
            empty.createEl('p', { text: 'No tasks found.' });
            return;
        }

        const listContainer = this.container.createDiv('dashboard-task-list');

        tasks.forEach(task => {
            this.renderTaskItem(listContainer, task);
        });
    }

    private renderTaskItem(container: HTMLElement, task: Task) {
        const taskEl = container.createDiv({ cls: ['task-item'] });

        if (this.settings?.colorMode === 'course' && task.fileName) {
            // --- USES SHARED HELPER ---
            taskEl.setCssProps({ 'border-left-color': getTopicColor(task.fileName, this.settings) });
        } else {
            const status = getTaskStatus(task);
            if (status === TaskStatus.Overdue) taskEl.addClass('status-overdue');
            if (status === TaskStatus.Urgent) taskEl.addClass('status-urgent');
            if (status === TaskStatus.Completed) taskEl.addClass('status-completed');
            if (status === TaskStatus.UpcomingWeek) taskEl.addClass('status-active');
        }

        const checkbox = taskEl.createEl('input', { type: 'checkbox', cls: 'task-checkbox' });
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => this.callbacks.onToggle(task));

        const content = taskEl.createDiv('task-content');

        const viewMode = content.createDiv('task-view-mode');
        const titleEl = viewMode.createDiv('task-title');
        titleEl.setText(task.title);

        const meta = viewMode.createDiv('task-meta');

        if (task.fileName) {
            const courseLabel = meta.createDiv('task-course');
            courseLabel.setText(task.fileName);
        }

        if (task.dueDate) {
            const dateLabel = meta.createDiv('task-date');
            dateLabel.setText(task.dueDate.toDateString());
        }

        titleEl.addEventListener('click', () => { void this.openTaskInEditor(task); });
    }

    private async openTaskInEditor(task: Task) {
        const file = this.app.vault.getAbstractFileByPath(task.filePath);
        if (file) {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file as TFile);
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (view) {
                view.editor.setCursor({ line: task.lineNumber, ch: 0 });
                view.editor.scrollIntoView({ from: {line: task.lineNumber, ch: 0}, to: {line: task.lineNumber, ch: 0} }, true);
            }
        }
    }
}