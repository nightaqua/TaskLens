import { vi } from 'vitest';

// Mock obsidian for both node and jsdom environments
vi.mock('obsidian', () => {
    return {
        TFile: class {},
        Events: class {
            on() {}
            off() {}
            trigger() {}
        },
        App: class {},
        Modal: class {
            open() {}
            close() {}
        },
        SuggestModal: class {
            open() {}
            close() {}
        },
        ItemView: class {},
        WorkspaceLeaf: class {},
        ViewStateResult: class {},
        setIcon: vi.fn()
    };
});

// Setup DOM for jsdom environment if needed
if (typeof window !== 'undefined') {
    // Basic DOM setup is already handled by jsdom
    Object.defineProperty(window, 'obsidian', {
        value: {
            TFile: class {},
            Events: class {
                on() {}
                off() {}
                trigger() {}
            },
            App: class {},
            Modal: class {
                open() {}
                close() {}
            },
            SuggestModal: class {
                open() {}
                close() {}
            },
            ItemView: class {},
            WorkspaceLeaf: class {},
            ViewStateResult: class {},
            setIcon: vi.fn()
        },
        writable: true
    });
}
