import {notImplemented} from "../../../common";

export default class BackendBase {
    protected readonly _projectUrl?: string;
    readonly projectTitle: string;

    constructor({projectTitle = "Redequate", projectUrl}: {projectTitle?: string; projectUrl?: string} = {}) {
        this.projectTitle = projectTitle;
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
