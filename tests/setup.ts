import { vi } from 'vitest';

vi.mock('obsidian', () => {
    return {
        TFile: class {},
        Events: class {
            on() {}
            off() {}
            trigger() {}
        },
        App: class {}
    };
});
