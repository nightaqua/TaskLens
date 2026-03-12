import { describe, it, expect } from 'vitest';
import { hasRecurrenceMetadata } from '../TaskSanitizer';

describe('TaskSanitizer', () => {
    describe('hasRecurrenceMetadata', () => {
        it('should return true if line contains Tasks plugin repeat emoji 🔁', () => {
            expect(hasRecurrenceMetadata('- [ ] Every day 🔁 every day')).toBe(true);
            expect(hasRecurrenceMetadata('- [ ] 🔁')).toBe(true);
        });

        it('should return true if line contains Tasks plugin finish emoji 🏁', () => {
            expect(hasRecurrenceMetadata('- [ ] Finish line 🏁')).toBe(true);
            expect(hasRecurrenceMetadata('🏁 some text')).toBe(true);
        });

        it('should return true if line contains Dataview/TaskLens repeat inline field [repeat:: ...]', () => {
            expect(hasRecurrenceMetadata('- [ ] My task [repeat:: daily]')).toBe(true);
            expect(hasRecurrenceMetadata('- [ ] My task (repeat:: weekly)')).toBe(true);
            expect(hasRecurrenceMetadata('repeat::')).toBe(true);
            expect(hasRecurrenceMetadata('Repeat::')).toBe(true);
            expect(hasRecurrenceMetadata('REPEAT::')).toBe(true);
        });

        it('should return false if line does not contain recurrence metadata', () => {
            expect(hasRecurrenceMetadata('- [ ] Normal task without repeat')).toBe(false);
            expect(hasRecurrenceMetadata('- [ ] Task with completion ✅ 2024-05-15')).toBe(false);
            expect(hasRecurrenceMetadata('- [ ] Task with due date due:: 2024-05-15')).toBe(false);
            expect(hasRecurrenceMetadata('No metadata here')).toBe(false);
        });
    });
});
