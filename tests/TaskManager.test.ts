import { describe, it, expect } from 'vitest';
import { TaskManager } from '../src/services/TaskManager';
import { Task } from '../src/models/Task';

describe('TaskManager', () => {
    describe('buildClonedLine', () => {
        const dummyTask: Task = {
            id: 'test',
            title: 'Test Task',
            completed: true,
            filePath: 'test.md',
            fileName: 'test',
            lineNumber: 0,
            originalText: '- [x] Test Task [due:: 2024-01-01] [repeat:: daily]'
        };

        it('should advance due date to next occurrence', () => {
            const manager = new TaskManager(null as any, null as any);
            const task = { ...dummyTask, dueDate: new Date('2024-01-01T00:00:00'), recurrence: 'daily' };
            const cloned = (manager as any).buildClonedLine(task.originalText, task, new Date('2024-01-01T00:00:00'));
            expect(cloned).toBe('- [ ] Test Task [due:: 2024-01-02] [repeat:: daily]');
        });

        it('should advance start and due date if both exist', () => {
            const manager = new TaskManager(null as any, null as any);
            const task = {
                ...dummyTask,
                startDate: new Date('2023-12-30T00:00:00'),
                dueDate: new Date('2024-01-01T00:00:00'),
                recurrence: 'daily',
                originalText: '- [x] Test Task [start:: 2023-12-30] [due:: 2024-01-01] [repeat:: daily]'
            };
            const cloned = (manager as any).buildClonedLine(task.originalText, task, new Date('2024-01-01T00:00:00'));
            expect(cloned).toBe('- [ ] Test Task [start:: 2023-12-31] [due:: 2024-01-02] [repeat:: daily]');
        });

        it('should advance start date if only start date exists', () => {
            const manager = new TaskManager(null as any, null as any);
            const task = {
                ...dummyTask,
                startDate: new Date('2024-01-01T00:00:00'),
                recurrence: 'daily',
                originalText: '- [x] Test Task [start:: 2024-01-01] [repeat:: daily]'
            };
            const cloned = (manager as any).buildClonedLine(task.originalText, task, new Date('2024-01-01T00:00:00'));
            expect(cloned).toBe('- [ ] Test Task [start:: 2024-01-02] [repeat:: daily]');
        });

        it('should handle missing dates gracefully', () => {
            const manager = new TaskManager(null as any, null as any);
            const task = {
                ...dummyTask,
                recurrence: 'daily',
                originalText: '- [x] Test Task [repeat:: daily]'
            };
            const cloned = (manager as any).buildClonedLine(task.originalText, task, new Date('2024-01-01T00:00:00'));
            expect(cloned).toBe('- [ ] Test Task [repeat:: daily]');
        });

        it('should strip completion metadata', () => {
            const manager = new TaskManager(null as any, null as any);
            const task = {
                ...dummyTask,
                dueDate: new Date('2024-01-01T00:00:00'),
                recurrence: 'daily',
                originalText: '- [x] Test Task [due:: 2024-01-01] [repeat:: daily] [completion:: 2024-01-01 10:00]'
            };
            const cloned = (manager as any).buildClonedLine(task.originalText, task, new Date('2024-01-01T00:00:00'));
            expect(cloned).toBe('- [ ] Test Task [due:: 2024-01-02] [repeat:: daily]');
        });

        it('should add repeat metadata if not present but task has recurrence', () => {
             const manager = new TaskManager(null as any, null as any);
             const task = {
                 ...dummyTask,
                 dueDate: new Date('2024-01-01T00:00:00'),
                 recurrence: 'daily',
                 originalText: '- [x] Test Task [due:: 2024-01-01]'
             };
             const cloned = (manager as any).buildClonedLine(task.originalText, task, new Date('2024-01-01T00:00:00'));
             expect(cloned).toBe('- [ ] Test Task [due:: 2024-01-02] [repeat:: daily]');
        });
    });
});
