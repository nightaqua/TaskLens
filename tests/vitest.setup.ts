import { vi } from 'vitest';
vi.mock('obsidian', () => ({
  App: class {
    private readonly dummy = 'dummy';
  },
  TFile: class {
    private readonly dummy = 'dummy';
  },
  Events: class {
    on = vi.fn();
    off = vi.fn();
    trigger = vi.fn();
  },
}));
