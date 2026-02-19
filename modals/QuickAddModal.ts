import { App, Modal, Setting, MarkdownView } from 'obsidian';
import { TaskManager } from '../services/TaskManager';

export class QuickAddModal extends Modal {
    private title: string = '';
    private date: string = '';
    private selectedFile: string = '';

    constructor(app: App, private taskManager: TaskManager) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Quick Add Task' });

        // 1. Task Title
        new Setting(contentEl)
            .setName('Task')
            .addText(text => text
                .setPlaceholder('Read Chapter 4...')
                .onChange(value => this.title = value)
                .inputEl.focus());

        // 2. Destination Selection (Cursor + All Files)
        new Setting(contentEl)
            .setName('Destination')
        // 2. Destination Selection (Cursor + Scanned Files)
        new Setting(contentEl)
            .setName('Destination')
            .addDropdown(drop => {
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

                // Add the Cursor option first
                drop.addOption('__CURSOR__', '📍 Insert at Cursor (Active File)');

                // ---> FIX: Use the smart scanned files list instead of the whole vault <---
                const allFiles = this.taskManager.getScannedFiles();

                allFiles.forEach((path) => {
                    const name = path.split('/').pop()?.replace('.md', '') || path;
                    drop.addOption(path, name);
                });

                // Default to Cursor if a file is open, otherwise the first valid file
                if (activeView) {
                    this.selectedFile = '__CURSOR__';
                } else if (allFiles.length > 0) {
                    this.selectedFile = allFiles[0];
                }

                drop.setValue(this.selectedFile);
                drop.onChange(value => this.selectedFile = value);
            });

        // 3. Due Date
        new Setting(contentEl)
            .setName('Due Date')
            .addText(text => {
                text.inputEl.type = 'date';
                text.onChange(value => this.date = value);
            });

        // 4. Buttons
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Add Task')
                .setCta()
                .onClick(async () => {
                    if (!this.title || !this.selectedFile) return;

                    if (this.selectedFile === '__CURSOR__') {
                        // Logic to insert directly into the text editor
                        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                        if (view && view.editor) {
                            const dateStr = this.date ? ` [due:: ${this.date}]` : '';
                            const taskLine = `- [ ] ${this.title}${dateStr}\n`;
                            view.editor.replaceSelection(taskLine);

                            // Tell task manager to rescan this specific file immediately
                            if (view.file) {
                                await this.taskManager.refreshFileTask(view.file.path);
                            }
                        }
                    } else {
                        // Standard append to end of file logic
                        const dateObj = this.date ? new Date(this.date) : null;
                        await this.taskManager.addTask(this.title, dateObj, this.selectedFile);
                    }

                    this.close();
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}