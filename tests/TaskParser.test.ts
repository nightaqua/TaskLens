import { App } from 'obsidian';
import { describe, it, expect } from 'vitest';
import { SemesterSettings } from '../src/settings/Settings';
import { TaskParser } from '../src/services/TaskParser';

describe('TaskParser.parseTaskMetadata', () => {
    // Create a dummy instance. Since parseTaskMetadata doesn't use `this.app` or `this.settings`,
    // we can pass null or empty objects casted to unknown.
    const parser = new TaskParser({} as unknown as App, {} as unknown as SemesterSettings);
    const parseTaskMetadata = ((parser as unknown) as Record<string, (...args: unknown[]) => unknown>)['parseTaskMetadata'].bind(parser) as (taskText: string) => { title: string; startDate?: Date; dueDate?: Date; completionDate?: Date; recurrence?: string; notes?: string };

    const getLocalMidnight = (dateStr: string) => new Date(`${dateStr}T00:00:00`);

    it('should parse basic text without dates', () => {
        const result = parseTaskMetadata('This is a simple task');
        expect(result.title).toBe('This is a simple task');
        expect(result.startDate).toBeUndefined();
        expect(result.dueDate).toBeUndefined();
        expect(result.completionDate).toBeUndefined();
        expect(result.recurrence).toBeUndefined();
        expect(result.notes).toBeUndefined();
    });

    it('should parse start date in yyyy-mm-dd format', () => {
        const result = parseTaskMetadata('Task with start date [start:: 2024-05-10]');
        expect(result.title).toBe('Task with start date');
        expect(result.startDate).toEqual(getLocalMidnight('2024-05-10'));
    });

    it('should parse start date in dd-mm-yyyy format', () => {
        const result = parseTaskMetadata('Task with start date (start:: 15-08-2023)');
        expect(result.title).toBe('Task with start date');
        expect(result.startDate).toEqual(getLocalMidnight('2023-08-15'));
    });

    it('should parse due date in yyyy-mm-dd format', () => {
        const result = parseTaskMetadata('Submit assignment [due:: 2023-11-01]');
        expect(result.title).toBe('Submit assignment');
        expect(result.dueDate).toEqual(getLocalMidnight('2023-11-01'));
    });

    it('should parse due date in dd-mm-yyyy format', () => {
        const result = parseTaskMetadata('Submit assignment due:: 01-11-2023');
        expect(result.title).toBe('Submit assignment');
        expect(result.dueDate).toEqual(getLocalMidnight('2023-11-01'));
    });

    it('should parse completion date without time', () => {
        const result = parseTaskMetadata('Done task [completion:: 2024-01-02]');
        expect(result.title).toBe('Done task');
        expect(result.completionDate).toEqual(getLocalMidnight('2024-01-02'));
    });

    it('should parse completion date with time', () => {
        // Completion date ignores the time part in parseDate, so it returns local midnight.
        // Wait, parseDate appends T00:00:00 so the HH:mm is ignored in the returned Date object,
        // but it removes it from the title. Let's verify this logic.
        const result = parseTaskMetadata('Done task [completion:: 2024-01-02 14:30]');
        expect(result.title).toBe('Done task');
        expect(result.completionDate).toEqual(getLocalMidnight('2024-01-02'));
    });

    it('should parse recurrence with repeat::', () => {
        const result = parseTaskMetadata('Water plants [repeat:: weekly]');
        expect(result.title).toBe('Water plants');
        expect(result.recurrence).toBe('weekly');
    });

    it('should parse recurrence with 🔁 emoji', () => {
        const result = parseTaskMetadata('Water plants 🔁 every 2 weeks');
        expect(result.title).toBe('Water plants');
        expect(result.recurrence).toBe('every 2 weeks');
    });

    it('should parse recurrence with 🔄 emoji', () => {
        const result = parseTaskMetadata('Water plants 🔄 daily');
        expect(result.title).toBe('Water plants');
        expect(result.recurrence).toBe('daily');
    });

    it('should stop emoji recurrence matching at 📅 or ✅', () => {
        const result = parseTaskMetadata('Task 🔁 weekly 📅 2024-01-01');

        // Wait, since parseTaskMetadata strips out the date part AFTER the recurrence part,
        // it parses the 📅 out of the string, so it should be just "Task".
        expect(result.title).toBe('Task');
        expect(result.recurrence).toBe('weekly');
        expect(result.dueDate).toEqual(getLocalMidnight('2024-01-01'));
    });

    it('should stop emoji recurrence matching at ✅', () => {
        const result = parseTaskMetadata('Task 🔁 weekly ✅ 2024-01-01');

        // The regex is /[\u{1F501}\u{1F504}]\s*([^[\u{1F4C5}\u2705]+)/u
        expect(result.title).toBe('Task ✅ 2024-01-01');
        expect(result.recurrence).toBe('weekly');
    });

    it('should parse due date with 📅 emoji', () => {
        const result = parseTaskMetadata('Buy milk 📅 2023-10-15');
        expect(result.title).toBe('Buy milk');
        expect(result.dueDate).toEqual(getLocalMidnight('2023-10-15'));
    });

    it('should not override [due::] with 📅 emoji', () => {
        const result = parseTaskMetadata('Buy milk [due:: 2023-10-15] 📅 2023-10-20');
        // emoji fallback is skipped if due is already set
        expect(result.title).toBe('Buy milk 📅 2023-10-20');
        expect(result.dueDate).toEqual(getLocalMidnight('2023-10-15'));
    });

    it('should parse multiple metadata tags simultaneously', () => {
        const result = parseTaskMetadata('Complex task [start:: 2023-10-01] [due:: 2023-10-15] [completion:: 2023-10-14] [repeat:: monthly]');
        expect(result.title).toBe('Complex task');
        expect(result.startDate).toEqual(getLocalMidnight('2023-10-01'));
        expect(result.dueDate).toEqual(getLocalMidnight('2023-10-15'));
        expect(result.completionDate).toEqual(getLocalMidnight('2023-10-14'));
        expect(result.recurrence).toBe('monthly');
    });

    it('should clean up extra spaces after removing metadata', () => {
        const result = parseTaskMetadata('   Task   with   spaces   [due:: 2023-01-01]   ');
        expect(result.title).toBe('Task with spaces');
        expect(result.dueDate).toEqual(getLocalMidnight('2023-01-01'));
    });

    it('should parse notes with notes::', () => {
        const result = parseTaskMetadata('Task with a note [notes:: This is an important note]');
        expect(result.title).toBe('Task with a note');
        expect(result.notes).toBe('This is an important note');
    });

    it('should parse notes with parenthesis format', () => {
        const result = parseTaskMetadata('Task with parens note (notes:: Another note here)');
        expect(result.title).toBe('Task with parens note');
        expect(result.notes).toBe('Another note here');
    });

    it('should handle notes alongside other metadata', () => {
        const result = parseTaskMetadata('Complex task [due:: 2024-12-01] [notes:: Requires review before submission] [repeat:: weekly]');
        expect(result.title).toBe('Complex task');
        expect(result.dueDate).toEqual(getLocalMidnight('2024-12-01'));
        expect(result.notes).toBe('Requires review before submission');
        expect(result.recurrence).toBe('weekly');
    });
});