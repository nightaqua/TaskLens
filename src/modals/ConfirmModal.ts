import { App, Modal, Setting } from 'obsidian';

export class ConfirmModal extends Modal {
    constructor(
        app: App,
        private readonly title: string,
        private readonly message: string,
        private readonly onConfirm: () => void
    ) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: this.title });
        contentEl.createEl('p', { text: this.message });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('Confirm')
                .setDestructive()
                .onClick(() => {
                    this.onConfirm();
                    this.close();
                }));
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
