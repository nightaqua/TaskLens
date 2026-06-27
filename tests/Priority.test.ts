import { App } from 'obsidian';
import { describe, it, expect, vi } from 'vitest';
import { priorityToEmoji, emojiToPriority } from '../src/models/Task';
import { TaskParser } from '../src/services/TaskParser';
import { SemesterSettings } from '../src/settings/Settings';
import { TaskManager } from '../src/services/TaskManager';
import { createMockFile } from './helpers';

describe('emojiToPriority — obsidian-tasks emoji set', () => {
    it('maps 🔺 to highest', () => {
        expect(emojiToPriority('\u{1F53A}')).toBe('highest');
    });
    it('maps ⏫ to high', () => {
        expect(emojiToPriority('\u{23EB}')).toBe('high');
    });
    it('maps 🔼 (medium) to high', () => {
        expect(emojiToPriority('\u{1F53C}')).toBe('high');
    });
    it('maps 🔽 to low', () => {
        expect(emojiToPriority('\u{1F53D}')).toBe('low');
    });
    it('maps ⏬ to lowest', () => {
        expect(emojiToPriority('\u{23EC}')).toBe('lowest');
    });
    it('returns undefined for an unrecognised emoji', () => {
        expect(emojiToPriority('\u{1F600}')).toBeUndefined();
    });
});

describe('priorityToEmoji — obsidian-tasks emoji set', () => {
    it('maps highest to 🔺', () => {
        expect(priorityToEmoji('highest')).toBe('\u{1F53A}');
    });
    it('maps high to ⏫', () => {
        expect(priorityToEmoji('high')).toBe('\u{23EB}');
    });
    it('maps normal to empty string', () => {
        expect(priorityToEmoji('normal')).toBe('');
    });
    it('maps low to 🔽', () => {
        expect(priorityToEmoji('low')).toBe('\u{1F53D}');
    });
    it('maps lowest to ⏬', () => {
        expect(priorityToEmoji('lowest')).toBe('\u{23EC}');
    });
    it('maps undefined to empty string', () => {
        expect(priorityToEmoji(undefined)).toBe('');
    });
});

describe('TaskParser priority round-trip', () => {
    const parser = new TaskParser({} as unknown as App, {} as unknown as SemesterSettings);
    const parseTaskMetadata = ((parser as unknown) as Record<string, (...args: unknown[]) => unknown>)['parseTaskMetadata'].bind(parser) as (taskText: string) => { title: string; priority?: string };

    it('parses 🔺 as highest and strips it from the title', () => {
        const result = parseTaskMetadata('Finish the report \u{1F53A}');
        expect(result.priority).toBe('highest');
        expect(result.title).toBe('Finish the report');
    });

    it('parses ⏫ as high and strips it from the title', () => {
        const result = parseTaskMetadata('Finish the report \u{23EB}');
        expect(result.priority).toBe('high');
        expect(result.title).toBe('Finish the report');
    });
});

describe('TaskManager.addTask writes priority emoji', () => {
    it('writes ⏫ before the metadata for a high-priority task', async () => {
        const mockApp = {
            vault: {
                getAbstractFileByPath: vi.fn().mockImplementation((path) => createMockFile(path)),
                read: vi.fn().mockResolvedValue('# Tasks'),
                modify: vi.fn().mockResolvedValue(undefined)
            }
        } as unknown as App;

        const taskManager = new TaskManager({} as TaskParser, mockApp);
        vi.spyOn(taskManager, 'refreshFileTask').mockResolvedValue(undefined);

        await taskManager.addTask('Write tests', new Date('2026-04-01T00:00:00'), 'test.md', undefined, 'high');

        const modifyCalls = (mockApp.vault.modify as import('vitest').Mock).mock.calls;
        expect(modifyCalls.length).toBe(1);
        const written: string = modifyCalls[0][1];
        const taskLine = written.split('\n').find(l => l.includes('Write tests')) as string;
        expect(taskLine).toContain('\u{23EB}');
        // Priority emoji must come before the due:: metadata.
        expect(taskLine.indexOf('\u{23EB}')).toBeLessThan(taskLine.indexOf('[due::'));
    });
});
