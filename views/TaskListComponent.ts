import { Task, getTaskStatus, TaskStatus } from '../models/Task';
import { App, MarkdownView, setIcon, TFile } from 'obsidian';
// (Note: You might need to import TaskManager logic via callback or pass it down)

export class TaskListComponent {
    // We need callbacks for the new actions
    constructor(
        private container: HTMLElement,
        private app: App,
        private callbacks: {
            onToggle: (t: Task) => void,
            onEdit: (t: Task, newTitle: string, newDate: Date | null) => void,
            onDelete: (t: Task) => void
        }
    ) {}

    render(tasks: Task[], groupBy: string = 'none') {
        this.container.empty();

        if (tasks.length === 0) {
            const empty = this.container.createDiv('dashboard-empty-state');
            empty.createEl('p', { text: 'No tasks found.' });
            return;
        }

        const listContainer = this.container.createDiv('dashboard-task-list');

        // ... (Keep your Grouping Logic from previous steps) ...
        // For brevity, assuming simple list or reusing the group logic you pasted:

        tasks.forEach(task => {
            this.renderTaskItem(listContainer, task);
        });
    }

    private renderTaskItem(container: HTMLElement, task: Task) {
        const status = getTaskStatus(task);
        let statusClass = 'status-active';
        if (status === TaskStatus.Overdue) statusClass = 'status-overdue';
        if (status === TaskStatus.Urgent) statusClass = 'status-urgent';
        if (status === TaskStatus.Completed) statusClass = 'status-completed';

        const taskEl = container.createDiv({ cls: ['task-item', statusClass] });

        // 1. Checkbox
        const checkbox = taskEl.createEl('input', { type: 'checkbox', cls: 'task-checkbox' });
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => this.callbacks.onToggle(task));

        // 2. Content Container
        const content = taskEl.createDiv('task-content');

        // --- VIEW MODE ---
        const viewMode = content.createDiv('task-view-mode');
        const titleEl = viewMode.createDiv('task-title');
        titleEl.setText(task.title);

        const meta = viewMode.createDiv('task-meta');
        meta.createSpan('task-course').setText(task.fileName);
        if (task.dueDate) {
            const d = task.dueDate.getDate().toString().padStart(2, '0');
            const m = (task.dueDate.getMonth() + 1).toString().padStart(2, '0');
            meta.createSpan('task-date').setText(`Due: ${d}-${m}-${task.dueDate.getFullYear()}`);
        }

        // Click title to jump to file
        titleEl.addEventListener('click', () => this.openTaskInEditor(task));

        // --- ACTIONS (Hover) ---
        const actions = taskEl.createDiv('task-actions');

        // Edit Button
        const editBtn = actions.createEl('button', { cls: 'task-action-btn' });
        setIcon(editBtn, 'pencil');
        editBtn.setAttribute('aria-label', 'Edit Task');

        // Delete Button
        const deleteBtn = actions.createEl('button', { cls: 'task-action-btn btn-danger' });
        setIcon(deleteBtn, 'trash-2');
        deleteBtn.setAttribute('aria-label', 'Delete Task');

        // --- EVENTS ---

        // DELETE
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Optional: Add confirmation dialog here
            this.callbacks.onDelete(task);
        });

        // EDIT: Switch to Input Mode
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            viewMode.hide();
            actions.hide(); // Hide buttons while editing

            // Create Input Mode UI
            const editMode = content.createDiv('task-edit-mode');

            // Title Input
            const titleInput = editMode.createEl('input', {
                type: 'text',
                value: task.title,
                cls: 'task-edit-input'
            });

            // Date Input
            const dateInput = editMode.createEl('input', {
                type: 'date',
                cls: 'task-edit-date'
            });
            if (task.dueDate) {
                // Format YYYY-MM-DD for input
                const y = task.dueDate.getFullYear();
                const m = String(task.dueDate.getMonth() + 1).padStart(2, '0');
                const d = String(task.dueDate.getDate()).padStart(2, '0');
                dateInput.value = `${y}-${m}-${d}`;
            }

            // Save Button
            const saveBtn = editMode.createEl('button', { cls: 'task-save-btn', text: 'Save' });

            // Cancel Button
            const cancelBtn = editMode.createEl('button', { cls: 'task-cancel-btn', text: 'Cancel' });

            const save = () => {
                const newTitle = titleInput.value.trim();
                if (newTitle) {
                    const newDate = dateInput.value ? new Date(dateInput.value) : null;
                    this.callbacks.onEdit(task, newTitle, newDate);
                }
                // UI will refresh automatically via TaskManager event
            };

            const cancel = () => {
                editMode.remove();
                viewMode.show();
                actions.show();
            };

            saveBtn.addEventListener('click', save);
            cancelBtn.addEventListener('click', cancel);

            // Handle Enter key
            titleInput.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter') save();
                if (evt.key === 'Escape') cancel();
            });

            titleInput.focus();
        });
    }

    private async openTaskInEditor(task: Task) {
        // ... (Keep existing logic)
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