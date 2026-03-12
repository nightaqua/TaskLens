import { describe, it, expect, beforeEach } from 'vitest';
import { TaskParser } from './TaskParser';
import { App } from 'obsidian';
import { SemesterSettings } from '../settings/Settings';

describe('TaskParser.parseTaskMetadata', () => {
    let parser: TaskParser;

    beforeEach(() => {
        // We cast to any because we only need to test pure logic, avoiding the Obsidian API
        const mockApp = {} as App;
        const mockSettings = {} as SemesterSettings;
        parser = new TaskParser(mockApp, mockSettings);
    });

    describe('Date Parsing Edge Cases', () => {
        it('should correctly parse standard yyyy-mm-dd dates', () => {
            // @ts-expect-error accessing private method for testing
            const result = parser.parseTaskMetadata('- [ ] A task [start:: 2026-03-10] [due:: 2026-03-15]');
            expect(result.startDate).toEqual(new Date('2026-03-10T00:00:00'));
            expect(result.dueDate).toEqual(new Date('2026-03-15T00:00:00'));
        });

        it('should correctly parse alternative dd-mm-yyyy dates', () => {
            // @ts-expect-error accessing private method for testing
            const result = parser.parseTaskMetadata('- [ ] A task [start:: 10-03-2026] [due:: 15-03-2026]');
            expect(result.startDate).toEqual(new Date('2026-03-10T00:00:00'));
            expect(result.dueDate).toEqual(new Date('2026-03-15T00:00:00'));
        });

        it('should handle invalid date values correctly (e.g. 99-99-9999)', () => {
            // Note: `new Date('9999-99-99T00:00:00')` evaluates to an "Invalid Date" object.
            // But we should verify it handles the regex correctly and produces what the standard Date object would.
            // @ts-expect-error accessing private method for testing
            const result = parser.parseTaskMetadata('- [ ] A task [start:: 99-99-9999]');
            expect(result.startDate).toBeInstanceOf(Date);
            expect(result.startDate?.toString()).toEqual('Invalid Date');
        });

        it('should ignore malformed date patterns (e.g. yyyy/mm/dd)', () => {
            // @ts-expect-error accessing private method for testing
            const result = parser.parseTaskMetadata('- [ ] A task [start:: 2026/03/10]');
            expect(result.startDate).toBeUndefined();
        });

        it('should handle leap years correctly', () => {
            // @ts-expect-error accessing private method for testing
            const result = parser.parseTaskMetadata('- [ ] Leap task [due:: 2024-02-29]');
            expect(result.dueDate).toEqual(new Date('2024-02-29T00:00:00'));

            // @ts-expect-error accessing private method for testing
            const resultDmy = parser.parseTaskMetadata('- [ ] Leap task [due:: 29-02-2024]');
            expect(resultDmy.dueDate).toEqual(new Date('2024-02-29T00:00:00'));
        });

        it('should handle dates at the start and end of months/years', () => {
            // @ts-expect-error accessing private method for testing
            const result = parser.parseTaskMetadata('- [ ] Task [start:: 2024-01-01] [due:: 2024-12-31]');
            expect(result.startDate).toEqual(new Date('2024-01-01T00:00:00'));
            expect(result.dueDate).toEqual(new Date('2024-12-31T00:00:00'));

            // @ts-expect-error accessing private method for testing
            const resultDmy = parser.parseTaskMetadata('- [ ] Task [start:: 01-01-2024] [due:: 31-12-2024]');
            expect(resultDmy.startDate).toEqual(new Date('2024-01-01T00:00:00'));
            expect(resultDmy.dueDate).toEqual(new Date('2024-12-31T00:00:00'));
        });

        it('should parse completion dates with HH:mm suffix', () => {
            // @ts-expect-error accessing private method for testing
            const result = parser.parseTaskMetadata('- [x] Done [completion:: 2024-05-15 14:30]');
            // The regex for completion ignores the time and extract the 2024-05-15 part
            // But completionDate is extracted using compMatch[1] which contains the HH:mm
            // suffix if the regex captured it, except the regex only captures the date part
            // because of (?:\\s\\d{2}:\\d{2})? outside of capture group.
            expect(result.completionDate).toEqual(new Date('2024-05-15T00:00:00'));
        });

        it('should parse completion dates in dd-mm-yyyy with HH:mm suffix', () => {
            // @ts-expect-error accessing private method for testing
            const result = parser.parseTaskMetadata('- [x] Done [completion:: 15-05-2024 14:30]');
            expect(result.completionDate).toEqual(new Date('2024-05-15T00:00:00'));
        });

        it('should parse bare dates without tags (e.g. Emoji fallback)', () => {
            // @ts-expect-error accessing private method for testing
            const result = parser.parseTaskMetadata('- [ ] Task 📅 2024-10-10');
            expect(result.dueDate).toEqual(new Date('2024-10-10T00:00:00'));

            // @ts-expect-error accessing private method for testing
            const resultDmy = parser.parseTaskMetadata('- [ ] Task 📅 10-10-2024');
            expect(resultDmy.dueDate).toEqual(new Date('2024-10-10T00:00:00'));
        });

        it('should strip metadata from the title correctly', () => {
            // @ts-expect-error accessing private method for testing
            const result = parser.parseTaskMetadata('Task name [start:: 2026-03-10] [due:: 2026-03-15]');
            expect(result.title).toEqual('Task name');

            // @ts-expect-error accessing private method for testing
            const resultDmy = parser.parseTaskMetadata('Another task [start:: 10-03-2026] [due:: 15-03-2026]');
            expect(resultDmy.title).toEqual('Another task');
        });
    });
});
