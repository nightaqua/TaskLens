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
            app: unknown;
            constructor(app: unknown) {
                this.app = app;
            }
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
        MarkdownView: class {
            containerEl = { isShown: () => true };
            editor = { replaceSelection: () => {} };
            file = { path: '' };
        },
        Notice: class MockNotice {
            message: string;
            static instances: { message: string }[] = [];
            constructor(message: string) {
                this.message = message;
                MockNotice.instances.push(this);
            }
        },
        setIcon: vi.fn(),
        normalizePath: (p: string) => p.replace(/\\/g, '/').replace(/\/+/g, '/').trim()
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
            MarkdownView: class {
                containerEl = { isShown: () => true };
                editor = { replaceSelection: () => {} };
                file = { path: '' };
            },
            WorkspaceLeaf: class {},
            ViewStateResult: class {},
            setIcon: vi.fn()
        },
        writable: true
    });
}
