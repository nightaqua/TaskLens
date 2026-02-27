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

        // Header
        const header = contentEl.createDiv('welcome-header');
        header.style.textAlign = 'center';
        header.style.marginBottom = '20px';
        header.createEl('h1', { text: 'Welcome to TaskLens 🚀' });
        header.createEl('p', { text: 'Your command center for tasks, timelines, and projects.', cls: 'text-muted' });

        // Tutorial Section
        const tutorial = contentEl.createDiv('welcome-tutorial');

        this.createStep(tutorial, '📊', 'The Dashboard', 'Click the new Dashboard icon in the left ribbon to open your master view. It combines your Timeline, Stats, and Task List.');
        this.createStep(tutorial, '🖱️', 'Move & Resize', 'By default, the layout is locked for a clean look. Click the "Move" icon (arrow cross) in the left ribbon to unlock tabs and arrange widgets.');
        this.createStep(tutorial, '➕', 'Quick Add', 'Click the pulsing "+" icon at the top right of the dashboard to instantly create tasks in any file.');
        this.createStep(tutorial, '📝', 'Inline Editing', 'Hover over any task in the list to reveal the Pencil (edit) and Trash (delete) icons.');
        this.createStep(tutorial, '🎯', 'Smart Filters', 'Click any statistic card (like "Urgent") to instantly filter your task list!');

        contentEl.createEl('hr');

        // Don't show again toggle
        new Setting(contentEl)
            .setName('Do not show this window again')
            .setDesc('You can always reopen this from the Settings tab.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.hasSeenWelcome)
                .onChange(async value => {
                    this.plugin.settings.hasSeenWelcome = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshViews();
                })
            );

        const btnContainer = contentEl.createDiv();
        btnContainer.style.display = 'flex';
        btnContainer.style.justifyContent = 'center';
        btnContainer.style.marginTop = '15px';

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
        row.style.display = 'flex';
        row.style.gap = '15px';
        row.style.marginBottom = '15px';
        row.style.alignItems = 'flex-start';
        row.style.padding = '10px';
        row.style.backgroundColor = 'var(--background-secondary)';
        row.style.borderRadius = '8px';

        const iconEl = row.createDiv('step-icon');
        iconEl.setText(icon);
        iconEl.style.fontSize = '24px';
        iconEl.style.lineHeight = '1.2';

        const textDiv = row.createDiv('step-text');
        const titleEl = textDiv.createEl('h3', { text: title });
        titleEl.style.margin = '0 0 4px 0';
        titleEl.style.fontSize = '1.1em';
        const descEl = textDiv.createEl('span', { text: desc, cls: 'text-muted' });
        descEl.style.fontSize = '0.9em';
        descEl.style.lineHeight = '1.4';
    }

    onClose() {
        this.contentEl.empty();
    }
}