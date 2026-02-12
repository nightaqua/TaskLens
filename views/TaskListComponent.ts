import { Task, getTaskStatus, TaskStatus } from '../models/Task';
import { App, MarkdownView, setIcon } from 'obsidian';

export class TaskListComponent {
    constructor(private container: HTMLElement, private app: App) {}

    render(tasks: Task[], onToggle: (t: Task) => void) {
        this.container.empty();

        if (tasks.length === 0) {
            const empty = this.container.createDiv('dashboard-empty-state');
            empty.createEl('p', { text: 'No tasks found.' });
            return;
        }

        const listContainer = this.container.createDiv('dashboard-task-list');

        tasks.forEach(task => {
            const status = getTaskStatus(task);

            let statusClass = 'status-active';
            if (status === TaskStatus.Overdue) statusClass = 'status-overdue';
            if (status === TaskStatus.Urgent) statusClass = 'status-urgent';
            if (status === TaskStatus.Completed) statusClass = 'status-completed';

            const taskEl = listContainer.createDiv({ cls: ['task-item', statusClass] });

            const checkbox = taskEl.createEl('input', { type: 'checkbox', cls: 'task-checkbox' });
            checkbox.checked = task.completed;
            checkbox.addEventListener('change', () => onToggle(task));

            const content = taskEl.createDiv('task-content');
            content.createDiv('task-title').setText(task.title);

            const meta = content.createDiv('task-meta');
            meta.createSpan('task-course').setText(task.fileName);
            if (task.dueDate) meta.createSpan('task-date').setText(`Due: ${task.dueDate.toLocaleDateString()}`);

            const titleEl = content.querySelector('.task-title') as HTMLElement;
            titleEl.addEventListener('click', () => this.openTaskInEditor(task));
        });
    }

    private async openTaskInEditor(task: Task) {
        const file = this.app.vault.getAbstractFileByPath(task.filePath);
        if (file) {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file as any);
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (view) {
                view.editor.setCursor({ line: task.lineNumber, ch: 0 });
                view.editor.scrollIntoView({ from: {line: task.lineNumber, ch: 0}, to: {line: task.lineNumber, ch: 0} }, true);
            }
        }
    }
}