import type AuthBase from "../../../auth/src/AuthBase";
import type DatabaseBase from "../../../database/src/common/DatabaseBase";
import type StorageBase from "../../../storage/src/StorageBase";
import {notImplemented} from "../../../common";

export default class BackendBase {
    protected readonly _projectUrl?: string;
    readonly projectTitle: string;
    storage?: StorageBase;
    auth?: AuthBase;
    database?: DatabaseBase;

    constructor({projectTitle = "Redequate", projectUrl}: {projectTitle?: string; projectUrl?: string} = {}) {
        this.projectTitle = projectTitle;
        this._projectUrl = projectUrl;
    }

    setAuth(auth: AuthBase): void {
        this.auth = auth;
    }

    setDatabase(database: DatabaseBase): void {
        this.database = database;
    }

    setStorage(storage: StorageBase): void {
        this.storage = storage;
    }

    async getCurrentUser(): Promise<string | undefined> {
        const user = await this.auth?.resolveCurrentUser({skipDelay: true});
        return user?.id || undefined;
    }

    get projectUrl(): string {
        return this._projectUrl ?? "";
    }

    get TIMESTAMP(): object {
        return notImplemented("timestamp");
    }

    increment(n: number): object {
        return notImplemented("increment");
    }

    async request(name: string, ...args: unknown[]): Promise<unknown> {
        return notImplemented("request");
    }
}
