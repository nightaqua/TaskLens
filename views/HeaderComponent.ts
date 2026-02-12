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
    private onAdd: (() => void) | null; // NEW PROPERTY

    constructor(
        container: HTMLElement,
        initialState: HeaderState,
        defaultTitle: string,
        callbacks: {
            onStateChange: () => void,
            onRefresh: () => void,
            onSettings?: () => void,
            onAdd?: () => void  // NEW OPTIONAL CALLBACK
        }
    ) {
        this.container = container;
        this.defaultTitle = defaultTitle;
        this.title = initialState.title || defaultTitle;
        this.isCollapsed = initialState.isCollapsed || false;

        this.onStateChange = callbacks.onStateChange;
        this.onRefresh = callbacks.onRefresh;
        this.onSettings = callbacks.onSettings || null;
        this.onAdd = callbacks.onAdd || null; // Store it
    }

    public render(): void {
        this.renderSidebarHandle();
        this.renderHeader();
        this.updateVisibility();
    }

    private renderSidebarHandle(): void {
        if (this.sidebarHandleEl) this.sidebarHandleEl.remove();
        this.sidebarHandleEl = this.container.createDiv('dashboard-sidebar-handle');
        setIcon(this.sidebarHandleEl, 'panel-left-open');
        this.sidebarHandleEl.addEventListener('click', () => {
            this.isCollapsed = false;
            this.updateVisibility();
            this.onStateChange();
        });
    }

    private renderHeader(): void {
        if (this.headerEl) this.headerEl.remove();
        this.headerEl = this.container.createDiv('dashboard-header');

        // LEFT
        const leftGroup = this.headerEl.createDiv('header-actions-left');
        if (this.onSettings) {
            const settingsBtn = leftGroup.createEl('button', { cls: 'header-icon-btn' });
            setIcon(settingsBtn, 'settings');
            settingsBtn.addEventListener('click', () => this.onSettings!());
        }

        // CENTER (Title)
        const titleWrapper = this.headerEl.createDiv('dashboard-title-wrapper');
        const titleEl = titleWrapper.createEl('h2', { text: this.title });
        const editIcon = titleWrapper.createDiv('edit-title-icon');
        setIcon(editIcon, 'pencil');
        titleWrapper.addEventListener('click', () => this.enterEditMode(titleWrapper));

        // RIGHT
        const rightGroup = this.headerEl.createDiv('header-actions-right');

        // NEW: Add Button
        if (this.onAdd) {
            const addBtn = rightGroup.createEl('button', { cls: 'header-icon-btn' });
            setIcon(addBtn, 'plus');
            addBtn.setAttribute('aria-label', 'Quick Add Task');
            addBtn.addEventListener('click', () => this.onAdd!());
        }

        // Refresh
        const refreshBtn = rightGroup.createEl('button', { cls: 'dashboard-refresh-btn header-icon-btn' });
        setIcon(refreshBtn, 'refresh-cw');
        refreshBtn.addEventListener('click', () => {
            refreshBtn.addClass('is-rotating');
            this.onRefresh();
            setTimeout(() => refreshBtn.removeClass('is-rotating'), 1000);
        });

        // Hide
        const hideBtn = rightGroup.createEl('button', { cls: 'header-icon-btn' });
        setIcon(hideBtn, 'panel-top-close');
        hideBtn.addEventListener('click', () => {
            this.isCollapsed = true;
            this.updateVisibility();
            this.onStateChange();
        });
    }

    private enterEditMode(wrapper: HTMLElement) {
        wrapper.empty();
        const input = wrapper.createEl('input', { type: 'text', value: this.title, cls: 'dashboard-title-input' });
        input.focus(); input.select();
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
            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); save(); }
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
        return { title: this.title, isCollapsed: this.isCollapsed };
    }
}