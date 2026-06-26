import { requestUrl } from 'obsidian';
import { IcsEvent, parseIcs } from './IcsParser';

/** Refresh ICS feeds every 4 hours while the plugin is loaded. */
const AUTO_REFRESH_MS = 4 * 60 * 60 * 1000;

export class IcsFeedManager {
    private events: IcsEvent[] = [];
    private refreshHandle: number | null = null;
    private readonly getUrls: () => string[];
    private readonly onEventsChanged: (() => void) | null;

    constructor(getUrls: () => string[], onEventsChanged?: () => void) {
        this.getUrls = getUrls;
        this.onEventsChanged = onEventsChanged ?? null;
    }

    /** Fetch all configured feeds. Silently skips feeds that fail to load. */
    async fetchAll(): Promise<void> {
        const urls = this.getUrls().filter(u => u.trim().length > 0);
        if (urls.length === 0) {
            if (this.events.length > 0) {
                this.events = [];
                this.onEventsChanged?.();
            }
            return;
        }

        const results = await Promise.allSettled(urls.map(url => this.fetchOne(url)));
        this.events = results
            .filter((r): r is PromiseFulfilledResult<IcsEvent[]> => r.status === 'fulfilled')
            .flatMap(r => r.value);

        this.onEventsChanged?.();
    }

    private async fetchOne(url: string): Promise<IcsEvent[]> {
        try {
            const resp = await requestUrl({ url: url.trim(), method: 'GET' });
            if (resp.status !== 200) return [];
            return parseIcs(resp.text);
        } catch {
            // Network error or CORS — swallow silently; this is a read-only overlay feature.
            return [];
        }
    }

    /** Return the most recently fetched events. */
    getEvents(): IcsEvent[] {
        return this.events;
    }

    /** Start the periodic auto-refresh timer. Call once after the initial fetchAll(). */
    startAutoRefresh(): void {
        this.stopAutoRefresh();
        this.refreshHandle = window.setInterval(() => { void this.fetchAll(); }, AUTO_REFRESH_MS);
    }

    /** Stop the auto-refresh timer. Must be called in plugin onunload(). */
    stopAutoRefresh(): void {
        if (this.refreshHandle !== null) {
            window.clearInterval(this.refreshHandle);
            this.refreshHandle = null;
        }
    }
}
