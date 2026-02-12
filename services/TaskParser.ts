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

    private getFilesToScan(): TFile[] {
        const allMarkdownFiles = this.app.vault.getMarkdownFiles();

        if (this.settings.scanFolders.length === 0) {
            return allMarkdownFiles;
        }

        return allMarkdownFiles.filter(file => {
            return this.settings.scanFolders.some(folder => {
                const normalizedFolder = folder.replace(/^\/|\/$/g, '');
                const filePath = file.path;

                // Fix: Ensure we check if setting exists before using it
                if (this.settings.scanRecursively) {
                    return filePath.startsWith(normalizedFolder);
                } else {
                    const fileFolder = file.parent?.path || '';
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
            const taskMatch = line.match(/^(\s*)-\s\[([ xX])\]\s(.+)$/);

            if (taskMatch) {
                const completed = taskMatch[2].toLowerCase() === 'x';
                const taskText = taskMatch[3];
                const { title, startDate, dueDate } = this.parseTaskMetadata(taskText);

                const task: Task = {
                    id: `${file.path}:${i}`,
                    title,
                    completed,
                    filePath: file.path,
                    fileName: courseName,
                    lineNumber: i,
                    startDate,
                    dueDate,
                    originalText: line
                };
                tasks.push(task);
            }
        }
        return tasks;
    }

    private getCourseName(file: TFile, cache: CachedMetadata | null): string {
        switch (this.settings.courseDetection) {
            case 'per-file': return file.basename;
            case 'per-folder': return file.parent?.name || file.basename;
            case 'frontmatter':
                if (cache?.frontmatter) {
                    const val = cache.frontmatter[this.settings.courseFrontmatterKey];
                    if (val) return String(val);
                }
                return file.basename;
            default: return file.basename;
        }
    }

    private parseTaskMetadata(taskText: string): { title: string; startDate?: Date; dueDate?: Date; } {
        let title = taskText;
        let startDate: Date | undefined;
        let dueDate: Date | undefined;

        // 1. START DATE Parsing
        // Matches: start:: YYYY-MM-DD | [start:: YYYY-MM-DD] | (start:: YYYY-MM-DD)
        const startRegex = /\[?\(?start::\s*(\d{4}-\d{2}-\d{2})[\]\)]?/gi;
        const startMatch = startRegex.exec(taskText);
        if (startMatch) {
            startDate = new Date(startMatch[1]);
            title = title.replace(startRegex, ''); // Remove from title
        }

        // 2. DUE DATE Parsing (Crucial Fix)
        // Matches: due:: YYYY-MM-DD | [due:: YYYY-MM-DD] | (due:: YYYY-MM-DD)
        const dueRegex = /\[?\(?due::\s*(\d{4}-\d{2}-\d{2})[\]\)]?/gi;
        const dueMatch = dueRegex.exec(taskText);
        if (dueMatch) {
            dueDate = new Date(dueMatch[1]);
            title = title.replace(dueRegex, ''); // Remove from title
        }

        // 3. Emoji Fallback
        if (!dueDate) {
            const emojiMatch = taskText.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
            if (emojiMatch) {
                dueDate = new Date(emojiMatch[1]);
                title = title.replace(/📅\s*\d{4}-\d{2}-\d{2}\s*/g, '');
            }
        }

        // Clean up double spaces or trailing brackets left behind
        title = title.replace(/\s+/g, ' ').trim();

        return { title, startDate, dueDate };
    }
}