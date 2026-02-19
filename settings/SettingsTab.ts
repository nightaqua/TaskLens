import { App, PluginSettingTab, Setting, setIcon } from 'obsidian';
import SemesterDashboardPlugin from '../main';
import { WelcomeModal } from '../modals/WelcomeModal';

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

        // Header with Help Icon
        const headerDiv = containerEl.createDiv();
        headerDiv.style.display = 'flex';
        headerDiv.style.justifyContent = 'space-between';
        headerDiv.style.alignItems = 'center';
        headerDiv.style.marginBottom = '20px';

        const headerTitle = headerDiv.createEl('h2', { text: 'TaskLens Settings' });
        headerTitle.style.margin = '0';

        const helpBtn = headerDiv.createEl('button', {
            cls: 'clickable-icon',
            attr: { 'aria-label': 'Show Tutorial' }
        });
        helpBtn.style.background = 'transparent';
        helpBtn.style.border = 'none';
        helpBtn.style.cursor = 'pointer';
        helpBtn.style.color = 'var(--text-muted)';
        helpBtn.style.padding = '4px';
        setIcon(helpBtn, 'help-circle');

        helpBtn.addEventListener('click', () => {
            new WelcomeModal(this.app, this.plugin).open();
        });
        // 1. Scanning
        const scanDetails = containerEl.createEl('details');
        scanDetails.open = true;
        scanDetails.createEl('summary', { text: 'Vault Scanning' });

        const scanPathsSetting = new Setting(scanDetails)
            .setName('Scan paths')
            // Using \n to force line breaks visually
            .setDesc('Folders (e.g. Uni/Math)\nor specific files (e.g. Projects/Todo.md).\n\nOne per line.\nLeave empty to scan entire vault.')
            .addTextArea(text => {
                text.setPlaceholder('Projects\nUni/History\nTo-Do.md')
                    .setValue(this.plugin.settings.scanFolders.join('\n'))
                    .onChange(async (value) => {
                        this.plugin.settings.scanFolders = value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                        await this.plugin.saveSettings();
                    });
            });

        // Add a custom class so we can target this specific layout in CSS
        scanPathsSetting.settingEl.addClass('scan-paths-setting');

        new Setting(scanDetails)
            .setName('Recursive Scan')
            .setDesc('Scan all subfolders inside the folders specified above?')
            .addToggle(t => t.setValue(this.plugin.settings.scanRecursively).onChange(async v => {
                this.plugin.settings.scanRecursively = v;
                await this.plugin.saveSettings();
            }));

        /// 2. Task Parsing
        const parserDetails = containerEl.createEl('details');
        parserDetails.createEl('summary', { text: 'Task Parsing' });

        new Setting(parserDetails)
            .setName('Start Key')
            .setDesc('Inline text used to find the start date. Example: [start:: 2026-02-02]')
            .addText(t => t.setValue(this.plugin.settings.startDateKey).onChange(async v => { this.plugin.settings.startDateKey = v; await this.plugin.saveSettings(); }));

        new Setting(parserDetails)
            .setName('Due Key')
            .setDesc('Inline text used to find the due date. You can combine them in one bracket! Example: [start:: 2026-02-02 due:: 2026-03-03]')
            .addText(t => t.setValue(this.plugin.settings.dueDateKey).onChange(async v => { this.plugin.settings.dueDateKey = v; await this.plugin.saveSettings(); }));

        // 3. Visuals & Colors
        const uiDetails = containerEl.createEl('details');
        uiDetails.open = true;
        uiDetails.createEl('summary', { text: 'Appearance & Colors' });

        /* --- COMMENTED OUT: Advanced Course Color Logic ---
        new Setting(uiDetails)
            .setName('Color Mode')
            .addDropdown(d => d
                .addOption('status', 'By Status (Urgent, Active)')
                .addOption('course', 'By Topic/File Palette')
                .setValue(this.plugin.settings.colorMode)
                .onChange(async (v) => {
                    this.plugin.settings.colorMode = v as any;
                    await this.plugin.saveSettings();
                    this.plugin.refreshViews();
                }));
        ---------------------------------------------------- */

        // Render only Status Colors
        new Setting(uiDetails)
            .setName('Overdue Color')
            .addColorPicker(c => c.setValue(this.plugin.settings.colors.overdue).onChange(async v => { this.plugin.settings.colors.overdue = v; await this.plugin.saveSettings(); this.plugin.refreshViews(); }));

        new Setting(uiDetails)
            .setName('Urgent Color')
            .addColorPicker(c => c.setValue(this.plugin.settings.colors.urgent).onChange(async v => { this.plugin.settings.colors.urgent = v; await this.plugin.saveSettings(); this.plugin.refreshViews(); }));

        new Setting(uiDetails)
            .setName('Active Color')
            .addColorPicker(c => c.setValue(this.plugin.settings.colors.active).onChange(async v => { this.plugin.settings.colors.active = v; await this.plugin.saveSettings(); this.plugin.refreshViews(); }));

        new Setting(uiDetails)
            .setName('Completed Color')
            .addColorPicker(c => c.setValue(this.plugin.settings.colors.completed).onChange(async v => { this.plugin.settings.colors.completed = v; await this.plugin.saveSettings(); this.plugin.refreshViews(); }));

        // 4. Support (Keep existing)
        containerEl.createEl('hr');
        const supportDiv = containerEl.createDiv('support-section');
        supportDiv.style.textAlign = 'center';
        supportDiv.style.padding = '20px 0';
        supportDiv.style.backgroundColor = 'var(--background-secondary)';
        supportDiv.style.borderRadius = '8px';
        supportDiv.createEl('h3', { text: 'Enjoying TaskLens?' });
        supportDiv.createEl('p', { text: 'If this dashboard helps you stay organized, consider supporting its development!', cls: 'text-muted' });
        const btn = supportDiv.createEl('a', { href: 'https://buymeacoffee.com/joblessdev', text: '☕ Buy Me a Coffee', cls: 'mod-cta' });
        btn.style.textDecoration = 'none';
        btn.style.display = 'inline-block';
        btn.style.marginTop = '10px';

        // Buy Me a Coffee button script embed
        const bmcScript = supportDiv.createEl('script');
        bmcScript.setAttribute('type', 'text/javascript');
        bmcScript.setAttribute('src', 'https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js');
        bmcScript.setAttribute('data-name', 'bmc-button');
        bmcScript.setAttribute('data-slug', 'JoblessDev');
        bmcScript.setAttribute('data-color', '#40DCA5');
        bmcScript.setAttribute('data-emoji', '☕');
        bmcScript.setAttribute('data-font', 'Poppins');
        bmcScript.setAttribute('data-text', 'Buy me a coffee');
        bmcScript.setAttribute('data-outline-color', '#000000');
        bmcScript.setAttribute('data-font-color', '#ffffff');
        bmcScript.setAttribute('data-coffee-color', '#FFDD00');
    }
}
