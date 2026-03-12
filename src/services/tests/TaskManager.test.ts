import { describe, it, expect } from 'vitest';
import { TaskManager } from '../TaskManager';

describe('TaskManager', () => {
    describe('formatDisplayDate', () => {
        it('should format normal dates correctly', () => {
            const date = new Date(2024, 4, 15); // May 15, 2024
            expect(TaskManager.formatDisplayDate(date)).toBe('15-05-2024');
        });

        it('should pad single digit days and months with zero', () => {
            const date = new Date(2024, 0, 5); // Jan 5, 2024
            expect(TaskManager.formatDisplayDate(date)).toBe('05-01-2024');
        });

        it('should handle end of year and month dates', () => {
            const date = new Date(2024, 11, 31); // Dec 31, 2024
            expect(TaskManager.formatDisplayDate(date)).toBe('31-12-2024');
        });

        it('should handle leap year dates', () => {
            const date = new Date(2024, 1, 29); // Feb 29, 2024
            expect(TaskManager.formatDisplayDate(date)).toBe('29-02-2024');
        });
    });
});
