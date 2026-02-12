import { TaskManager } from '../services/TaskManager';
import { TaskStatus, getTaskStatus } from '../models/Task';

export class StatsComponent {
    constructor(private container: HTMLElement) {}

    render(taskManager: TaskManager) {
        this.container.empty();
        const stats = taskManager.getStatistics();
        const tasks = taskManager.getAllTasks();
        const urgentCount = tasks.filter(t => !t.completed && getTaskStatus(t) === TaskStatus.Urgent).length;

        const containerDiv = this.container.createDiv('dashboard-stats');

        const statCards = [
            { label: 'Total', value: stats.total, cls: 'stat-total' },
            { label: 'Active', value: stats.upcoming, cls: 'stat-active' },
            { label: 'Urgent', value: urgentCount, cls: 'stat-urgent' },
            { label: 'Overdue', value: stats.overdue, cls: 'stat-overdue' },
            { label: 'Completed', value: stats.completed, cls: 'stat-completed' }
        ];

        statCards.forEach(stat => {
            const card = containerDiv.createDiv({ cls: ['stat-card', stat.cls] });
            card.createDiv('stat-value').setText(String(stat.value));
            card.createDiv('stat-label').setText(stat.label);
        });
    }
}