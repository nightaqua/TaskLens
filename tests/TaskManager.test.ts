import { describe, it, expect, vi } from 'vitest';
import { TaskManager } from '../src/services/TaskManager';
import { TaskParser } from '../src/services/TaskParser';
import { App, TFile } from 'obsidian';

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


});

describe('TaskManager.updateTask', () => {
    it('strips due:: metadata explicitly when newDate is null', async () => {
        const mockApp = {
            vault: {
                getAbstractFileByPath: vi.fn().mockImplementation((path: string): TFile => {
                    const file = Object.create(TFile.prototype);
                    file.path = path;
                    return file;
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
});
