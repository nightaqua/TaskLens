import { App, TFile, CachedMetadata, normalizePath } from 'obsidian';
import { Task } from '../models/Task';
import { SemesterSettings } from '../settings/Settings';

export class TaskParser {
    private cachedFiles: TFile[] | null = null;
    private cachedFilePaths: string[] | null = null;

    // Matches both yyyy-mm-dd and dd-mm-yyyy after the key
    private static readonly DATE_PAT = '(\\d{4}-\\d{2}-\\d{2}|\\d{2}-\\d{2}-\\d{4})';

    // 1. START DATE
    private static readonly START_REGEX = new RegExp(`\\[?\\(?start::\\s*${TaskParser.DATE_PAT}[\\])]?`, 'gi');
    // 2. DUE DATE
    private static readonly DUE_REGEX = new RegExp(`\\[?\\(?due::\\s*${TaskParser.DATE_PAT}[\\])]?`, 'gi');
    // 3. COMPLETION DATE (also supports HH:mm suffix)
    private static readonly COMP_REGEX = new RegExp(`\\[?\\(?completion::\\s*(\\d{4}-\\d{2}-\\d{2}|\\d{2}-\\d{2}-\\d{4})(?:\\s\\d{2}:\\d{2})?[\\])]?`, 'gi');
    // 4. RECURRENCE — TaskLens format: [repeat:: weekly]
    private static readonly REPEAT_REGEX = /\[?\(?repeat::\s*([^\]]+)[\])]?/gi;
    // 5. NOTES — TaskLens format: [notes:: ...]
    private static readonly NOTES_REGEX = /\[?\(?notes::\s*([^\])]+)[\])]?/gi;

    // Fallback emoji regexes
    // eslint-disable-next-line no-useless-escape
    private static readonly EMOJI_RECUR_MATCH_REGEX = /[\u{1F501}\u{1F504}]\s*([^\[\u{1F4C5}\u2705]+)/u;
    // eslint-disable-next-line no-useless-escape
    private static readonly EMOJI_RECUR_REPLACE_REGEX = /[\u{1F501}\u{1F504}]\s*[^\[\u{1F4C5}\u2705]+/u;
    private static readonly EMOJI_DATE_MATCH_REGEX = /\u{1F4C5}\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/u;
    private static readonly EMOJI_DATE_REPLACE_REGEX = /\u{1F4C5}\s*(?:\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\s*/gu;

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

        let result: TFile[];
        if (this.settings.scanFolders.length === 0) {
            result = allMarkdownFiles;
        } else {
            result = allMarkdownFiles.filter(file => {
                return this.settings.scanFolders.some(folder => {
                    const normalizedFolder = folder.replace(/^\/|\/$/g, '');
                    const filePath = file.path;

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
                        const fileFolder = file.parent?.path === '/' ? '' : (file.parent?.path || '');
                        return fileFolder === normalizedFolder;
                    }
                });
            });
        }

        this.cachedFiles = result;
        return result;
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
                const { title, startDate, dueDate, completionDate, recurrence, notes } = this.parseTaskMetadata(taskText);

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

    private parseTaskMetadata(taskText: string): { title: string; startDate?: Date; dueDate?: Date; completionDate?: Date; recurrence?: string; notes?: string } {
        let title = taskText;
        let startDate: Date | undefined;
        let dueDate: Date | undefined;
        let completionDate: Date | undefined;
        let recurrence: string | undefined;
        let notes: string | undefined;

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
        TaskParser.START_REGEX.lastIndex = 0;
        const startMatch = TaskParser.START_REGEX.exec(taskText);
        if (startMatch) {
            startDate = parseDate(startMatch[1]);
            title = title.replace(TaskParser.START_REGEX, '');
        }

        // 2. DUE DATE
        TaskParser.DUE_REGEX.lastIndex = 0;
        const dueMatch = TaskParser.DUE_REGEX.exec(taskText);
        if (dueMatch) {
            dueDate = parseDate(dueMatch[1]);
            title = title.replace(TaskParser.DUE_REGEX, '');
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

        title = title.replace(/\s+/g, ' ').trim();

        return { title, startDate, dueDate, completionDate, recurrence, notes };
    }
}