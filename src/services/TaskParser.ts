import { App, TFile, CachedMetadata, normalizePath } from 'obsidian';
import { Task, TaskPriority, emojiToPriority } from '../models/Task';
import { SemesterSettings } from '../settings/Settings';

export class TaskParser {
    private cachedFiles: TFile[] | null = null;
    private cachedFilePaths: string[] | null = null;

    // Matches both yyyy-mm-dd and dd-mm-yyyy after the key
    private static readonly DATE_PAT = '(\\d{4}-\\d{2}-\\d{2}|\\d{2}-\\d{2}-\\d{4})';

    // 3. COMPLETION DATE (also supports HH:mm suffix)
    private static readonly COMP_REGEX = new RegExp(`\\[?\\(?completion::\\s*(\\d{4}-\\d{2}-\\d{2}|\\d{2}-\\d{2}-\\d{4})(?:\\s\\d{2}:\\d{2})?[\\])]?`, 'gi');
    // 4. RECURRENCE — TaskLens format: [repeat:: weekly]
    private static readonly REPEAT_REGEX = /\[?\(?repeat::\s*([^\]]+)[\])]?/gi;
    // 5. NOTES — TaskLens format: [notes:: ...]
    private static readonly NOTES_REGEX = /\[?\(?notes::\s*([^\])]+)[\])]?/gi;
    // 6. TIMER TAGS — #countdown / #elapsed / #countdown-elapsed.
    // Group 1 is the leading boundary (start or whitespace) so it can be preserved on strip.
    // The negative lookahead (no lookbehind — iOS Safari) prevents matching inside longer
    // tags like #countdownfoo; #countdown-elapsed is listed first so it wins over #countdown.
    private static readonly TIMER_TAG_REGEX = /(^|\s)#(countdown-elapsed|countdown|elapsed)(?![\w-])/gi;

    private escapeRegex(s: string): string {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // 1. START DATE — instance getter using configured key
    private get START_REGEX(): RegExp {
        const key = this.settings.startDateKey || 'start';
        return new RegExp(`\\[?\\(?${this.escapeRegex(key)}::\\s*${TaskParser.DATE_PAT}[\\])]?`, 'gi');
    }

    // 2. DUE DATE — instance getter using configured key
    private get DUE_REGEX(): RegExp {
        const key = this.settings.dueDateKey || 'due';
        return new RegExp(`\\[?\\(?${this.escapeRegex(key)}::\\s*${TaskParser.DATE_PAT}[\\])]?`, 'gi');
    }

    // Fallback emoji regexes
    // eslint-disable-next-line no-useless-escape -- \[ kept intentionally inside the character class for readability; removing it would make [^[ visually ambiguous
    private static readonly EMOJI_RECUR_MATCH_REGEX = /[\u{1F501}\u{1F504}]\s*([^\[\u{1F4C5}\u2705\u23EB\u{1F53C}\u{1F53D}\u23EC]+)/u;
    // eslint-disable-next-line no-useless-escape -- \[ kept intentionally inside the character class for readability; removing it would make [^[ visually ambiguous
    private static readonly EMOJI_RECUR_REPLACE_REGEX = /[\u{1F501}\u{1F504}]\s*[^\[\u{1F4C5}\u2705\u23EB\u{1F53C}\u{1F53D}\u23EC]+/u;
    private static readonly EMOJI_DATE_MATCH_REGEX = /\u{1F4C5}\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/u;
    private static readonly EMOJI_DATE_REPLACE_REGEX = /\u{1F4C5}\s*(?:\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\s*/gu;
    // obsidian-tasks priority emojis: 🔺 highest, ⏫ high, 🔼 medium, 🔽 low, ⏬ lowest.
    private static readonly PRIORITY_REGEX = /[\u{1F53A}\u{23EB}\u{1F53C}\u{1F53D}\u{23EC}]/gu;

    // NOTE: All gi-flagged static regexes above (START_REGEX, DUE_REGEX, COMP_REGEX, REPEAT_REGEX)
    // carry lastIndex state between calls because they are shared class-level objects.
    // parseTaskMetadata() resets lastIndex to 0 before every exec() call to prevent
    // a previous match position from skipping characters on the next parse.
    // String.prototype.replace() resets lastIndex internally when called, so the
    // title.replace(REGEX, '') calls after exec() are safe without an extra reset.

    constructor(
        private readonly app: App,
        private readonly settings: SemesterSettings
    ) {}

    /**
     * RENAMED: Matches TaskManager.loadTasks()
     */
    async findAllTasks(): Promise<Task[]> {
        const filesToScan = this.getFilesToScan();
        const taskPromises = filesToScan.map(file => this.parseTasksFromFile(file));
        const allFileTasks = await Promise.all(taskPromises);

        return allFileTasks.flat();
    }

    /**
     * RENAMED: Matches TaskManager.refreshFileTask()
     */
    async getTasksFromFile(filePath: string): Promise<Task[]> {
        const file = this.app.vault.getAbstractFileByPath(normalizePath(filePath));
        if (file instanceof TFile) {
            return this.parseTasksFromFile(file);
        }
        return [];
    }

    public clearCache(): void {
        this.cachedFiles = null;
        this.cachedFilePaths = null;
    }

    public getScannedFilePaths(): string[] {
        if (this.cachedFilePaths) return this.cachedFilePaths;
        this.cachedFilePaths = this.getFilesToScan().map(file => file.path);
        return this.cachedFilePaths;
    }

    // --- Private Helpers ---

    public getFilesToScan(): TFile[] {
        if (this.cachedFiles) return this.cachedFiles;

        const allMarkdownFiles = this.app.vault.getMarkdownFiles();
        const result = allMarkdownFiles.filter(file => this.isPathInScope(file.path));

        this.cachedFiles = result;
        return result;
    }

    /**
     * Whether a single file path falls within the configured scan scope
     * (scanFolders + scanRecursively). An empty scanFolders means "scan
     * everything", so this returns true for any path in that case.
     *
     * This is the shared scope check for both full scans (getFilesToScan)
     * and incremental refreshes (TaskManager.refreshFileTask).
     */
    public isPathInScope(filePath: string): boolean {
        if (this.settings.scanFolders.length === 0) {
            return true;
        }

        return this.settings.scanFolders.some(folder => {
            const normalizedFolder = folder.replace(/^\/|\/$/g, '');

            // 1. Direct File Match (e.g. user typed "Projects/Todo.md" or "Todo")
            if (filePath === normalizedFolder || filePath === `${normalizedFolder}.md`) {
                return true;
            }

            // 2. Folder Match
            if (this.settings.scanRecursively) {
                // The trailing slash prevents "Math" from matching a folder named "Maths/"
                return filePath.startsWith(normalizedFolder + '/');
            } else {
                // Match ONLY files directly inside this specific folder
                const lastSlash = filePath.lastIndexOf('/');
                const fileFolder = lastSlash === -1 ? '' : filePath.slice(0, lastSlash);
                return fileFolder === normalizedFolder;
            }
        });
    }

    private async parseTasksFromFile(file: TFile): Promise<Task[]> {
        const tasks: Task[] = [];
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        const cache = this.app.metadataCache.getFileCache(file);
        const courseName = this.getCourseName(file, cache);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const taskMatch = line.match(/^(\s*)-\s\[([ xX])]\s(.+)$/);

            if (taskMatch) {
                const completed = taskMatch[2].toLowerCase() === 'x';
                const taskText = taskMatch[3];
                const { title, startDate, dueDate, completionDate, recurrence, notes, timerMode, priority } = this.parseTaskMetadata(taskText);

                const task: Task = {
                    id: `${file.path}:${String(i)}`,
                    title,
                    completed,
                    filePath: file.path,
                    fileName: courseName,
                    lineNumber: i,
                    startDate,
                    dueDate,
                    completionDate, // Added
                    recurrence,     // Added
                    notes,          // Added
                    timerMode,      // Added
                    priority,       // Added
                    originalText: line
                };
                tasks.push(task);
            }
        }
        return tasks;
    }

    private getCourseName(file: TFile, cache: CachedMetadata | null): string {
        switch (this.settings.courseDetection) {
            case 'per-file':
                return file.basename;
            case 'per-folder':
                return file.parent?.name || file.basename;
            case 'frontmatter':
                if (cache?.frontmatter) {
                    const raw: unknown = cache.frontmatter[this.settings.courseFrontmatterKey];
                    const val = typeof raw === 'string' ? raw : undefined;
                    if (val) return val;
                }
                return file.basename;
            default:
                return file.basename;
        }
    }

    private parseTaskMetadata(taskText: string): { title: string; startDate?: Date; dueDate?: Date; completionDate?: Date; recurrence?: string; notes?: string; timerMode?: 'countdown' | 'elapsed' | 'both'; priority?: TaskPriority } {
        let title = taskText;
        let startDate: Date | undefined;
        let dueDate: Date | undefined;
        let completionDate: Date | undefined;
        let recurrence: string | undefined;
        let notes: string | undefined;
        let timerMode: 'countdown' | 'elapsed' | 'both' | undefined;
        let priority: TaskPriority | undefined;

        /**
         * Normalise a parsed date string to a local-midnight Date.
         * Accepts both yyyy-mm-dd and dd-mm-yyyy.
         * Using new Date('YYYY-MM-DD') gives UTC midnight which shifts the displayed
         * day by ±1 in non-UTC timezones; appending T00:00:00 gives local midnight.
         */
        const parseDate = (raw: string): Date => {
            // dd-mm-yyyy → rearrange to yyyy-mm-dd
            const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
            const iso = dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : raw;
            return new Date(`${iso}T00:00:00`);
        };

        // 1. START DATE
        const startRegex = this.START_REGEX;
        const startMatch = startRegex.exec(taskText);
        if (startMatch) {
            startDate = parseDate(startMatch[1]);
            title = title.replace(this.START_REGEX, '');
        }

        // 2. DUE DATE
        const dueRegex = this.DUE_REGEX;
        const dueMatch = dueRegex.exec(taskText);
        if (dueMatch) {
            dueDate = parseDate(dueMatch[1]);
            title = title.replace(this.DUE_REGEX, '');
        }

        // 3. COMPLETION DATE (also supports HH:mm suffix)
        TaskParser.COMP_REGEX.lastIndex = 0;
        const compMatch = TaskParser.COMP_REGEX.exec(taskText);
        if (compMatch) {
            completionDate = parseDate(compMatch[1]);
            title = title.replace(TaskParser.COMP_REGEX, '');
        }

        // 4. RECURRENCE — TaskLens format: [repeat:: weekly]
        TaskParser.REPEAT_REGEX.lastIndex = 0;
        const repeatMatch = TaskParser.REPEAT_REGEX.exec(taskText);
        if (repeatMatch) {
            recurrence = repeatMatch[1].trim().toLowerCase();
            title = title.replace(TaskParser.REPEAT_REGEX, '');
        }

        // 5. NOTES — TaskLens format: [notes:: ...]
        TaskParser.NOTES_REGEX.lastIndex = 0;
        const notesMatch = TaskParser.NOTES_REGEX.exec(taskText);
        if (notesMatch) {
            notes = notesMatch[1].trim();
            title = title.replace(TaskParser.NOTES_REGEX, '');
        }

        // Tasks-plugin emoji recurrence: 🔁 / 🔄 followed by a rule string.
        // Read-only — we recognise it so isRecurring is correct and the chip shows,
        // but we never write back in this format (TaskLens writes [repeat:: ...]).
        if (!recurrence) {
            const emojiRecurMatch = taskText.match(TaskParser.EMOJI_RECUR_MATCH_REGEX);
            if (emojiRecurMatch) {
                recurrence = emojiRecurMatch[1].trim().toLowerCase();
                title = title.replace(TaskParser.EMOJI_RECUR_REPLACE_REGEX, '').trim();
            }
        }

        // 6. Emoji fallback 📅 — accepts both date formats
        if (!dueDate) {
            const emojiMatch = taskText.match(TaskParser.EMOJI_DATE_MATCH_REGEX);
            if (emojiMatch) {
                dueDate = parseDate(emojiMatch[1]);
                title = title.replace(TaskParser.EMOJI_DATE_REPLACE_REGEX, '');
            }
        }

        // 7. TIMER TAGS — collect every #countdown / #elapsed / #countdown-elapsed
        // occurrence, then strip them from the title (preserving the leading boundary).
        let hasCountdown = false;
        let hasElapsed = false;
        TaskParser.TIMER_TAG_REGEX.lastIndex = 0;
        let timerMatch: RegExpExecArray | null;
        while ((timerMatch = TaskParser.TIMER_TAG_REGEX.exec(taskText)) !== null) {
            const tag = timerMatch[2].toLowerCase();
            if (tag === 'countdown-elapsed') {
                hasCountdown = true;
                hasElapsed = true;
            } else if (tag === 'countdown') {
                hasCountdown = true;
            } else if (tag === 'elapsed') {
                hasElapsed = true;
            }
        }
        if (hasCountdown && hasElapsed) {
            timerMode = 'both';
        } else if (hasCountdown) {
            timerMode = 'countdown';
        } else if (hasElapsed) {
            timerMode = 'elapsed';
        }
        if (timerMode) {
            title = title.replace(TaskParser.TIMER_TAG_REGEX, '$1');
        }

        // 8. PRIORITY — obsidian-tasks emoji (🔺⏫🔼🔽⏬). No emoji → undefined (normal).
        // Read the first priority emoji, then strip all of them from the visible title.
        TaskParser.PRIORITY_REGEX.lastIndex = 0;
        const priorityMatch = TaskParser.PRIORITY_REGEX.exec(taskText);
        if (priorityMatch) {
            priority = emojiToPriority(priorityMatch[0]);
            title = title.replace(TaskParser.PRIORITY_REGEX, '');
        }

        title = title.replace(/\s+/g, ' ').trim();

        return { title, startDate, dueDate, completionDate, recurrence, notes, timerMode, priority };
    }
}
