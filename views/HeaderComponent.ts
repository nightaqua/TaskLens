import { setIcon } from 'obsidian';

export interface HeaderState {
    title: string | null;
    isCollapsed: boolean;
}

export class HeaderComponent {
    private container: HTMLElement;
    private title: string;
    private defaultTitle: string;
    private isCollapsed: boolean;

    private headerEl: HTMLElement | null = null;
    private sidebarHandleEl: HTMLElement | null = null;
    private isSaving: boolean = false;

    // Callbacks
    private onStateChange: () => void;
    private onRefresh: () => void;
    private onSettings: (() => void) | null;
    private onAdd: (() => void) | null; // <--- 1. Property added

    constructor(
        container: HTMLElement,
        initialState: HeaderState,
        defaultTitle: string,
        callbacks: {
            onStateChange: () => void,
            onRefresh: () => void,
            onSettings?: () => void,
            onAdd?: () => void // <--- 2. Interface updated (Optional)
        }
    ) {
        this.container = container;
        this.defaultTitle = defaultTitle;
        this.title = initialState.title || defaultTitle;
        this.isCollapsed = initialState.isCollapsed || false;

        this.onStateChange = callbacks.onStateChange;
        this.onRefresh = callbacks.onRefresh;
        this.onSettings = callbacks.onSettings || null;
        this.onAdd = callbacks.onAdd || null; // <--- 3. Assign property
    }

    public render(): void {
        this.renderSidebarHandle();
        this.renderHeader();
        this.updateVisibility();
    }

    private renderSidebarHandle(): void {
        if (this.sidebarHandleEl) this.sidebarHandleEl.remove();

        this.sidebarHandleEl = this.container.createDiv('dashboard-sidebar-handle is-hidden');
        setIcon(this.sidebarHandleEl, 'panel-left-open');
        this.sidebarHandleEl.setAttribute('aria-label', 'Show Header');

        this.sidebarHandleEl.addEventListener('click', () => {
            this.isCollapsed = false;
            this.updateVisibility();
            this.onStateChange();
        });
    }

    private renderHeader(): void {
        if (this.headerEl) this.headerEl.remove();

        this.headerEl = this.container.createDiv('dashboard-header');

        // --- LEFT GROUP ---
        const leftGroup = this.headerEl.createDiv('header-actions-left');
        if (this.onSettings) {
            const settingsBtn = leftGroup.createEl('button', { cls: 'header-icon-btn' });
            setIcon(settingsBtn, 'settings');
            settingsBtn.addEventListener('click', () => this.onSettings!());
        }

        // --- CENTER TITLE ---
        const titleWrapper = this.headerEl.createDiv('dashboard-title-wrapper');
        titleWrapper.setAttribute('aria-label', 'Click to rename');
        const titleEl = titleWrapper.createEl('h2', { text: this.title });
        const editIcon = titleWrapper.createDiv('edit-title-icon');
        setIcon(editIcon, 'pencil');

        titleWrapper.addEventListener('click', () => {
            this.enterEditMode(titleWrapper);
        });

        // --- RIGHT GROUP ---
        const rightGroup = this.headerEl.createDiv('header-actions-right');

        // <--- 4. THE MISSING ADD BUTTON LOGIC ---
        if (this.onAdd) {
            // Added 'feature-highlight' class so you can't miss it
            const addBtn = rightGroup.createEl('button', { cls: 'header-icon-btn feature-highlight' });
            setIcon(addBtn, 'plus');
            addBtn.setAttribute('aria-label', 'Quick Add Task');
            addBtn.addEventListener('click', () => this.onAdd!());
        }

        // Refresh Button
        const refreshBtn = rightGroup.createEl('button', { cls: 'dashboard-refresh-btn header-icon-btn' });
        setIcon(refreshBtn, 'refresh-cw');
        refreshBtn.setAttribute('aria-label', 'Refresh Data');
        refreshBtn.addEventListener('click', () => {
            refreshBtn.addClass('is-rotating');
            this.onRefresh();
            setTimeout(() => refreshBtn.removeClass('is-rotating'), 1000);
        });

        // Hide Button
        const hideBtn = rightGroup.createEl('button', { cls: 'header-icon-btn' });
        setIcon(hideBtn, 'panel-top-close');
        hideBtn.setAttribute('aria-label', 'Hide Header');
        hideBtn.addEventListener('click', () => {
            this.isCollapsed = true;
            this.updateVisibility();
            this.onStateChange();
        });
    }

    private enterEditMode(wrapper: HTMLElement) {
        wrapper.empty();
        const input = wrapper.createEl('input', {
            type: 'text',
            value: this.title,
            cls: 'dashboard-title-input'
        });

        input.focus();
        input.select();

        this.isSaving = false;

        const save = () => {
            if (this.isSaving) return;
            this.isSaving = true;

            const newVal = input.value.trim();
            this.title = newVal.length > 0 ? newVal : this.defaultTitle;
            this.onStateChange();
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            e.stopPropagation(); // Stop hotkeys from firing
            if (e.key === 'Enter') {
                e.preventDefault();
                save();
            }
        });
        input.addEventListener('keypress', (e) => e.stopPropagation());
    }

    private updateVisibility(): void {
        if (this.isCollapsed) {
            this.headerEl?.addClass('is-collapsed');
            this.sidebarHandleEl?.removeClass('is-hidden');
        } else {
            this.headerEl?.removeClass('is-collapsed');
            this.sidebarHandleEl?.addClass('is-hidden');
        }
    }

    public getState(): HeaderState {
        return {
            title: this.title,
            isCollapsed: this.isCollapsed
        };
    }
}
