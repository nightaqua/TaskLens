import { App, Modal, Setting, MarkdownView, ButtonComponent } from 'obsidian';
import { TaskManager } from '../services/TaskManager';
import { Task } from '../models/Task';
import { SemesterSettings } from '../settings/Settings';

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

// ---------------------------------------------------------------------------
// Natural Language Date Parsing
// ---------------------------------------------------------------------------

/** Minimal interface for the nldates-obsidian plugin's public API. */
interface NLDatesPlugin {
    parseDate(text: string): { moment: { isValid(): boolean; format(fmt: string): string } } | null;
}

/**
 * Shape of the undocumented Obsidian runtime plugin registry.
 * Cast via `unknown` to avoid conflicting with the public App type.
 */
interface ObsidianAppWithPlugins {
    plugins?: {
        plugins?: Record<string, unknown>;
    };
}

/** Formats a Date to yyyy-mm-dd in local time. */
function nlFormatDate(d: Date): string {
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

const NL_WEEKDAYS = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const;
type NLWeekday = typeof NL_WEEKDAYS[number];

/** Built-in NL parser covering the most common relative-date phrases. */
function parseNLDateInline(s: string): string | null {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const MS = 86_400_000; // ms per day

    if (s === 'today')     return nlFormatDate(today);
    if (s === 'tomorrow')  return nlFormatDate(new Date(today.getTime() + MS));
    if (s === 'yesterday') return nlFormatDate(new Date(today.getTime() - MS));

    // "+N days" / "in N days" / "N days"
    let m = s.match(/^(?:in\s+|[+])?(\d+)\s*d(?:ays?)?$/);
    if (m) return nlFormatDate(new Date(today.getTime() + parseInt(m[1]) * MS));

    // "+N weeks" / "in N weeks" / "N weeks"
    m = s.match(/^(?:in\s+|[+])?(\d+)\s*w(?:eeks?)?$/);
    if (m) return nlFormatDate(new Date(today.getTime() + parseInt(m[1]) * 7 * MS));

    // "next <weekday>"
    m = s.match(/^next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
    if (m) {
        const target = NL_WEEKDAYS.indexOf(m[1] as NLWeekday);
        const diff = ((target - today.getDay() + 7) % 7) || 7;
        return nlFormatDate(new Date(today.getTime() + diff * MS));
    }

    // "next week" → next Monday
    if (s === 'next week') {
        const todayDay = today.getDay();
        const diff = todayDay === 1 ? 7 : ((8 - todayDay) % 7) || 7;
        return nlFormatDate(new Date(today.getTime() + diff * MS));
    }

    // "end of week" / "eow" → coming Sunday
    if (s === 'end of week' || s === 'eow') {
        const diff = today.getDay() === 0 ? 7 : 7 - today.getDay();
        return nlFormatDate(new Date(today.getTime() + diff * MS));
    }

    // "end of month" / "eom" → last day of current month
    if (s === 'end of month' || s === 'eom') {
        const eom = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return nlFormatDate(eom);
    }

    return null;
}

/**
 * Parses a natural-language date string into a yyyy-mm-dd string.
 *
 * Resolves in order:
 *   1. Already a valid yyyy-mm-dd — returned as-is.
 *   2. nldates-obsidian plugin (if installed) — delegates to its `parseDate()` API.
 *   3. Built-in inline parser — covers the most common relative-date patterns:
 *      today, tomorrow, yesterday, +N days, +N weeks, next <weekday>,
 *      next week, end of week (eow), end of month (eom).
 *
 * Returns `null` if the input cannot be resolved to a concrete date.
 */
export function parseNLDate(input: string, app: App): string | null {
    const s = input.trim();
    if (!s) return null;

    // 1. Already formatted as yyyy-mm-dd — pass through.
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // 2. Delegate to nldates-obsidian plugin if installed.
    // Cast via `unknown` then to a typed shim — `plugins.plugins` is an undocumented runtime
    // registry absent from the public Obsidian type definitions.
    const appShim = app as unknown as ObsidianAppWithPlugins;
    const pluginRegistry = appShim.plugins?.plugins;
    // Record<string, unknown> is non-nullable — use an explicit guard, not optional-chain, for the key lookup.
    const nlDates = pluginRegistry !== undefined
        ? pluginRegistry['nldates-obsidian'] as NLDatesPlugin | undefined
        : undefined;
    if (nlDates) {
        try {
            const parsed = nlDates.parseDate(s);
            if (parsed !== null && parsed.moment.isValid()) {
                return parsed.moment.format('YYYY-MM-DD');
            }
        } catch {
            // Fall through to inline parser.
        }
    }

    // 3. Inline fallback parser.
    return parseNLDateInline(s.toLowerCase());
}

export class QuickAddModal extends Modal {
    /** Raw text entered by the user for the task title. */
    private title: string = '';

    /** ISO date string (YYYY-MM-DD) from the date picker, or empty string. */
    private date: string = '';

    /** ISO date string (YYYY-MM-DD) for the start date picker, or empty string. */
    private startDate: string = '';

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

    constructor(app: App, private readonly taskManager: TaskManager, private readonly editTask?: Task, private readonly settings?: SemesterSettings) {
        super(app);

        this.activeViewAtOpen = resolveActiveMarkdownView(this.app);
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    /** Builds and renders the modal UI when it is opened. */
    onOpen() {
        const { contentEl } = this;

        const heading = this.editTask ? 'Edit task' : 'Quick add task';
        contentEl.createEl('h2', { text: heading });

        // Pre-populate fields if editing
        if (this.editTask) {
            this.title = this.editTask.title;
            if (this.editTask.dueDate) {
                const y = String(this.editTask.dueDate.getFullYear());
                const m = String(this.editTask.dueDate.getMonth() + 1).padStart(2, '0');
                const d = String(this.editTask.dueDate.getDate()).padStart(2, '0');
                this.date = `${y}-${m}-${d}`;
            }
            if (this.editTask.startDate) {
                const y = String(this.editTask.startDate.getFullYear());
                const m = String(this.editTask.startDate.getMonth() + 1).padStart(2, '0');
                const d = String(this.editTask.startDate.getDate()).padStart(2, '0');
                this.startDate = `${y}-${m}-${d}`;
            }
            if (this.editTask.recurrence) {
                this.recurrence = this.editTask.recurrence;
            }
        }

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
                text.inputEl.setAttribute("aria-label", "Task");
                text.inputEl.setAttribute("title", "Task");
                text
                    .setPlaceholder('Read chapter 4...')
                    .setValue(this.title)
                    .onChange(value => {
                        this.title = value;
                        this.updateSubmitButtonState();
                    });

                // Auto-focus so the user can start typing immediately.
                text.inputEl.focus();
                text.inputEl.addEventListener('keydown', handleEnter);
            });

        // --- 2. Destination dropdown (hidden in edit mode) --------
        if (!this.editTask) {
            new Setting(contentEl)
                .setName('Destination')
                .addDropdown(drop => {
                drop.selectEl.setAttribute("aria-label", "Destination");
                drop.selectEl.setAttribute("title", "Destination");
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
        } else {
            // In edit mode, pre-set selectedFile to the task's file
            this.selectedFile = this.editTask.filePath;
        }

        // --- 3. Due date input (NL-aware) -----------------------------------
        new Setting(contentEl)
            .setName('Due date')
            .addText(text => {
                text.inputEl.setAttribute("aria-label", "Due date");
                text.inputEl.setAttribute("title", "Due date");
                // Accept free text: yyyy-mm-dd or natural language ("tomorrow",
                // "next friday", "in 3 days", "eom", …). The value is resolved
                // to yyyy-mm-dd on blur and on submit.
                text.inputEl.type = 'text';
                text.setPlaceholder('2026-12-31, "tomorrow", "next friday"');
                text.setValue(this.date);
                text.onChange(value => { this.date = value; });
                text.inputEl.addEventListener('blur', () => {
                    const resolved = parseNLDate(this.date, this.app);
                    this.date = resolved ?? '';
                    text.setValue(this.date);
                });
                text.inputEl.addEventListener('keydown', handleEnter);
            });

        // --- 3.5 Start date input (NL-aware) --------------------------------
        new Setting(contentEl)
            .setName('Start date')
            .addText(text => {
                text.inputEl.setAttribute("aria-label", "Start date");
                text.inputEl.setAttribute("title", "Start date");
                text.inputEl.type = 'text';
                text.setPlaceholder('2026-12-31, "next monday", "in 3 days"');
                text.setValue(this.startDate);
                text.onChange(value => { this.startDate = value; });
                text.inputEl.addEventListener('blur', () => {
                    const resolved = parseNLDate(this.startDate, this.app);
                    this.startDate = resolved ?? '';
                    text.setValue(this.startDate);
                });
                text.inputEl.addEventListener('keydown', handleEnter);
            });

        // --- 4. Recurrence input (dropdown) ---
        new Setting(contentEl)
            .setName('Repeat')
            .setDesc('Select a recurrence pattern.')
            .addDropdown(drop => {
                drop.selectEl.setAttribute("aria-label", "Repeat");
                drop.selectEl.setAttribute("title", "Repeat");
                drop.addOption('', 'None');
                drop.addOption('daily', 'Daily');
                drop.addOption('weekly', 'Weekly');
                drop.addOption('biweekly', 'Biweekly');
                drop.addOption('monthly', 'Monthly');
                drop.addOption('quarterly', 'Quarterly');
                drop.addOption('yearly', 'Yearly');

                // If editTask has a recurrence not in dropdown, still show it
                if (this.editTask && this.editTask.recurrence && !['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', ''].includes(this.editTask.recurrence)) {
                    drop.addOption(this.editTask.recurrence, this.editTask.recurrence);
                }

                drop.setValue(this.recurrence);
                drop.onChange(value => { this.recurrence = value; });
            });

        // --- 5. Submit button -----------------------------------------------
        this.submitButton = new Setting(contentEl)
            .addButton(btn => {
                this.submitBtnComp = btn;
                const buttonText = this.editTask ? 'Save changes' : 'Add task';
                btn.setButtonText(buttonText)
                    .setCta()
                    .onClick(() => { void this.handleSubmit(); });
            });

        this.updateSubmitButtonState();
    }

    private updateSubmitButtonState(): void {
        if (!this.submitBtnComp) return;
        if (!this.title.trim()) {
            this.submitBtnComp.setDisabled(true);
            this.submitBtnComp.setTooltip('A task title is required');
        } else {
            this.submitBtnComp.setDisabled(false);
            this.submitBtnComp.setTooltip('');
        }
    }

    private submitButton: Setting | null = null;
    private submitBtnComp: ButtonComponent | null = null;
    private isSubmitting: boolean = false;

    private async handleSubmit(): Promise<void> {
        if (this.isSubmitting) return;

        // Resolve any NL date input that hasn't been normalised by a blur event
        // (e.g. when the user presses Enter without leaving the date field first).
        if (this.date) {
            this.date = parseNLDate(this.date, this.app) ?? '';
        }
        if (this.startDate) {
            this.startDate = parseNLDate(this.startDate, this.app) ?? '';
        }

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
