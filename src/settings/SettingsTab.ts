import { App, PluginSettingTab, SettingDefinitionItem, SettingGroupItem, normalizePath } from 'obsidian';
import TaskLensPlugin from '../main';
import { WelcomeModal } from '../modals/WelcomeModal';
import { getTopicColor, ColorMode, CourseDetection } from './Settings';
import { CLASS_SETTINGS } from '../constants';
import { BMC_BUTTON_DATA_URI } from '../assets/bmcButton';

const validColorModes: readonly ColorMode[] = ['status', 'course'];
function isColorMode(v: unknown): v is ColorMode {
    return validColorModes.includes(v as ColorMode);
}

const validCourseDetections: readonly CourseDetection[] = ['per-file', 'per-folder', 'frontmatter'];
function isCourseDetection(v: unknown): v is CourseDetection {
    return validCourseDetections.includes(v as CourseDetection);
}

const TOPIC_COLOR_PREFIX = 'topicColor:';

export class SettingsTab extends PluginSettingTab {
    private readonly plugin: TaskLensPlugin;

    constructor(app: App, plugin: TaskLensPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.containerEl.addClass(CLASS_SETTINGS);
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            {
                name: 'Configuration',
                render: (setting) => {
                    setting.setName('Configuration').setHeading().addExtraButton(btn => btn
                        .setIcon('help-circle')
                        .setTooltip('Show tutorial')
                        .onClick(() => {
                            new WelcomeModal(this.app, this.plugin).open();
                        })
                    );
                },
            },
            {
                type: 'group',
                heading: 'Vault scanning',
                items: [
                    {
                        name: 'Scan paths',
                        desc: 'Folders (e.g. Uni/math)\nor specific files (e.g. Projects/todo.md).\n\nOne per line.\nLeave empty to scan entire vault.',
                        control: {
                            type: 'textarea',
                            key: 'scanFolders',
                            placeholder: 'Projects\nUni/History\nTo-Do.md',
                        },
                    },
                    {
                        name: 'Recursive scan',
                        desc: 'Scan all subfolders inside the folders specified above?',
                        control: { type: 'toggle', key: 'scanRecursively' },
                    },
                ],
            },
            {
                type: 'group',
                heading: 'Task parsing & automation',
                items: [
                    {
                        name: 'App-wide automation',
                        desc: 'Apply date stamping and recurrence even when editing notes directly.',
                        control: { type: 'toggle', key: 'appWideAutomation' },
                    },
                    {
                        name: 'Start key',
                        desc: 'Inline text used to find the start date. Example: [start:: 2026-02-02]',
                        control: { type: 'text', key: 'startDateKey' },
                    },
                    {
                        name: 'Due key',
                        desc: 'Inline text used to find the due date. You can combine them in one bracket! Example: [start:: 2026-02-02 due:: 2026-03-03]',
                        control: { type: 'text', key: 'dueDateKey' },
                    },
                    {
                        name: 'Course detection',
                        desc: 'How to determine a task\'s course or topic name.',
                        control: {
                            type: 'dropdown',
                            key: 'courseDetection',
                            options: {
                                'per-file': 'File name',
                                'per-folder': 'Folder name',
                                'frontmatter': 'Frontmatter field',
                            },
                        },
                    },
                    {
                        name: 'Frontmatter key',
                        desc: 'Frontmatter field name to read the course name from.',
                        control: {
                            type: 'text',
                            key: 'courseFrontmatterKey',
                            placeholder: 'Course',
                        },
                        visible: () => this.plugin.settings.courseDetection === 'frontmatter',
                    },
                ],
            },
            {
                type: 'group',
                heading: 'Appearance & colors',
                items: [
                    {
                        name: 'Color mode',
                        control: {
                            type: 'dropdown',
                            key: 'colorMode',
                            options: {
                                'status': 'By urgency (overdue, active)',
                                'course': 'By topic (file palette)',
                            },
                        },
                    },
                    {
                        name: 'Show task action buttons',
                        desc: 'Show edit and delete buttons on task hover in the task list.',
                        control: { type: 'toggle', key: 'showTaskActions' },
                    },
                ],
            },
            {
                type: 'group',
                heading: this.plugin.settings.colorMode === 'course' ? 'Colors (per topic)' : 'Colors',
                items: this.plugin.settings.colorMode === 'course'
                    ? this.getTopicColorItems()
                    : this.getStatusColorItems(),
            },
            {
                type: 'group',
                heading: 'Calendar feeds (.ics)',
                items: [
                    {
                        name: 'Calendar feed urls',
                        desc: 'Subscribe to public or private .ics calendar URLs. Events appear as a read-only overlay on the Timeline. One URL per line.',
                        control: {
                            type: 'textarea',
                            key: 'icsFeedUrls',
                            placeholder: 'https://example.com/calendar.ics',
                            rows: 4,
                        },
                    },
                    {
                        name: 'Refresh calendar feeds',
                        desc: 'Fetch all calendar feeds now and refresh the timeline overlay.',
                        render: (setting) => {
                            setting.addButton(btn => btn
                                .setButtonText('Refresh now')
                                .onClick(() => {
                                    btn.setButtonText('Refreshing…');
                                    btn.setDisabled(true);
                                    this.plugin.icsFeedManager.fetchAll()
                                        .then(() => {
                                            this.plugin.refreshViews();
                                            btn.setButtonText('Refresh now');
                                            btn.setDisabled(false);
                                        })
                                        .catch(() => {
                                            btn.setButtonText('Refresh now');
                                            btn.setDisabled(false);
                                        });
                                })
                            );
                        },
                    },
                ],
            },
            {
                name: 'Support',
                render: (setting) => {
                    setting.settingEl.empty();
                    setting.settingEl.removeClass('setting-item');
                    setting.settingEl.addClass('settings-support-section');

                    setting.settingEl.createEl('br');
                    setting.settingEl.createEl('hr');

                    setting.settingEl.createEl('p', {
                        text: 'If this dashboard helps you stay organized, consider supporting its development!',
                        cls: 'settings-support-text',
                    });

                    const bmcLink = setting.settingEl.createEl('a', {
                        href: 'https://buymeacoffee.com/JoblessDev',
                    });
                    bmcLink.setAttribute('target', '_blank');
                    bmcLink.setAttribute('rel', 'noopener');

                    const bmcImg = bmcLink.createEl('img');
                    bmcImg.setAttribute('src', BMC_BUTTON_DATA_URI);
                    bmcImg.setAttribute('width', '200');
                    bmcImg.setAttribute('alt', 'Buy Me A Coffee');
                },
            },
        ];
    }

    private getStatusColorItems(): SettingGroupItem[] {
        const colorSetting = (name: string, settingKey: keyof typeof this.plugin.settings.colors): SettingGroupItem => ({
            name,
            control: { type: 'color', key: `color:${settingKey}` },
        });

        return [
            colorSetting('Overdue color', 'overdue'),
            colorSetting('Urgent color', 'urgent'),
            colorSetting('Active color', 'active'),
            colorSetting('Completed color', 'completed'),
        ];
    }

    private getTopicColorItems(): SettingGroupItem[] {
        const allTasks = this.plugin.taskManager.getAllTasks();
        const uniqueTopics = Array.from(new Set(allTasks.map(t => t.fileName).filter((t): t is string => Boolean(t))));

        if (uniqueTopics.length === 0) {
            return [{ name: 'No active topics found. Add some tasks first!' }];
        }

        return uniqueTopics.map((topic): SettingGroupItem => ({
            name: `${topic} color`,
            control: { type: 'color', key: `${TOPIC_COLOR_PREFIX}${topic}` },
        }));
    }

    override getControlValue(key: string): unknown {
        const settings = this.plugin.settings;
        switch (key) {
            case 'scanFolders':
                return settings.scanFolders.join('\n');
            case 'scanRecursively':
                return settings.scanRecursively;
            case 'appWideAutomation':
                return settings.appWideAutomation;
            case 'startDateKey':
                return settings.startDateKey;
            case 'dueDateKey':
                return settings.dueDateKey;
            case 'courseDetection':
                return settings.courseDetection;
            case 'courseFrontmatterKey':
                return settings.courseFrontmatterKey;
            case 'colorMode':
                return settings.colorMode;
            case 'showTaskActions':
                return settings.showTaskActions;
            case 'icsFeedUrls':
                return settings.icsFeedUrls.join('\n');
            case 'color:overdue':
                return settings.colors.overdue;
            case 'color:urgent':
                return settings.colors.urgent;
            case 'color:active':
                return settings.colors.active;
            case 'color:completed':
                return settings.colors.completed;
            default:
                if (key.startsWith(TOPIC_COLOR_PREFIX)) {
                    return getTopicColor(key.slice(TOPIC_COLOR_PREFIX.length), settings);
                }
                return undefined;
        }
    }

    override async setControlValue(key: string, value: unknown): Promise<void> {
        const settings = this.plugin.settings;
        switch (key) {
            case 'scanFolders': {
                if (typeof value !== 'string') return;
                settings.scanFolders = value
                    .split('\n')
                    .map(s => s.trim())
                    .filter(s => s.length > 0)
                    // Normalise slashes and whitespace for cross-platform compatibility
                    .map(s => normalizePath(s));
                await this.plugin.saveSettings();
                await this.plugin.taskManager.loadTasks();
                return;
            }
            case 'scanRecursively': {
                if (typeof value !== 'boolean') return;
                settings.scanRecursively = value;
                await this.plugin.saveSettings();
                await this.plugin.taskManager.loadTasks();
                return;
            }
            case 'appWideAutomation': {
                if (typeof value !== 'boolean') return;
                settings.appWideAutomation = value;
                await this.plugin.saveSettings();
                return;
            }
            case 'startDateKey': {
                if (typeof value !== 'string') return;
                settings.startDateKey = value;
                await this.plugin.saveSettings();
                await this.plugin.taskManager.loadTasks();
                return;
            }
            case 'dueDateKey': {
                if (typeof value !== 'string') return;
                settings.dueDateKey = value;
                await this.plugin.saveSettings();
                await this.plugin.taskManager.loadTasks();
                return;
            }
            case 'courseDetection': {
                if (!isCourseDetection(value)) return;
                settings.courseDetection = value;
                await this.plugin.saveSettings();
                await this.plugin.taskManager.loadTasks();
                this.refreshDomState();
                return;
            }
            case 'courseFrontmatterKey': {
                if (typeof value !== 'string') return;
                settings.courseFrontmatterKey = value;
                await this.plugin.saveSettings();
                await this.plugin.taskManager.loadTasks();
                return;
            }
            case 'colorMode': {
                if (!isColorMode(value)) return;
                settings.colorMode = value;
                await this.plugin.saveSettings();
                this.plugin.refreshViews();
                this.update();
                return;
            }
            case 'showTaskActions': {
                if (typeof value !== 'boolean') return;
                settings.showTaskActions = value;
                await this.plugin.saveSettings();
                this.plugin.refreshViews();
                return;
            }
            case 'icsFeedUrls': {
                if (typeof value !== 'string') return;
                settings.icsFeedUrls = value
                    .split('\n')
                    .map(s => s.trim())
                    .filter(s => s.length > 0);
                await this.plugin.saveSettings();
                return;
            }
            case 'color:overdue': {
                if (typeof value !== 'string') return;
                settings.colors.overdue = value;
                await this.plugin.saveSettings();
                this.plugin.refreshViews();
                return;
            }
            case 'color:urgent': {
                if (typeof value !== 'string') return;
                settings.colors.urgent = value;
                await this.plugin.saveSettings();
                this.plugin.refreshViews();
                return;
            }
            case 'color:active': {
                if (typeof value !== 'string') return;
                settings.colors.active = value;
                await this.plugin.saveSettings();
                this.plugin.refreshViews();
                return;
            }
            case 'color:completed': {
                if (typeof value !== 'string') return;
                settings.colors.completed = value;
                await this.plugin.saveSettings();
                this.plugin.refreshViews();
                return;
            }
            default: {
                if (key.startsWith(TOPIC_COLOR_PREFIX) && typeof value === 'string') {
                    settings.topicColors[key.slice(TOPIC_COLOR_PREFIX.length)] = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshViews();
                }
            }
        }
    }
}
