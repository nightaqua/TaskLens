import { Task, TaskGroup, getTaskStatus, TaskStatus } from '../models/Task';
import { App, MarkdownView, TFile, setIcon } from 'obsidian';
import { SemesterSettings, getTopicColor } from '../settings/Settings';
import { TaskManager } from '../services/TaskManager';

/**
 * Opens the source file for a task and moves the editor cursor to its exact line.
 * Exported here so TimelineComponent can import it from one place — same pattern
 * as setupViewDOM (DashboardView.ts) and getTopicColor (Settings.ts).
 */
export async function openTaskInEditor(app: App, task: Task): Promise<void> {
    const file = app.vault.getAbstractFileByPath(task.filePath);
    if (!(file instanceof TFile)) return;

    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(file, { active: true });

    const view = app.workspace.getActiveViewOfType(MarkdownView);
    if (view) {
        const pos = { line: task.lineNumber, ch: 0 };
        view.editor.setCursor(pos);
        view.editor.scrollIntoView({ from: pos, to: pos }, true);
    }
}

export class TaskListComponent {
    constructor(
        private readonly container: HTMLElement,
        private readonly app: App,
        private readonly callbacks: {
            onToggle: (t: Task) => void,
            onEdit: (t: Task, newTitle: string, newDate: Date | null) => void,
            onDelete: (t: Task) => void
        },
        private readonly settings: SemesterSettings
    ) {}

    render(groups: TaskGroup[]): void {
        this.container.empty();

        if (groups.length === 0) {
            const empty = this.container.createDiv('dashboard-empty-state');
            empty.createEl('p', { text: 'No tasks found.' });
            return;
        }

        const listContainer = this.container.createDiv('dashboard-task-list');

        groups.forEach(group => {
            this.renderTaskItem(listContainer, group);
        });
    }

    private renderTaskItem(container: HTMLElement, group: TaskGroup): void {
        const task = group.representative;
        const taskEl = container.createDiv({ cls: ['task-item'] });

        if (this.settings.colorMode === 'course' && task.fileName) {
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
        checkbox.setAttribute('aria-label', `Toggle task: ${task.title}`);
        checkbox.setAttribute('title', `Toggle task: ${task.title}`);
        checkbox.addEventListener('change', () => { this.callbacks.onToggle(task); });

        const content = taskEl.createDiv('task-content');

        const viewMode = content.createDiv('task-view-mode');
        const titleRow = viewMode.createDiv('task-title-row');
        const titleEl = titleRow.createDiv('task-title');
        titleEl.setText(task.title);
        titleEl.setAttribute('role', 'button');
        titleEl.setAttribute('tabindex', '0');
        titleEl.setAttribute('aria-label', `Open task in editor: ${task.title}`);
        titleEl.setAttribute('title', `Open task in editor: ${task.title}`);

        const meta = viewMode.createDiv('task-meta');

        if (task.fileName) {
            const courseLabel = meta.createDiv('task-course');
            courseLabel.setText(task.fileName);
        }

        if (task.dueDate) {
            const dateLabel = meta.createDiv('task-date');
            dateLabel.setText(TaskManager.formatDisplayDate(task.dueDate));
        }

        // Recurring chip: icon always shown for recurring tasks.
        // ×N badge shows completed cycle count when at least one cycle has been done.
        if (group.isRecurring) {
            const recurringChip = meta.createDiv('task-recurring-chip');
            const icon = recurringChip.createSpan({ cls: 'task-recurring-icon' });
            setIcon(icon, 'repeat');
            if (group.doneCount > 0) {
                recurringChip.createSpan({
                    text: `×${String(group.doneCount)}`,
                    cls: 'task-recurrence-count',
                    attr: {
                        'aria-label': `Completed ${String(group.doneCount)} time${group.doneCount === 1 ? '' : 's'}`,
                        'title': `Completed ${String(group.doneCount)} time${group.doneCount === 1 ? '' : 's'}`
                    }
                });
            }
        }

        titleEl.addEventListener('click', () => { void openTaskInEditor(this.app, task); });
        titleEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                void openTaskInEditor(this.app, task);
            }
        });
    }

}