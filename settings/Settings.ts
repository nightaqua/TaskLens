export type ColorMode = 'status' | 'course';

export interface SemesterSettings {
    // ... (Keep existing scan, course, and date keys) ...
    scanFolders: string[];
    scanRecursively: boolean;
    courseDetection: 'per-file' | 'per-folder' | 'frontmatter';
    courseFrontmatterKey: string;
    startDateKey: string;
    dueDateKey: string;

    // Visuals & UI
    colorScheme: 'inherit' | 'custom';
    colorMode: ColorMode;

    // Status Colors
    colors: {
        overdue: string;
        urgent: string;
        active: string;
        completed: string;
    };

    courseColors: string[];

    hasSeenWelcome: boolean;
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
    },

    // Default palette for courses
    courseColors: ['#4cc9f0', '#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4caf50'],

    hasSeenWelcome: false
};
