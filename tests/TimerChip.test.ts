import { describe, it, expect } from 'vitest';
import { Task } from '../src/models/Task';
import { formatTimerDuration, formatTimerChip } from '../src/views/TaskListComponent';

function makeTask(overrides: Partial<Task>): Task {
    return {
        id: 't:0',
        title: 'Task',
        completed: false,
        filePath: 'Notes.md',
        fileName: 'Notes',
        lineNumber: 0,
        originalText: '- [ ] Task',
        ...overrides,
    };
}

describe('formatTimerDuration', () => {
    it('shows days and hours when at least a day remains', () => {
        const ms = (2 * 24 + 3) * 3600000;
        expect(formatTimerDuration(ms)).toBe('2d 3h');
    });

    it('shows hours and minutes under a day', () => {
        const ms = (3 * 3600 + 12 * 60) * 1000;
        expect(formatTimerDuration(ms)).toBe('3h 12m');
    });

    it('shows minutes and seconds under an hour', () => {
        expect(formatTimerDuration((5 * 60 + 20) * 1000)).toBe('5m 20s');
    });

    it('shows seconds under a minute', () => {
        expect(formatTimerDuration(12000)).toBe('12s');
    });

    it('clamps negative input to zero', () => {
        expect(formatTimerDuration(-5000)).toBe('0s');
    });
});

describe('formatTimerChip countdown', () => {
    const now = new Date('2024-05-10T12:00:00').getTime();

    it('returns null without a due date', () => {
        expect(formatTimerChip(makeTask({}), 'countdown', now)).toBeNull();
    });

    it('is green when more than three days remain', () => {
        const task = makeTask({ dueDate: new Date('2024-05-15T12:00:00') });
        const result = formatTimerChip(task, 'countdown', now);
        expect(result?.state).toBe('is-green');
    });

    it('is yellow between one and three days', () => {
        const task = makeTask({ dueDate: new Date('2024-05-12T12:00:00') });
        expect(formatTimerChip(task, 'countdown', now)?.state).toBe('is-yellow');
    });

    it('is orange within a day', () => {
        const task = makeTask({ dueDate: new Date('2024-05-10T20:00:00') });
        expect(formatTimerChip(task, 'countdown', now)?.state).toBe('is-orange');
    });

    it('is red and reads Overdue when past due', () => {
        const task = makeTask({ dueDate: new Date('2024-05-09T12:00:00') });
        const result = formatTimerChip(task, 'countdown', now);
        expect(result?.state).toBe('is-red');
        expect(result?.text).toBe('Overdue');
    });
});

describe('formatTimerChip elapsed', () => {
    const now = new Date('2024-05-10T12:00:00').getTime();

    it('returns null without a start date', () => {
        expect(formatTimerChip(makeTask({}), 'elapsed', now)).toBeNull();
    });

    it('appends " ago" and is green within a day', () => {
        const task = makeTask({ startDate: new Date('2024-05-10T06:00:00') });
        const result = formatTimerChip(task, 'elapsed', now);
        expect(result?.state).toBe('is-green');
        expect(result?.text.endsWith(' ago')).toBe(true);
    });

    it('is red after a week', () => {
        const task = makeTask({ startDate: new Date('2024-05-01T12:00:00') });
        expect(formatTimerChip(task, 'elapsed', now)?.state).toBe('is-red');
    });
});
