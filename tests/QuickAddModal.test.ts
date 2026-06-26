import { describe, it, expect, vi } from 'vitest';
import { resolveActiveMarkdownView, QuickAddModal } from '../src/modals/QuickAddModal';
import { MarkdownView, App } from 'obsidian';
import { TaskManager } from '../src/services/TaskManager';

interface QuickAddModalInternals {
    title: string;
    date: string;
    recurrence: string;
    selectedFile: string;
    handleSubmit(): Promise<void>;
}

describe('resolveActiveMarkdownView', () => {
    it('returns the result of getActiveViewOfType directly when it returns a non-null value', () => {
        const mockView = { id: 'active-view' };
        const mockApp = {
            workspace: {
                getActiveViewOfType: vi.fn().mockReturnValue(mockView),
                getLeavesOfType: vi.fn()
            }
        };
        const result = resolveActiveMarkdownView(mockApp as any);
        expect(result).toBe(mockView);
        expect(mockApp.workspace.getActiveViewOfType).toHaveBeenCalledWith(MarkdownView);
    });

    it('returns null when getActiveViewOfType returns null and getLeavesOfType returns an empty array', () => {
        const mockApp = {
            workspace: {
                getActiveViewOfType: vi.fn().mockReturnValue(null),
                getLeavesOfType: vi.fn().mockReturnValue([])
            }
        };
        const result = resolveActiveMarkdownView(mockApp as any);
        expect(result).toBeNull();
    });

    it('returns the view from the first visible markdown leaf when getActiveViewOfType returns null and a visible leaf exists', () => {
        const mockView1 = Object.assign(new MarkdownView(null as any), {
            containerEl: { isShown: () => false }
        });
        const mockView2 = Object.assign(new MarkdownView(null as any), {
            containerEl: { isShown: () => true }
        });
        const mockLeaf1 = { view: mockView1 };
        const mockLeaf2 = { view: mockView2 };

        const mockApp = {
            workspace: {
                getActiveViewOfType: vi.fn().mockReturnValue(null),
                getLeavesOfType: vi.fn().mockReturnValue([mockLeaf1, mockLeaf2])
            }
        };

        const result = resolveActiveMarkdownView(mockApp as any);
        expect(result).toBe(mockView2);
    });

    it('returns null when getActiveViewOfType returns null and all leaves have non-visible views', () => {
        const mockView1 = Object.assign(new MarkdownView(null as any), {
            containerEl: { isShown: () => false }
        });
        const mockLeaf1 = { view: mockView1 };

        const mockApp = {
            workspace: {
                getActiveViewOfType: vi.fn().mockReturnValue(null),
                getLeavesOfType: vi.fn().mockReturnValue([mockLeaf1])
            }
        };

        const result = resolveActiveMarkdownView(mockApp as any);
        expect(result).toBeNull();
    });
});

describe('QuickAddModal.handleSubmit — cursor fallback', () => {
    it('passes recurrence as the 4th argument to addTask when no active view exists', async () => {
        // No active view and no visible markdown leaves → activeViewAtOpen is null,
        // forcing handleSubmit() down the cursor-fallback branch.
        const mockApp = {
            workspace: {
                getActiveViewOfType: vi.fn().mockReturnValue(null),
                getLeavesOfType: vi.fn().mockReturnValue([])
            }
        };

        const addTask = vi.fn().mockResolvedValue(undefined);
        const taskManager = {
            getScannedFiles: vi.fn().mockReturnValue(['Notes.md']),
            addTask
        };

        const modal = new QuickAddModal(
            mockApp as unknown as App,
            taskManager as unknown as TaskManager
        );

        const internals = modal as unknown as QuickAddModalInternals;
        internals.title = 'Buy milk';
        internals.selectedFile = '__CURSOR__';
        internals.recurrence = 'weekly';

        await internals.handleSubmit();

        expect(addTask).toHaveBeenCalledWith('Buy milk', null, 'Notes.md', 'weekly');
        expect(addTask.mock.calls[0][3]).toBe('weekly');
    });
});
