import type StorageBase from "../../../storage/src/StorageBase";
import {notImplemented} from "../../../common";

export default class BackendBase {
    protected readonly _projectUrl?: string;
    readonly projectTitle: string;
    readonly storage?: StorageBase;

    constructor({projectTitle = "Redequate", projectUrl, storage}: {projectTitle?: string; projectUrl?: string; storage?: StorageBase} = {}) {
        this.projectTitle = projectTitle;
        this.storage = storage;
        this._projectUrl = projectUrl;
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
