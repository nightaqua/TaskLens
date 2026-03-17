import { TaskManager } from '../services/TaskManager';

export class StatsComponent {
    constructor(private readonly container: HTMLElement) {}

    render(taskManager: TaskManager): void {
        this.container.empty();
        const stats = taskManager.getStatistics();

        const containerDiv = this.container.createDiv('dashboard-stats');

        const statCards = [
            { label: 'Total',     value: stats.total,     cls: 'stat-total' },
            { label: 'Active',    value: stats.upcoming,  cls: 'stat-active' },
            { label: 'Urgent',    value: stats.urgent,    cls: 'stat-urgent' },
            { label: 'Overdue',   value: stats.overdue,   cls: 'stat-overdue' },
            { label: 'Completed', value: stats.completed, cls: 'stat-completed' }
        ];

        statCards.forEach(stat => {
            const card = containerDiv.createDiv({ cls: ['stat-card', stat.cls] });
            card.setAttribute('role', 'status');
            card.setAttribute('aria-label', `${stat.label} tasks: ${String(stat.value)}`);
            card.createDiv('stat-value').setText(String(stat.value));
            card.createDiv('stat-label').setText(stat.label);
        });

        this.renderPacingAnalysis(stats.velocity7Days);
        if (stats.mostUrgentTopic) {
            this.renderUrgentTopic(stats.mostUrgentTopic);
        }
    }

    private renderPacingAnalysis(velocity: number[]): void {
        const wrapper = this.container.createDiv('dashboard-pacing-analysis');
        wrapper.createEl('h3', { text: '7-day pacing analysis' });

        const maxVal = Math.max(...velocity, 1);

        const histogramContainer = wrapper.createDiv('pacing-histogram');

        const days = ['6d', '5d', '4d', '3d', '2d', '1d', 'Today'];

        velocity.forEach((val, i) => {
            const barWrapper = histogramContainer.createDiv('histogram-bar-wrapper');
            const percent = (val / maxVal) * 100;

            const bar = barWrapper.createDiv('histogram-bar');
            bar.setCssProps({ '--bar-height': `${String(percent)}%` });

            // Value above bar
            bar.createDiv('histogram-value').setText(String(val));

            // Label below bar
            barWrapper.createDiv('histogram-label').setText(days[i]);
        });
    }

    private renderUrgentTopic(topic: { name: string, ratio: number, urgent: number, total: number }): void {
        const wrapper = this.container.createDiv('dashboard-urgent-topic');
        wrapper.createEl('h3', { text: 'Most urgent topic' });

        const card = wrapper.createDiv({ cls: ['stat-card', 'stat-urgent-topic'] });

        const nameDiv = card.createDiv('urgent-topic-name');
        nameDiv.setText(topic.name);

        const percent = Math.round(topic.ratio * 100);
        card.createDiv('urgent-topic-ratio').setText(`${String(percent)}% Urgent`);

        card.createDiv('urgent-topic-details').setText(
            `${String(topic.urgent)} of ${String(topic.total)} open tasks are urgent`
        );
    }
}