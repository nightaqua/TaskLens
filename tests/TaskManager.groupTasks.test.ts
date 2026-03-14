import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskManager } from '../src/services/TaskManager';
import { TaskParser } from '../src/services/TaskParser';
import { App, TFile } from 'obsidian';
import { Task, TaskGroup } from '../src/models/Task';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const makeTask = (overrides: Partial<Task> & { id: string }): Task => ({
    title: 'Test task',
    completed: false,
    filePath: 'file.md',
    fileName: 'file',
    lineNumber: 0,
    originalText: '- [ ] Test task',
    ...overrides,
});

function makeManager(): TaskManager {
    const mockApp = {} as App;
    const mockParser = {} as TaskParser;
    return new TaskManager(mockParser, mockApp);
}

/** Access private method via casting */
function groupTasks(
    manager: TaskManager,
    tasks: Task[],
    allTasks?: Task[]
): TaskGroup[] {
    return (manager as unknown as {
        groupTasks: (t: Task[], all?: Task[]) => TaskGroup[];
    }).groupTasks(tasks, allTasks);
}

// ─────────────────────────────────────────────────────────────────────────────
// groupTasks
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskManager.groupTasks', () => {
    const manager = makeManager();

    it('wraps a single non-recurring task into its own group', () => {
        const task = makeTask({ id: 'file.md:1' });
        const groups = groupTasks(manager, [task]);
        expect(groups).toHaveLength(1);
        expect(groups[0].representative).toBe(task);
        expect(groups[0].openCount).toBe(1);
        expect(groups[0].doneCount).toBe(0);
        expect(groups[0].isRecurring).toBe(false);
    });

    it('collapses recurring clones into one group', () => {
        const recurrence = 'weekly';
        const clone1 = makeTask({ id: 'file.md:1', title: 'Water plants', recurrence, dueDate: new Date('2026-03-10T00:00:00') });
        const clone2 = makeTask({ id: 'file.md:2', title: 'Water plants', recurrence, dueDate: new Date('2026-03-17T00:00:00') });
        const groups = groupTasks(manager, [clone1, clone2]);
        expect(groups).toHaveLength(1);
        expect(groups[0].isRecurring).toBe(true);
        expect(groups[0].openCount).toBe(2);
        // Representative should be earliest-due open task
        expect(groups[0].representative.dueDate).toEqual(new Date('2026-03-10T00:00:00'));
    });

    it('picks completed task as representative when all clones are done', () => {
        const recurrence = 'daily';
        const done1 = makeTask({ id: 'file.md:1', title: 'Review notes', recurrence, completed: true, dueDate: new Date('2026-03-10T00:00:00') });
        const done2 = makeTask({ id: 'file.md:2', title: 'Review notes', recurrence, completed: true, dueDate: new Date('2026-03-11T00:00:00') });
        const groups = groupTasks(manager, [done1, done2]);
        expect(groups).toHaveLength(1);
        expect(groups[0].openCount).toBe(0);
        // Representative comes from the done pool — just verify it's one of them
        expect([done1, done2]).toContain(groups[0].representative);
    });

    it('counts completed cycles from allTasks even when filtered tasks exclude them', () => {
        const recurrence = 'daily';
        const open = makeTask({ id: 'file.md:1', title: 'Run', recurrence, dueDate: new Date('2026-03-14T00:00:00') });
        const done = makeTask({ id: 'file.md:0', title: 'Run', recurrence, completed: true, dueDate: new Date('2026-03-13T00:00:00') });

        // Pass only the open task as visible, but all tasks for cycle count
        const groups = groupTasks(manager, [open], [open, done]);
        expect(groups[0].openCount).toBe(1);
        expect(groups[0].doneCount).toBe(1);
    });

    it('preserves insertion order of groups', () => {
        const taskA = makeTask({ id: 'file.md:1', title: 'Task A' });
        const taskB = makeTask({ id: 'file.md:2', title: 'Task B' });
        const taskC = makeTask({ id: 'file.md:3', title: 'Task C' });
        const groups = groupTasks(manager, [taskA, taskB, taskC]);
        expect(groups.map(g => g.representative.title)).toEqual(['Task A', 'Task B', 'Task C']);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildClonedLine
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskManager.buildClonedLine', () => {
    const manager = makeManager();

    function buildClonedLine(originalLine: string, task: Task, completionDate: Date): string {
        return (manager as unknown as {
            buildClonedLine: (l: string, t: Task, d: Date) => string;
        }).buildClonedLine(originalLine, task, completionDate);
    }

    it('advances the due date for a recurring task', () => {
        const task = makeTask({
            id: 'file.md:1',
            recurrence: 'weekly',
            dueDate: new Date('2026-03-10T00:00:00'),
        });
        const line = '- [x] Test task [due:: 2026-03-10] [repeat:: weekly]';
        const clone = buildClonedLine(line, task, new Date('2026-03-10T00:00:00'));
        expect(clone).toContain('2026-03-17');
        expect(clone).toContain('[ ]');
        expect(clone).not.toContain('[x]');
    });

    it('strips the completion metadata from the cloned line', () => {
        const task = makeTask({
            id: 'file.md:1',
            recurrence: 'daily',
            dueDate: new Date('2026-03-10T00:00:00'),
        });
        const line = '- [x] Test task [due:: 2026-03-10] [completion:: 10-03-2026 09:00] [repeat:: daily]';
        const clone = buildClonedLine(line, task, new Date('2026-03-10T00:00:00'));
        expect(clone).not.toContain('completion::');
    });

    it('preserves start:: window when both dates are present', () => {
        const task = makeTask({
            id: 'file.md:1',
            recurrence: 'weekly',
            startDate: new Date('2026-03-07T00:00:00'),
            dueDate:   new Date('2026-03-10T00:00:00'),
        });
        const line = '- [x] Task [start:: 2026-03-07] [due:: 2026-03-10] [repeat:: weekly]';
        const clone = buildClonedLine(line, task, new Date('2026-03-10T00:00:00'));
        // 3-day window preserved: start should be 3 days before the new due (2026-03-17)
        expect(clone).toContain('2026-03-14'); // new start
        expect(clone).toContain('2026-03-17'); // new due
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateTaskStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskManager.updateTaskStatus', () => {
    let manager: TaskManager;
    let mockFile: TFile;

    beforeEach(() => {
        mockFile = Object.create(TFile.prototype);
        mockFile.path = 'test.md';

        const content = '- [ ] My task [due:: 2026-03-10]\n';
        const mockApp = {
            vault: {
                getAbstractFileByPath: vi.fn().mockReturnValue(mockFile),
                read: vi.fn().mockResolvedValue(content),
                modify: vi.fn().mockResolvedValue(undefined),
            },
        } as unknown as App;
        const mockParser = {
            getTasksFromFile: vi.fn().mockResolvedValue([]),
        } as unknown as TaskParser;
        manager = new TaskManager(mockParser, mockApp);
    });

    it('calls toggleTaskCompletion when dropping on Completed column', async () => {
        const toggleSpy = vi.spyOn(manager, 'toggleTaskCompletion').mockResolvedValue();
        const task = makeTask({ id: 'test.md:0', completed: false, dueDate: new Date('2026-03-10T00:00:00') });

        await manager.updateTaskStatus(task, 'completed' as import('../src/models/Task').TaskStatus);
        expect(toggleSpy).toHaveBeenCalledWith(task);
    });

    it('does NOT call toggleTaskCompletion when task is already completed and dropped on Completed', async () => {
        const toggleSpy = vi.spyOn(manager, 'toggleTaskCompletion').mockResolvedValue();
        const task = makeTask({ id: 'test.md:0', completed: true, dueDate: new Date('2026-03-10T00:00:00') });

        await manager.updateTaskStatus(task, 'completed' as import('../src/models/Task').TaskStatus);
        expect(toggleSpy).not.toHaveBeenCalled();
    });
});
