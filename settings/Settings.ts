/**
 * Plugin settings structure
 */
export interface SemesterSettings {
    /** Folders to scan for tasks (empty array = scan entire vault) */
    scanFolders: string[];
    
    /** Whether to scan recursively in specified folders */
    scanRecursively: boolean;
    
    /** How to identify courses */
    courseDetection: 'per-file' | 'per-folder' | 'frontmatter';
    
    /** Frontmatter property to use for course name (if courseDetection is 'frontmatter') */
    courseFrontmatterKey: string;

    /** Metadata key for start date */
    startDateKey: string;

    /** Metadata key for due date */
    dueDateKey: string;
    
    /** Whether to allow tasks without due dates */
    allowNoDueDate: boolean;
    
    /** Whether to show completed tasks by default */
    showCompletedByDefault: boolean;
    
    /** Default sort order */
    defaultSort: 'due-date' | 'start-date' | 'file-name';
    
    /** UI density */
    uiDensity: 'compact' | 'comfortable' | 'spacious';
    
    /** Color scheme */
    colorScheme: 'inherit' | 'custom';
    
    /** Custom colors (if colorScheme is 'custom') */
    customColors: {
        overdue: string;
        upcoming: string;
        completed: string;
    };
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: SemesterSettings = {
    scanFolders: [],
    scanRecursively: true,
    courseDetection: 'per-file',
    courseFrontmatterKey: 'course',
    startDateKey: 'start',
    dueDateKey: 'due',
    allowNoDueDate: true,
    showCompletedByDefault: false,
    defaultSort: 'due-date',
    uiDensity: 'comfortable',
    colorScheme: 'inherit',
    customColors: {
        overdue: '#e74c3c',
        upcoming: '#f39c12',
        completed: '#27ae60'
    }
};
