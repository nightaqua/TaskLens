import { Plugin, Notice, Menu, addIcon, TFile } from 'obsidian';
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

// All view types in one place — used repeatedly for bulk operations
const ALL_VIEW_TYPES = [VIEW_TYPE_DASHBOARD, VIEW_TYPE_TIMELINE, VIEW_TYPE_LIST, VIEW_TYPE_STATS];

const TASKLENS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="11" cy="11" r="8"></circle>
  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  <path d="M8 11.5L10 13.5L14 8.5"></path>
</svg>`;

// Obsidian doesn't expose split types on WorkspaceRoot, so we cast where needed
type WorkspaceWithSplits = {
    leftSplit: { collapse: () => void };
    rightSplit: { collapse: () => void };
    setLayout: (layout: unknown) => Promise<void>;
};

export default class TaskLensPlugin extends Plugin {
    settings: SemesterSettings;
    taskManager: TaskManager;
    isLayoutLocked: boolean = true;
    isFocusMode: boolean = false;

    async onload() {
        await this.loadSettings();

        // Restore the focus mode state if Obsidian was closed while it was active
        if (this.settings.savedFocusLayout) {
            this.isFocusMode = true;
        }

        const parser = new TaskParser(this.app, this.settings);
        this.taskManager = new TaskManager(parser, this.app);

        this.registerEvent(
            this.app.vault.on('modify', async (file) => {
                if (!(file instanceof TFile)) return;

                const isInternal = this.taskManager.getIsInternalChange();
                if (!this.settings.appWideAutomation || !file.path.endsWith('.md') || isInternal) {
                    return;
                }

                await this.taskManager.processManualUpdate(file);
            })
        );

        this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this));
        this.registerView(VIEW_TYPE_TIMELINE, (leaf) => new TimelineView(leaf, this));
        this.registerView(VIEW_TYPE_LIST, (leaf) => new TaskListView(leaf, this));
        this.registerView(VIEW_TYPE_STATS, (leaf) => new StatsView(leaf, this));

        addIcon('tasklens-icon', TASKLENS_ICON);
        this.setupRibbonIcon();
        this.setupCommands();

        // Delay welcome modal slightly so Obsidian's own UI finishes loading first
        if (!this.settings.hasSeenWelcome) {
            setTimeout(() => { new WelcomeModal(this.app, this).open(); }, 1000);
        }

        this.addSettingTab(new SettingsTab(this.app, this));

        // Populate this.tasks unconditionally on every startup. Without this, if no
        // TaskLens view is open (e.g. focus mode was active when Obsidian was closed),
        // this.tasks stays empty and processManualUpdate can never detect any transition.
        this.app.workspace.onLayoutReady(() => {
            void this.taskManager.loadTasks();
        });
    }

    private setupRibbonIcon(): void {
        const ribbonIconEl = this.addRibbonIcon('tasklens-icon', 'Tasklens', (evt: MouseEvent) => {
            ribbonIconEl.removeClass('feature-highlight');

            if (!this.settings.hasClickedRibbonIcon) {
                this.settings.hasClickedRibbonIcon = true;
                void this.saveSettings();
            }

            const menu = new Menu();

            menu.addItem((item) =>
                item
                    .setTitle('Add widget')
                    .setIcon('layout-dashboard')
                    .onClick(() => { void this.activateView(VIEW_TYPE_DASHBOARD); })
            );
            menu.addItem((item) =>
                item
                    .setTitle('Quick add task')
                    .setIcon('plus-circle')
                    .onClick(() => { new QuickAddModal(this.app, this.taskManager).open(); })
            );

            menu.addSeparator();

            menu.addItem((item) =>
                item
                    .setTitle(this.isLayoutLocked ? 'Unlock layout' : 'Lock layout')
                    .setIcon(this.isLayoutLocked ? 'unlock' : 'lock')
                    .onClick(() => { this.toggleLayoutMode(); })
            );
            menu.addItem((item) =>
                item
                    .setTitle(this.isFocusMode ? 'Exit focus mode' : 'Enter focus mode')
                    .setIcon(this.isFocusMode ? 'eye' : 'eye-off')
                    .onClick(() => { void this.toggleFocusMode(); })
            );

            menu.showAtMouseEvent(evt);
        });

        // Highlight the ribbon icon until the user has seen the welcome screen and clicked it
        if (!this.settings.hasSeenWelcome || !this.settings.hasClickedRibbonIcon) {
            ribbonIconEl.addClass('feature-highlight');
        }
    }

    private setupCommands(): void {
        const viewCommands = [
            { id: 'open-dashboard',   name: 'Open dashboard (all-in-one)', type: VIEW_TYPE_DASHBOARD },
            { id: 'open-timeline',    name: 'Open timeline view',          type: VIEW_TYPE_TIMELINE },
            { id: 'open-task-list',   name: 'Open task list',              type: VIEW_TYPE_LIST },
            { id: 'open-stats',       name: 'Open statistics',             type: VIEW_TYPE_STATS },
        ];

        viewCommands.forEach(({ id, name, type }) => {
            this.addCommand({ id, name, callback: () => { void this.activateView(type); } });
        });

        this.addCommand({
            id: 'quick-add-task',
            name: 'Quick add task',
            callback: () => { new QuickAddModal(this.app, this.taskManager).open(); },
        });

        this.addCommand({
            id: 'refresh-dashboard-styles',
            name: 'Reload dashboard colors/styles',
            callback: () => { this.refreshViews(); },
        });
    }

    toggleLayoutMode(): void {
        this.isLayoutLocked = !this.isLayoutLocked;

        // Apply or remove the tab-hiding class on every open TaskLens leaf
        ALL_VIEW_TYPES.forEach(type => {
            this.app.workspace.getLeavesOfType(type).forEach(leaf => {
                const tabContainer = leaf.view.containerEl.closest('.workspace-tabs');
                if (tabContainer) {
                    tabContainer.classList.toggle('tasklens-hide-tabs', this.isLayoutLocked);
                }
            });
        });

        new Notice(this.isLayoutLocked ? 'Dashboard layout: locked 🔒' : 'Dashboard layout: unlocked 🔓');
    }

    async toggleFocusMode(): Promise<void> {
        const workspace = this.app.workspace as unknown as WorkspaceWithSplits;

        if (!this.isFocusMode) {
            // Save layout before collapsing so it can be restored later
            this.settings.savedFocusLayout = this.app.workspace.getLayout();
            this.isFocusMode = true;
            await this.saveSettings();

            if (typeof workspace.leftSplit.collapse === 'function') workspace.leftSplit.collapse();
            if (typeof workspace.rightSplit.collapse === 'function') workspace.rightSplit.collapse();

            // Count and close all open TaskLens views
            let closedCount = 0;
            ALL_VIEW_TYPES.forEach(type => {
                const leaves = this.app.workspace.getLeavesOfType(type);
                closedCount += leaves.length;
                if (leaves.length > 0) this.app.workspace.detachLeavesOfType(type);
            });

            if (closedCount > 0) {
                new Notice('Focus mode enabled');
            } else {
                // Nothing was open — abort and roll back state
                this.isFocusMode = false;
                this.settings.savedFocusLayout = null;
                await this.saveSettings();
                new Notice('No task lenses were open');
            }
        } else {
            this.isFocusMode = false;
            if (this.settings.savedFocusLayout) {
                await workspace.setLayout(this.settings.savedFocusLayout);
                this.settings.savedFocusLayout = null;
                await this.saveSettings();
                new Notice('Focus mode disabled');
            }
        }
    }

    async activateView(viewType: string): Promise<void> {
        // Reuse the current leaf only if it's empty; otherwise split
        let leaf = this.app.workspace.getLeaf(false);
        if (leaf.view.getViewType() !== 'empty') {
            leaf = this.app.workspace.getLeaf('split');
        }

        await leaf.setViewState({ type: viewType, active: true });
        await this.app.workspace.revealLeaf(leaf);

        if (this.isLayoutLocked) {
            // Auto-unlock so the user can position the new leaf freely
            this.toggleLayoutMode();
            new Notice('Layout auto-unlocked for placement 🔓');
        } else {
            const tabContainer = leaf.view.containerEl.closest('.workspace-tabs');
            if (tabContainer instanceof HTMLElement) {
                tabContainer.classList.remove('tasklens-hide-tabs');
            }
        }
    }

    async loadSettings(): Promise<void> {
        const data = (await this.loadData()) as Partial<SemesterSettings> | null;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data || {});
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        // Note: callers that change settings affecting task parsing (e.g. scan folders,
        // course detection) must call taskManager.loadTasks() explicitly after saveSettings().
    }

    refreshViews(): void {
        ALL_VIEW_TYPES.forEach(type => {
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

/* #TODO constants file*/