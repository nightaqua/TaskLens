/**
 * Minimal RFC 5545 ICS parser.
 * Extracts VEVENT blocks and reads DTSTART, DTEND, DTSTART;VALUE=DATE, SUMMARY, UID.
 * Does NOT handle VTIMEZONE — TZID-parameterised datetimes are parsed as local time.
 */

export interface IcsEvent {
    uid: string;
    summary: string;
    /** Start of event (inclusive). For all-day events this is midnight local time. */
    start: Date;
    /** End of event. For all-day events the ICS spec uses exclusive end dates (e.g. a
     *  one-day event on 2026-06-01 has DTEND:20260602). We store the raw value and let
     *  callers decide how to display it. */
    end: Date;
    /** True when the ICS event has a DATE-only (no time) DTSTART value. */
    allDay: boolean;
}

/** Parse an ICS text string into an array of calendar events. */
export function parseIcs(icsText: string): IcsEvent[] {
    // RFC 5545 §3.1: unfold long lines (continuation = CRLF + single LWSP char).
    const unfolded = icsText
        .replace(/\r\n[ \t]/g, '')
        .replace(/\n[ \t]/g, '');

    const lines = unfolded.split(/\r?\n/);

    const events: IcsEvent[] = [];
    let inEvent = false;
    let uid = '';
    let summary = '';
    let start: Date | null = null;
    let end: Date | null = null;
    let allDay = false;

    for (const raw of lines) {
        const line = raw.trimEnd();

        if (line === 'BEGIN:VEVENT') {
            inEvent = true;
            uid = '';
            summary = '';
            start = null;
            end = null;
            allDay = false;
            continue;
        }

        if (line === 'END:VEVENT') {
            inEvent = false;
            if (summary && start && end) {
                events.push({
                    uid: uid || `${summary}-${start.toISOString()}`,
                    summary,
                    start,
                    end,
                    allDay,
                });
            }
            continue;
        }

        if (!inEvent) continue;

        const colon = line.indexOf(':');
        if (colon === -1) continue;

        // Property may have parameters: "DTSTART;TZID=America/New_York:..."
        // Strip everything between the property name and the first semicolon/colon.
        const rawKey = line.slice(0, colon);
        const val = line.slice(colon + 1);

        // Base key = portion before the first ';'
        const baseKey = rawKey.split(';')[0].toUpperCase();
        // Check for VALUE=DATE parameter on DTSTART/DTEND
        const isDateOnly = rawKey.toUpperCase().includes('VALUE=DATE');

        switch (baseKey) {
            case 'UID':
                uid = val;
                break;
            case 'SUMMARY':
                summary = unescapeIcsText(val);
                break;
            case 'DTSTART': {
                const parsed = parseIcsDate(val, isDateOnly);
                if (parsed) {
                    start = parsed.date;
                    allDay = parsed.allDay;
                }
                break;
            }
            case 'DTEND': {
                const parsed = parseIcsDate(val, isDateOnly);
                if (parsed) end = parsed.date;
                break;
            }
            case 'DURATION': {
                // Minimal DURATION support: only if DTEND is absent and we have DTSTART
                if (!end && start) {
                    const dur = parseDuration(val);
                    if (dur !== null) {
                        end = new Date(start.getTime() + dur);
                    }
                }
                break;
            }
        }
    }

    return events;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface ParsedDate { date: Date; allDay: boolean }

function parseIcsDate(val: string, forceAllDay = false): ParsedDate | null {
    const trimmed = val.trim();

    // Date-only: YYYYMMDD
    const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
    if (dateOnly || forceAllDay) {
        const src = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(trimmed);
        if (!src) return null;
        return {
            date: new Date(parseInt(src[1]), parseInt(src[2]) - 1, parseInt(src[3])),
            allDay: true,
        };
    }

    // UTC datetime: YYYYMMDDTHHmmssZ
    const utcDt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(trimmed);
    if (utcDt) {
        return {
            date: new Date(Date.UTC(
                parseInt(utcDt[1]), parseInt(utcDt[2]) - 1, parseInt(utcDt[3]),
                parseInt(utcDt[4]), parseInt(utcDt[5]), parseInt(utcDt[6]),
            )),
            allDay: false,
        };
    }

    // Local / TZID datetime: YYYYMMDDTHHmmss (no Z — treated as local)
    const localDt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(trimmed);
    if (localDt) {
        return {
            date: new Date(
                parseInt(localDt[1]), parseInt(localDt[2]) - 1, parseInt(localDt[3]),
                parseInt(localDt[4]), parseInt(localDt[5]), parseInt(localDt[6]),
            ),
            allDay: false,
        };
    }

    return null;
}

/** Parse a P[nD][T[nH][nM][nS]] duration string; returns milliseconds or null. */
function parseDuration(val: string): number | null {
    const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(val.trim());
    if (!m) return null;
    const days = parseInt(m[1] || '0');
    const hours = parseInt(m[2] || '0');
    const mins = parseInt(m[3] || '0');
    const secs = parseInt(m[4] || '0');
    return ((days * 24 + hours) * 60 + mins) * 60000 + secs * 1000;
}

/** Unescape ICS text property values (RFC 5545 §3.3.11). */
function unescapeIcsText(val: string): string {
    return val
        .replace(/\\n/gi, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');
}
