import { Task, TaskGroup, getTaskStatus, TaskStatus } from '../models/Task';
import { App, MarkdownView, TFile, setIcon } from 'obsidian';
import { SemesterSettings, getTopicColor } from '../settings/Settings';
import { TaskManager } from '../services/TaskManager';
import { ConfirmModal } from '../modals/ConfirmModal';

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

type TimerChipKind = 'countdown' | 'elapsed';
type TimerChipState = 'is-green' | 'is-yellow' | 'is-orange' | 'is-red';

export interface TimerChipResult {
    text: string;
    state: TimerChipState;
    aria: string;
}

const HOUR_MS = 3600000;

/** Formats a positive duration as its two largest units, e.g. "2d 3h", "5m 20s", "12s". */
export function formatTimerDuration(ms: number): string {
    const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days >= 1) return `${String(days)}d ${String(hours)}h`;
    if (hours >= 1) return `${String(hours)}h ${String(minutes)}m`;
    if (minutes >= 1) return `${String(minutes)}m ${String(seconds)}s`;
    return `${String(seconds)}s`;
}

/**
 * Computes the text, colour state and aria label for one timer chip.
 * Returns null when the task lacks the date the chip needs (due for countdown,
 * start for elapsed) so the caller can skip rendering it.
 */
export function formatTimerChip(task: Task, kind: TimerChipKind, now: number): TimerChipResult | null {
    if (kind === 'countdown') {
        if (!task.dueDate) return null;
        const remaining = task.dueDate.getTime() - now;
        if (remaining <= 0) {
            return { text: 'Overdue', state: 'is-red', aria: 'Countdown: overdue' };
        }
        const hours = remaining / HOUR_MS;
        const state: TimerChipState = hours >= 72 ? 'is-green' : hours >= 24 ? 'is-yellow' : 'is-orange';
        const text = formatTimerDuration(remaining);
        return { text, state, aria: `Countdown: ${text} remaining` };
    }

    if (!task.startDate) return null;
    const elapsed = now - task.startDate.getTime();
    const hours = elapsed / HOUR_MS;
    const state: TimerChipState = hours < 24 ? 'is-green' : hours < 72 ? 'is-yellow' : hours < 168 ? 'is-orange' : 'is-red';
    const text = `${formatTimerDuration(elapsed)} ago`;
    return { text, state, aria: `Elapsed: ${text}` };
}

const TIMER_STATE_CLASSES: TimerChipState[] = ['is-green', 'is-yellow', 'is-orange', 'is-red'];

export class TaskListComponent {
    private readonly timerChips: { el: HTMLElement; task: Task; kind: TimerChipKind }[] = [];
    private timerIntervalId: number | null = null;

    constructor(
        private readonly container: HTMLElement,
        private readonly app: App,
        private readonly callbacks: {
            onToggle: (t: Task) => void,
            onEdit: (t: Task) => void,
            onDelete: (t: Task) => void
        },
        private readonly settings: SemesterSettings
    ) {}

    render(groups: TaskGroup[]): void {
        // Drop any chips/interval from a previous render before rebuilding the DOM.
        this.stopTimers();
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

        if (this.timerChips.length > 0) {
            this.timerIntervalId = window.setInterval(() => { this.updateTimerChips(); }, 1000);
        }
    }

    /** Clears the live-update interval. Call from the host view's onClose and before re-render. */
    public destroy(): void {
        this.stopTimers();
    }

    private stopTimers(): void {
        if (this.timerIntervalId !== null) {
            window.clearInterval(this.timerIntervalId);
            this.timerIntervalId = null;
        }
        this.timerChips.length = 0;
    }

    private updateTimerChips(): void {
        const now = Date.now();
        for (const chip of this.timerChips) {
            if (chip.el.isConnected) {
                this.applyTimerChip(chip.el, chip.task, chip.kind, now);
            }
        }
    }

    private applyTimerChip(el: HTMLElement, task: Task, kind: TimerChipKind, now: number): void {
        const result = formatTimerChip(task, kind, now);
        if (!result) return;
        el.setText(result.text);
        el.removeClasses(TIMER_STATE_CLASSES);
        el.addClass(result.state);
        el.setAttribute('aria-label', result.aria);
        el.setAttribute('title', result.aria);
    }

    private renderTimerChips(container: HTMLElement, task: Task): void {
        if (task.completed || !task.timerMode) return;

        const kinds: TimerChipKind[] = task.timerMode === 'both'
            ? ['countdown', 'elapsed']
            : [task.timerMode];

        const now = Date.now();
        for (const kind of kinds) {
            if (kind === 'countdown' && !task.dueDate) continue;
            if (kind === 'elapsed' && !task.startDate) continue;

            const chip = container.createSpan({ cls: 'tl-timer-chip' });
            this.applyTimerChip(chip, task, kind, now);
            this.timerChips.push({ el: chip, task, kind });
        }
    }

    private renderTaskItem(container: HTMLElement, group: TaskGroup): void {
        const task = group.representative;
        const taskEl = container.createDiv({ cls: ['task-item'] });

        if (this.settings.colorMode === 'course' && task.fileName) {
            taskEl.setCssProps({ '--tl-task-color': getTopicColor(task.fileName, this.settings) });
            taskEl.addClass('has-topic-color');
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

        this.renderTimerChips(titleRow, task);

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
            const label = group.doneCount > 0
                ? `Recurring task, Completed ${String(group.doneCount)} time${group.doneCount === 1 ? '' : 's'}`
                : 'Recurring task';

            const recurringChip = meta.createDiv('task-recurring-chip');
            recurringChip.setAttribute('aria-label', label);
            recurringChip.setAttribute('title', label);

            const icon = recurringChip.createSpan({ cls: 'task-recurring-icon' });
            setIcon(icon, 'repeat');
            if (group.doneCount > 0) {
                recurringChip.createSpan({
                    text: `×${String(group.doneCount)}`,
                    cls: 'task-recurrence-count'
                });
            }
        }

        // Notes display
        if (task.notes) {
            const notesEl = meta.createDiv('task-notes');
            notesEl.setText(task.notes);
        }

        // Task actions (gated by showTaskActions setting)
        if (this.settings.showTaskActions) {
            const actionsEl = meta.createDiv('task-actions');
            const editBtn = actionsEl.createEl('button', { cls: 'task-action-btn' });
            setIcon(editBtn, 'pencil');
            editBtn.setAttribute('aria-label', 'Edit task');
            editBtn.setAttribute('title', 'Edit task');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.callbacks.onEdit(task);
            });
            const deleteBtn = actionsEl.createEl('button', { cls: ['task-action-btn', 'btn-danger'] });
            setIcon(deleteBtn, 'trash-2');
            deleteBtn.setAttribute('aria-label', 'Delete task');
            deleteBtn.setAttribute('title', 'Delete task');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                new ConfirmModal(
                    this.app,
                    'Delete task',
                    `Are you sure you want to delete "${task.title}"?`,
                    () => { this.callbacks.onDelete(task); }
                ).open();
            });
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