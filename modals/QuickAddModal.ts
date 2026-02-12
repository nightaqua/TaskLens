import { App, Modal, Setting } from 'obsidian';
// FIX: Use BaseUrl imports (cleaner and often more reliable in your setup)
import { TaskManager } from 'services/TaskManager';
import { Task } from 'models/Task';

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

        // 2. Course Selection
        new Setting(contentEl)
            .setName('Course (File)')
            .addDropdown(drop => {
                // EXPLICIT TYPING: Bulletproof against "unknown" errors
                const tasks: Task[] = this.taskManager.getAllTasks();
                const knownFiles: string[] = tasks.map(t => t.filePath);

                // FORCE GENERIC: Ensure Set treats contents as strings
                const uniqueFiles = Array.from(new Set<string>(knownFiles));

                if (uniqueFiles.length > 0) {
                    this.selectedFile = uniqueFiles[0];
                    uniqueFiles.forEach((path) => {
                        const name = path.split('/').pop()?.replace('.md', '') || path;
                        drop.addOption(path, name);
                    });
                } else {
                    drop.addOption('', 'No course files found');
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

                    const dateObj = this.date ? new Date(this.date) : null;
                    await this.taskManager.addTask(this.title, dateObj, this.selectedFile);
                    this.close();
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}