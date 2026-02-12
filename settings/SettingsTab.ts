import { App, PluginSettingTab, Setting } from 'obsidian';
import SemesterDashboardPlugin from '../main';

export class SettingsTab extends PluginSettingTab {
    plugin: SemesterDashboardPlugin;

    constructor(app: App, plugin: SemesterDashboardPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('semester-dashboard-settings');

        containerEl.createEl('h2', { text: 'Semester Dashboard Settings' });

        // 1. Scanning
        const scanDetails = containerEl.createEl('details');
        scanDetails.open = true;
        scanDetails.createEl('summary', { text: 'Vault Scanning' });

        new Setting(scanDetails)
            .setName('Scan folders')
            .setDesc('Folders to scan (one per line).')
            .addTextArea(text => {
                text.setPlaceholder('Uni/Courses')
                    .setValue(this.plugin.settings.scanFolders.join('\n'))
                    .onChange(async (value) => {
                        this.plugin.settings.scanFolders = value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                        await this.plugin.saveSettings();
                    });
            });

        // 2. Task Parsing
        const parserDetails = containerEl.createEl('details');
        parserDetails.createEl('summary', { text: 'Task Parsing' });
        new Setting(parserDetails).setName('Start Key').addText(t => t.setValue(this.plugin.settings.startDateKey).onChange(async v => { this.plugin.settings.startDateKey = v; await this.plugin.saveSettings(); }));
        new Setting(parserDetails).setName('Due Key').addText(t => t.setValue(this.plugin.settings.dueDateKey).onChange(async v => { this.plugin.settings.dueDateKey = v; await this.plugin.saveSettings(); }));


        // 3. Visuals (NEW)
        const uiDetails = containerEl.createEl('details');
        uiDetails.createEl('summary', { text: 'Appearance & Colors' });

        new Setting(uiDetails)
            .setName('Color Mode')
            .addDropdown(d => d
                .addOption('status', 'By Status')
                .addOption('course', 'By Course (Simple)')
                .setValue(this.plugin.settings.colorMode)
                .onChange(async (v) => {
                    this.plugin.settings.colorMode = v as any;
                    await this.plugin.saveSettings();
                }));

        new Setting(uiDetails)
            .setName('Overdue Color')
            .addColorPicker(c => c
                .setValue(this.plugin.settings.colors.overdue)
                .onChange(async (v) => {
                    this.plugin.settings.colors.overdue = v;
                    await this.plugin.saveSettings();
                    this.plugin.refreshViews();
                }));

        new Setting(uiDetails)
            .setName('Urgent Color')
            .addColorPicker(c => c.setValue(this.plugin.settings.colors.urgent).onChange(async v => {
                this.plugin.settings.colors.urgent = v;
                await this.plugin.saveSettings();
                this.plugin.refreshViews();
            }));

        new Setting(uiDetails)
            .setName('Active Color')
            .addColorPicker(c => c.setValue(this.plugin.settings.colors.active).onChange(async v => {
                this.plugin.settings.colors.active = v;
                await this.plugin.saveSettings();
                this.plugin.refreshViews();
            }));

        new Setting(uiDetails)
            .setName('Completed Color')
            .addColorPicker(c => c.setValue(this.plugin.settings.colors.completed).onChange(async v => {
                this.plugin.settings.colors.completed = v;
                await this.plugin.saveSettings();
                this.plugin.refreshViews();
            }));
    }
}
