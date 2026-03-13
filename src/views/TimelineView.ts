import { ItemView, WorkspaceLeaf, ViewStateResult } from 'obsidian';
import TaskLensPlugin, { RefreshableView } from '../main';
import { TimelineComponent } from './TimelineComponent';
import { HeaderComponent, HeaderState } from './HeaderComponent';
import { setupViewDOM, cleanUpViewDOM } from './DashboardView';
import { VIEW_TYPE_TIMELINE, CLASS_DASHBOARD_VIEW } from '../constants';


export class TimelineView extends ItemView implements RefreshableView {
    private leafRootEl: HTMLElement | null = null;
    private tabContainer: HTMLElement | null = null;
    private timelineComponent: TimelineComponent | null = null;
    private headerComponent: HeaderComponent | null = null;
    private headerState: HeaderState = { title: null, isCollapsed: false };
    private timelineDaysToShow = 10;
    private viewportStart: Date | null = null;
    private savedScrollLeft = 0;
    private hasOpenedOnce = false;

    constructor(leaf: WorkspaceLeaf, private readonly plugin: TaskLensPlugin) {
        super(leaf);
        this.plugin.taskManager.on('tasks-updated', this.onTasksUpdated);
    }

    getViewType(): string { return VIEW_TYPE_TIMELINE; }
    getDisplayText(): string { return 'Timeline view'; }
    getIcon(): string { return 'clock'; }

    // Named event handler to prevent listener stacking
    private onTasksUpdated = (): void => {
        this.render();
    };

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        await super.setState(state, result);

        if (state && typeof state === 'object') {
            const s = state as Record<string, unknown>;
            if (Object.prototype.hasOwnProperty.call(s, 'headerState')) this.headerState = s.headerState as HeaderState;
            if (Object.prototype.hasOwnProperty.call(s, 'zoomLevel')) this.timelineDaysToShow = s.zoomLevel as number;
            if (Object.prototype.hasOwnProperty.call(s, 'viewportStart')) {
                const raw = s.viewportStart;
                if (typeof raw === 'string') {
                    const parsed = new Date(raw);
                    if (!isNaN(parsed.getTime())) this.viewportStart = parsed;
                }
            }
        }

        this.render();
        // Restore persisted scroll position; only jump to today on a genuine cold open
        const rendered = this.timelineComponent;
        if (!rendered) return;
        if (this.hasOpenedOnce) {
            setTimeout(() => { rendered.setScrollPosition(this.savedScrollLeft); }, 50);
        } else {
            setTimeout(() => { rendered.scrollToToday(); }, 300);
        }
    }

    getState(): Record<string, unknown> {
        // Grab the live viewport position from the component so it survives layout saves
        const liveViewportStart = this.timelineComponent?.getViewportStart() ?? this.viewportStart;

        return Object.assign(super.getState(), {
            headerState: this.headerComponent ? this.headerComponent.getState() : this.headerState,
            zoomLevel: this.timelineDaysToShow,
            viewportStart: liveViewportStart?.toISOString() ?? null,
        });
    }

    onOpen(): Promise<void> {
        // Use shared utility for UI consistency
        const { leafRootEl, tabContainer } = setupViewDOM(this.containerEl, this.plugin.isLayoutLocked);
        this.leafRootEl = leafRootEl;
        this.tabContainer = tabContainer;

        this.contentEl.empty();
        this.contentEl.addClass(CLASS_DASHBOARD_VIEW);

        void this.plugin.taskManager.loadTasks().then(() => {
            this.render();
            const rendered = this.timelineComponent;
            if (!rendered) return;
            if (!this.hasOpenedOnce) {
                this.hasOpenedOnce = true;
                setTimeout(() => { rendered.scrollToToday(); }, 500);
            } else {
                setTimeout(() => { rendered.setScrollPosition(this.savedScrollLeft); }, 50);
            }
        });

        // Keep the timeline live when the user edits tasks outside the dashboard
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file.path.endsWith('.md') && !this.plugin.taskManager.getIsInternalChange()) {
                    void this.plugin.taskManager.refreshFileTask(file.path);
                }
            })
        );

        return Promise.resolve();
    }

    onClose(): Promise<void> {
        this.plugin.taskManager.off('tasks-updated', this.onTasksUpdated);
        this.timelineComponent?.destroy();
        this.performCleanup();
        return Promise.resolve();
    }

    private performCleanup(): void {
        cleanUpViewDOM(this.leafRootEl, this.tabContainer);
    }

    public render(): void {
        // Preserve pan position across re-renders
        this.savedScrollLeft = this.timelineComponent?.getScrollPosition() ?? this.savedScrollLeft;
        // Clean up out-of-container DOM nodes before wiping contentEl
        this.timelineComponent?.destroy();

        this.contentEl.empty();

        this.headerComponent = new HeaderComponent(
            this.contentEl,
            this.headerState,
            'Timeline',
            {
                onStateChange: () => {
                    if (this.headerComponent) this.headerState = this.headerComponent.getState();
                    this.app.workspace.requestSaveLayout();
                    this.render();
                },
                onRefresh: () => { void this.plugin.taskManager.loadTasks(); },
            }
        );
        this.headerComponent.render();

        const container = this.contentEl.createDiv('dashboard-timeline-view');
        this.timelineComponent = new TimelineComponent(
            container,
            this.app,
            this.plugin.taskManager.getAllGroupedTasks(),
            this.timelineDaysToShow,
            this.plugin.settings,
            this.viewportStart ?? undefined,
            // When the user jumps the viewport, persist it immediately so layout saves reflect it
            (newStart: Date) => {
                this.viewportStart = newStart;
                this.app.workspace.requestSaveLayout();
            }
        );
        this.timelineComponent.render();

        // Restore pan position after DOM rebuild — setTimeout lets layout settle first.
        // Captured in a local const so the closure holds a guaranteed non-null reference.
        const rendered = this.timelineComponent;
        if (this.savedScrollLeft > 0) {
            setTimeout(() => { rendered.setScrollPosition(this.savedScrollLeft); }, 50);
        }
    }

    public refreshFromSettings(): void {
        this.render();
    }
}