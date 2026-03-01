import { App, PluginSettingTab, Setting } from 'obsidian';
import TaskLensPlugin from '../main';
import { WelcomeModal } from '../modals/WelcomeModal';
import { getTopicColor } from './Settings';

export class SettingsTab extends PluginSettingTab {
    plugin: TaskLensPlugin;

    constructor(app: App, plugin: TaskLensPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('tasklens-settings');

        // --- NATIVE HEADER WITH HELP BUTTON ---
        new Setting(containerEl)
            .setName('TaskLens settings')
            .setHeading()
            .addExtraButton(btn => btn
                .setIcon('help-circle')
                .setTooltip('Show tutorial')
                .onClick(() => {
                    new WelcomeModal(this.app, this.plugin).open();
                })
            );

        const scanDetails = containerEl.createEl('details');
        scanDetails.open = true;
        scanDetails.createEl('summary', { text: 'Vault scanning' });

        const scanPathsSetting = new Setting(scanDetails)
            .setName('Scan paths')
            .setDesc('Folders (e.g. Uni/Math)\nor specific files (e.g. Projects/Todo.md).\n\nOne per line.\nLeave empty to scan entire vault.')
            .addTextArea(text => {
                text.setPlaceholder('Projects\nUni/History\nTo-Do.md')
                    .setValue(this.plugin.settings.scanFolders.join('\n'))
                    .onChange((value) => {
                        this.plugin.settings.scanFolders = value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                        void this.plugin.saveSettings();
                    });
            });

        scanPathsSetting.settingEl.addClass('scan-paths-setting');

        new Setting(scanDetails)
            .setName('Recursive scan')
            .setDesc('Scan all subfolders inside the folders specified above?')
            .addToggle(t => t.setValue(this.plugin.settings.scanRecursively).onChange(v => {
                this.plugin.settings.scanRecursively = v;
                void this.plugin.saveSettings();
            }));

        const parserDetails = containerEl.createEl('details');
        parserDetails.createEl('summary', { text: 'Task parsing' });

        new Setting(parserDetails)
            .setName('Start key')
            .setDesc('Inline text used to find the start date. Example: [start:: 2026-02-02]')
            .addText(t => t.setValue(this.plugin.settings.startDateKey).onChange(v => {
                this.plugin.settings.startDateKey = v;
                void this.plugin.saveSettings();
            }));

        new Setting(parserDetails)
            .setName('Due key')
            .setDesc('Inline text used to find the due date. You can combine them in one bracket! Example: [start:: 2026-02-02 due:: 2026-03-03]')
            .addText(t => t.setValue(this.plugin.settings.dueDateKey).onChange(v => {
                this.plugin.settings.dueDateKey = v;
                void this.plugin.saveSettings();
            }));

        const uiDetails = containerEl.createEl('details');
        uiDetails.open = true;
        uiDetails.createEl('summary', { text: 'Appearance & colors' });

        new Setting(uiDetails)
            .setName('Color mode')
            .addDropdown(d => d
                .addOption('status', 'By urgency (overdue, active)')
                .addOption('course', 'By topic (file palette)')
                .setValue(this.plugin.settings.colorMode)
                .onChange((v) => {
                    this.plugin.settings.colorMode = v as 'status' | 'course';
                    void this.plugin.saveSettings().then(() => {
                        this.plugin.refreshViews();
                        renderColorPickers();
                    });
                }));

        const colorPickersContainer = uiDetails.createDiv();

        const renderColorPickers = () => {
            colorPickersContainer.empty();

            if (this.plugin.settings.colorMode === 'status') {
                new Setting(colorPickersContainer).setName('Overdue color').addColorPicker(c => c.setValue(this.plugin.settings.colors.overdue).onChange(v => { this.plugin.settings.colors.overdue = v; void this.plugin.saveSettings().then(() => this.plugin.refreshViews()); }));
                new Setting(colorPickersContainer).setName('Urgent color').addColorPicker(c => c.setValue(this.plugin.settings.colors.urgent).onChange(v => { this.plugin.settings.colors.urgent = v; void this.plugin.saveSettings().then(() => this.plugin.refreshViews()); }));
                new Setting(colorPickersContainer).setName('Active color').addColorPicker(c => c.setValue(this.plugin.settings.colors.active).onChange(v => { this.plugin.settings.colors.active = v; void this.plugin.saveSettings().then(() => this.plugin.refreshViews()); }));
                new Setting(colorPickersContainer).setName('Completed color').addColorPicker(c => c.setValue(this.plugin.settings.colors.completed).onChange(v => { this.plugin.settings.colors.completed = v; void this.plugin.saveSettings().then(() => this.plugin.refreshViews()); }));
            } else {
                const helperText = colorPickersContainer.createEl('p', {
                    text: 'Assign a custom color to each of your active topics.',
                    cls: 'text-muted'
                });
                helperText.setCssProps({ 'margin-left': '14px', 'margin-bottom': '12px', 'font-size': '0.9em' });

                const allTasks = this.plugin.taskManager.getAllTasks();
                const uniqueTopics = Array.from(new Set(allTasks.map(t => t.fileName).filter((t): t is string => Boolean(t))));

                if (uniqueTopics.length === 0) {
                    const emptyText = colorPickersContainer.createEl('p', { text: 'No active topics found. Add some tasks first!' });
                    emptyText.setCssProps({ 'margin-left': '14px', 'font-style': 'italic' });
                    return;
                }

                uniqueTopics.forEach(topic => {
                    const savedColor = getTopicColor(topic, this.plugin.settings);

                    new Setting(colorPickersContainer)
                        .setName(`${topic} color`)
                        .addColorPicker(c => c.setValue(savedColor).onChange(v => {
                            this.plugin.settings.topicColors[topic] = v;
                            void this.plugin.saveSettings().then(() => this.plugin.refreshViews());
                        }));
                });
            }
        };

        renderColorPickers();

// --- CLEAN DONATION BUTTON ---
        containerEl.createEl('br');
        containerEl.createEl('hr');

        const supportDiv = containerEl.createDiv();
        supportDiv.setCssProps({
            'text-align': 'center',
            'margin-top': '20px',
            'margin-bottom': '20px'
        });

        // The weak grey, centered text
        const supportText = supportDiv.createEl('p', {
            text: 'If this dashboard helps you stay organized, consider supporting its development!'
        });
        supportText.setCssProps({
            'color': 'var(--text-muted)',
            'font-size': '0.9em',
            'margin-bottom': '12px'
        });

        const bmcLink = supportDiv.createEl('a', {
            href: 'https://buymeacoffee.com/JoblessDev'
        });

        const bmcImg = bmcLink.createEl('img');
        bmcImg.setAttribute('src', 'https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png');
        bmcImg.setAttribute('width', '200');
        bmcImg.setAttribute('alt', 'Buy Me A Coffee');
    }
}