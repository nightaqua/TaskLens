import { App, PluginSettingTab, Setting } from 'obsidian';
import SemesterDashboardPlugin from '../main';

// Export as SettingsTab to match what main.ts imports
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

        containerEl.createEl('h2', { text: 'Personal Dashboard Settings' });

        // 1. General Config
        const generalDetails = containerEl.createEl('details');
        generalDetails.open = true;
        generalDetails.createEl('summary', { text: 'General Configuration' });

        new Setting(generalDetails)
            .setName('Course Folders')
            .setDesc('Specific folders to scan (comma separated). Leave empty to scan whole vault.')
            .addText(text => text
                .setPlaceholder('Uni/Sem1, Work/Projects')
                .setValue(this.plugin.settings.scanFolders.join(', '))
                .onChange(async (value) => {
                    this.plugin.settings.scanFolders = value
                        .split(',')
                        .map(s => s.trim())
                        .filter(s => s.length > 0);
                    await this.plugin.saveSettings();
                }));

        // 2. Task Parsing
        const parserDetails = containerEl.createEl('details');
        parserDetails.createEl('summary', { text: 'Task Parsing' });

        new Setting(parserDetails)
            .setName('Start Date Key')
            .setDesc('Inline field for start date (e.g. start::)')
            .addText(text => text
                .setValue(this.plugin.settings.startDateKey)
                .onChange(async (value) => {
                    this.plugin.settings.startDateKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(parserDetails)
            .setName('Due Date Key')
            .setDesc('Inline field for due date (e.g. due::)')
            .addText(text => text
                .setValue(this.plugin.settings.dueDateKey)
                .onChange(async (value) => {
                    this.plugin.settings.dueDateKey = value;
                    await this.plugin.saveSettings();
                }));

        // 3. View Preferences (Placeholder for future settings)
        const viewDetails = containerEl.createEl('details');
        viewDetails.createEl('summary', { text: 'View Preferences' });

        new Setting(viewDetails)
            .setName('Default View')
            .setDesc('Choose what to show by default (Future feature)')
            .addDropdown(drop => drop
                .addOption('list', 'List')
                .addOption('timeline', 'Timeline')
                .setValue('list')
                .setDisabled(true)); // Disabled for now, just visual placeholder
    }
}