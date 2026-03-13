import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Task, TaskStatus, getTaskStatus } from '../src/models/Task';

describe('getTaskStatus', () => {
    let mockTask: Task;

    beforeEach(() => {
        // Create a base mock task
        mockTask = {
            id: 'file.md:1',
            title: 'Test task',
            completed: false,
            filePath: 'file.md',
            fileName: 'file',
            lineNumber: 1,
            originalText: '- [ ] Test task'
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns Completed when task.completed is true', () => {
        mockTask.completed = true;
        expect(getTaskStatus(mockTask)).toBe(TaskStatus.Completed);
    });

    it('returns Urgent when task.recurrence is truthy and not completed', () => {
        mockTask.recurrence = 'daily';
        expect(getTaskStatus(mockTask)).toBe(TaskStatus.Urgent);
    });

    describe('when task has a dueDate', () => {
        beforeEach(() => {
            // Set fixed system time for consistent testing
            // We use '2025-02-14T12:00:00Z'
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2025-02-14T12:00:00Z'));
        });

        it('returns Overdue when due date is before today', () => {
            mockTask.dueDate = new Date('2025-02-13T10:00:00Z');
            expect(getTaskStatus(mockTask)).toBe(TaskStatus.Overdue);
        });

        it('returns Urgent when due date is today', () => {
            mockTask.dueDate = new Date('2025-02-14T10:00:00Z');
            expect(getTaskStatus(mockTask)).toBe(TaskStatus.Urgent);
        });

        it('returns Urgent when due date is within 3 days (tomorrow)', () => {
            mockTask.dueDate = new Date('2025-02-15T10:00:00Z');
            expect(getTaskStatus(mockTask)).toBe(TaskStatus.Urgent);
        });

        it('returns Urgent when due date is exactly 3 days away', () => {
            mockTask.dueDate = new Date('2025-02-17T10:00:00Z');
            expect(getTaskStatus(mockTask)).toBe(TaskStatus.Urgent);
        });

        it('returns UpcomingWeek when due date is more than 3 days away', () => {
            mockTask.dueDate = new Date('2025-02-18T10:00:00Z');
            expect(getTaskStatus(mockTask)).toBe(TaskStatus.UpcomingWeek);
        });

        it('handles different time zones correctly by ignoring time part', () => {
            // Overdue
            mockTask.dueDate = new Date('2025-02-13T23:59:59');
            expect(getTaskStatus(mockTask)).toBe(TaskStatus.Overdue);

            // Today
            mockTask.dueDate = new Date('2025-02-14T23:59:59');
            expect(getTaskStatus(mockTask)).toBe(TaskStatus.Urgent);
        });
    });

    it('returns NoDate when there is no dueDate, recurrence, or completion', () => {
        expect(getTaskStatus(mockTask)).toBe(TaskStatus.NoDate);
    });
});
