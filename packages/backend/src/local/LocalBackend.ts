import {fail} from "../../../common";
import {LOCAL_DATABASE_NAME} from "../../../common/src/localDatabase";
import BackendBase from "../common/BackendBase";
import {installListeners} from "./database/installListeners";
import createIncrement from "./increment";
import requestHandlers from "./requestHandlers";
import TIMESTAMP from "./timestamp";

export default class LocalBackend extends BackendBase {
    #storageId: string;

    constructor(options: NonNullable<ConstructorParameters<typeof BackendBase>[0]> & { storageId?: string } = {}) {
        super({
            ...options,
            projectUrl: options.projectUrl === undefined ? globalThis.location?.origin ?? "" : options.projectUrl,
        });
        const {storageId = LOCAL_DATABASE_NAME} = options;
        if (typeof storageId !== "string" || !storageId.trim()) {
            fail("database/invalid-argument", "storageId must be a non-empty string.");
        }
        this.#storageId = storageId;
        installListeners(this);
    }

    get storageId(): string {
        return this.#storageId;
    }

    get TIMESTAMP() {
        return TIMESTAMP;
    }

    increment(n: number) {
        return createIncrement(n);
    }

    async changeRole(uid: string, role: string | null): Promise<void> {}

    async request(name: string, ...args: unknown[]): Promise<unknown> {
        if (!Object.hasOwn(requestHandlers, name)) {
            fail("backend/not-implemented", `Backend request ${name} is not implemented.`);
        }
        return requestHandlers[name]({storageId: this.#storageId, args, backend: this});
    }
}
