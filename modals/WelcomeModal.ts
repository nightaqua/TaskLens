import { App, Modal, Setting } from 'obsidian';

export class WelcomeModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('dashboard-welcome-modal');

        // Header
        contentEl.createEl('h1', { text: 'Welcome to Personal Dashboard! 🚀' });
        contentEl.createEl('p', { text: 'Your new command center for assignments, tasks, and deadlines.' });

        // Tutorial Section
        const tutorial = contentEl.createDiv('welcome-tutorial');

        this.createStep(tutorial, '📊', 'Widgets', 'Open different views (Timeline, List, Stats) using the command palette or ribbon icon.');
        this.createStep(tutorial, '🖱️', 'Drag & Drop', 'Click the "Move" icon in the left ribbon to unlock dragging. Arrange windows, then lock them back.');
        this.createStep(tutorial, '➕', 'Quick Add', 'Click the "+" icon in any task list header to capture new tasks instantly.');
        this.createStep(tutorial, '🎨', 'Customize', 'Rename any widget by clicking its title. Hide headers for a clean look.');

        // Footer
        contentEl.createEl('hr');
        contentEl.createEl('p', { text: 'You can find these settings and more in the plugin settings menu.', cls: 'text-muted' });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Let\'s Go!')
                .setCta()
                .onClick(() => this.close()));
    }

    private createStep(container: HTMLElement, icon: string, title: string, desc: string) {
        const row = container.createDiv('welcome-step');
        row.style.display = 'flex';
        row.style.gap = '15px';
        row.style.marginBottom = '15px';
        row.style.alignItems = 'center';

        const iconEl = row.createDiv('step-icon');
        iconEl.setText(icon);
        iconEl.style.fontSize = '24px';

        const textDiv = row.createDiv('step-text');
        const titleEl = textDiv.createEl('h3', { text: title });
        titleEl.style.margin = '0 0 4px 0';
        textDiv.createEl('span', { text: desc, cls: 'text-muted' });
    }

    onClose() {
        this.contentEl.empty();
    }
}
