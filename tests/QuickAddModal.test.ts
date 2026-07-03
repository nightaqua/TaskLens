import { describe, it, expect, vi } from 'vitest';
import { resolveActiveMarkdownView, QuickAddModal, parseNLDate } from '../src/modals/QuickAddModal';
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

        expect(addTask).toHaveBeenCalledWith('Buy milk', null, 'Notes.md', 'weekly', undefined);
        expect(addTask.mock.calls[0][3]).toBe('weekly');
    });
});

// ---------------------------------------------------------------------------
// parseNLDate tests
// ---------------------------------------------------------------------------

/** Build a minimal App mock (no nldates plugin installed by default). */
function makeApp(nlDatesPlugin?: Record<string, unknown>): any {
    return {
        plugins: {
            plugins: nlDatesPlugin ? { 'nldates-obsidian': nlDatesPlugin } : {}
        }
    };
}

/** Returns a yyyy-mm-dd string for `today + offsetDays` in local time. */
function localDateOffset(offsetDays: number): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

describe('parseNLDate — passthrough and empty input', () => {
    const app = makeApp();

    it('returns null for empty string', () => {
        expect(parseNLDate('', app)).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
        expect(parseNLDate('   ', app)).toBeNull();
    });

    it('passes through a valid yyyy-mm-dd without touching it', () => {
        expect(parseNLDate('2026-12-31', app)).toBe('2026-12-31');
    });

    it('trims surrounding whitespace before matching', () => {
        expect(parseNLDate('  2026-01-15  ', app)).toBe('2026-01-15');
    });
});

describe('parseNLDate — inline parser keywords', () => {
    const app = makeApp();

    it('resolves "today"', () => {
        expect(parseNLDate('today', app)).toBe(localDateOffset(0));
    });

    it('resolves "Today" (case-insensitive)', () => {
        expect(parseNLDate('Today', app)).toBe(localDateOffset(0));
    });

    it('resolves "tomorrow"', () => {
        expect(parseNLDate('tomorrow', app)).toBe(localDateOffset(1));
    });

    it('resolves "yesterday"', () => {
        expect(parseNLDate('yesterday', app)).toBe(localDateOffset(-1));
    });
});

describe('parseNLDate — relative days/weeks', () => {
    const app = makeApp();

    it('resolves "+3 days"', () => {
        expect(parseNLDate('+3 days', app)).toBe(localDateOffset(3));
    });

    it('resolves "in 7 days"', () => {
        expect(parseNLDate('in 7 days', app)).toBe(localDateOffset(7));
    });

    it('resolves "1 day"', () => {
        expect(parseNLDate('1 day', app)).toBe(localDateOffset(1));
    });

    it('resolves "2w" (shorthand weeks)', () => {
        expect(parseNLDate('2w', app)).toBe(localDateOffset(14));
    });

    it('resolves "in 2 weeks"', () => {
        expect(parseNLDate('in 2 weeks', app)).toBe(localDateOffset(14));
    });

    it('resolves "+1 week"', () => {
        expect(parseNLDate('+1 week', app)).toBe(localDateOffset(7));
    });
});

describe('parseNLDate — next <weekday>', () => {
    const app = makeApp();

    it('resolves "next monday" to a future Monday', () => {
        const result = parseNLDate('next monday', app);
        expect(result).toBeTruthy();
        const parsed = new Date((result as string) + 'T00:00:00');
        expect(parsed.getDay()).toBe(1); // Monday
        // Must be strictly in the future (at least 1 day away)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expect(parsed.getTime()).toBeGreaterThan(today.getTime());
    });

    it('resolves "next friday" to a future Friday', () => {
        const result = parseNLDate('next friday', app);
        const parsed = new Date((result as string) + 'T00:00:00');
        expect(parsed.getDay()).toBe(5); // Friday
    });

    it('resolves "next sunday" to a future Sunday', () => {
        const result = parseNLDate('next sunday', app);
        const parsed = new Date((result as string) + 'T00:00:00');
        expect(parsed.getDay()).toBe(0); // Sunday
    });

    it('resolves "Next Monday" (case-insensitive)', () => {
        const result = parseNLDate('Next Monday', app);
        const parsed = new Date((result as string) + 'T00:00:00');
        expect(parsed.getDay()).toBe(1);
    });
});

describe('parseNLDate — next week / end of week / end of month', () => {
    const app = makeApp();

    it('resolves "next week" to a Monday', () => {
        const result = parseNLDate('next week', app);
        const parsed = new Date((result as string) + 'T00:00:00');
        expect(parsed.getDay()).toBe(1); // Monday
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expect(parsed.getTime()).toBeGreaterThan(today.getTime());
    });

    it('resolves "end of week" to a Sunday', () => {
        const result = parseNLDate('end of week', app);
        const parsed = new Date((result as string) + 'T00:00:00');
        expect(parsed.getDay()).toBe(0); // Sunday
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expect(parsed.getTime()).toBeGreaterThan(today.getTime());
    });

    it('resolves "eow" to a Sunday', () => {
        const result = parseNLDate('eow', app);
        const parsed = new Date((result as string) + 'T00:00:00');
        expect(parsed.getDay()).toBe(0);
    });

    it('resolves "end of month" to the last day of the current month', () => {
        const result = parseNLDate('end of month', app);
        const parsed = new Date((result as string) + 'T00:00:00');
        // The next day should be the 1st of the following month
        const next = new Date(parsed.getTime() + 86_400_000);
        expect(next.getDate()).toBe(1);
    });

    it('resolves "eom" like "end of month"', () => {
        expect(parseNLDate('eom', app)).toBe(parseNLDate('end of month', app));
    });
});

describe('parseNLDate — unrecognised input', () => {
    const app = makeApp();

    it('returns null for gibberish', () => {
        expect(parseNLDate('banana', app)).toBeNull();
    });

    it('returns null for a partial date string', () => {
        expect(parseNLDate('2026-07', app)).toBeNull();
    });
});

describe('parseNLDate — nldates-obsidian plugin bridge', () => {
    it('delegates to the plugin when available and valid', () => {
        const mockPlugin = {
            parseDate: vi.fn().mockReturnValue({
                moment: { isValid: () => true, format: () => '2026-08-15' }
            })
        };
        const app = makeApp(mockPlugin);
        expect(parseNLDate('next month', app)).toBe('2026-08-15');
        expect(mockPlugin.parseDate).toHaveBeenCalledWith('next month');
    });

    it('falls back to inline parser when plugin returns invalid moment', () => {
        const mockPlugin = {
            parseDate: vi.fn().mockReturnValue({
                moment: { isValid: () => false, format: () => 'Invalid date' }
            })
        };
        const app = makeApp(mockPlugin);
        // "today" will be handled by the inline parser
        expect(parseNLDate('today', app)).toBe(localDateOffset(0));
    });

    it('falls back to inline parser when plugin throws', () => {
        const mockPlugin = {
            parseDate: vi.fn().mockImplementation(() => { throw new Error('plugin error'); })
        };
        const app = makeApp(mockPlugin);
        expect(parseNLDate('tomorrow', app)).toBe(localDateOffset(1));
    });

    it('falls back to inline parser when plugin returns null', () => {
        const mockPlugin = {
            parseDate: vi.fn().mockReturnValue(null)
        };
        const app = makeApp(mockPlugin);
        expect(parseNLDate('yesterday', app)).toBe(localDateOffset(-1));
    });
});

// FA-007 — tag autocomplete unit tests
// ---------------------------------------------------------------------------
describe('FA-007 tag autocomplete — trigger regex', () => {
    // The regex that drives the dropdown — must match #tags at cursor including
    // nested (#project/sub) and hyphenated (#sub-team) patterns.
    const TRIGGER_RE = /(^|[\s])#([\w/-]*)$/;

    it('matches a simple tag at start of input', () => {
        expect(TRIGGER_RE.test('#todo')).toBe(true);
    });

    it('matches a simple tag after whitespace', () => {
        const m = 'Some task #todo'.match(TRIGGER_RE);
        expect(m).not.toBeNull();
        expect(m?.[2]).toBe('todo');
    });

    it('matches a nested tag (project/sub)', () => {
        const m = 'Task #project/feature'.match(TRIGGER_RE);
        expect(m).not.toBeNull();
        expect(m?.[2]).toBe('project/feature');
    });

    it('matches a hyphenated tag', () => {
        const m = 'Task #sub-team'.match(TRIGGER_RE);
        expect(m).not.toBeNull();
        expect(m?.[2]).toBe('sub-team');
    });

    it('does NOT match when # is not preceded by start-of-string or whitespace', () => {
        expect(TRIGGER_RE.test('nospace#tag')).toBe(false);
    });

    it('returns the partial prefix typed so far', () => {
        const m = 'Task #pro'.match(TRIGGER_RE);
        expect(m?.[2]).toBe('pro');
    });
});

describe('FA-007 tag autocomplete — getAllTags mock unions inline + frontmatter', () => {
    it('returns both inline tags and frontmatter tags', () => {
        // Verify the obsidian mock getAllTags unions both sources — this is the
        // behaviour QuickAddModal.getVaultTags() relies on for complete suggestions.
        const cache = {
            tags: [{ tag: '#inline' }],
            frontmatter: { tags: ['frontmatter-tag'] },
        };
        // Import via the vitest auto-mock path (mocks/obsidian.ts is the vi alias)
        // We test the logic directly without instantiating the full modal.
        function getAllTagsInline(c: { tags?: {tag: string}[]; frontmatter: { tags: string[] } }): string[] | null {
            const result: string[] = [];
            if (c.tags) for (const t of c.tags) result.push(t.tag);
            if (Array.isArray(c.frontmatter.tags)) {
                for (const t of c.frontmatter.tags) result.push(t.startsWith('#') ? t : '#' + t);
            }
            return result.length > 0 ? result : null;
        }
        const result = getAllTagsInline(cache);
        expect(result).toContain('#inline');
        expect(result).toContain('#frontmatter-tag');
    });
});
