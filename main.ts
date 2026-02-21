import { Plugin, Notice, Menu, addIcon } from 'obsidian';
import { TaskManager } from './services/TaskManager';
import { TaskParser } from './services/TaskParser';
import { SemesterSettings, DEFAULT_SETTINGS } from './settings/Settings';
import { SettingsTab } from './settings/SettingsTab';
import { DashboardView, VIEW_TYPE_DASHBOARD } from './views/DashboardView';
import { TimelineView, VIEW_TYPE_TIMELINE } from './views/TimelineView';
import { TaskListView, VIEW_TYPE_LIST } from './views/TaskListView';
import { StatsView, VIEW_TYPE_STATS } from './views/StatsView';
import { QuickAddModal } from './modals/QuickAddModal';
import { WelcomeModal } from './modals/WelcomeModal';

// 1. Define our custom TaskLens icon (Magnifying Glass + Checkmark)
const TASKLENS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="11" cy="11" r="8"></circle>
  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  <path d="M8 11.5L10 13.5L14 8.5"></path>
</svg>`;

export default class SemesterDashboardPlugin extends Plugin {
    settings: SemesterSettings;
    taskManager: TaskManager;
    isLayoutLocked: boolean = true;

    async onload() {
        await this.loadSettings();

        const parser = new TaskParser(this.app, this.settings);
        this.taskManager = new TaskManager(parser, this.app);

        // Register Views
        this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this));
        this.registerView(VIEW_TYPE_TIMELINE, (leaf) => new TimelineView(leaf, this));
        this.registerView(VIEW_TYPE_LIST, (leaf) => new TaskListView(leaf, this));
        this.registerView(VIEW_TYPE_STATS, (leaf) => new StatsView(leaf, this));

        // 2. Add the custom icon to Obsidian's icon library
        addIcon('tasklens-icon', TASKLENS_ICON);

        // 3. Create the SINGLE unified Ribbon Icon with a Context Menu
        this.addRibbonIcon('tasklens-icon', 'TaskLens', (evt: MouseEvent) => {
            const menu = new Menu();

            menu.addItem((item) =>
                item
                    .setTitle('Open Dashboard')
                    .setIcon('layout-dashboard')
                    .onClick(() => this.activateView(VIEW_TYPE_DASHBOARD))
            );

            menu.addItem((item) =>
                item
                    .setTitle('Quick Add Task')
                    .setIcon('plus-circle')
                    .onClick(() => new QuickAddModal(this.app, this.taskManager).open())
            );

            menu.addSeparator();

            // Dynamically change title/icon based on current state
            menu.addItem((item) =>
                item
                    .setTitle(this.isLayoutLocked ? 'Unlock Layout' : 'Lock Layout')
                    .setIcon(this.isLayoutLocked ? 'unlock' : 'lock')
                    .onClick(() => this.toggleLayoutMode())
            );

            // Replace the disabled "Layout Presets" with the "Hide All" action!
            menu.addItem((item) =>
                item
                    .setTitle('Close All Widgets')
                    .setIcon('eye-off')
                    .onClick(() => this.closeAllWidgets())
            );

            menu.showAtMouseEvent(evt);
        });

        // Commands
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

        // CHECK FIRST RUN
        if (!this.settings.hasSeenWelcome) {
            setTimeout(async () => {
                new WelcomeModal(this.app, this).open();
            }, 1000);
        }

        this.addSettingTab(new SettingsTab(this.app, this));
    }

    toggleLayoutMode() {
        this.isLayoutLocked = !this.isLayoutLocked;

        const viewTypes = [VIEW_TYPE_DASHBOARD, VIEW_TYPE_TIMELINE, VIEW_TYPE_LIST, VIEW_TYPE_STATS];

        viewTypes.forEach(type => {
            const leaves = this.app.workspace.getLeavesOfType(type);
            leaves.forEach(leaf => {
                const tabContainer = leaf.view.containerEl.closest('.workspace-tabs');
                if (tabContainer) {
                    if (this.isLayoutLocked) {
                        tabContainer.classList.add('semester-hide-tabs');
                    } else {
                        tabContainer.classList.remove('semester-hide-tabs');
                    }
                }
            });
        });

        new Notice(this.isLayoutLocked ? 'Dashboard Layout: Locked 🔒' : 'Dashboard Layout: Unlocked 🔓');
    }

    // ---> NEW: Closes all widgets to focus on notes <---
    closeAllWidgets() {
        const viewTypes = [VIEW_TYPE_DASHBOARD, VIEW_TYPE_TIMELINE, VIEW_TYPE_LIST, VIEW_TYPE_STATS];
        let closedCount = 0;
        
        viewTypes.forEach(type => {
            const leaves = this.app.workspace.getLeavesOfType(type);
            leaves.forEach(leaf => {
                leaf.detach();
                closedCount++;
            });
        });

        if (closedCount > 0) {
            new Notice('TaskLens widgets hidden.');
        } else {
            new Notice('No TaskLens widgets were open.');
        }
    }

    // ---> UPDATED: Smart Spawning Logic <---
    async activateView(viewType: string) {
        // 1. Don't overwrite an active note. Split the view instead!
        let leaf = this.app.workspace.getLeaf(false);
        if (leaf && leaf.view.getViewType() !== 'empty') {
            leaf = this.app.workspace.getLeaf('split');
        }
        
        await leaf.setViewState({ type: viewType, active: true });
        this.app.workspace.revealLeaf(leaf);

        // 2. If the layout is locked, auto-unlock it so they can drag the new widget!
        if (this.isLayoutLocked) {
            this.toggleLayoutMode();
            new Notice('Layout auto-unlocked for placement 🔓');
        } else {
            // If it's already unlocked, just make sure tabs aren't hidden
            const tabContainer = leaf.view.containerEl.closest('.workspace-tabs');
            if (tabContainer) tabContainer.classList.remove('semester-hide-tabs');
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        await this.taskManager.loadTasks();
    }

    refreshViews() {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
        leaves.forEach(leaf => {
            const view = leaf.view;
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