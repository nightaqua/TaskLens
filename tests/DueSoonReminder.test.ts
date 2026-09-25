import { App } from 'obsidian';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Task } from '../src/models/Task';
import { TaskParser } from '../src/services/TaskParser';
import { SemesterSettings } from '../src/settings/Settings';
import { computeDueSoonNotice } from '../src/views/DashboardView';

describe('TaskParser reminder field (⏰, obsidian-reminder plugin)', () => {
    const parser = new TaskParser({} as unknown as App, {} as unknown as SemesterSettings);
    const parseTaskMetadata = ((parser as unknown) as Record<string, (...args: unknown[]) => unknown>)['parseTaskMetadata'].bind(parser) as
        (taskText: string) => { title: string; reminderDate?: Date; dueDate?: Date };

    it('parses a bare ⏰ YYYY-MM-DD HH:mm field and strips it from the title', () => {
        const result = parseTaskMetadata('Submit report \u{23F0} 2026-07-08 09:00');
        expect(result.reminderDate).toBeInstanceOf(Date);
        expect(result.reminderDate?.getFullYear()).toBe(2026);
        expect(result.reminderDate?.getMonth()).toBe(6); // 0-indexed: July
        expect(result.reminderDate?.getDate()).toBe(8);
        expect(result.title).toBe('Submit report');
    });

    it('parses ⏰ without a time suffix', () => {
        const result = parseTaskMetadata('Water plants \u{23F0} 2026-03-01');
        expect(result.reminderDate?.getDate()).toBe(1);
        expect(result.title).toBe('Water plants');
    });

    it('accepts dd-mm-yyyy like the other date fields', () => {
        const result = parseTaskMetadata('Call dentist \u{23F0} 08-07-2026 09:00');
        expect(result.reminderDate?.getFullYear()).toBe(2026);
        expect(result.reminderDate?.getMonth()).toBe(6);
        expect(result.reminderDate?.getDate()).toBe(8);
        expect(result.title).toBe('Call dentist');
    });

    it('does not interfere with a separate 📅 due-date field', () => {
        const result = parseTaskMetadata('Submit report \u{23F0} 2026-07-08 09:00 \u{1F4C5} 2026-07-08');
        expect(result.reminderDate?.getDate()).toBe(8);
        expect(result.dueDate?.getDate()).toBe(8);
        expect(result.title).toBe('Submit report');
    });

    it('leaves a bare ⏰ with no following date untouched', () => {
        const result = parseTaskMetadata('Set an alarm \u{23F0}');
        expect(result.reminderDate).toBeUndefined();
        expect(result.title).toBe('Set an alarm \u{23F0}');
    });

    it('is undefined when no reminder field is present', () => {
        const result = parseTaskMetadata('Plain task');
        expect(result.reminderDate).toBeUndefined();
    });
});

function makeTask(overrides: Partial<Task>): Task {
    return {
        id: overrides.id ?? 'file.md:1',
        title: 'Test task',
        completed: false,
        filePath: 'file.md',
        fileName: 'file',
        lineNumber: 1,
        originalText: '- [ ] Test task',
        ...overrides,
    };
}

describe('computeDueSoonNotice', () => {
    const now = new Date('2026-07-08T12:00:00');

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns null when there are no tasks', () => {
        expect(computeDueSoonNotice([], new Set(), now)).toBeNull();
    });

    it('returns null when nothing is due today or overdue', () => {
        const tasks = [makeTask({ id: 't1', dueDate: new Date('2026-07-15T00:00:00') })];
        expect(computeDueSoonNotice(tasks, new Set(), now)).toBeNull();
    });

    it('ignores completed tasks even if overdue', () => {
        const tasks = [makeTask({ id: 't1', completed: true, dueDate: new Date('2026-07-01T00:00:00') })];
        expect(computeDueSoonNotice(tasks, new Set(), now)).toBeNull();
    });

    it('ignores tasks with no due date', () => {
        const tasks = [makeTask({ id: 't1' })];
        expect(computeDueSoonNotice(tasks, new Set(), now)).toBeNull();
    });

    it('reports a single overdue task', () => {
        const tasks = [makeTask({ id: 't1', dueDate: new Date('2026-07-01T00:00:00') })];
        const result = computeDueSoonNotice(tasks, new Set(), now);
        expect(result).not.toBeNull();
        expect(result?.message).toBe('TaskLens: 1 overdue');
        expect(result?.newIds).toEqual(['t1']);
    });

    it('reports a single due-today task', () => {
        const tasks = [makeTask({ id: 't1', dueDate: new Date('2026-07-08T00:00:00') })];
        const result = computeDueSoonNotice(tasks, new Set(), now);
        expect(result?.message).toBe('TaskLens: 1 due today');
    });

    it('combines overdue and due-today counts in one message', () => {
        const tasks = [
            makeTask({ id: 't1', dueDate: new Date('2026-07-01T00:00:00') }),
            makeTask({ id: 't2', dueDate: new Date('2026-07-08T00:00:00') }),
            makeTask({ id: 't3', dueDate: new Date('2026-07-08T00:00:00') }),
        ];
        const result = computeDueSoonNotice(tasks, new Set(), now);
        expect(result?.message).toBe('TaskLens: 1 overdue, 2 due today');
        expect(result?.newIds.sort()).toEqual(['t1', 't2', 't3']);
    });

    it('excludes tasks already in the notified set', () => {
        const tasks = [
            makeTask({ id: 't1', dueDate: new Date('2026-07-01T00:00:00') }),
            makeTask({ id: 't2', dueDate: new Date('2026-07-08T00:00:00') }),
        ];
        const result = computeDueSoonNotice(tasks, new Set(['t1']), now);
        expect(result?.message).toBe('TaskLens: 1 due today');
        expect(result?.newIds).toEqual(['t2']);
    });

    it('returns null once every due/overdue task has already been notified', () => {
        const tasks = [makeTask({ id: 't1', dueDate: new Date('2026-07-01T00:00:00') })];
        expect(computeDueSoonNotice(tasks, new Set(['t1']), now)).toBeNull();
    });

    it('ignores time-of-day on the due date (only the calendar day matters)', () => {
        const tasks = [makeTask({ id: 't1', dueDate: new Date('2026-07-08T23:59:00') })];
        const result = computeDueSoonNotice(tasks, new Set(), now);
        expect(result?.message).toBe('TaskLens: 1 due today');
    });
});
