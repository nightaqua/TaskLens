import { Plugin, WorkspaceLeaf, Notice } from 'obsidian'; // Add Notice
import { TaskManager } from './services/TaskManager';
import { TaskParser } from './services/TaskParser';
import { SemesterSettings, DEFAULT_SETTINGS } from './settings/Settings';
import { SettingsTab } from './settings/SettingsTab';
import { DashboardView, VIEW_TYPE_DASHBOARD } from './views/DashboardView';
import { TimelineView, VIEW_TYPE_TIMELINE } from './views/TimelineView';
import { TaskListView, VIEW_TYPE_LIST } from './views/TaskListView';
import { StatsView, VIEW_TYPE_STATS } from './views/StatsView';

export default class SemesterDashboardPlugin extends Plugin {
    settings: SemesterSettings;
    taskManager: TaskManager;

    async onload() {
        await this.loadSettings();

        // 1. Initialize Shared Service
        const parser = new TaskParser(this.app, this.settings);
        this.taskManager = new TaskManager(parser);

        // 2. Register Views
        this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this));
        this.registerView(VIEW_TYPE_TIMELINE, (leaf) => new TimelineView(leaf, this));
        this.registerView(VIEW_TYPE_LIST, (leaf) => new TaskListView(leaf, this));
        this.registerView(VIEW_TYPE_STATS, (leaf) => new StatsView(leaf, this));

        // --- NEW: Layout Lock/Unlock Ribbon Icon ---
        this.addRibbonIcon('move', 'Toggle Dashboard Layout', () => {
            this.toggleLayoutMode();
        });

        // 3. Add Commands
        this.addCommand({
            id: 'open-dashboard',
            name: 'Open Dashboard (All-in-One)',
            callback: () => this.activateView(VIEW_TYPE_DASHBOARD)
        });

        this.addCommand({
            id: 'open-timeline',
            name: 'Open Timeline View',
            callback: () => this.activateView(VIEW_TYPE_TIMELINE)
        });

        this.addCommand({
            id: 'open-task-list',
            name: 'Open Task List',
            callback: () => this.activateView(VIEW_TYPE_LIST)
        });

        this.addCommand({
            id: 'open-stats',
            name: 'Open Statistics',
            callback: () => this.activateView(VIEW_TYPE_STATS)
        });

        this.addSettingTab(new SettingsTab(this.app, this));
    }

    // Toggle the "semester-hide-tabs" class on ALL dashboard leaves
    toggleLayoutMode() {
        const viewTypes = [VIEW_TYPE_DASHBOARD, VIEW_TYPE_TIMELINE, VIEW_TYPE_LIST, VIEW_TYPE_STATS];
        let anyUnlocked = false;

        viewTypes.forEach(type => {
            const leaves = this.app.workspace.getLeavesOfType(type);
            leaves.forEach(leaf => {
                const tabContainer = leaf.view.containerEl.closest('.workspace-tabs');
                if (tabContainer) {
                    // Toggle the class
                    if (tabContainer.classList.contains('semester-hide-tabs')) {
                        tabContainer.classList.remove('semester-hide-tabs');
                        anyUnlocked = true;
                    } else {
                        tabContainer.classList.add('semester-hide-tabs');
                    }
                }
            });
        });

        new Notice(anyUnlocked ? 'Dashboard Layout: Unlocked 🔓' : 'Dashboard Layout: Locked 🔒');
    }

    async activateView(viewType: string) {
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({ type: viewType, active: true });
        this.app.workspace.revealLeaf(leaf);
        
        // Auto-lock new views by default for clean look
        // (Wait for DOM to settle)
        setTimeout(() => {
            const tabContainer = leaf.view.containerEl.closest('.workspace-tabs');
            if (tabContainer) tabContainer.classList.add('semester-hide-tabs');
        }, 100);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.taskManager.loadTasks();
    }
}