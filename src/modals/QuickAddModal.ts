import { App, Modal, Setting, MarkdownView, ButtonComponent } from 'obsidian';
import { TaskManager } from '../services/TaskManager';

/**
 * QuickAddModal
 *
 * A modal dialogue that lets the user quickly create a new task without
 * leaving their current note. It supports two insertion modes:
 *
 *  - **Insert at cursor** – writes the task line directly into the active
 *    Markdown editor at the current cursor position, then triggers an
 *    immediate rescan of that file so the TaskManager stays in sync.
 *  - **Append to file** – delegates to `TaskManager.addTask()`, which
 *    appends the formatted task to the end of an existing destination file.
 *
 * The available destination files come from `TaskManager.getScannedFiles()`,
 * so only files already known to the plugin are offered.
 */
/**
 * Resolves the active MarkdownView.
 * First tries to get the active view, and if that fails,
 * finds the first visible Markdown leaf.
 */
export function resolveActiveMarkdownView(app: App): MarkdownView | null {
    // 1. First, try the standard active view (works for Ribbon clicks)
    let view = app.workspace.getActiveViewOfType(MarkdownView);

    // 2. If null (Dashboard button click), find the first visible Markdown leaf
    if (!view) {
        const markdownLeaves = app.workspace.getLeavesOfType('markdown');

        const visibleMarkdownLeaf = markdownLeaves.find(leaf =>
            leaf.view instanceof MarkdownView && (leaf.view.containerEl.isShown())
        );

        if (visibleMarkdownLeaf) {
            const leafView = visibleMarkdownLeaf.view;
            if (leafView instanceof MarkdownView) {
                view = leafView;
            }
        }
    }

    return view;
}

export class QuickAddModal extends Modal {
    /** Raw text entered by the user for the task title. */
    private title: string = '';

    /** ISO date string (YYYY-MM-DD) from the date picker, or empty string. */
    private date: string = '';

    private recurrence: string = '';

    /**
     * Path of the chosen destination file, or the sentinel value
     * `'__CURSOR__'` when the user wants to insert at the cursor position.
     */
    private selectedFile: string = '';

    /**
     * The Markdown view that was active at the moment the modal was constructed.
     *
     * Captured in the constructor — not in onOpen() — because by the time
     * onOpen() fires, Obsidian has already transferred focus to the modal's
     * container element, causing getActiveViewOfType() to return null even
     * though the editor is still visible behind the modal.
     */
    private readonly activeViewAtOpen: MarkdownView | null;

    constructor(app: App, private readonly taskManager: TaskManager) {
        super(app);

        this.activeViewAtOpen = resolveActiveMarkdownView(this.app);
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    /** Builds and renders the modal UI when it is opened. */
    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Quick add task' });

        // Handle Enter keypress for quick submission
        const handleEnter = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                void this.handleSubmit();
            }
        };

        // --- 1. Task title input -------------------------------------------
        new Setting(contentEl)
            .setName('Task')
            .addText(text => {
                text
                    .setPlaceholder('Read chapter 4...')
                    .onChange(value => { this.title = value; });

                // Auto-focus so the user can start typing immediately.
                text.inputEl.focus();
                text.inputEl.addEventListener('keydown', handleEnter);
            });

        // --- 2. Destination dropdown ----------------------------------------
        new Setting(contentEl)
            .setName('Destination')
            .addDropdown(drop => {
                // Always offer "insert at cursor" as the first option, so it is
                // the most ergonomic choice when a Markdown file is already open.
                drop.addOption('__CURSOR__', 'Insert at cursor (active file)');

                // Only show files the plugin has already scanned rather than
                // every file in the vault, keeping the list focused and relevant.
                const scannedFiles = this.taskManager.getScannedFiles();
                scannedFiles.forEach((path) => {
                    // Strip the directory path and .md extension for a clean label.
                    const label = path.split('/').pop()?.replace('.md', '') || path;
                    drop.addOption(path, label);
                });

                // Pre-select a sensible default:
                //   • Cursor mode if a Markdown file was open when the modal launched.
                //   • Otherwise fall back to the first scanned file.
                if (this.activeViewAtOpen) {
                    this.selectedFile = '__CURSOR__';
                } else if (scannedFiles.length > 0) {
                    this.selectedFile = scannedFiles[0];
                }

                drop.setValue(this.selectedFile);
                drop.onChange(value => { this.selectedFile = value; });
            });

        // --- 3. Due date picker ---------------------------------------------
        new Setting(contentEl)
            .setName('Due date')
            .addText(text => {
                // Render as a native HTML date input for a built-in calendar picker.
                text.inputEl.type = 'date';
                text.onChange(value => { this.date = value; });
                text.inputEl.addEventListener('keydown', handleEnter);
            });

        // --- 3.5 Recurrence input ---
        new Setting(contentEl)
            .setName('Repeat')
            .setDesc('Examples: daily, weekly, 2d, 3w, monthly+, 2w+')
            .addText(text => {
                text.setPlaceholder('Optional...');
                text.onChange(value => { this.recurrence = value; });
                text.inputEl.addEventListener('keydown', handleEnter);
            });

        // --- 4. Submit button -----------------------------------------------
        this.submitButton = new Setting(contentEl)
            .addButton(btn => {
                this.submitBtnComp = btn;
                btn.setButtonText('Add task')
                    .setCta()
                    .onClick(() => { void this.handleSubmit(); });
            });
    }

    private submitButton: Setting | null = null;
    private submitBtnComp: ButtonComponent | null = null;
    private isSubmitting: boolean = false;

    private async handleSubmit(): Promise<void> {
        if (this.isSubmitting) return;

        // Guard: both a title and a destination are required.
        if (!this.title || !this.selectedFile) return;

        this.isSubmitting = true;
        if (this.submitBtnComp) {
            this.submitBtnComp.setButtonText('Adding...');
            this.submitBtnComp.setDisabled(true);
        }

        try {
            if (this.selectedFile === '__CURSOR__') {
                // -----------------------------------------------------------------
                // Cursor-insertion path
                // -----------------------------------------------------------------
                if (this.activeViewAtOpen) {
                // Build and insert the task line synchronously
                // BEFORE closing the modal. Closing first (even with
                // a setTimeout) risks losing the editor reference or
                // landing at a stale cursor position.
                const dateStr = this.date ? ` [due:: ${this.date}]` : '';
                const repeatStr = this.recurrence ? ` [repeat:: ${this.recurrence}]` : '';
                const taskLine = `- [ ] ${this.title}${dateStr}${repeatStr}\n`;

                this.activeViewAtOpen.editor.replaceSelection(taskLine);

                // Rescan so the TaskManager reflects the new entry
                // without waiting for the next background sweep.
                if (this.activeViewAtOpen.file) {
                    await this.taskManager.refreshFileTask(this.activeViewAtOpen.file.path);
                }
            } else {
                // Fallback: the view was closed before the user submitted.
                // Append to the first available scanned file instead.
                // Do NOT pass '__CURSOR__' — addTask expects a real path.
                const fallbackFile = this.taskManager.getScannedFiles()[0];
                if (fallbackFile) {
                    const dateObj = this.date ? new Date(`${this.date}T00:00:00`) : null;
                    await this.taskManager.addTask(this.title, dateObj, fallbackFile);
                }
            }
            } else {
                // -----------------------------------------------------------------
                // Append-to-file path
                //
                // Delegate entirely to TaskManager, which handles
                // formatting and writing to the end of the chosen file.
                // -----------------------------------------------------------------
                const dateObj = this.date ? new Date(`${this.date}T00:00:00`) : null;
                await this.taskManager.addTask(this.title, dateObj, this.selectedFile, this.recurrence);
            }

            this.close();
        } finally {
            this.isSubmitting = false;
            if (this.submitBtnComp) {
                this.submitBtnComp.setButtonText('Add task');
                this.submitBtnComp.setDisabled(false);
            }
        }
    }

    /** Cleans up the modal's DOM when it is closed. */
    onClose() {
        this.contentEl.empty();
    }
}
