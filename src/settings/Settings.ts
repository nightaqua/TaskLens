export type ColorMode = 'status' | 'course';

export interface SemesterSettings {
    scanFolders: string[];
    scanRecursively: boolean;
    courseDetection: 'per-file' | 'per-folder' | 'frontmatter';
    courseFrontmatterKey: string;
    startDateKey: string;
    dueDateKey: string;

    // Visuals & UI
    colorScheme: 'inherit' | 'custom';
    colorMode: ColorMode;

    // Status Colours
    colors: {
        overdue: string;
        urgent: string;
        active: string;
        completed: string;
    };

    appWideAutomation: boolean;

    topicColors: Record<string, string>;

    showBoard: boolean;
    hasSeenWelcome: boolean;
    hasClickedRibbonIcon: boolean;

    /** Persists which settings accordion sections were open when the tab was last closed. */
    settingsTabState: {
        scanOpen: boolean;
        parserOpen: boolean;
        uiOpen: boolean;
    };

    savedFocusLayout?: unknown;
}

export const DEFAULT_SETTINGS: SemesterSettings = {
    scanFolders: [],
    scanRecursively: true,
    courseDetection: 'per-file',
    courseFrontmatterKey: 'course',
    startDateKey: 'start',
    dueDateKey: 'due',

    colorScheme: 'inherit',
    colorMode: 'status',
    colors: {
        overdue: '#e63946',
        urgent: '#fb8500',
        active: '#2a9d8f',
        completed: '#457b9d'
    },

    topicColors: {},

    appWideAutomation: true,

    showBoard: false,
    hasSeenWelcome: false,
    hasClickedRibbonIcon: false,

    settingsTabState: {
        scanOpen: true,
        parserOpen: false,
        uiOpen: true,
    },

    savedFocusLayout: null
};

export function getTopicColor(topic: string, settings: SemesterSettings): string {
    if (settings.topicColors[topic]) {
        return settings.topicColors[topic];
    }
    const defaultPalette = ['#4cc9f0', '#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4caf50'];
    let hash = 0;
    for (let i = 0; i < topic.length; i++) hash = topic.charCodeAt(i) + ((hash << 5) - hash);
    return defaultPalette[Math.abs(hash) % defaultPalette.length];
}