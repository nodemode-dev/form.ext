export type Permission = 'document' | 'files-read' | 'files-write' | 'network' | 'models' | 'native-code';
export interface Hello {
    product: string;
    app: string;
    appVersion: string;
    api: '1';
    extension: {
        id: string;
        version: string;
        source: 'catalogue' | 'sideload' | 'development';
    };
    permissions: Permission[];
    theme: {
        mode: 'dark' | 'light';
        tokens: Record<string, string>;
    };
    locale: string;
}
export interface Activation {
    reason: 'panel' | 'command';
    panel?: string;
    command?: string;
    args?: unknown;
}
export interface PickedFile {
    name: string;
    type: string;
    size: number;
    data: string;
}
export declare class FormExtError extends Error {
    code: number;
    data?: unknown;
    constructor(code: number, message: string, data?: unknown);
}
export declare const ERR: {
    readonly NOT_FOUND: -32601;
    readonly INVALID: -32602;
    readonly PERMISSION: -32001;
    readonly CANCELLED: -32002;
    readonly UNAVAILABLE: -32003;
    readonly REFUSED: -32004;
};
type Handler = (params: any) => unknown;
export declare class FormExt {
    private seq;
    private pending;
    private handlers;
    private helloCache;
    constructor();
    private post;
    call<T = unknown>(method: string, params?: unknown): Promise<T>;
    on(method: string, handler: Handler): void;
    onActivate(handler: (a: Activation) => unknown): void;
    onEvent(handler: (e: {
        name: string;
        data: unknown;
    }) => unknown): void;
    hello(): Promise<Hello>;
    notify(message: string, level?: 'info' | 'success' | 'warning' | 'error'): Promise<null>;
    resize(height: number): Promise<null>;
    setTitle(title: string): Promise<null>;
    storageGet<T = unknown>(key: string): Promise<T | null>;
    storageSet(key: string, value: unknown): Promise<null>;
    readDocument<T = unknown>(what?: string): Promise<T>;
    apply(label: string, ops: {
        command: string;
        args?: unknown;
    }[]): Promise<{
        applied: number;
        results: unknown[];
    }>;
    commands(): Promise<{
        id: string;
        title: string;
        args?: unknown;
    }[]>;
    run<T = unknown>(command: string, args?: unknown): Promise<T>;
    openFiles(accept: string[], multiple?: boolean): Promise<PickedFile[]>;
    saveFile(name: string, type: string, data: string): Promise<{
        saved: boolean;
        name: string;
    }>;
    fetch(url: string, init?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
    }): Promise<{
        status: number;
        headers: Record<string, string>;
        body: string;
    }>;
    done(result?: unknown): Promise<null>;
}
export declare function applyTheme(theme: Hello['theme'] | undefined): void;
export declare function toBase64(bytes: Uint8Array): string;
export declare function fromBase64(data: string): Uint8Array;
export declare const formext: FormExt;
export {};
