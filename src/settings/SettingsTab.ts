import { App, PluginSettingTab, Setting, SettingDefinitionItem, SettingGroupItem, normalizePath } from 'obsidian';
import TaskLensPlugin from '../main';
import { WelcomeModal } from '../modals/WelcomeModal';
import { getTopicColor, ColorMode, CourseDetection, SemesterSettings } from './Settings';
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
type SectionStateKey = keyof SemesterSettings['settingsTabState'];

export class SettingsTab extends PluginSettingTab {
    private readonly plugin: TaskLensPlugin;

    constructor(app: App, plugin: TaskLensPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.containerEl.addClass(CLASS_SETTINGS);
    }

    private async toggleSection(stateKey: SectionStateKey): Promise<void> {
        this.plugin.settings.settingsTabState[stateKey] = !this.plugin.settings.settingsTabState[stateKey];
        await this.plugin.saveSettings();
        this.update();
    }

    private buildCollapsibleGroup(heading: string, stateKey: SectionStateKey, items: SettingGroupItem[]): SettingDefinitionItem {
        const isOpen = this.plugin.settings.settingsTabState[stateKey];
        return {
            type: 'group',
            heading,
            cls: isOpen ? 'tasklens-settings-group' : 'tasklens-settings-group-collapsed',
            extraButtons: [(btn) => btn
                .setIcon(isOpen ? 'chevron-down' : 'chevron-right')
                .setTooltip(isOpen ? 'Collapse' : 'Expand')
                .onClick(() => {
                    void this.toggleSection(stateKey);
                })
            ],
            items,
        };
    }

    private renderPlainText(setting: Setting, text: string, cls: string | string[]): void {
        setting.settingEl.empty();
        setting.settingEl.removeClass('setting-item');
        setting.settingEl.createEl('p', { text, cls });
    }

    /**
     * Imperative fallback for Obsidian versions older than 1.13.0 (i.e. desktop,
     * which hasn't received the declarative settings API yet). Obsidian only
     * calls this when the runtime doesn't recognise getSettingDefinitions();
     * on 1.13+ runtimes (mobile) this is ignored in favor of the declarative
     * definitions below. Keep both renderings in sync when editing settings.
     *
     * minAppVersion is 1.13.0 because setDestructive() (ConfirmModal.ts) requires
     * it, not because the declarative settings renderer is available everywhere at
     * that version — desktop hasn't shipped it yet, so this fallback is still live.
     */
    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Configuration')
            .setHeading()
            .addExtraButton(btn => btn
                .setIcon('help-circle')
                .setTooltip('Show tutorial')
                .onClick(() => {
                    new WelcomeModal(this.app, this.plugin).open();
                })
            );

        const scanDetails = containerEl.createEl('details');
        scanDetails.open = this.plugin.settings.settingsTabState.scanOpen;
        scanDetails.createEl('summary', { text: 'Vault scanning' });
        scanDetails.addEventListener('toggle', () => {
            this.plugin.settings.settingsTabState.scanOpen = scanDetails.open;
            void this.plugin.saveSettings();
        });

        const scanPathsSetting = new Setting(scanDetails)
            .setName('Scan paths')
            .setDesc('Folders (e.g. Uni/math)\nor specific files (e.g. Projects/todo.md).\n\nOne per line.\nLeave empty to scan entire vault.')
            .addTextArea(text => {
                text.inputEl.setAttribute('aria-label', 'Scan paths');
                text.setPlaceholder('Projects\nUni/History\nTo-Do.md')
                    .setValue(this.plugin.settings.scanFolders.join('\n'))
                    .onChange((value) => {
                        void this.updateScanPaths(value);
                    });
            });
        scanPathsSetting.settingEl.addClass('scan-paths-setting');

        new Setting(scanDetails)
            .setName('Recursive scan')
            .setDesc('Scan all subfolders inside the folders specified above?')
            .addToggle(t => t.setValue(this.plugin.settings.scanRecursively).onChange(v => {
                this.plugin.settings.scanRecursively = v;
                void this.plugin.saveSettings().then(() => { void this.plugin.taskManager.loadTasks(); });
            }));

        const parserDetails = containerEl.createEl('details');
        parserDetails.open = this.plugin.settings.settingsTabState.parserOpen;
        parserDetails.createEl('summary', { text: 'Task parsing & automation' });
        parserDetails.addEventListener('toggle', () => {
            this.plugin.settings.settingsTabState.parserOpen = parserDetails.open;
            void this.plugin.saveSettings();
        });

        new Setting(parserDetails)
            .setName('App-wide automation')
            .setDesc('Apply date stamping and recurrence even when editing notes directly.')
            .addToggle(t => t.setValue(this.plugin.settings.appWideAutomation).onChange(v => {
                this.plugin.settings.appWideAutomation = v;
                void this.plugin.saveSettings();
            }));

        new Setting(parserDetails)
            .setName('Start key')
            .setDesc('Inline text used to find the start date. Example: [start:: 2026-02-02]')
            .addText(t => {
                t.inputEl.setAttribute('aria-label', 'Start key');
                return t.setValue(this.plugin.settings.startDateKey).onChange(v => {
                    this.plugin.settings.startDateKey = v;
                    void this.plugin.saveSettings().then(() => { void this.plugin.taskManager.loadTasks(); });
                });
            });

        new Setting(parserDetails)
            .setName('Due key')
            .setDesc('Inline text used to find the due date. You can combine them in one bracket! Example: [start:: 2026-02-02 due:: 2026-03-03]')
            .addText(t => {
                t.inputEl.setAttribute('aria-label', 'Due key');
                return t.setValue(this.plugin.settings.dueDateKey).onChange(v => {
                    this.plugin.settings.dueDateKey = v;
                    void this.plugin.saveSettings().then(() => { void this.plugin.taskManager.loadTasks(); });
                });
            });

        new Setting(parserDetails)
            .setName('Course detection')
            .setDesc('How to determine a task\'s course or topic name.')
            .addDropdown(d => {
                d.selectEl.setAttribute('aria-label', 'Course detection');
                return d
                    .addOption('per-file', 'File name')
                    .addOption('per-folder', 'Folder name')
                    .addOption('frontmatter', 'Frontmatter field')
                    .setValue(this.plugin.settings.courseDetection)
                    .onChange((v) => {
                        if (isCourseDetection(v)) this.plugin.settings.courseDetection = v;
                        void this.plugin.saveSettings().then(() => { void this.plugin.taskManager.loadTasks(); });
                        this.renderFrontmatterKeyField(frontmatterKeyContainer);
                    });
            });

        const frontmatterKeyContainer = parserDetails.createDiv();
        this.renderFrontmatterKeyField(frontmatterKeyContainer);

        const uiDetails = containerEl.createEl('details');
        uiDetails.open = this.plugin.settings.settingsTabState.uiOpen;
        uiDetails.createEl('summary', { text: 'Appearance & colors' });
        uiDetails.addEventListener('toggle', () => {
            this.plugin.settings.settingsTabState.uiOpen = uiDetails.open;
            void this.plugin.saveSettings();
        });

        new Setting(uiDetails)
            .setName('Color mode')
            .addDropdown(d => {
                d.selectEl.setAttribute('aria-label', 'Color mode');
                return d
                    .addOption('status', 'By urgency (overdue, active)')
                    .addOption('course', 'By topic (file palette)')
                    .setValue(this.plugin.settings.colorMode)
                    .onChange((v) => {
                        if (isColorMode(v)) this.plugin.settings.colorMode = v;
                        void this.plugin.saveSettings().then(() => {
                            this.plugin.refreshViews();
                            this.renderColorPickers(colorPickersContainer);
                        });
                    });
            });

        new Setting(uiDetails)
            .setName('Show task action buttons')
            .setDesc('Show edit and delete buttons on task hover in the task list.')
            .addToggle(t => t.setValue(this.plugin.settings.showTaskActions).onChange(v => {
                this.plugin.settings.showTaskActions = v;
                void this.plugin.saveSettings().then(() => { this.plugin.refreshViews(); });
            }));

        const colorPickersContainer = uiDetails.createDiv();
        this.renderColorPickers(colorPickersContainer);

        const icsDetails = containerEl.createEl('details');
        icsDetails.open = this.plugin.settings.settingsTabState.icsOpen;
        icsDetails.createEl('summary', { text: 'Calendar feeds (.ics)' });
        icsDetails.addEventListener('toggle', () => {
            this.plugin.settings.settingsTabState.icsOpen = icsDetails.open;
            void this.plugin.saveSettings();
        });

        new Setting(icsDetails)
            .setName('Calendar feed urls')
            .setDesc('Subscribe to public or private .ics calendar URLs. Events appear as a read-only overlay on the Timeline. One URL per line.')
            .addTextArea(text => {
                text.inputEl.setAttribute('aria-label', 'Calendar feed urls');
                text.inputEl.rows = 4;
                return text
                    .setPlaceholder('https://example.com/calendar.ics')
                    .setValue(this.plugin.settings.icsFeedUrls.join('\n'))
                    .onChange(async (value) => {
                        this.plugin.settings.icsFeedUrls = value
                            .split('\n')
                            .map(s => s.trim())
                            .filter(s => s.length > 0);
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(icsDetails)
            .setName('Refresh calendar feeds')
            .setDesc('Fetch all calendar feeds now and refresh the timeline overlay.')
            .addButton(btn => btn
                .setButtonText('Refresh now')
                .onClick(async () => {
                    btn.setButtonText('Refreshing…');
                    btn.setDisabled(true);
                    await this.plugin.icsFeedManager.fetchAll();
                    this.plugin.refreshViews();
                    btn.setButtonText('Refresh now');
                    btn.setDisabled(false);
                })
            );

        containerEl.createEl('br');
        containerEl.createEl('hr');

        const supportDiv = containerEl.createDiv('settings-support-section');
        supportDiv.createEl('p', {
            text: 'If this dashboard helps you stay organized, consider supporting its development!',
            cls: 'settings-support-text',
        });

        const bmcLink = supportDiv.createEl('a', {
            href: 'https://buymeacoffee.com/JoblessDev',
        });
        bmcLink.setAttribute('target', '_blank');
        bmcLink.setAttribute('rel', 'noopener');

        const bmcImg = bmcLink.createEl('img');
        bmcImg.setAttribute('src', BMC_BUTTON_DATA_URI);
        bmcImg.setAttribute('width', '200');
        bmcImg.setAttribute('alt', 'Buy Me A Coffee');
    }

    private renderFrontmatterKeyField(container: HTMLElement): void {
        container.empty();

        if (this.plugin.settings.courseDetection === 'frontmatter') {
            new Setting(container)
                .setName('Frontmatter key')
                .setDesc('Frontmatter field name to read the course name from.')
                .addText(t => {
                    t.inputEl.setAttribute('aria-label', 'Frontmatter key');
                    return t
                        .setPlaceholder('Course')
                        .setValue(this.plugin.settings.courseFrontmatterKey)
                        .onChange(v => {
                            this.plugin.settings.courseFrontmatterKey = v;
                            void this.plugin.saveSettings().then(() => { void this.plugin.taskManager.loadTasks(); });
                        });
                });
        }
    }

    private renderColorPickers(container: HTMLElement): void {
        container.empty();

        if (this.plugin.settings.colorMode === 'status') {
            this.renderStatusColors(container);
        } else {
            this.renderTopicColors(container);
        }
    }

    private renderStatusColors(container: HTMLElement): void {
        const createColorSetting = (name: string, settingKey: keyof typeof this.plugin.settings.colors) => {
            new Setting(container)
                .setName(name)
                .addColorPicker(c => c
                    .setValue(this.plugin.settings.colors[settingKey])
                    .onChange(v => {
                        this.plugin.settings.colors[settingKey] = v;
                        void this.plugin.saveSettings().then(() => {
                            this.plugin.refreshViews();
                        });
                    })
                );
        };

        createColorSetting('Overdue color', 'overdue');
        createColorSetting('Urgent color', 'urgent');
        createColorSetting('Active color', 'active');
        createColorSetting('Completed color', 'completed');
    }

    private renderTopicColors(container: HTMLElement): void {
        container.createEl('p', {
            text: 'Assign a custom color to each of your active topics.',
            cls: ['text-muted', 'color-picker-helper'],
        });

        const allTasks = this.plugin.taskManager.getAllTasks();
        const uniqueTopics = Array.from(new Set(allTasks.map(t => t.fileName).filter((t): t is string => Boolean(t))));

        if (uniqueTopics.length === 0) {
            container.createEl('p', { text: 'No active topics found. Add some tasks first!', cls: 'color-picker-empty' });
            return;
        }

        uniqueTopics.forEach(topic => {
            const savedColor = getTopicColor(topic, this.plugin.settings);

            new Setting(container)
                .setName(`${topic} color`)
                .addColorPicker(c => c
                    .setValue(savedColor)
                    .onChange(v => {
                        this.plugin.settings.topicColors[topic] = v;
                        void this.plugin.saveSettings().then(() => {
                            this.plugin.refreshViews();
                        });
                    })
                );
        });
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
            this.buildCollapsibleGroup('Vault scanning', 'scanOpen', [
                {
                    name: 'Scan paths',
                    desc: 'Folders (e.g. Uni/math)\nor specific files (e.g. Projects/todo.md).\n\nOne per line.\nLeave empty to scan entire vault.',
                    render: (setting) => {
                        setting.settingEl.addClass('scan-paths-setting');
                        setting.setName('Scan paths')
                            .setDesc('Folders (e.g. Uni/math)\nor specific files (e.g. Projects/todo.md).\n\nOne per line.\nLeave empty to scan entire vault.')
                            .addTextArea(text => {
                                text.inputEl.setAttribute('aria-label', 'Scan paths');
                                text.setPlaceholder('Projects\nUni/History\nTo-Do.md')
                                    .setValue(this.plugin.settings.scanFolders.join('\n'))
                                    .onChange((value) => {
                                        void this.updateScanPaths(value);
                                    });
                            });
                    },
                },
                {
                    name: 'Recursive scan',
                    desc: 'Scan all subfolders inside the folders specified above?',
                    control: { type: 'toggle', key: 'scanRecursively' },
                },
            ]),
            this.buildCollapsibleGroup('Task parsing & automation', 'parserOpen', [
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
            ]),
            this.buildCollapsibleGroup('Appearance & colors', 'uiOpen', [
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
                ...(this.plugin.settings.colorMode === 'course' ? this.getTopicColorItems() : this.getStatusColorItems()),
            ]),
            this.buildCollapsibleGroup('Calendar feeds (.ics)', 'icsOpen', [
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
            ]),
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

    private async updateScanPaths(value: string): Promise<void> {
        this.plugin.settings.scanFolders = value
            .split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0)
            // Normalise slashes and whitespace for cross-platform compatibility
            .map(s => normalizePath(s));

        await this.plugin.saveSettings();
        await this.plugin.taskManager.loadTasks();
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
        const helper: SettingGroupItem = {
            name: 'Assign a custom color to each of your active topics.',
            render: (setting) => {
                this.renderPlainText(setting, 'Assign a custom color to each of your active topics.', ['text-muted', 'color-picker-helper']);
            },
        };

        const allTasks = this.plugin.taskManager.getAllTasks();
        const uniqueTopics = Array.from(new Set(allTasks.map(t => t.fileName).filter((t): t is string => Boolean(t))));

        if (uniqueTopics.length === 0) {
            const empty: SettingGroupItem = {
                name: 'No active topics found. Add some tasks first!',
                render: (setting) => {
                    this.renderPlainText(setting, 'No active topics found. Add some tasks first!', 'color-picker-empty');
                },
            };
            return [helper, empty];
        }

        return [
            helper,
            ...uniqueTopics.map((topic): SettingGroupItem => ({
                name: `${topic} color`,
                control: { type: 'color', key: `${TOPIC_COLOR_PREFIX}${topic}` },
            })),
        ];
    }

    override getControlValue(key: string): unknown {
        const settings = this.plugin.settings;
        switch (key) {
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
                // Status vs. topic colors are structurally different items, not just a
                // visibility toggle, so the whole definitions tree is rebuilt.
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
