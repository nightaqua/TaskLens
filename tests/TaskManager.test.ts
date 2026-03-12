import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskManager } from '../src/services/TaskManager';
import { TaskParser } from '../src/services/TaskParser';
import { App, TFile } from 'obsidian';
import { Task } from '../src/models/Task';

describe('TaskManager - calculateNextDueDate via toggleTaskCompletion', () => {
    let mockApp: unknown;
    let mockVault: unknown;
    let mockParser: unknown;
    let taskManager: TaskManager;
    let writtenFileContent: string;

    beforeEach(() => {
        vi.useFakeTimers();

        writtenFileContent = '';

        mockVault = {
            getAbstractFileByPath: vi.fn(),
            read: vi.fn(),
            modify: vi.fn().mockImplementation((file: unknown, content: string) => {
                writtenFileContent = content;
                return Promise.resolve();
            })
        };

        mockApp = {
            vault: mockVault
        } as unknown as App;

        mockParser = {
            getTasksFromFile: vi.fn().mockResolvedValue([])
        } as unknown as TaskParser;

        taskManager = new TaskManager(mockParser as TaskParser, mockApp as App);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // Helper to setup the mock vault and task object
    const setupTask = (
        originalLine: string,
        recurrence: string | undefined,
        dueDate: Date | null,
        completionDate: Date
    ) => {
        const file = new TFile();
        Object.defineProperty(file, 'path', { value: 'test.md', writable: true });

        if (mockVault && typeof mockVault === 'object') {
            const vault = mockVault as Record<string, unknown>;
            if (typeof vault.getAbstractFileByPath === 'function') {
                vault.getAbstractFileByPath = vi.fn().mockReturnValue(file);
            }
            if (typeof vault.read === 'function') {
                vault.read = vi.fn().mockResolvedValue(originalLine);
            }
        }

        // We fake the current time so that completionDate matches our expectations
        vi.setSystemTime(completionDate);

        const task: Task = {
            id: '1',
            title: 'Test task',
            completed: false,
            filePath: 'test.md',
            fileName: 'test',
            lineNumber: 0,
            dueDate: dueDate || undefined,
            completionDate: null,
            recurrence: recurrence,
            originalText: originalLine
        };

        return task;
    };

    describe('Strict Recurrence (from dueDate)', () => {
        it('calculates daily recurrence correctly', async () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');
            const originalLine = '- [ ] Test task [due:: 2026-03-10]';

            const task = setupTask(originalLine, 'daily', dueDate, completionDate);
            await taskManager.toggleTaskCompletion(task);

            expect(writtenFileContent).toContain('[due:: 2026-03-11]');
        });

        it('calculates daily shorthand correctly', async () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');
            const originalLine = '- [ ] Test task [due:: 2026-03-10]';

            const task = setupTask(originalLine, 'd', dueDate, completionDate);
            await taskManager.toggleTaskCompletion(task);

            expect(writtenFileContent).toContain('[due:: 2026-03-11]');
        });

        it('calculates n-days recurrence correctly', async () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');
            const originalLine = '- [ ] Test task [due:: 2026-03-10]';

            const task = setupTask(originalLine, '3d', dueDate, completionDate);
            await taskManager.toggleTaskCompletion(task);

            expect(writtenFileContent).toContain('[due:: 2026-03-13]');
        });

        it('calculates weekly recurrence correctly', async () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');
            const originalLine = '- [ ] Test task [due:: 2026-03-10]';

            const task = setupTask(originalLine, 'weekly', dueDate, completionDate);
            await taskManager.toggleTaskCompletion(task);

            expect(writtenFileContent).toContain('[due:: 2026-03-17]');
        });

        it('calculates n-weeks recurrence correctly', async () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');
            const originalLine = '- [ ] Test task [due:: 2026-03-10]';

            const task = setupTask(originalLine, '2w', dueDate, completionDate);
            await taskManager.toggleTaskCompletion(task);

            expect(writtenFileContent).toContain('[due:: 2026-03-24]');
        });

        it('calculates monthly recurrence correctly', async () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');
            const originalLine = '- [ ] Test task [due:: 2026-03-10]';

            const task = setupTask(originalLine, 'monthly', dueDate, completionDate);
            await taskManager.toggleTaskCompletion(task);

            expect(writtenFileContent).toContain('[due:: 2026-04-10]');
        });

        it('handles end-of-month rollover (31st to month with 30 days)', async () => {
            const dueDate = new Date('2026-01-31T00:00:00');
            const completionDate = new Date('2026-02-01T00:00:00');
            const originalLine = '- [ ] Test task [due:: 2026-01-31]';

            const task = setupTask(originalLine, 'monthly', dueDate, completionDate);
            await taskManager.toggleTaskCompletion(task);

            expect(writtenFileContent).toContain('[due:: 2026-02-28]');
        });

        it('handles end-of-month rollover to leap year February', async () => {
            const dueDate = new Date('2024-01-31T00:00:00');
            const completionDate = new Date('2024-02-01T00:00:00');
            const originalLine = '- [ ] Test task [due:: 2024-01-31]';

            const task = setupTask(originalLine, 'monthly', dueDate, completionDate);
            await taskManager.toggleTaskCompletion(task);

            expect(writtenFileContent).toContain('[due:: 2024-02-29]');
        });

        it('calculates yearly recurrence correctly', async () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');
            const originalLine = '- [ ] Test task [due:: 2026-03-10]';

            const task = setupTask(originalLine, 'yearly', dueDate, completionDate);
            await taskManager.toggleTaskCompletion(task);

            expect(writtenFileContent).toContain('[due:: 2027-03-10]');
        });

        it('handles leap year to non-leap year yearly rollover', async () => {
            const dueDate = new Date('2024-02-29T00:00:00');
            const completionDate = new Date('2024-03-01T00:00:00');
            const originalLine = '- [ ] Test task [due:: 2024-02-29]';

            const task = setupTask(originalLine, 'yearly', dueDate, completionDate);
            await taskManager.toggleTaskCompletion(task);

            expect(writtenFileContent).toContain('[due:: 2025-02-28]');
        });
    });

    describe('Flexible Recurrence (+) (from completionDate)', () => {
        it('calculates flexible daily recurrence from completion date', async () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00'); // Late by 2 days
            const originalLine = '- [ ] Test task [due:: 2026-03-10]';

            const task = setupTask(originalLine, 'daily+', dueDate, completionDate);
            await taskManager.toggleTaskCompletion(task);

            expect(writtenFileContent).toContain('[due:: 2026-03-13]');
        });

        it('calculates flexible n-weeks recurrence from completion date', async () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');
            const originalLine = '- [ ] Test task [due:: 2026-03-10]';

            const task = setupTask(originalLine, '2w+', dueDate, completionDate);
            await taskManager.toggleTaskCompletion(task);

            expect(writtenFileContent).toContain('[due:: 2026-03-26]');
        });
    });

    describe('Missing dueDate fallback', () => {
        it('uses completion date when no due date is provided, even without +', async () => {
            const dueDate = null;
            const completionDate = new Date('2026-03-12T00:00:00');
            const originalLine = '- [ ] Test task [start:: 2026-03-12]';

            const task = setupTask(originalLine, 'daily', dueDate, completionDate);
            task.startDate = new Date('2026-03-12T00:00:00'); // set start date since due date is null
            await taskManager.toggleTaskCompletion(task);

            // Since there's no due date but there is a start date, it will clone the line with advanced start date
            expect(writtenFileContent).toContain('[start:: 2026-03-13]');
        });
    });

    describe('Invalid recurrence rule', () => {
        it('defaults to 1 day for unknown rules', async () => {
            const dueDate = new Date('2026-03-10T00:00:00');
            const completionDate = new Date('2026-03-12T00:00:00');
            const originalLine = '- [ ] Test task [due:: 2026-03-10]';

            // "xyz" is an invalid rule, so it falls back to unit 'd' and amount 1
            const task = setupTask(originalLine, 'xyz', dueDate, completionDate);
            await taskManager.toggleTaskCompletion(task);

            expect(writtenFileContent).toContain('[due:: 2026-03-11]');
        });
    });
});
