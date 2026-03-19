import { describe, it, expect, vi } from 'vitest';
import { TaskManager } from '../src/services/TaskManager';
import { TaskParser } from '../src/services/TaskParser';
import { App, TFile } from 'obsidian';
import { createMockFile } from './helpers';

describe('TaskManager', () => {
    // We can just cast empty objects since calculateNextDueDate doesn't use 'this'
    const mockApp = {} as App;
    const mockParser = {} as TaskParser;
    const taskManager = new TaskManager(mockParser, mockApp);

    describe('formatCompletionDate', () => {
        it('formats a standard date correctly', () => {
            const date = new Date('2024-05-15T14:30:00');
            expect(taskManager.formatCompletionDate(date)).toBe('15-05-2024 14:30');
        });

        it('pads single-digit days, months, hours, and minutes with zeros', () => {
            const date = new Date('2024-01-05T08:05:00');
            expect(taskManager.formatCompletionDate(date)).toBe('05-01-2024 08:05');
        });

        it('formats midnight correctly', () => {
            const date = new Date('2024-12-31T00:00:00');
            expect(taskManager.formatCompletionDate(date)).toBe('31-12-2024 00:00');
        });

        it('formats just before midnight correctly', () => {
            const date = new Date('2024-12-31T23:59:00');
            expect(taskManager.formatCompletionDate(date)).toBe('31-12-2024 23:59');
        });
    });

    describe('calculateNextDueDate', () => {
        describe('Strict Recurrence (from dueDate)', () => {
        it('calculates daily recurrence correctly', () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');

            const nextDate = taskManager.calculateNextDueDate(dueDate, 'daily', completionDate);
            expect(nextDate).toEqual(new Date('2026-03-11T00:00:00'));
        });

        it('calculates daily shorthand correctly', () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');

            const nextDate = taskManager.calculateNextDueDate(dueDate, 'd', completionDate);
            expect(nextDate).toEqual(new Date('2026-03-11T00:00:00'));
        });

        it('calculates n-days recurrence correctly', () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');

            const nextDate = taskManager.calculateNextDueDate(dueDate, '3d', completionDate);
            expect(nextDate).toEqual(new Date('2026-03-13T00:00:00'));
        });

        it('calculates weekly recurrence correctly', () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');

            const nextDate = taskManager.calculateNextDueDate(dueDate, 'weekly', completionDate);
            expect(nextDate).toEqual(new Date('2026-03-17T00:00:00'));
        });

        it('calculates n-weeks recurrence correctly', () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');

            const nextDate = taskManager.calculateNextDueDate(dueDate, '2w', completionDate);
            expect(nextDate).toEqual(new Date('2026-03-24T00:00:00'));
        });

        it('calculates monthly recurrence correctly', () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');

            const nextDate = taskManager.calculateNextDueDate(dueDate, 'monthly', completionDate);
            expect(nextDate).toEqual(new Date('2026-04-10T00:00:00'));
        });

        it('handles end-of-month rollover (31st to month with 30 days)', () => {
            const dueDate = new Date('2026-01-31T00:00:00');
            const completionDate = new Date('2026-02-01T00:00:00');

            const nextDate = taskManager.calculateNextDueDate(dueDate, 'monthly', completionDate);
            expect(nextDate).toEqual(new Date('2026-02-28T00:00:00')); // Feb has 28 in 2026
        });

        it('handles end-of-month rollover to leap year February', () => {
            const dueDate = new Date('2024-01-31T00:00:00'); // 2024 is leap year
            const completionDate = new Date('2024-02-01T00:00:00');

            const nextDate = taskManager.calculateNextDueDate(dueDate, 'monthly', completionDate);
            expect(nextDate).toEqual(new Date('2024-02-29T00:00:00'));
        });

        it('calculates yearly recurrence correctly', () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');

            const nextDate = taskManager.calculateNextDueDate(dueDate, 'yearly', completionDate);
            expect(nextDate).toEqual(new Date('2027-03-10T00:00:00'));
        });

        it('handles leap year to non-leap year yearly rollover', () => {
            const dueDate = new Date('2024-02-29T00:00:00');
            const completionDate = new Date('2024-03-01T00:00:00');

            const nextDate = taskManager.calculateNextDueDate(dueDate, 'yearly', completionDate);
            expect(nextDate).toEqual(new Date('2025-02-28T00:00:00'));
        });

        it('calculates 3m recurrence with end-of-month clamp (Jan 31 + 3 months = Apr 30)', () => {
            const dueDate = new Date('2026-01-31T00:00:00');
            const completionDate = new Date('2026-02-01T00:00:00');

            // Jan 31 + 3 months: day=31, advance to April, April has 30 days, clamp to 30
            const nextDate = taskManager.calculateNextDueDate(dueDate, '3m', completionDate);
            expect(nextDate).toEqual(new Date('2026-04-30T00:00:00'));
        });

        it('calculates 2y recurrence with end-of-month clamp (Feb 29 leap + 2 years = Feb 28 non-leap)', () => {
            const dueDate = new Date('2024-02-29T00:00:00');
            const completionDate = new Date('2024-03-01T00:00:00');

            // Feb 29 2024 + 2 years = 2026, which is non-leap, so clamp to Feb 28
            const nextDate = taskManager.calculateNextDueDate(dueDate, '2y', completionDate);
            expect(nextDate).toEqual(new Date('2026-02-28T00:00:00'));
        });
    });

    describe('Flexible Recurrence (+) (from completionDate)', () => {
        it('calculates flexible daily recurrence from completion date', () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00'); // Late by 2 days

            const nextDate = taskManager.calculateNextDueDate(dueDate, 'daily+', completionDate);
            expect(nextDate).toEqual(new Date('2026-03-13T00:00:00'));
        });

        it('calculates flexible n-weeks recurrence from completion date', () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');

            const nextDate = taskManager.calculateNextDueDate(dueDate, '2w+', completionDate);
            expect(nextDate).toEqual(new Date('2026-03-26T00:00:00'));
        });

        it('calculates monthly+ recurrence from completion date (not due date)', () => {
            const dueDate = new Date('2026-01-10T00:00:00');
            const completionDate = new Date('2026-01-25T00:00:00');

            // Flexible: base is completionDate Jan 25, +1 month = Feb 25
            const nextDate = taskManager.calculateNextDueDate(dueDate, 'monthly+', completionDate);
            expect(nextDate).toEqual(new Date('2026-02-25T00:00:00'));
        });

        it('calculates yearly+ recurrence from completion date (not due date)', () => {
            const dueDate = new Date('2026-01-10T00:00:00');
            const completionDate = new Date('2026-03-15T00:00:00');

            // Flexible: base is completionDate Mar 15 2026, +1 year = Mar 15 2027
            const nextDate = taskManager.calculateNextDueDate(dueDate, 'yearly+', completionDate);
            expect(nextDate).toEqual(new Date('2027-03-15T00:00:00'));
        });
    });

    describe('Missing dueDate fallback', () => {
        it('uses completion date when no due date is provided, even without +', () => {
            const dueDate = null;
            const completionDate = new Date('2026-03-12T00:00:00');

            const nextDate = taskManager.calculateNextDueDate(dueDate, 'daily', completionDate);
            expect(nextDate).toEqual(new Date('2026-03-13T00:00:00'));
        });
    });

        describe('Invalid recurrence rule', () => {
            it('defaults to 1 day for unknown rules', () => {
                const dueDate = new Date('2026-03-10T00:00:00');
                const completionDate = new Date('2026-03-12T00:00:00');

                // "xyz" is an invalid rule, so it falls back to unit 'd' and amount 1
                const nextDate = taskManager.calculateNextDueDate(dueDate, 'xyz', completionDate);
                expect(nextDate).toEqual(new Date('2026-03-11T00:00:00'));
            });
        });
    });

    describe('formatDisplayDate', () => {
        it('formats dates with double-digit day and month correctly', () => {
            const date = new Date('2024-12-25T00:00:00');
            expect(TaskManager.formatDisplayDate(date)).toBe('25-12-2024');
        });

        it('pads single-digit day correctly', () => {
            const date = new Date('2024-12-05T00:00:00');
            expect(TaskManager.formatDisplayDate(date)).toBe('05-12-2024');
        });

        it('pads single-digit month correctly', () => {
            const date = new Date('2024-05-25T00:00:00');
            expect(TaskManager.formatDisplayDate(date)).toBe('25-05-2024');
        });

        it('pads single-digit day and month correctly', () => {
            const date = new Date('2024-05-05T00:00:00');
            expect(TaskManager.formatDisplayDate(date)).toBe('05-05-2024');
        });

        it('handles different years correctly', () => {
            const date1 = new Date('1999-01-01T00:00:00');
            expect(TaskManager.formatDisplayDate(date1)).toBe('01-01-1999');

            const date2 = new Date('2100-01-01T00:00:00');
            expect(TaskManager.formatDisplayDate(date2)).toBe('01-01-2100');
        });

        it('ignores time components correctly', () => {
            const date = new Date('2024-05-15T14:30:45');
            expect(TaskManager.formatDisplayDate(date)).toBe('15-05-2024');
        });

        it('formats end of year correctly', () => {
            const date = new Date('2024-12-31T23:59:59');
            expect(TaskManager.formatDisplayDate(date)).toBe('31-12-2024');
        });

        it('formats leap year date correctly', () => {
            const date = new Date('2024-02-29T12:00:00');
            expect(TaskManager.formatDisplayDate(date)).toBe('29-02-2024');
    });
});

describe('TaskManager.processManualUpdate', () => {
    it('resets isInternalChange to false if parser.getTasksFromFile throws', async () => {
        const mockApp = {} as App;
        const mockParser = {
            getTasksFromFile: vi.fn().mockRejectedValue(new Error('Parser failed'))
        } as unknown as TaskParser;

        const taskManager = new TaskManager(mockParser, mockApp);
        const refreshSpy = vi.spyOn(taskManager, 'refreshFileTask').mockResolvedValue();

        const mockFile = Object.create(TFile.prototype);
        mockFile.path = 'test.md';

        await expect(taskManager.processManualUpdate(mockFile)).rejects.toThrow('Parser failed');

        expect((taskManager as unknown as { isInternalChange: boolean }).isInternalChange).toBe(false);
        expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('resets isInternalChange to false and calls refreshFileTask on success (no state change detected)', async () => {
        // Happy path: getTasksFromFile returns [] (no tasks), so no completion state
        // change is detected. The finally block resets isInternalChange, then
        // refreshFileTask is called at the bottom of processManualUpdate.
        const mockApp = {} as App;
        const mockParser = {
            getTasksFromFile: vi.fn().mockResolvedValue([])
        } as unknown as TaskParser;

        const taskManager = new TaskManager(mockParser, mockApp);
        const refreshSpy = vi.spyOn(taskManager, 'refreshFileTask').mockResolvedValue();

        const mockFile = Object.create(TFile.prototype);
        mockFile.path = 'test.md';

        await taskManager.processManualUpdate(mockFile);

        // After the call, the lock must be released
        expect((taskManager as unknown as { isInternalChange: boolean }).isInternalChange).toBe(false);
        // refreshFileTask is called once (at the end of processManualUpdate) because
        // no addCompletionMetadata / removeCompletionMetadata branch was taken
        expect(refreshSpy).toHaveBeenCalledOnce();
        expect(refreshSpy).toHaveBeenCalledWith('test.md');
    });
});

describe('TaskManager.updateTask', () => {
    it('strips due:: metadata explicitly when newDate is null', async () => {
        const mockApp = {
            vault: {
                getAbstractFileByPath: vi.fn().mockImplementation((path) => {
                    return createMockFile(path);
                }),
                read: vi.fn().mockResolvedValue('- [ ] Complete assignment [due:: 2026-03-15]'),
                modify: vi.fn().mockResolvedValue(undefined)
            }
        } as unknown as App;

        const mockParser = {} as TaskParser;
        const taskManager = new TaskManager(mockParser, mockApp);

        vi.spyOn(taskManager, 'refreshFileTask').mockResolvedValue(undefined);

        const task = {
            id: 'test.md:0',
            title: 'Complete assignment',
            completed: false,
            filePath: 'test.md',
            lineNumber: 0,
            originalText: '- [ ] Complete assignment [due:: 2026-03-15]'
        } as import('../src/models/Task').Task;

        await taskManager.updateTask(task, 'Complete assignment', null);

        const modifyCalls = (mockApp.vault.modify as import('vitest').Mock).mock.calls;
        expect(modifyCalls.length).toBe(1);
        expect(modifyCalls[0][1]).toBe('- [ ] Complete assignment');
    });

    it('updates both title and due date when a new Date is provided', async () => {
        const mockApp = {
            vault: {
                getAbstractFileByPath: vi.fn().mockImplementation((path) => {
                    return createMockFile(path);
                }),
                read: vi.fn().mockResolvedValue('- [ ] Old title [due:: 2026-03-15]'),
                modify: vi.fn().mockResolvedValue(undefined)
            }
        } as unknown as App;

        const mockParser = {} as TaskParser;
        const taskManager = new TaskManager(mockParser, mockApp);

        vi.spyOn(taskManager, 'refreshFileTask').mockResolvedValue(undefined);

        const task = {
            id: 'test.md:0',
            title: 'Old title',
            completed: false,
            filePath: 'test.md',
            lineNumber: 0,
            originalText: '- [ ] Old title [due:: 2026-03-15]'
        } as import('../src/models/Task').Task;

        await taskManager.updateTask(task, 'New title', new Date('2026-04-01T00:00:00'));

        const modifyCalls = (mockApp.vault.modify as import('vitest').Mock).mock.calls;
        expect(modifyCalls.length).toBe(1);
        const resultLine: string = modifyCalls[0][1];
        expect(resultLine).toContain('New title');
        expect(resultLine).toContain('[due:: 2026-04-01]');
    });

    it('preserves existing due date when newDate is undefined (title-only update)', async () => {
        // undefined means "leave the date as-is"; null means "remove the date".
        // The source checks `if (newDate)` for updating and `else if (newDate === null)`
        // for removal — undefined falls through both branches, so the due:: tag is kept.
        const mockApp = {
            vault: {
                getAbstractFileByPath: vi.fn().mockImplementation((path) => {
                    return createMockFile(path);
                }),
                read: vi.fn().mockResolvedValue('- [ ] Old title [due:: 2026-03-15]'),
                modify: vi.fn().mockResolvedValue(undefined)
            }
        } as unknown as App;

        const mockParser = {} as TaskParser;
        const taskManager = new TaskManager(mockParser, mockApp);

        vi.spyOn(taskManager, 'refreshFileTask').mockResolvedValue(undefined);

        const task = {
            id: 'test.md:0',
            title: 'Old title',
            completed: false,
            filePath: 'test.md',
            lineNumber: 0,
            originalText: '- [ ] Old title [due:: 2026-03-15]'
        } as import('../src/models/Task').Task;

        await taskManager.updateTask(task, 'New title', undefined);

        const modifyCalls = (mockApp.vault.modify as import('vitest').Mock).mock.calls;
        expect(modifyCalls.length).toBe(1);
        const resultLine: string = modifyCalls[0][1];
        expect(resultLine).toContain('New title');
        // Original due date must be preserved since undefined !== null
        expect(resultLine).toContain('[due:: 2026-03-15]');
    });
});

describe('TaskManager.getStatistics', () => {
    it('velocity7Days: task completed exactly 7 days ago is NOT included (boundary is exclusive)', () => {
        // The source checks: diffDays >= 0 && diffDays < 7
        // A task completed exactly 7 days ago has diffDays === 7, which fails diffDays < 7.
        // So it is NOT counted in the 7-day velocity window.
        const mockApp = {} as App;
        const mockParser = {} as TaskParser;
        const taskManager = new TaskManager(mockParser, mockApp);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // Inject a completed task with completionDate exactly 7 days ago
        (taskManager as unknown as { tasks: import('../src/models/Task').Task[] }).tasks = [
            {
                id: 'test.md:0',
                title: 'Old task',
                completed: true,
                completionDate: sevenDaysAgo,
                filePath: 'test.md',
                fileName: 'test',
                lineNumber: 0,
                originalText: '- [x] Old task'
            } as import('../src/models/Task').Task
        ];

        const stats = taskManager.getStatistics();
        const totalVelocity = stats.velocity7Days.reduce((sum, v) => sum + v, 0);

        // diffDays === 7 does NOT satisfy diffDays < 7, so the task is excluded
        expect(totalVelocity).toBe(0);
    });
});
});
