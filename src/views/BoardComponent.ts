import { App, setIcon } from 'obsidian';
import { TaskGroup, getTaskStatus, TaskStatus } from '../models/Task';
import { SemesterSettings, getTopicColor } from '../settings/Settings';
import { TaskManager } from '../services/TaskManager';
import { openTaskInEditor } from './TaskListComponent';

export class BoardComponent {
    private draggedTaskGroup: TaskGroup | null = null;
    private columns: Record<string, HTMLElement> = {};

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

        const boardContainer = this.container.createDiv('dashboard-board');
        boardContainer.setCssProps({
            display: 'flex',
            gap: '16px',
            'overflow-x': 'auto',
            'padding-bottom': '16px',
            'min-height': '300px'
        });

        const columnsData = [
            { id: TaskStatus.UpcomingWeek, title: 'Active' },
            { id: TaskStatus.Urgent, title: 'Urgent' },
            { id: TaskStatus.Overdue, title: 'Overdue' },
            { id: TaskStatus.Completed, title: 'Completed' }
        ];

        columnsData.forEach(colData => {
            const colEl = boardContainer.createDiv('board-column');
            colEl.setCssProps({
                flex: '1 1 280px',
                'min-width': '280px',
                background: 'var(--background-secondary)',
                'border-radius': '8px',
                padding: '12px',
                display: 'flex',
                'flex-direction': 'column',
                gap: '8px'
            });
            colEl.dataset.status = colData.id;

            const header = colEl.createDiv('board-column-header');
            header.setCssProps({
                'font-weight': '600',
                'margin-bottom': '8px',
                color: 'var(--text-normal)'
            });
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

        const targetColumn = (e.currentTarget as HTMLElement).closest('.board-column');
        if (targetColumn instanceof HTMLElement) {
            const newStatus = targetColumn.dataset.status as TaskStatus;

            // Trigger update via TaskManager
            void this.taskManager.updateTaskStatus(this.draggedTaskGroup.representative, newStatus);
        }

        this.draggedTaskGroup = null;
    };

    private renderTaskCard(container: HTMLElement, group: TaskGroup): void {
        const task = group.representative;
        const card = container.createDiv('board-task-card');

        card.setAttribute('draggable', 'true');
        card.setCssProps({
            background: 'var(--background-primary)',
            border: '1px solid var(--background-modifier-border)',
            'border-radius': '6px',
            padding: '10px',
            cursor: 'grab',
            display: 'flex',
            'flex-direction': 'column',
            gap: '6px'
        });

        if (this.settings.colorMode === 'course' && task.fileName) {
            card.setCssProps({ 'border-left': `4px solid ${getTopicColor(task.fileName, this.settings)}` });
        } else {
            const status = getTaskStatus(task);
            if (status === TaskStatus.Overdue) card.setCssProps({ 'border-left': '4px solid var(--color-red)' });
            if (status === TaskStatus.Urgent) card.setCssProps({ 'border-left': '4px solid var(--color-orange)' });
            if (status === TaskStatus.Completed) card.setCssProps({ 'border-left': '4px solid var(--color-blue)', opacity: '0.7' });
            if (status === TaskStatus.UpcomingWeek) card.setCssProps({ 'border-left': '4px solid var(--color-green)' });
        }

        card.addEventListener('dragstart', (e) => {
            this.draggedTaskGroup = group;
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', task.id);
            }
            setTimeout(() => {
                card.setCssProps({ opacity: '0.5' });
            }, 0);
        });

        card.addEventListener('dragend', () => {
            this.draggedTaskGroup = null;
            card.setCssProps({ opacity: '1' });
        });

        // Content
        const titleRow = card.createDiv('board-task-title');
        titleRow.setCssProps({
            'font-size': '0.95em',
            'font-weight': '500',
            'line-height': '1.3'
        });
        titleRow.setText(task.title);

        const meta = card.createDiv('board-task-meta');
        meta.setCssProps({
            display: 'flex',
            'flex-wrap': 'wrap',
            gap: '6px',
            'font-size': '0.8em',
            color: 'var(--text-muted)'
        });

        if (task.fileName) {
            const courseLabel = meta.createDiv('board-task-course');
            courseLabel.setText(task.fileName);
            courseLabel.setCssProps({
                background: 'var(--background-secondary-alt)',
                padding: '2px 6px',
                'border-radius': '4px'
            });
        }

        if (task.dueDate) {
            const dateLabel = meta.createDiv('board-task-date');
            dateLabel.setText(TaskManager.formatDisplayDate(task.dueDate));
            dateLabel.setCssProps({
                background: 'var(--background-secondary-alt)',
                padding: '2px 6px',
                'border-radius': '4px'
            });
        }

        if (group.isRecurring) {
            const recurringChip = meta.createDiv('board-task-recurring-chip');
            recurringChip.setCssProps({
                display: 'flex',
                'align-items': 'center',
                gap: '2px',
                background: 'var(--background-secondary-alt)',
                padding: '2px 6px',
                'border-radius': '4px'
            });
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
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                void openTaskInEditor(this.app, task);
            }
        });
    }
}
