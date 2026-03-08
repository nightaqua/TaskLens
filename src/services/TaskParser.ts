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

        // 1. START DATE Parsing
        const startRegex  = /\[?\(?start::\s*(\d{4}-\d{2}-\d{2})[\])]?/gi;
        const startMatch = startRegex.exec(taskText);
        if (startMatch) {
            startDate = new Date(startMatch[1]);
            title = title.replace(startRegex, '');
        }

        // 2. DUE DATE Parsing
        const dueRegex    = /\[?\(?due::\s*(\d{4}-\d{2}-\d{2})[\])]?/gi;
        const dueMatch = dueRegex.exec(taskText);
        if (dueMatch) {
            dueDate = new Date(dueMatch[1]);
            title = title.replace(dueRegex, '');
        }

        // 3. COMPLETION DATE Parsing (Supports YYYY-MM-DD and YYYY-MM-DD HH:mm)
        const compRegex   = /\[?\(?completion::\s*(\d{4}-\d{2}-\d{2}(?:\s\d{2}:\d{2})?)[\])]?/gi;
        const compMatch = compRegex.exec(taskText);
        if (compMatch) {
            completionDate = new Date(compMatch[1]);
            title = title.replace(compRegex, '');
        }

        // 4. RECURRENCE Parsing
        const repeatRegex = /\[?\(?repeat::\s*([^\]]+)[\])]?/gi;
        const repeatMatch = repeatRegex.exec(taskText);
        if (repeatMatch) {
            recurrence = repeatMatch[1].trim().toLowerCase();
            title = title.replace(repeatRegex, '');
        }

        // 5. Emoji Fallback (Calendar emoji: U+1F4C5)
        if (!dueDate) {
            const emojiMatch = taskText.match(/\u{1F4C5}\s*(\d{4}-\d{2}-\d{2})/u);
            if (emojiMatch) {
                dueDate = new Date(emojiMatch[1]);
                title = title.replace(/\u{1F4C5}\s*\d{4}-\d{2}-\d{2}\s*/gu, '');
            }
        }

        title = title.replace(/\s+/g, ' ').trim();

        return { title, startDate, dueDate, completionDate, recurrence };
    }
}
