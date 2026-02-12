import { Plugin, Notice } from 'obsidian';
import { TaskManager } from './services/TaskManager';
import { TaskParser } from './services/TaskParser';
import { SemesterSettings, DEFAULT_SETTINGS } from './settings/Settings';
import { SettingsTab } from './settings/SettingsTab';
import { DashboardView, VIEW_TYPE_DASHBOARD } from './views/DashboardView';
import { TimelineView, VIEW_TYPE_TIMELINE } from './views/TimelineView';
import { TaskListView, VIEW_TYPE_LIST } from './views/TaskListView';
import { StatsView, VIEW_TYPE_STATS } from './views/StatsView';
import { QuickAddModal } from './modals/QuickAddModal'; // Import

export default class SemesterDashboardPlugin extends Plugin {
    settings: SemesterSettings;
    taskManager: TaskManager;

    async onload() {
        await this.loadSettings();

        const parser = new TaskParser(this.app, this.settings);
        // FIX: Pass 'this.app' to TaskManager
        this.taskManager = new TaskManager(parser, this.app);

        // Register Views
        this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this));
        this.registerView(VIEW_TYPE_TIMELINE, (leaf) => new TimelineView(leaf, this));
        this.registerView(VIEW_TYPE_LIST, (leaf) => new TaskListView(leaf, this));
        this.registerView(VIEW_TYPE_STATS, (leaf) => new StatsView(leaf, this));

        // Ribbon Icon
        this.addRibbonIcon('move', 'Toggle Dashboard Layout', () => this.toggleLayoutMode());

        // Commands
        this.addCommand({
            id: 'open-dashboard',
            name: 'Open Dashboard (All-in-One)',
            callback: () => this.activateView(VIEW_TYPE_DASHBOARD)
        });

        // ... (Keep other open commands) ...
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

        // NEW: Global Quick Add
        this.addCommand({
            id: 'quick-add-task',
            name: 'Quick Add Task',
            callback: () => {
                new QuickAddModal(this.app, this.taskManager).open();
            }
        });

        this.addCommand({
            id: 'refresh-dashboard-styles',
            name: 'Reload Dashboard Colors/Styles',
            callback: () => this.refreshViews()
        });

        this.addSettingTab(new SettingsTab(this.app, this));
    }

    toggleLayoutMode() {
        const viewTypes = [VIEW_TYPE_DASHBOARD, VIEW_TYPE_TIMELINE, VIEW_TYPE_LIST, VIEW_TYPE_STATS];
        let anyUnlocked = false;
        viewTypes.forEach(type => {
            const leaves = this.app.workspace.getLeavesOfType(type);
            leaves.forEach(leaf => {
                const tabContainer = leaf.view.containerEl.closest('.workspace-tabs');
                if (tabContainer) {
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

    refreshViews() {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
        leaves.forEach(leaf => {
            const view = leaf.view;
            // Avoid instanceof due to hot-reload identity changes; rely on view type + method presence.
            const isDashboard =
                typeof view?.getViewType === 'function' &&
                view.getViewType() === VIEW_TYPE_DASHBOARD;
            const canRefresh = typeof (view as { refreshFromSettings?: unknown })?.refreshFromSettings === 'function';
            if (isDashboard && canRefresh) {
                (view as DashboardView).refreshFromSettings();
            }
        });
    }
}
