import { App, setIcon } from 'obsidian';
import { TaskGroup, getTaskStatus, TaskStatus } from '../models/Task';
import { SemesterSettings, getTopicColor } from '../settings/Settings';
import { TaskManager } from '../services/TaskManager';
import { openTaskInEditor } from './TaskListComponent';

export class BoardComponent {
    private draggedTaskGroup: TaskGroup | null = null;
    private columns: Record<string, HTMLElement | undefined> = {};

    constructor(
        private readonly container: HTMLElement,
        private readonly app: App,
        private readonly taskManager: TaskManager,
        private readonly settings: SemesterSettings
    ) {}

    public destroy(): void {
        this.container.empty();
    }

    public render(groups: TaskGroup[]): void {
        this.container.empty();

        if (groups.length === 0) {
            const empty = this.container.createDiv('dashboard-empty-state');
            empty.createEl('p', { text: 'No tasks found.' });
            return;
        }

        const boardContainer = this.container.createDiv('dashboard-board');

        const columnsData = [
            { id: TaskStatus.UpcomingWeek, title: 'Active' },
            { id: TaskStatus.Urgent, title: 'Urgent' },
            { id: TaskStatus.Overdue, title: 'Overdue' },
            { id: TaskStatus.Completed, title: 'Completed' }
        ];

        columnsData.forEach(colData => {
            const colEl = boardContainer.createDiv('board-column');
            colEl.dataset.status = colData.id;

            const header = colEl.createDiv('board-column-header');
            header.setText(colData.title);

            this.columns[colData.id] = colEl;

            // Setup drop zone
            colEl.addEventListener('dragover', this.onDragOver);
            colEl.addEventListener('drop', this.onDrop);
        });

        // Add tasks to columns
        groups.forEach(group => {
            let status = getTaskStatus(group.representative);
            if (status === TaskStatus.NoDate) status = TaskStatus.UpcomingWeek; // fallback NoDate to Active for display

            const col = this.columns[status];
            if (!col) {
                // This should not happen with current logic, but handle gracefully
                return;
            }
            this.renderTaskCard(col, group);
        });
    }

    private readonly onDragOver = (e: DragEvent): void => {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
    };

private readonly onDrop = (e: DragEvent): void => {
    e.preventDefault();
    if (!this.draggedTaskGroup) return;
    if (!(e.currentTarget instanceof HTMLElement)) return;
    const targetColumn = e.currentTarget.closest('.board-column');
    if (!(targetColumn instanceof HTMLElement)) return;
    const rawStatus = targetColumn.dataset.status;
    const validStatuses: string[] = Object.values(TaskStatus);
    if (!rawStatus || !validStatuses.includes(rawStatus)) return;
    const newStatus = rawStatus as TaskStatus; // safe after guard
    void this.taskManager.updateTaskStatus(this.draggedTaskGroup.representative, newStatus);
    this.draggedTaskGroup = null;
};

    private renderTaskCard(container: HTMLElement, group: TaskGroup): void {
        const task = group.representative;
        const card = container.createDiv('board-task-card');

        card.setAttribute('draggable', 'true');

        if (this.settings.colorMode === 'course' && task.fileName) {
            card.setCssProps({ '--tl-task-color': getTopicColor(task.fileName, this.settings) });
            card.addClass('has-topic-color');
        } else {
            const status = getTaskStatus(task);
            if (status === TaskStatus.Overdue) card.addClass('board-status-overdue');
            if (status === TaskStatus.Urgent) card.addClass('board-status-urgent');
            if (status === TaskStatus.Completed) card.addClass('board-status-completed');
            if (status === TaskStatus.UpcomingWeek) card.addClass('board-status-active');
        }

        card.addEventListener('dragstart', (e) => {
            this.draggedTaskGroup = group;
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', task.id);
            }
            window.setTimeout(() => {
                card.addClass('is-dragging');
            }, 0);
        });

        card.addEventListener('dragend', () => {
            this.draggedTaskGroup = null;
            card.removeClass('is-dragging');
        });

        // Content
        const titleRow = card.createDiv('board-task-title');
        titleRow.setText(task.title);

        const meta = card.createDiv('board-task-meta');

        if (task.fileName) {
            const courseLabel = meta.createDiv('board-task-course');
            courseLabel.setText(task.fileName);
        }

        if (task.dueDate) {
            const dateLabel = meta.createDiv('board-task-date');
            dateLabel.setText(TaskManager.formatDisplayDate(task.dueDate));
        }

        if (group.isRecurring) {
            const label = group.doneCount > 0
                ? `Recurring task, Completed ${String(group.doneCount)} time${group.doneCount === 1 ? '' : 's'}`
                : 'Recurring task';

            const recurringChip = meta.createDiv('board-task-recurring-chip');
            recurringChip.setAttribute('aria-label', label);
            recurringChip.setAttribute('title', label);
            const icon = recurringChip.createSpan();
            setIcon(icon, 'repeat');
            if (group.doneCount > 0) {
                recurringChip.createSpan({ text: `×${String(group.doneCount)}` });
            }
        }

        // Add double click to open in editor
        card.addEventListener('dblclick', () => {
            void openTaskInEditor(this.app, task);
        });

        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `Open task in editor: ${task.title}`);
        card.setAttribute('title', `Open task in editor: ${task.title}`);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                void openTaskInEditor(this.app, task);
            }
        });
    }
}
