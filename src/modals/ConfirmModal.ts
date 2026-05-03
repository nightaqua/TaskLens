import { App, Modal, Setting } from 'obsidian';

export class ConfirmModal extends Modal {
    constructor(
        app: App,
        private title: string,
        private message: string,
        private confirmText: string,
        private onConfirm: () => void
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: this.title });
        contentEl.createEl('p', { text: this.message });

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText('Cancel')
                    .onClick(() => {
                        this.close();
                    })
            )
            .addButton((btn) => {
                btn.setButtonText(this.confirmText)
                   .setWarning()
                   .onClick(() => {
                       this.close();
                       this.onConfirm();
                   });
            });
    }

    onClose() {
        this.contentEl.empty();
    }
}
