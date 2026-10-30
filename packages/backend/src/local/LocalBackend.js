import {fail} from "../../../common";
import {LOCAL_DATABASE_NAME} from "../../../common/src/localDatabase";
import BackendBase from "../common/BackendBase";
import {installListeners} from "./database/installListeners";
import createIncrement from "./increment";
import requestHandlers from "./requestHandlers";
import TIMESTAMP from "./timestamp";

export default class LocalBackend extends BackendBase {
    #storageId;

    constructor(
        {
            projectTitle,
            projectUrl = globalThis.location?.origin ?? "",
            storage,
            storageId = LOCAL_DATABASE_NAME,
        } = {}) {

        super({projectTitle, projectUrl, storage});
        if (typeof storageId !== "string" || !storageId.trim()) {
            fail("database/invalid-argument", "storageId must be a non-empty string.");
        }
        this.#storageId = storageId;
        installListeners(this);
    }

    get storageId() {
        return this.#storageId;
    }

    get TIMESTAMP() {
        return TIMESTAMP;
    }

    increment(n) {
        return createIncrement(n);
    }

    async request(name, ...args) {
        if (!Object.hasOwn(requestHandlers, name)) {
            fail("backend/not-implemented", `Backend request ${name} is not implemented.`);
        }
        return requestHandlers[name]({storageId: this.#storageId, args});
    }
}
