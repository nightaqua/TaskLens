import { App, PluginSettingTab, Setting, normalizePath } from 'obsidian';
import TaskLensPlugin from '../main';
import { WelcomeModal } from '../modals/WelcomeModal';
import { getTopicColor } from './Settings';
import { CLASS_SETTINGS } from '../constants';

const validSortModes = ['status', 'course'] as const;
type SortMode = typeof validSortModes[number];
function isSortMode(v: unknown): v is SortMode {
    return validSortModes.includes(v as SortMode);
}

export class SettingsTab extends PluginSettingTab {
    private readonly plugin: TaskLensPlugin;

    constructor(app: App, plugin: TaskLensPlugin) {
        super(app, plugin);
        this.plugin = plugin;
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

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass(CLASS_SETTINGS);

        // --- NATIVE HEADER WITH HELP BUTTON ---
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
                text.inputEl.setAttribute("aria-label", "Scan paths");
                text.inputEl.setAttribute("title", "Scan paths");
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
                t.inputEl.setAttribute("aria-label", "Start key");
                t.inputEl.setAttribute("title", "Start key");
                return t.setValue(this.plugin.settings.startDateKey).onChange(v => {
                this.plugin.settings.startDateKey = v;
                void this.plugin.saveSettings().then(() => { void this.plugin.taskManager.loadTasks(); });
            });
            });

        new Setting(parserDetails)
            .setName('Due key')
            .setDesc('Inline text used to find the due date. You can combine them in one bracket! Example: [start:: 2026-02-02 due:: 2026-03-03]')
            .addText(t => {
                t.inputEl.setAttribute("aria-label", "Due key");
                t.inputEl.setAttribute("title", "Due key");
                return t.setValue(this.plugin.settings.dueDateKey).onChange(v => {
                this.plugin.settings.dueDateKey = v;
                void this.plugin.saveSettings().then(() => { void this.plugin.taskManager.loadTasks(); });
            });
            });

        new Setting(parserDetails)
            .setName('Course detection')
            .setDesc('How to determine a task\'s course or topic name.')
            .addDropdown(d => {
                d.selectEl.setAttribute("aria-label", "Course detection");
                d.selectEl.setAttribute("title", "Course detection");
                return d
                .addOption('per-file', 'File name')
                .addOption('per-folder', 'Folder name')
                .addOption('frontmatter', 'Frontmatter field')
                .setValue(this.plugin.settings.courseDetection)
                .onChange((v) => {
                    this.plugin.settings.courseDetection = v as 'per-file' | 'per-folder' | 'frontmatter';
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
                d.selectEl.setAttribute("aria-label", "Color mode");
                d.selectEl.setAttribute("title", "Color mode");
                return d
                .addOption('status', 'By urgency (overdue, active)')
                .addOption('course', 'By topic (file palette)')
                .setValue(this.plugin.settings.colorMode)
                .onChange((v) => {
                    if (isSortMode(v)) this.plugin.settings.colorMode = v;
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


        // --- ICS CALENDAR FEEDS ---
        const icsDetails = containerEl.createEl('details');
        icsDetails.open = this.plugin.settings.settingsTabState.icsOpen;
        icsDetails.createEl('summary', { text: 'Calendar feeds (ics)' });
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

        // --- CLEAN DONATION BUTTON ---
        containerEl.createEl('br');
        containerEl.createEl('hr');

        const supportDiv = containerEl.createDiv('settings-support-section');

        // The weak gray, centered text
        supportDiv.createEl('p', {
            text: 'If this dashboard helps you stay organized, consider supporting its development!',
            cls: 'settings-support-text'
        });

        const bmcLink = supportDiv.createEl('a', {
            href: 'https://buymeacoffee.com/JoblessDev'
        });

        const bmcImg = bmcLink.createEl('img');
        bmcImg.setAttribute('src', 'https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png');
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
                    t.inputEl.setAttribute("aria-label", "Frontmatter key");
                    t.inputEl.setAttribute("title", "Frontmatter key");
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
            cls: ['text-muted', 'color-picker-helper']
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
}
