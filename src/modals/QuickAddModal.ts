import { App, Modal, Setting, MarkdownView, ButtonComponent, setIcon, getAllTags } from 'obsidian';
import { TaskManager } from '../services/TaskManager';
import { Task, TaskPriority, isTaskPriority, priorityToEmoji } from '../models/Task';
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

/**
 * Runtime type-guard for the nldates-obsidian plugin object.
 * Uses an `in`-narrowing check rather than a bare `as` cast (AGENTS.md §2).
 */
function asNLDatesPlugin(x: unknown): NLDatesPlugin | null {
    if (typeof x !== 'object' || x === null) return null;
    if (typeof (x as Record<string, unknown>)['parseDate'] !== 'function') return null;
    return x as NLDatesPlugin;
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
    if (m) return nlFormatDate(new Date(today.getTime() + parseInt(m[1], 10) * MS));

    // "+N weeks" / "in N weeks" / "N weeks"
    m = s.match(/^(?:in\s+|[+])?(\d+)\s*w(?:eeks?)?$/);
    if (m) return nlFormatDate(new Date(today.getTime() + parseInt(m[1], 10) * 7 * MS));

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
        ? asNLDatesPlugin(pluginRegistry['nldates-obsidian'])
        : null;
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

    /** Selected obsidian-tasks priority, or undefined for normal (no emoji). */
    private priority: TaskPriority | undefined = undefined;

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

    // -------------------------------------------------------------------------
    // Tag autocomplete state
    // -------------------------------------------------------------------------

    /** Floating suggestion list element, or null when hidden. */
    private tagDropdownEl: HTMLDivElement | null = null;

    /** Filtered tag suggestions currently shown in the dropdown. */
    private tagSuggestions: string[] = [];

    /** Index of the highlighted suggestion, or -1 for none. */
    private tagSuggestionIndex: number = -1;

    /** Cursor position in the input where the `#` that opened the dropdown sits. */
    private tagTriggerPos: number = -1;

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
            if (this.editTask.priority) {
                this.priority = this.editTask.priority;
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
                text
                    .setPlaceholder('Read chapter 4...')
                    .setValue(this.title)
                    .onChange(value => {
                        this.title = value;
                        this.updateSubmitButtonState();
                    });

                // Auto-focus so the user can start typing immediately.
                text.inputEl.focus();
                this.attachTagAutocomplete(text.inputEl, handleEnter);
            });

        // --- 2. Destination dropdown (hidden in edit mode) --------
        if (!this.editTask) {
            new Setting(contentEl)
                .setName('Destination')
                .addDropdown(drop => {
                drop.selectEl.setAttribute("aria-label", "Destination");
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
                text.onChange(value => {
                    this.date = value;
                    text.inputEl.removeClass('tl-input-error');
                });
                text.inputEl.addEventListener('blur', () => {
                    const raw = this.date;
                    if (!raw) return;
                    const resolved = parseNLDate(raw, this.app);
                    if (resolved) {
                        this.date = resolved;
                        text.setValue(resolved);
                        text.inputEl.removeClass('tl-input-error');
                    } else {
                        // Keep raw text visible so the user can correct it
                        text.inputEl.addClass('tl-input-error');
                    }
                });
                this.attachDatePickerButton(
                    text.inputEl,
                    () => this.date,
                    v => { this.date = v; text.setValue(v); }
                );
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
                text.onChange(value => {
                    this.startDate = value;
                    text.inputEl.removeClass('tl-input-error');
                });
                text.inputEl.addEventListener('blur', () => {
                    const raw = this.startDate;
                    if (!raw) return;
                    const resolved = parseNLDate(raw, this.app);
                    if (resolved) {
                        this.startDate = resolved;
                        text.setValue(resolved);
                        text.inputEl.removeClass('tl-input-error');
                    } else {
                        text.inputEl.addClass('tl-input-error');
                    }
                });
                this.attachDatePickerButton(
                    text.inputEl,
                    () => this.startDate,
                    v => { this.startDate = v; text.setValue(v); }
                );
                text.inputEl.addEventListener('keydown', handleEnter);
            });

        // --- 4. Recurrence input (dropdown) ---
        new Setting(contentEl)
            .setName('Repeat')
            .setDesc('Select a recurrence pattern.')
            .addDropdown(drop => {
                drop.selectEl.setAttribute("aria-label", "Repeat");
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

        // --- 4.5 Priority selector ---
        new Setting(contentEl)
            .setName('Priority')
            .addDropdown(drop => {
                drop.selectEl.setAttribute('aria-label', 'Priority');
                drop.addOption('highest', `${priorityToEmoji('highest')} Highest`);
                drop.addOption('high', `${priorityToEmoji('high')} High`);
                drop.addOption('', 'Normal');
                drop.addOption('low', `${priorityToEmoji('low')} Low`);
                drop.addOption('lowest', `${priorityToEmoji('lowest')} Lowest`);

                drop.setValue(this.priority ?? '');
                drop.onChange(value => {
                    this.priority = isTaskPriority(value) ? value : undefined;
                });
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
                // Priority emoji sits at the end of the title, before date/recurrence metadata.
                const priorityEmoji = priorityToEmoji(this.priority);
                const priorityStr = priorityEmoji ? ` ${priorityEmoji}` : '';
                const taskLine = `- [ ] ${this.title}${priorityStr}${dateStr}${repeatStr}\n`;

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
                    await this.taskManager.addTask(this.title, dateObj, fallbackFile, this.recurrence, this.priority);
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
                await this.taskManager.addTask(this.title, dateObj, this.selectedFile, this.recurrence, this.priority);
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

    /**
     * Appends a small calendar-icon button immediately after `inputEl` that opens
     * a hidden native date picker. When the user picks a date the text field and
     * state are updated, and any error styling is cleared.
     *
     * Preserves the native date-picker affordance alongside NL text entry.
     */
    private attachDatePickerButton(
        inputEl: HTMLInputElement,
        getState: () => string,
        setState: (v: string) => void
    ): void {
        // Hidden native date input — provides the browser calendar UI
        const picker = activeDocument.createElement('input');
        picker.type = 'date';
        picker.classList.add('tl-date-picker-hidden');
        inputEl.insertAdjacentElement('afterend', picker);

        // Visible calendar icon button (inserted between input and picker in DOM order)
        const btn = activeDocument.createElement('button');
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Open calendar');
        btn.classList.add('tl-date-picker-btn');
        setIcon(btn, 'calendar');
        inputEl.insertAdjacentElement('afterend', btn);

        btn.addEventListener('click', () => {
            const cur = getState();
            if (/^\d{4}-\d{2}-\d{2}$/.test(cur)) {
                picker.value = cur;
            }
            // picker.click() opens the native calendar in Obsidian's Electron context
            picker.click();
        });

        picker.addEventListener('change', () => {
            if (!picker.value) return;
            setState(picker.value);
            inputEl.value = picker.value;
            inputEl.removeClass('tl-input-error');
            // Sync the Setting text component's value tracking
            inputEl.dispatchEvent(new Event('input'));
        });
    }

    /** Cleans up the modal's DOM when it is closed. */
    onClose() {
        this.hideTagDropdown();
        this.contentEl.empty();
    }

    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // Tag autocomplete
    // -------------------------------------------------------------------------

    /**
     * Returns all unique tag names (without leading `#`) found in the vault,
     * sorted alphabetically. Uses getAllTags() from the Obsidian API which
     * unions both inline tags (cache.tags) and frontmatter tags so that
     * vaults organised by frontmatter get complete suggestions.
     *
     * Results are cached for 2 s per dropdown session to avoid a full vault
     * scan on every keystroke.
     */
    private tagsCachedAt = 0;
    private cachedTagList: string[] = [];
    private readonly TAG_CACHE_TTL_MS = 2000;

    private getVaultTags(): string[] {
        const now = Date.now();
        if (now - this.tagsCachedAt < this.TAG_CACHE_TTL_MS) {
            return this.cachedTagList;
        }
        const tagSet = new Set<string>();
        for (const file of this.app.vault.getMarkdownFiles()) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (!cache) continue;
            const tags = getAllTags(cache);
            if (tags) {
                for (const tag of tags) {
                    // getAllTags returns tags with leading '#'
                    const name = tag.startsWith('#') ? tag.slice(1) : tag;
                    if (name) tagSet.add(name.toLowerCase());
                }
            }
        }
        this.cachedTagList = Array.from(tagSet).sort();
        this.tagsCachedAt = now;
        return this.cachedTagList;
    }

    /**
     * Wires up `input` and `keydown` listeners on the title field to drive
     * the tag autocomplete dropdown.
     *
     * The handleEnter callback is passed in so we can suppress it while the
     * dropdown is open (Enter should select a suggestion, not submit the form).
     */
    private attachTagAutocomplete(
        input: HTMLInputElement,
        handleEnter: (e: KeyboardEvent) => void
    ): void {
        input.addEventListener('input', () => {
            const pos = input.selectionStart ?? input.value.length;
            const textBefore = input.value.slice(0, pos);

            // Match a `#` preceded by start-of-string or whitespace, followed
            // by zero or more word characters up to the cursor.
            const match = textBefore.match(/(^|[\s])#([\w/-]*)$/);
            if (match) {
                const prefix = match[2];
                const triggerPos = textBefore.lastIndexOf('#');
                this.showTagDropdown(input, prefix, triggerPos);
            } else {
                this.hideTagDropdown();
            }
        });

        input.addEventListener('keydown', (e: KeyboardEvent) => {
            if (!this.tagDropdownEl || this.tagSuggestions.length === 0) {
                // Dropdown not open — fall through to normal Enter handling
                if (e.key === 'Enter') handleEnter(e);
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.tagSuggestionIndex = Math.min(
                    this.tagSuggestionIndex + 1,
                    this.tagSuggestions.length - 1
                );
                this.highlightDropdownItem(this.tagSuggestionIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.tagSuggestionIndex = Math.max(this.tagSuggestionIndex - 1, -1);
                this.highlightDropdownItem(this.tagSuggestionIndex);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                if (this.tagSuggestionIndex >= 0) {
                    e.preventDefault();
                    this.selectTag(input, this.tagSuggestionIndex);
                } else if (e.key === 'Enter') {
                    // Nothing highlighted — close dropdown and let Enter submit
                    this.hideTagDropdown();
                    handleEnter(e);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.hideTagDropdown();
            }
        });

        // Close the dropdown when focus leaves the input. A short delay is
        // needed so that a mousedown on an item fires before blur hides the list.
        input.addEventListener('blur', () => {
            window.setTimeout(() => { this.hideTagDropdown(); }, 150);
        });
    }

    /** Renders the floating suggestion list below the input. */
    private showTagDropdown(
        input: HTMLInputElement,
        prefix: string,
        triggerPos: number
    ): void {
        this.hideTagDropdown();
        this.tagTriggerPos = triggerPos;

        const all = this.getVaultTags();
        const lc = prefix.toLowerCase();
        this.tagSuggestions = all.filter(t => t.startsWith(lc));
        if (this.tagSuggestions.length === 0) return;
        this.tagSuggestionIndex = -1;

        const dropdown = activeDocument.createElement('div');
        dropdown.classList.add('tl-tag-dropdown');

        // Set dynamic position via CSS variables so we stay within the
        // obsidianmd/no-static-styles-assignment rule.
        const rect = input.getBoundingClientRect();
        dropdown.setCssProps({
            '--tl-dd-left':      `${String(Math.round(rect.left))}px`,
            '--tl-dd-top':       `${String(Math.round(rect.bottom + 2))}px`,
            '--tl-dd-min-width': `${String(Math.round(rect.width))}px`,
        });

        for (let i = 0; i < this.tagSuggestions.length; i++) {
            const item = dropdown.createEl('div', {
                cls: 'tl-tag-dropdown-item',
                text: '#' + this.tagSuggestions[i],
            });
            // mousedown fires before blur, so we can safely select the tag
            // without the dropdown disappearing first.
            item.addEventListener('mousedown', (e: MouseEvent) => {
                e.preventDefault();
                this.selectTag(input, i);
            });
        }

        activeDocument.body.appendChild(dropdown);
        this.tagDropdownEl = dropdown;
    }

    /** Removes the suggestion list from the DOM and resets all autocomplete state. */
    private hideTagDropdown(): void {
        if (this.tagDropdownEl) {
            this.tagDropdownEl.remove();
            this.tagDropdownEl = null;
        }
        this.tagSuggestions       = [];
        this.tagSuggestionIndex   = -1;
        this.tagTriggerPos        = -1;
    }

    /**
     * Inserts the selected tag into the input, replacing the partial `#…` token
     * that opened the dropdown, and moves the cursor to after the inserted text.
     */
    private selectTag(input: HTMLInputElement, index: number): void {
        const tag = this.tagSuggestions[index];
        if (!tag || this.tagTriggerPos < 0) return;

        const cursorEnd = input.selectionStart ?? input.value.length;
        const before    = input.value.slice(0, this.tagTriggerPos);
        const after     = input.value.slice(cursorEnd);
        const insertion = `#${tag} `;

        input.value = before + insertion + after;

        const newCursor = before.length + insertion.length;
        input.setSelectionRange(newCursor, newCursor);

        // Keep this.title in sync — onChange won't fire for programmatic
        // assignments to input.value.
        this.title = input.value;
        this.updateSubmitButtonState();
        this.hideTagDropdown();
        input.focus();
    }

    /** Adds or removes the `is-selected` highlight class on the given item index. */
    private highlightDropdownItem(index: number): void {
        if (!this.tagDropdownEl) return;
        const items = this.tagDropdownEl.querySelectorAll('.tl-tag-dropdown-item');
        items.forEach((item, i) => {
            item.classList.toggle('is-selected', i === index);
        });
    }
}
