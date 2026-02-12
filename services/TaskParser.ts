import { App, TFile, CachedMetadata } from 'obsidian';
import { Task } from '../models/Task';
import { SemesterSettings } from '../settings/Settings';

/**
 * Service responsible for parsing tasks from markdown files
 */
export class TaskParser {
    constructor(
        private app: App,
        private settings: SemesterSettings
    ) {}

    /**
     * Parse all tasks from the vault based on settings
     */
    async parseAllTasks(): Promise<Task[]> {
        const tasks: Task[] = [];
        const filesToScan = this.getFilesToScan();

        for (const file of filesToScan) {
            const fileTasks = await this.parseTasksFromFile(file);
            tasks.push(...fileTasks);
        }

        return tasks;
    }

    /**
     * Get list of files to scan based on settings
     */
    private getFilesToScan(): TFile[] {
        const allMarkdownFiles = this.app.vault.getMarkdownFiles();

        // If no specific folders configured, scan all files
        if (this.settings.scanFolders.length === 0) {
            return allMarkdownFiles;
        }

        // Filter files based on configured folders
        return allMarkdownFiles.filter(file => {
            return this.settings.scanFolders.some(folder => {
                const normalizedFolder = folder.replace(/^\/|\/$/g, '');
                const filePath = file.path;

                if (this.settings.scanRecursively) {
                    return filePath.startsWith(normalizedFolder);
                } else {
                    const fileFolder = file.parent?.path || '';
                    return fileFolder === normalizedFolder;
                }
            });
        });
    }

    /**
     * Parse tasks from a single file
     */
    private async parseTasksFromFile(file: TFile): Promise<Task[]> {
        const tasks: Task[] = [];
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        const cache = this.app.metadataCache.getFileCache(file);

        // Get course name based on detection method
        const courseName = this.getCourseName(file, cache);

        // Find all task lines
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const taskMatch = line.match(/^(\s*)-\s\[([ xX])\]\s(.+)$/);

            if (taskMatch) {
                const completed = taskMatch[2].toLowerCase() === 'x';
                const taskText = taskMatch[3];

                // Parse metadata and clean title
                const { title, startDate, dueDate } = this.parseTaskMetadata(taskText);

                // Create task object
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

    /**
     * Get course name based on configured detection method
     */
    private getCourseName(file: TFile, cache: CachedMetadata | null): string {
        switch (this.settings.courseDetection) {
            case 'per-file':
                return file.basename;

            case 'per-folder':
                return file.parent?.name || file.basename;

            case 'frontmatter':
                if (cache?.frontmatter) {
                    const courseValue = cache.frontmatter[this.settings.courseFrontmatterKey];
                    if (courseValue) {
                        return String(courseValue);
                    }
                }
                return file.basename;

            default:
                return file.basename;
        }
    }

    /**
     * Parse inline metadata from task text
     * Extracts start:: and due:: dates and returns cleaned title
     */
    private parseTaskMetadata(taskText: string): {
        title: string;
        startDate?: Date;
        dueDate?: Date;
    } {
        let title = taskText;
        let startDate: Date | undefined;
        let dueDate: Date | undefined;

        // Match start:: YYYY-MM-DD
        const startMatch = taskText.match(/start::\s*(\d{4}-\d{2}-\d{2})/);
        if (startMatch) {
            startDate = new Date(startMatch[1]);
            title = title.replace(/start::\s*\d{4}-\d{2}-\d{2}\s*/g, '');
        }

        // Match due:: YYYY-MM-DD
        const dueMatch = taskText.match(/due::\s*(\d{4}-\d{2}-\d{2})/);
        if (dueMatch) {
            dueDate = new Date(dueMatch[1]);
            title = title.replace(/due::\s*\d{4}-\d{2}-\d{2}\s*/g, '');
        }

        // Also try to match inline format (📅 YYYY-MM-DD) as fallback
        if (!dueDate) {
            const emojiMatch = taskText.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
            if (emojiMatch) {
                dueDate = new Date(emojiMatch[1]);
                title = title.replace(/📅\s*\d{4}-\d{2}-\d{2}\s*/g, '');
            }
        }

        // Clean up extra whitespace
        title = title.trim();

        return { title, startDate, dueDate };
    }

    /**
     * Parse tasks from a specific file (used for updates)
     */
    async parseTasksFromFilePath(filePath: string): Promise<Task[]> {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            return this.parseTasksFromFile(file);
        }
        return [];
    }
}
