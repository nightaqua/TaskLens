import { Task, getTaskStatus, TaskStatus } from '../models/Task';
import { App, MarkdownView, setIcon, TFile } from 'obsidian';
import { SemesterSettings } from '../settings/Settings';

export class TaskListComponent {
    // We need callbacks for the new actions
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

    private getCourseColor(courseName: string): string {
        if (this.settings?.topicColors && this.settings.topicColors[courseName]) {
            return this.settings.topicColors[courseName];
        }
        
        const defaultPalette = ['#4cc9f0', '#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4caf50'];
        let hash = 0;
        for (let i = 0; i < courseName.length; i++) hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
        return defaultPalette[Math.abs(hash) % defaultPalette.length];
    }

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
        const taskEl = container.createDiv({ cls: ['task-item'] });

        if (this.settings?.colorMode === 'course' && task.fileName) {
            // Apply dynamic course color
            taskEl.style.borderLeftColor = this.getCourseColor(task.fileName);
        } else {
            // Apply standard urgency color
            const status = getTaskStatus(task);
            if (status === TaskStatus.Overdue) taskEl.addClass('status-overdue');
            if (status === TaskStatus.Urgent) taskEl.addClass('status-urgent');
            if (status === TaskStatus.Completed) taskEl.addClass('status-completed');
            if (status === TaskStatus.UpcomingWeek) taskEl.addClass('status-active');
        }

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

        if (task.fileName) {
            const courseLabel = meta.createDiv('task-course');
            courseLabel.setText(task.fileName);
        }

        if (task.dueDate) {
            const dateLabel = meta.createDiv('task-date');
            dateLabel.setText(task.dueDate.toDateString());
        }

        const actions = meta.createDiv('task-actions');

        /* const editBtn = actions.createEl('button', { cls: 'task-action-btn' });
        setIcon(editBtn, 'pencil');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            viewMode.style.display = 'none';
            
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
            };

            const cancel = () => {
                editMode.remove();
                viewMode.style.display = 'flex';
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

        const deleteBtn = actions.createEl('button', { cls: 'task-action-btn btn-danger' });
        setIcon(deleteBtn, 'trash-2');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.callbacks.onDelete(task);
        }); */

        // Click title to jump to file
        titleEl.addEventListener('click', () => this.openTaskInEditor(task));
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
