import { App, Modal, Setting } from 'obsidian';
import TaskLensPlugin from '../main';

export class WelcomeModal extends Modal {
    constructor(app: App, private plugin: TaskLensPlugin) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('tasklens-welcome-modal');

        const header = contentEl.createDiv('welcome-header');
        header.setCssProps({ 'text-align': 'center', 'margin-bottom': '20px' });
        header.createEl('h1', { text: 'Welcome to TaskLens 🚀' });
        header.createEl('p', { text: 'Your command center for tasks, timelines, and projects.', cls: 'text-muted' });

        const tutorial = contentEl.createDiv('welcome-tutorial');

        this.createStep(tutorial, '📊', 'The dashboard', 'Click the new Dashboard icon in the left ribbon to open your master view. It combines your Timeline, Stats, and Task List.');
        this.createStep(tutorial, '🖱️', 'Move & resize', 'By default, the layout is locked for a clean look. Click the "Move" icon (arrow cross) in the left ribbon to unlock tabs and arrange widgets.');
        this.createStep(tutorial, '➕', 'Quick add', 'Click the pulsing "+" icon at the top right of the dashboard to instantly create tasks in any file.');
        this.createStep(tutorial, '📝', 'Inline editing', 'Hover over any task in the list to reveal the Pencil (edit) and Trash (delete) icons.');
        this.createStep(tutorial, '🎯', 'Smart filters', 'Click any statistic card (like "Urgent") to instantly filter your task list!');

        contentEl.createEl('hr');

        new Setting(contentEl)
            .setName('Do not show this window again')
            .setDesc('You can always reopen this from the Settings tab.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.hasSeenWelcome)
                .onChange(value => {
                    this.plugin.settings.hasSeenWelcome = value;
                    void this.plugin.saveSettings().then(() => this.plugin.refreshViews());
                })
            );

        const btnContainer = contentEl.createDiv();
        btnContainer.setCssProps({ display: 'flex', 'justify-content': 'center', 'margin-top': '15px' });

        new Setting(btnContainer)
            .addButton(btn => btn
                .setButtonText('Got it!')
                .setCta()
                .onClick(() => {
                    this.plugin.refreshViews();
                    this.close();
                }));
    }

    private createStep(container: HTMLElement, icon: string, title: string, desc: string) {
        const row = container.createDiv('welcome-step');
        row.setCssProps({ display: 'flex', gap: '15px', 'margin-bottom': '15px', 'align-items': 'flex-start', padding: '10px', 'background-color': 'var(--background-secondary)', 'border-radius': '8px' });

        const iconEl = row.createDiv('step-icon');
        iconEl.setText(icon);
        iconEl.setCssProps({ 'font-size': '24px', 'line-height': '1.2' });

        const textDiv = row.createDiv('step-text');
        const titleEl = textDiv.createEl('h3', { text: title });
        titleEl.setCssProps({ margin: '0 0 4px 0', 'font-size': '1.1em' });
        const descEl = textDiv.createEl('span', { text: desc, cls: 'text-muted' });
        descEl.setCssProps({ 'font-size': '0.9em', 'line-height': '1.4' });
    }

    onClose() {
        this.contentEl.empty();
    }
}