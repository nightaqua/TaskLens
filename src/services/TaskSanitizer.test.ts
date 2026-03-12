import { describe, it, expect } from 'vitest';
import { stripCompletionMetadata } from './TaskSanitizer';

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

    it('should handle multiple spaces around completion key', () => {
        expect(stripCompletionMetadata('- [x] Task [ completion:: 2023-10-27 ]')).toBe('- [x] Task');
        expect(stripCompletionMetadata('- [x] Task (  completion:: 2023-10-27  )')).toBe('- [x] Task');
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
});
