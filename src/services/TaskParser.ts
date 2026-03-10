import { App, TFile, CachedMetadata } from 'obsidian';
import { Task } from '../models/Task';
import { SemesterSettings } from '../settings/Settings';

export class TaskParser {
    constructor(
        private app: App,
        private settings: SemesterSettings
    ) {}

    /**
     * RENAMED: Matches TaskManager.loadTasks()
     */
    async findAllTasks(): Promise<Task[]> {
        const tasks: Task[] = [];
        const filesToScan = this.getFilesToScan();

        for (const file of filesToScan) {
            const fileTasks = await this.parseTasksFromFile(file);
            tasks.push(...fileTasks);
        }

        return tasks;
    }

    /**
     * RENAMED: Matches TaskManager.refreshFileTask()
     */
    async getTasksFromFile(filePath: string): Promise<Task[]> {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            return this.parseTasksFromFile(file);
        }
        return [];
    }

    // --- Private Helpers ---

    public getFilesToScan(): TFile[] {
        const allMarkdownFiles = this.app.vault.getMarkdownFiles();

        if (this.settings.scanFolders.length === 0) {
            return allMarkdownFiles;
        }

        return allMarkdownFiles.filter(file => {
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
                const { title, startDate, dueDate, completionDate, recurrence } = this.parseTaskMetadata(taskText);

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
                    const val = cache.frontmatter[this.settings.courseFrontmatterKey] as string | undefined;
                    if (val) return val;
                }
                return file.basename;
            default:
                return file.basename;
        }
    }

    private parseTaskMetadata(taskText: string): { title: string; startDate?: Date; dueDate?: Date; completionDate?: Date; recurrence?: string } {
        let title = taskText;
        let startDate: Date | undefined;
        let dueDate: Date | undefined;
        let completionDate: Date | undefined;
        let recurrence: string | undefined;

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

        // Matches both yyyy-mm-dd and dd-mm-yyyy after the key
        const DATE_PAT = '(\\d{4}-\\d{2}-\\d{2}|\\d{2}-\\d{2}-\\d{4})';

        // 1. START DATE
        const startRegex = new RegExp(`\\[?\\(?start::\\s*${DATE_PAT}[\\])]?`, 'gi');
        const startMatch = startRegex.exec(taskText);
        if (startMatch) {
            startDate = parseDate(startMatch[1]);
            title = title.replace(startRegex, '');
        }

        // 2. DUE DATE
        const dueRegex = new RegExp(`\\[?\\(?due::\\s*${DATE_PAT}[\\])]?`, 'gi');
        const dueMatch = dueRegex.exec(taskText);
        if (dueMatch) {
            dueDate = parseDate(dueMatch[1]);
            title = title.replace(dueRegex, '');
        }

        // 3. COMPLETION DATE (also supports HH:mm suffix)
        const compRegex = new RegExp(`\\[?\\(?completion::\\s*(\\d{4}-\\d{2}-\\d{2}|\\d{2}-\\d{2}-\\d{4})(?:\\s\\d{2}:\\d{2})?[\\])]?`, 'gi');
        const compMatch = compRegex.exec(taskText);
        if (compMatch) {
            completionDate = parseDate(compMatch[1]);
            title = title.replace(compRegex, '');
        }

        // 4. RECURRENCE — TaskLens format: [repeat:: weekly]
        const repeatRegex = /\[?\(?repeat::\s*([^\]]+)[\])]?/gi;
        const repeatMatch = repeatRegex.exec(taskText);
        if (repeatMatch) {
            recurrence = repeatMatch[1].trim().toLowerCase();
            title = title.replace(repeatRegex, '');
        }

        // Tasks-plugin emoji recurrence: 🔁 / 🔄 followed by a rule string.
        // Read-only — we recognise it so isRecurring is correct and the chip shows,
        // but we never write back in this format (TaskLens writes [repeat:: ...]).
        if (!recurrence) {
            const emojiRecurMatch = taskText.match(/[\u{1F501}\u{1F504}]\s*([^[\u{1F4C5}\u2705]+)/u);
            if (emojiRecurMatch) {
                recurrence = emojiRecurMatch[1].trim().toLowerCase();
                title = title.replace(/[\u{1F501}\u{1F504}]\s*[^[\u{1F4C5}\u2705]+/u, '').trim();
            }
        }

        // 5. Emoji fallback 📅 — accepts both date formats
        if (!dueDate) {
            const emojiMatch = taskText.match(/\u{1F4C5}\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/u);
            if (emojiMatch) {
                dueDate = parseDate(emojiMatch[1]);
                title = title.replace(/\u{1F4C5}\s*(?:\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\s*/gu, '');
            }
        }

        title = title.replace(/\s+/g, ' ').trim();

        return { title, startDate, dueDate, completionDate, recurrence };
    }
}