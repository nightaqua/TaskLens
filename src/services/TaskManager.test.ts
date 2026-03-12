import { describe, it, expect } from 'vitest';
import { TaskManager } from './TaskManager';

describe('TaskManager.formatDisplayDate', () => {
    it('formats a date with double-digit day and month correctly', () => {
        // Use the T00:00:00 suffix as mandated by AGENTS.md
        const date = new Date('2024-12-25T00:00:00');
        expect(TaskManager.formatDisplayDate(date)).toBe('25-12-2024');
    });

    it('zero-pads single-digit days and months', () => {
        const date = new Date('2024-05-09T00:00:00');
        expect(TaskManager.formatDisplayDate(date)).toBe('09-05-2024');
    });

    it('handles leap year dates correctly', () => {
        const date = new Date('2024-02-29T00:00:00');
        expect(TaskManager.formatDisplayDate(date)).toBe('29-02-2024');
    });

    it('handles dates in different years', () => {
        const date = new Date('2026-03-10T00:00:00');
        expect(TaskManager.formatDisplayDate(date)).toBe('10-03-2026');
    });
});
