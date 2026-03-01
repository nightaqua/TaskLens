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

export interface RefreshableView {
    refreshFromSettings?(): void;
    render?(): void;
    applyColorTheme?(): void;
}

const TASKLENS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="11" cy="11" r="8"></circle>
  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  <path d="M8 11.5L10 13.5L14 8.5"></path>
</svg>`;

export default class TaskLensPlugin extends Plugin {
    settings: SemesterSettings;
    taskManager: TaskManager;
    isLayoutLocked: boolean = true;
    isFocusMode: boolean = false;
    private savedLayout: unknown = null;

    async onload() {
        await this.loadSettings();

        const parser = new TaskParser(this.app, this.settings);
        this.taskManager = new TaskManager(parser, this.app);

        this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this));
        this.registerView(VIEW_TYPE_TIMELINE, (leaf) => new TimelineView(leaf, this));
        this.registerView(VIEW_TYPE_LIST, (leaf) => new TaskListView(leaf, this));
        this.registerView(VIEW_TYPE_STATS, (leaf) => new StatsView(leaf, this));

        addIcon('tasklens-icon', TASKLENS_ICON);

        const ribbonIconEl = this.addRibbonIcon('tasklens-icon', 'TaskLens', (evt: MouseEvent) => {
            ribbonIconEl.removeClass('feature-highlight');
            if (!this.settings.hasClickedRibbonIcon) {
                this.settings.hasClickedRibbonIcon = true;
                void this.saveSettings();
            }

            const menu = new Menu();

            menu.addItem((item) =>
                item
                    .setTitle('Open dashboard')
                    .setIcon('layout-dashboard')
                    .onClick(() => { void this.activateView(VIEW_TYPE_DASHBOARD); })
            );

            menu.addItem((item) =>
                item
                    .setTitle('Quick add task')
                    .setIcon('plus-circle')
                    .onClick(() => new QuickAddModal(this.app, this.taskManager).open())
            );

            menu.addSeparator();

            menu.addItem((item) =>
                item
                    .setTitle(this.isLayoutLocked ? 'Unlock layout' : 'Lock layout')
                    .setIcon(this.isLayoutLocked ? 'unlock' : 'lock')
                    .onClick(() => this.toggleLayoutMode())
            );

            menu.addItem((item) =>
                item
                    .setTitle(this.isFocusMode ? 'Exit focus mode' : 'Enter focus mode')
                    .setIcon(this.isFocusMode ? 'eye' : 'eye-off')
                    .onClick(() => { void this.toggleFocusMode(); })
            );

            menu.showAtMouseEvent(evt);
        });

        if (!this.settings.hasSeenWelcome || !this.settings.hasClickedRibbonIcon) {
            ribbonIconEl.addClass('feature-highlight');
        }

        this.addCommand({
            id: 'open-dashboard',
            name: 'Open dashboard (all-in-one)',
            callback: () => { void this.activateView(VIEW_TYPE_DASHBOARD); }
        });

        this.addCommand({
            id: 'open-timeline',
            name: 'Open timeline view',
            callback: () => { void this.activateView(VIEW_TYPE_TIMELINE); }
        });

        this.addCommand({
            id: 'open-task-list',
            name: 'Open task list',
            callback: () => { void this.activateView(VIEW_TYPE_LIST); }
        });

        this.addCommand({
            id: 'open-stats',
            name: 'Open statistics',
            callback: () => { void this.activateView(VIEW_TYPE_STATS); }
        });

        this.addCommand({
            id: 'quick-add-task',
            name: 'Quick add task',
            callback: () => {
                new QuickAddModal(this.app, this.taskManager).open();
            }
        });

        this.addCommand({
            id: 'refresh-dashboard-styles',
            name: 'Reload dashboard colors/styles',
            callback: () => this.refreshViews()
        });

        if (!this.settings.hasSeenWelcome) {
            setTimeout(() => {
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
                        tabContainer.classList.add('tasklens-hide-tabs');
                    } else {
                        tabContainer.classList.remove('tasklens-hide-tabs');
                    }
                }
            });
        });

        new Notice(this.isLayoutLocked ? 'Dashboard layout: Locked 🔒' : 'Dashboard layout: Unlocked 🔓');
    }

    async toggleFocusMode() {
        const workspace = this.app.workspace as unknown as { leftSplit: { collapse: () => void }, rightSplit: { collapse: () => void }, setLayout: (layout: unknown) => Promise<void> };

        if (!this.isFocusMode) {
            this.savedLayout = this.app.workspace.getLayout();
            this.isFocusMode = true;

            if (workspace.leftSplit && typeof workspace.leftSplit.collapse === 'function') {
                workspace.leftSplit.collapse();
            }
            if (workspace.rightSplit && typeof workspace.rightSplit.collapse === 'function') {
                workspace.rightSplit.collapse();
            }

            const viewTypes = [VIEW_TYPE_DASHBOARD, VIEW_TYPE_TIMELINE, VIEW_TYPE_LIST, VIEW_TYPE_STATS];
            let closedCount = 0;

            viewTypes.forEach(type => {
                this.app.workspace.getLeavesOfType(type).forEach(leaf => {
                    leaf.detach();
                    closedCount++;
                });
            });

            if (closedCount > 0) {
                new Notice('Focus mode enabled');
            } else {
                this.isFocusMode = false;
                this.savedLayout = null;
                new Notice('No TaskLenses were open');
            }
        } else {
            this.isFocusMode = false;
            if (this.savedLayout) {
                await workspace.setLayout(this.savedLayout);
                this.savedLayout = null;
                new Notice('Focus mode disabled');
            }
        }
    }

    async activateView(viewType: string) {
        let leaf = this.app.workspace.getLeaf(false);
        if (leaf && leaf.view.getViewType() !== 'empty') {
            leaf = this.app.workspace.getLeaf('split');
        }

        await leaf.setViewState({ type: viewType, active: true });

        // --- ADDED AWAIT HERE TO FIX WARNING ---
        await this.app.workspace.revealLeaf(leaf);

        if (this.isLayoutLocked) {
            this.toggleLayoutMode();
            new Notice('Layout auto-unlocked for placement 🔓');
        } else {
            const tabContainer = leaf.view.containerEl.closest('.workspace-tabs');
            if (tabContainer) tabContainer.classList.remove('tasklens-hide-tabs');
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
        const viewTypes = [VIEW_TYPE_DASHBOARD, VIEW_TYPE_TIMELINE, VIEW_TYPE_LIST, VIEW_TYPE_STATS];
        viewTypes.forEach(type => {
            this.app.workspace.getLeavesOfType(type).forEach(leaf => {
                const view = leaf.view as unknown as RefreshableView;
                if (typeof view.refreshFromSettings === 'function') {
                    view.refreshFromSettings();
                } else if (typeof view.render === 'function') {
                    if (typeof view.applyColorTheme === 'function') view.applyColorTheme();
                    view.render();
                }
            });
        });
    }
}