export class App {
    public mockAppProp = true;
}

export class TFile {
    public mockTFileProp = true;
}

export type CachedMetadata = Record<string, unknown>;

export class Events {
    on(name: string, callback: (...data: any) => any, ctx?: any): any {}
    off(name: string, callback: (...data: any) => any): void {}
    offref(ref: any): void {}
    trigger(name: string, ...data: any[]): void {}
    tryTrigger(evt: any, args: any[]): void {}
}

export class Modal {
    open(): void {}
    close(): void {}
}

export class Notice {
    public message: string;
    /** Test hook — every constructed Notice is recorded here so specs can assert on it. */
    static instances: Notice[] = [];
    constructor(message: string, timeout?: number) {
        this.message = message;
        Notice.instances.push(this);
    }
}

export class SuggestModal<T> {
    public items: T[] = [];
    public item?: T;
    open(): void {}
    close(): void {}
    onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): void {}
}

export class ItemView {
    getViewType(): string { return ''; }
    getDisplayText(): string { return ''; }
    getViewData(): unknown { return {}; }
    setViewData(data: unknown, clear?: boolean): void {}
}

export class MarkdownView extends ItemView {
    public containerEl: { isShown: () => boolean } = { isShown: () => true };
    public editor: any = { replaceSelection: (text: string) => {} };
    public file: any = { path: '' };
}

export class WorkspaceLeaf {
    view: ItemView | null = null;
}

export class ViewStateResult {
    data: unknown;
    state: unknown;
}

export function setIcon(el: HTMLElement, iconId: string): void {}

/**
 * Returns all tags (inline + frontmatter) from a CachedMetadata object.
 * Mirrors the Obsidian API: https://docs.obsidian.md/Reference/TypeScript+API/getAllTags
 */
export function getAllTags(cache: Record<string, unknown>): string[] | null {
    const result: string[] = [];
    const inlineTags = cache.tags as Array<{ tag: string }> | undefined;
    if (inlineTags) {
        for (const t of inlineTags) result.push(t.tag);
    }
    const fmTags = (cache.frontmatter as Record<string, unknown> | undefined)?.tags;
    if (Array.isArray(fmTags)) {
        for (const t of fmTags as string[]) result.push(t.startsWith('#') ? t : '#' + t);
    }
    return result.length > 0 ? result : null;
}