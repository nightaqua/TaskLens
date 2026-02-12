export type ColorMode = 'status' | 'course';

export interface SemesterSettings {
    // --- Scanning & Parsing ---
    /** Folders to scan for tasks (empty array = scan entire vault) */
    scanFolders: string[];

    /** Whether to scan recursively in specified folders */
    scanRecursively: boolean;

    /** How to identify courses */
    courseDetection: 'per-file' | 'per-folder' | 'frontmatter';

    /** Frontmatter property to use for course name */
    courseFrontmatterKey: string;

    /** Metadata key for start date */
    startDateKey: string;

    /** Metadata key for due date */
    dueDateKey: string;

    // --- Visuals & UI ---
    /** Color scheme mode */
    colorScheme: 'inherit' | 'custom';

    /** How to color tasks */
    colorMode: ColorMode;

    /** Custom Color Palette */
    colors: {
        overdue: string;
        urgent: string;
        active: string;
        completed: string;
    };
}

export const DEFAULT_SETTINGS: SemesterSettings = {
    // Scanning Defaults
    scanFolders: [],
    scanRecursively: true,
    courseDetection: 'per-file',
    courseFrontmatterKey: 'course',
    startDateKey: 'start',
    dueDateKey: 'due',

    // Visual Defaults
    colorScheme: 'inherit',
    colorMode: 'status',
    colors: {
        overdue: '#e63946',
        urgent: '#fb8500',
        active: '#2a9d8f',
        completed: '#457b9d'
    }
};