import {notImplemented} from "../../../common";

export default class BackendBase {
    increment(n: number): object {
        return notImplemented("increment");
    }

    async request(name: string, ...args: unknown[]): Promise<unknown> {
        return notImplemented("request");
    }
}
