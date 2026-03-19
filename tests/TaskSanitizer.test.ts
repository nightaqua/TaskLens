import { describe, it, expect } from 'vitest';
import { stripCompletionMetadata, hasRecurrenceMetadata, hasCompletionMetadata } from '../src/services/TaskSanitizer';

describe('TaskSanitizer - stripCompletionMetadata', () => {
    it('should strip TaskLens / Dataview bracket format', () => {
        expect(stripCompletionMetadata('- [x] Some task [completion:: 2023-10-27]')).toBe('- [x] Some task');
        expect(stripCompletionMetadata('- [x] Some task [completion:: 2023-10-27 15:30]')).toBe('- [x] Some task');
    });

    it('should strip TaskLens / Dataview parentheses format', () => {
        expect(stripCompletionMetadata('- [x] Some task (completion:: 2023-10-27)')).toBe('- [x] Some task');
        expect(stripCompletionMetadata('- [x] Some task (completion:: 2023-10-27 15:30)')).toBe('- [x] Some task');
    });

    it('should strip Tasks-plugin emoji format', () => {
        expect(stripCompletionMetadata('- [x] Some task ✅ 2023-10-27')).toBe('- [x] Some task');
    });

    it('should preserve checkbox state', () => {
        expect(stripCompletionMetadata('- [ ] Pending task ✅ 2023-10-27')).toBe('- [ ] Pending task');
        expect(stripCompletionMetadata('- [-] Cancelled task [completion:: 2023-10-27]')).toBe('- [-] Cancelled task');
        expect(stripCompletionMetadata('* [x] Asterisk task ✅ 2023-10-27')).toBe('* [x] Asterisk task');
    });

    it('should return line unchanged if no metadata is present', () => {
        expect(stripCompletionMetadata('- [x] Just a simple task')).toBe('- [x] Just a simple task');
        expect(stripCompletionMetadata('Not a task line')).toBe('Not a task line');
    });

    it('should strip metadata case-insensitively', () => {
        expect(stripCompletionMetadata('- [x] Task [COMPLETION:: 2023-10-27]')).toBe('- [x] Task');
        expect(stripCompletionMetadata('- [x] Task (Completion:: 2023-10-27)')).toBe('- [x] Task');
    });

    it('should handle metadata in the middle of a line', () => {
        expect(stripCompletionMetadata('- [x] Some [completion:: 2023-10-27] task')).toBe('- [x] Some task');
        expect(stripCompletionMetadata('- [x] Some ✅ 2023-10-27 task')).toBe('- [x] Some task');
    });

    it('should strip multiple completion metadata blocks', () => {
        expect(stripCompletionMetadata('- [x] Task [completion:: 2023-10-27] ✅ 2023-10-27')).toBe('- [x] Task');
    });

    it('should be idempotent (running multiple times should not change result)', () => {
        const line = '- [x] Task [completion:: 2023-10-27] ✅ 2023-10-27';
        const stripped1 = stripCompletionMetadata(line);
        const stripped2 = stripCompletionMetadata(stripped1);
        expect(stripped1).toBe('- [x] Task');
        expect(stripped2).toBe('- [x] Task');
    });

    it('should strip bare completion:: format (no brackets or parens)', () => {
        expect(stripCompletionMetadata('- [x] Some task completion:: 2023-10-27')).toBe('- [x] Some task');
        expect(stripCompletionMetadata('- [x] Some task completion:: 2023-10-27 15:30')).toBe('- [x] Some task');
    });
});

describe('TaskSanitizer', () => {
        describe('hasCompletionMetadata', () => {
        it('should return true if line contains Tasks plugin completion emoji ✅', () => {
            expect(hasCompletionMetadata('- [x] Task ✅ 2023-10-27')).toBe(true);
            expect(hasCompletionMetadata('✅ 2023-10-27')).toBe(true);
        });

        it('should return true if line contains Dataview/TaskLens completion inline field', () => {
            expect(hasCompletionMetadata('- [x] Task [completion:: 2023-10-27]')).toBe(true);
            expect(hasCompletionMetadata('- [x] Task (completion:: 2023-10-27)')).toBe(true);
            expect(hasCompletionMetadata('completion:: 2023-10-27')).toBe(true);
        });

        it('should return true regardless of case for completion::', () => {
            expect(hasCompletionMetadata('- [x] Task [COMPLETION:: 2023-10-27]')).toBe(true);
            expect(hasCompletionMetadata('- [x] Task (Completion:: 2023-10-27)')).toBe(true);
        });

        it('should return false if no completion metadata is present', () => {
            expect(hasCompletionMetadata('- [ ] Task without metadata')).toBe(false);
            expect(hasCompletionMetadata('- [ ] Task with [due:: 2023-10-27]')).toBe(false);
            expect(hasCompletionMetadata('- [ ] Task with 🔁 every day')).toBe(false);
            expect(hasCompletionMetadata('Just some text')).toBe(false);
        });

        it('should return false for malformed completion metadata', () => {
            expect(hasCompletionMetadata('✅ 23-10-27')).toBe(false); // Wrong year format
            expect(hasCompletionMetadata('✅ 2023-1-27')).toBe(false); // Wrong month format
            expect(hasCompletionMetadata('completio:: 2023-10-27')).toBe(false);
        });
    });

    describe('hasCompletionMetadata', () => {
        it('should return true if line contains Tasks plugin completion emoji ✅ and date', () => {
            expect(hasCompletionMetadata('- [x] Task ✅ 2024-05-15')).toBe(true);
            expect(hasCompletionMetadata('✅ 2024-05-15')).toBe(true);
            expect(hasCompletionMetadata('- [x] Task ✅2024-05-15')).toBe(true); // No space after emoji
        });

        it('should return true if line contains Dataview/TaskLens completion inline field', () => {
            expect(hasCompletionMetadata('- [x] Task [completion:: 2024-05-15]')).toBe(true);
            expect(hasCompletionMetadata('- [x] Task (completion:: 2024-05-15)')).toBe(true);
            expect(hasCompletionMetadata('completion::')).toBe(true);
        });

        it('should return true if line contains completion field case-insensitively', () => {
            expect(hasCompletionMetadata('- [x] Task [COMPLETION:: 2024-05-15]')).toBe(true);
            expect(hasCompletionMetadata('- [x] Task (Completion:: 2024-05-15)')).toBe(true);
        });

        it('should return false if Tasks emoji is present but date is missing or malformed', () => {
            expect(hasCompletionMetadata('- [x] Task ✅')).toBe(false);
            expect(hasCompletionMetadata('- [x] Task ✅ 24-05-15')).toBe(false);
            expect(hasCompletionMetadata('- [x] Task ✅ 2024-5-15')).toBe(false);
        });

        it('should return false if line does not contain completion metadata', () => {
            expect(hasCompletionMetadata('- [ ] Normal task')).toBe(false);
            expect(hasCompletionMetadata('- [ ] Task with due date [due:: 2024-05-15]')).toBe(false);
            expect(hasCompletionMetadata('- [ ] Task with repeat [repeat:: daily]')).toBe(false);
            expect(hasCompletionMetadata('Just some text')).toBe(false);
        });
    });

    describe('hasRecurrenceMetadata', () => {
        it('should return true if line contains Tasks plugin repeat emoji 🔁', () => {
            expect(hasRecurrenceMetadata('- [ ] Every day 🔁 every day')).toBe(true);
            expect(hasRecurrenceMetadata('- [ ] 🔁')).toBe(true);
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

        it('should return true if line contains 🔄 recurrence emoji', () => {
            expect(hasRecurrenceMetadata('- [ ] Every day 🔄 every day')).toBe(true);
            expect(hasRecurrenceMetadata('🔄')).toBe(true);
        });
    });
});
