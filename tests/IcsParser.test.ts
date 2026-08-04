import { describe, it, expect } from 'vitest';
import { parseIcs } from '../src/services/IcsParser';

// Minimal valid ICS wrapper
function wrap(vevent: string): string {
    return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${vevent}\r\nEND:VCALENDAR`;
}

describe('parseIcs', () => {
    it('parses a basic all-day event (DATE-only DTSTART/DTEND)', () => {
        const ics = wrap(
            'BEGIN:VEVENT\r\n' +
            'UID:abc123@test\r\n' +
            'SUMMARY:Holiday\r\n' +
            'DTSTART:20260601\r\n' +
            'DTEND:20260602\r\n' +
            'END:VEVENT'
        );
        const events = parseIcs(ics);
        expect(events).toHaveLength(1);
        expect(events[0].summary).toBe('Holiday');
        expect(events[0].uid).toBe('abc123@test');
        expect(events[0].allDay).toBe(true);
        expect(events[0].start).toEqual(new Date(2026, 5, 1));   // June 1
        expect(events[0].end).toEqual(new Date(2026, 5, 2));     // June 2 (exclusive)
    });

    it('parses a UTC datetime event', () => {
        const ics = wrap(
            'BEGIN:VEVENT\r\n' +
            'UID:utc@test\r\n' +
            'SUMMARY:Meeting\r\n' +
            'DTSTART:20260615T090000Z\r\n' +
            'DTEND:20260615T100000Z\r\n' +
            'END:VEVENT'
        );
        const events = parseIcs(ics);
        expect(events).toHaveLength(1);
        expect(events[0].allDay).toBe(false);
        expect(events[0].start).toEqual(new Date(Date.UTC(2026, 5, 15, 9, 0, 0)));
        expect(events[0].end).toEqual(new Date(Date.UTC(2026, 5, 15, 10, 0, 0)));
    });

    it('parses a local (no-Z) datetime event', () => {
        const ics = wrap(
            'BEGIN:VEVENT\r\n' +
            'UID:local@test\r\n' +
            'SUMMARY:Local event\r\n' +
            'DTSTART:20260620T140000\r\n' +
            'DTEND:20260620T150000\r\n' +
            'END:VEVENT'
        );
        const events = parseIcs(ics);
        expect(events).toHaveLength(1);
        expect(events[0].allDay).toBe(false);
        expect(events[0].start).toEqual(new Date(2026, 5, 20, 14, 0, 0));
    });

    it('handles DTSTART with VALUE=DATE parameter', () => {
        const ics = wrap(
            'BEGIN:VEVENT\r\n' +
            'UID:vdate@test\r\n' +
            'SUMMARY:Conference\r\n' +
            'DTSTART;VALUE=DATE:20260710\r\n' +
            'DTEND;VALUE=DATE:20260712\r\n' +
            'END:VEVENT'
        );
        const events = parseIcs(ics);
        expect(events).toHaveLength(1);
        expect(events[0].allDay).toBe(true);
        expect(events[0].start).toEqual(new Date(2026, 6, 10));
    });

    it('handles DTSTART with TZID parameter (treats as local)', () => {
        const ics = wrap(
            'BEGIN:VEVENT\r\n' +
            'UID:tzid@test\r\n' +
            'SUMMARY:Zoned event\r\n' +
            'DTSTART;TZID=America/New_York:20260715T120000\r\n' +
            'DTEND;TZID=America/New_York:20260715T130000\r\n' +
            'END:VEVENT'
        );
        const events = parseIcs(ics);
        expect(events).toHaveLength(1);
        expect(events[0].summary).toBe('Zoned event');
        expect(events[0].allDay).toBe(false);
    });

    it('unescapes SUMMARY text sequences', () => {
        const ics = wrap(
            'BEGIN:VEVENT\r\n' +
            'UID:esc@test\r\n' +
            'SUMMARY:Team\\, All-Hands\\nQ3 Review\r\n' +
            'DTSTART:20260801\r\n' +
            'DTEND:20260802\r\n' +
            'END:VEVENT'
        );
        const events = parseIcs(ics);
        expect(events[0].summary).toBe('Team, All-Hands\nQ3 Review');
    });

    it('unfolds long lines (RFC 5545 continuation)', () => {
        // Line fold: CRLF + single space continues the previous line
        const ics = wrap(
            'BEGIN:VEVENT\r\n' +
            'UID:fold@test\r\n' +
            'SUMMARY:Very long summ\r\n ary that is folded\r\n' +
            'DTSTART:20260901\r\n' +
            'DTEND:20260902\r\n' +
            'END:VEVENT'
        );
        const events = parseIcs(ics);
        expect(events[0].summary).toBe('Very long summary that is folded');
    });

    it('falls back to DURATION when DTEND is absent', () => {
        const ics = wrap(
            'BEGIN:VEVENT\r\n' +
            'UID:dur@test\r\n' +
            'SUMMARY:Sprint\r\n' +
            'DTSTART:20260901\r\n' +
            'DURATION:P7D\r\n' +
            'END:VEVENT'
        );
        const events = parseIcs(ics);
        expect(events).toHaveLength(1);
        const expectedEnd = new Date(2026, 8, 1);
        expectedEnd.setDate(expectedEnd.getDate() + 7);
        expect(events[0].end).toEqual(expectedEnd);
    });

    it('generates a synthetic UID when UID property is absent', () => {
        const ics = wrap(
            'BEGIN:VEVENT\r\n' +
            'SUMMARY:No UID\r\n' +
            'DTSTART:20261001\r\n' +
            'DTEND:20261002\r\n' +
            'END:VEVENT'
        );
        const events = parseIcs(ics);
        expect(events).toHaveLength(1);
        expect(events[0].uid).toContain('No UID');
    });

    it('parses multiple VEVENTs', () => {
        const ics = wrap(
            'BEGIN:VEVENT\r\n' +
            'UID:e1@test\r\nSUMMARY:Event 1\r\nDTSTART:20261101\r\nDTEND:20261102\r\n' +
            'END:VEVENT\r\n' +
            'BEGIN:VEVENT\r\n' +
            'UID:e2@test\r\nSUMMARY:Event 2\r\nDTSTART:20261115\r\nDTEND:20261116\r\n' +
            'END:VEVENT'
        );
        const events = parseIcs(ics);
        expect(events).toHaveLength(2);
        expect(events[0].summary).toBe('Event 1');
        expect(events[1].summary).toBe('Event 2');
    });

    it('skips VEVENTs missing SUMMARY', () => {
        const ics = wrap(
            'BEGIN:VEVENT\r\n' +
            'UID:nosummary@test\r\n' +
            'DTSTART:20261201\r\n' +
            'DTEND:20261202\r\n' +
            'END:VEVENT'
        );
        expect(parseIcs(ics)).toHaveLength(0);
    });

    it('returns empty array for empty or non-ICS input', () => {
        expect(parseIcs('')).toHaveLength(0);
        expect(parseIcs('not ics at all')).toHaveLength(0);
    });
});
