export interface BackendBase {
    request(name: string, ...args: unknown[]): Promise<unknown>;
}
