import { describe, it, expect, vi } from 'vitest';
import { resolveActiveMarkdownView } from '../src/modals/QuickAddModal';
import { MarkdownView } from 'obsidian';

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
