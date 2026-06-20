import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager } from '../src/services/TaskManager';
import { TaskParser } from '../src/services/TaskParser';
import { App } from 'obsidian';
import { Task, TaskStatus } from '../src/models/Task';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeManager(tasks: Task[] = []): TaskManager {
    const mockApp = {} as App;
    const mockParser = {} as TaskParser;
    const manager = new TaskManager(mockParser, mockApp);
    // Directly inject tasks into private state
    (manager as unknown as { tasks: Task[] }).tasks = tasks;
    (manager as unknown as { filteredTasks: Task[] }).filteredTasks = [...tasks];
    return manager;
}

const today = new Date();
today.setHours(0, 0, 0, 0);

const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);

const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);

const nextWeek = new Date(today);
nextWeek.setDate(today.getDate() + 10);

const makeTask = (overrides: Partial<Task> & { id: string }): Task => ({
    title: 'Task',
    completed: false,
    filePath: 'file.md',
    fileName: 'Test',
    lineNumber: 0,
    originalText: '',
    ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// applyFiltersAndSort (private, tested via setStatusFilter)
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskManager.applyFiltersAndSort', () => {
    let overdueTask: Task;
    let urgentTask: Task;
    let upcomingTask: Task;
    let noDateTask: Task;
    let completedTask: Task;

    beforeEach(() => {
        overdueTask  = makeTask({ id: '1', title: 'Overdue',   dueDate: yesterday });
        urgentTask   = makeTask({ id: '2', title: 'Urgent',    dueDate: tomorrow });
        upcomingTask = makeTask({ id: '3', title: 'Upcoming',  dueDate: nextWeek });
        noDateTask   = makeTask({ id: '4', title: 'NoDate' });
        completedTask = makeTask({ id: '5', title: 'Done', completed: true });
    });

    it('Open filter excludes completed tasks', () => {
        const manager = makeManager([overdueTask, completedTask]);
        manager.setStatusFilter(TaskStatus.Open);
        const filtered = manager.getGroupedFilteredTasks();
        const titles = filtered.map(g => g.representative.title);
        expect(titles).toContain('Overdue');
        expect(titles).not.toContain('Done');
    });

    it('All filter includes completed tasks', () => {
        const manager = makeManager([overdueTask, completedTask]);
        manager.setStatusFilter(TaskStatus.All);
        const filtered = manager.getGroupedFilteredTasks();
        const titles = filtered.map(g => g.representative.title);
        expect(titles).toContain('Overdue');
        expect(titles).toContain('Done');
    });

    it('Overdue filter returns only overdue tasks', () => {
        const manager = makeManager([overdueTask, urgentTask, upcomingTask]);
        manager.setStatusFilter(TaskStatus.Overdue);
        const filtered = manager.getGroupedFilteredTasks();
        expect(filtered).toHaveLength(1);
        expect(filtered[0].representative.title).toBe('Overdue');
    });

    it('sort order: Overdue < Urgent < Upcoming < NoDate < Completed', () => {
        const manager = makeManager([noDateTask, upcomingTask, completedTask, urgentTask, overdueTask]);
        manager.setStatusFilter(TaskStatus.All);
        const filtered = manager.getGroupedFilteredTasks();
        const titles = filtered.map(g => g.representative.title);
        const overdueIdx  = titles.indexOf('Overdue');
        const urgentIdx   = titles.indexOf('Urgent');
        const upcomingIdx = titles.indexOf('Upcoming');
        const noDateIdx   = titles.indexOf('NoDate');
        const doneIdx     = titles.indexOf('Done');
        expect(overdueIdx).toBeLessThan(urgentIdx);
        expect(urgentIdx).toBeLessThan(upcomingIdx);
        expect(upcomingIdx).toBeLessThan(noDateIdx);
        expect(noDateIdx).toBeLessThan(doneIdx);
    });

    it('course filter excludes tasks from other courses', () => {
        const mathTask    = makeTask({ id: '6', fileName: 'Math', title: 'Math task' });
        const physicsTask = makeTask({ id: '7', fileName: 'Physics', title: 'Physics task' });
        const manager = makeManager([mathTask, physicsTask]);
        manager.setStatusFilter(TaskStatus.Open);
        manager.setCourseFilter('Math');
        const filtered = manager.getGroupedFilteredTasks();
        expect(filtered).toHaveLength(1);
        expect(filtered[0].representative.title).toBe('Math task');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// getStatistics
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskManager.getStatistics', () => {
    it('counts tasks correctly by status', () => {
        const tasks: Task[] = [
            makeTask({ id: '1', dueDate: yesterday }),          // overdue
            makeTask({ id: '2', dueDate: tomorrow }),           // urgent
            makeTask({ id: '3', dueDate: nextWeek }),           // upcoming
            makeTask({ id: '4' }),                              // no-date
            makeTask({ id: '5', completed: true }),             // completed
        ];
        const manager = makeManager(tasks);
        const stats = manager.getStatistics();
        expect(stats.total).toBe(5);
        expect(stats.overdue).toBe(1);
        expect(stats.urgent).toBe(1);
        expect(stats.upcoming).toBe(1);
        expect(stats.completed).toBe(1);
    });

    it('returns cached result when task array reference is unchanged', () => {
        const manager = makeManager([makeTask({ id: '1' })]);
        const stats1 = manager.getStatistics();
        const stats2 = manager.getStatistics();
        expect(stats1).toBe(stats2); // same object reference = cache hit
    });

    it('velocity7Days counts tasks completed within last 7 days', () => {
        const recent = new Date();
        recent.setDate(recent.getDate() - 1); // yesterday

        const tasks: Task[] = [
            makeTask({ id: '1', completed: true, completionDate: recent }),
        ];
        const manager = makeManager(tasks);
        const stats = manager.getStatistics();
        // Index 5 = "1d ago", today is index 6
        const totalVelocity = stats.velocity7Days.reduce((a, b) => a + b, 0);
        expect(totalVelocity).toBe(1);
    });

    it('getCourseNames returns sorted unique course names', () => {
        const tasks: Task[] = [
            makeTask({ id: '1', fileName: 'Math' }),
            makeTask({ id: '2', fileName: 'Art' }),
            makeTask({ id: '3', fileName: 'Math' }),
        ];
        const manager = makeManager(tasks);
        expect(manager.getCourseNames()).toEqual(['Art', 'Math']);
    });
});
