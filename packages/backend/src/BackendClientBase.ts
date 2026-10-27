import {notImplemented} from "../../common";

export default class BackendClientBase {
    async request(name: string, ...args: unknown[]): Promise<unknown> {
        return notImplemented("request");
    }
}
