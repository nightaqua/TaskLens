import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskManager } from '../src/services/TaskManager';
import { Task } from '../src/models/Task';
import { App, TFile } from 'obsidian';
import { TaskParser } from '../src/services/TaskParser';

describe('TaskManager - Recurring Task Cloning', () => {
    let mockApp: any;
    let mockParser: any;
    let manager: TaskManager;
    let mockFile: TFile;
    let fileContent: string;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T10:00:00'));

        mockFile = new TFile();
        mockFile.path = 'test.md';

        mockApp = {
            vault: {
                getAbstractFileByPath: vi.fn().mockReturnValue(mockFile),
                read: vi.fn().mockImplementation(() => Promise.resolve(fileContent)),
                modify: vi.fn().mockImplementation((file: TFile, content: string) => {
                    fileContent = content;
                    return Promise.resolve();
                })
            }
        };

        mockParser = {
            getTasksFromFile: vi.fn().mockResolvedValue([])
        };

        manager = new TaskManager(mockParser as unknown as TaskParser, mockApp as unknown as App);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const createDummyTask = (originalText: string, extraArgs: Partial<Task> = {}): Task => ({
        id: 'test:0',
        title: 'Test Task',
        completed: false,
        filePath: 'test.md',
        fileName: 'test',
        lineNumber: 0,
        originalText,
        ...extraArgs
    });

    it('should advance due date to next occurrence and reset checkbox', async () => {
        fileContent = '- [ ] Test Task [due:: 2024-01-01] [repeat:: daily]';
        const task = createDummyTask(fileContent, {
            dueDate: new Date('2024-01-01T00:00:00'),
            recurrence: 'daily'
        });

        await manager.toggleTaskCompletion(task);

        const lines = fileContent.split('\n');
        expect(lines[0]).toBe('- [x] Test Task [due:: 2024-01-01] [repeat:: daily] [completion:: 01-01-2024 10:00]');
        expect(lines[1]).toBe('- [ ] Test Task [due:: 2024-01-02] [repeat:: daily]');
    });

    it('should advance both start and due date, preserving the window', async () => {
        fileContent = '- [ ] Test Task [start:: 2023-12-30] [due:: 2024-01-01] [repeat:: daily]';
        const task = createDummyTask(fileContent, {
            startDate: new Date('2023-12-30T00:00:00'),
            dueDate: new Date('2024-01-01T00:00:00'),
            recurrence: 'daily'
        });

        await manager.toggleTaskCompletion(task);

        const lines = fileContent.split('\n');
        expect(lines[1]).toBe('- [ ] Test Task [start:: 2023-12-31] [due:: 2024-01-02] [repeat:: daily]');
    });

    it('should advance start date if only start date exists', async () => {
        fileContent = '- [ ] Test Task [start:: 2024-01-01] [repeat:: weekly]';
        const task = createDummyTask(fileContent, {
            startDate: new Date('2024-01-01T00:00:00'),
            recurrence: 'weekly'
        });

        await manager.toggleTaskCompletion(task);

        const lines = fileContent.split('\n');
        expect(lines[1]).toBe('- [ ] Test Task [start:: 2024-01-08] [repeat:: weekly]');
    });

    it('should handle missing dates gracefully (no dates cloned)', async () => {
        fileContent = '- [ ] Test Task [repeat:: daily]';
        const task = createDummyTask(fileContent, {
            recurrence: 'daily'
        });

        await manager.toggleTaskCompletion(task);

        const lines = fileContent.split('\n');
        expect(lines[1]).toBe('- [ ] Test Task [repeat:: daily]');
    });

    it('should strip completion metadata entirely', async () => {
        // Note: `toggleTaskCompletion` on an open task adds a new `[completion:: ...]` stamp
        // and then builds the clone using the *original line* before any edits.
        // We will mock `TaskManager.processManualUpdate` instead, which handles the case where
        // the user checks the box *and* there's pre-existing completion metadata.
        // Alternatively, if we call `toggleTaskCompletion` on a line with `[completion:: ]` already,
        // it just flips the box and skips cloning: `lines[task.lineNumber] = originalLine.replace(/\[ ]/, '[x]');`
        // Wait, to test `buildClonedLine` stripping, we can just use `manager.addCompletionMetadata(task)`
        // since it is public? No, `addCompletionMetadata` is private too!
        // But `toggleTaskCompletion` calls `buildClonedLine(originalLine, task, completionDate)`.
        // The `originalLine` comes from `fileContent`. So if we put some fake garbage metadata
        // like `✅ 2024-01-01` inside the `originalLine` and then call `toggleTaskCompletion`,
        // it will clone it and *should* strip it. Wait, `hasCompletionMetadata` checks for emoji too.
        // If `hasCompletionMetadata` is true, `toggleTaskCompletion` skips cloning!!
        // Ah! `toggleTaskCompletion` has this code:
        // `if (!hasCompletionMetadata(originalLine)) { ... clone ... } else { ... flip only ... }`
        // So `toggleTaskCompletion` NEVER clones if the original line has completion metadata.
        // Therefore, the only way a clone is generated where `stripCompletionMetadata` does something
        // inside `buildClonedLine` is when `buildClonedLine` is called from `addCompletionMetadata`.
        // `addCompletionMetadata` is called by `processManualUpdate`. Let's test via `processManualUpdate`!
        fileContent = '- [x] Test Task [due:: 2024-01-01] [repeat:: daily] ✅ 2024-01-01';

        const openTask = createDummyTask('- [ ] Test Task [due:: 2024-01-01] [repeat:: daily] ✅ 2024-01-01', {
            dueDate: new Date('2024-01-01T00:00:00'),
            recurrence: 'daily'
        });

        const completedTask = createDummyTask(fileContent, {
            dueDate: new Date('2024-01-01T00:00:00'),
            recurrence: 'daily',
            completed: true
        });

        // Set up the state BEFORE yielding
        (manager as any).tasks = [openTask];
        mockParser.getTasksFromFile.mockResolvedValue([completedTask]);

        // processManualUpdate will detect it went from open -> closed, and call addCompletionMetadata
        await manager.processManualUpdate(mockFile);

        const lines = fileContent.split('\n');
        // Line 0 becomes completed (with fresh stamp added because addCompletionMetadata strips the old ✅ first)
        expect(lines[0]).toBe('- [x] Test Task [due:: 2024-01-01] [repeat:: daily] [completion:: 01-01-2024 10:00]');
        // Line 1 is the clone. It should have the due date advanced and NO completion metadata.
        expect(lines[1]).toBe('- [ ] Test Task [due:: 2024-01-02] [repeat:: daily]');
    });

    it('should add repeat metadata if missing but task has recurrence', async () => {
        fileContent = '- [ ] Test Task [due:: 2024-01-01]';
        const task = createDummyTask(fileContent, {
            dueDate: new Date('2024-01-01T00:00:00'),
            recurrence: 'monthly'
        });

        await manager.toggleTaskCompletion(task);

        const lines = fileContent.split('\n');
        // The clone should have the monthly recurrence explicitly added
        expect(lines[1]).toBe('- [ ] Test Task [due:: 2024-02-01] [repeat:: monthly]');
    });

    it('should calculate base next date using completion date if rule has + suffix', async () => {
        // Late completion scenario
        vi.setSystemTime(new Date('2024-01-05T10:00:00'));
        fileContent = '- [ ] Test Task [due:: 2024-01-01] [repeat:: daily+]';
        const task = createDummyTask(fileContent, {
            dueDate: new Date('2024-01-01T00:00:00'),
            recurrence: 'daily+'
        });

        await manager.toggleTaskCompletion(task);

        const lines = fileContent.split('\n');
        // Because of +, it should clone to completion + 1 day = 01-06
        expect(lines[1]).toBe('- [ ] Test Task [due:: 2024-01-06] [repeat:: daily+]');
    });

    it('should not clone if an open clone already exists on the next line', async () => {
        fileContent = '- [ ] Test Task [due:: 2024-01-01] [repeat:: daily]\n- [ ] Test Task [due:: 2024-01-02] [repeat:: daily]';
        const task = createDummyTask('- [ ] Test Task [due:: 2024-01-01] [repeat:: daily]', {
            dueDate: new Date('2024-01-01T00:00:00'),
            recurrence: 'daily',
            lineNumber: 0
        });

        await manager.toggleTaskCompletion(task);

        const lines = fileContent.split('\n');
        // File should still have exactly 2 lines
        expect(lines.length).toBe(2);
        // Original line is completed
        expect(lines[0]).toContain('- [x]');
        // Clone is not added again
        expect(lines[1]).toBe('- [ ] Test Task [due:: 2024-01-02] [repeat:: daily]');
    });
});
