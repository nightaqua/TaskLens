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