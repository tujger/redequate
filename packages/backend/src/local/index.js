import {fail} from "../../../common";
import {LOCAL_DATABASE_NAME} from "../../../common/src/localDatabase";
import BackendClientBase from "../BackendClientBase";
import {installListeners} from "./database/installListeners";
import requestHandlers from "./database/requestHandlers";

export default class LocalBackend extends BackendClientBase {
    #storageId;

    constructor({storageId = LOCAL_DATABASE_NAME} = {}) {
        super();
        if (typeof storageId !== "string" || !storageId.trim()) {
            fail("database/invalid-argument", "storageId must be a non-empty string.");
        }
        this.#storageId = storageId;
        installListeners(this);
    }

    get storageId() {
        return this.#storageId;
    }

    async request(name, ...args) {
        if (!Object.hasOwn(requestHandlers, name)) {
            fail("backend/not-implemented", `Backend request ${name} is not implemented.`);
        }
        return requestHandlers[name]({storageId: this.#storageId, args});
    }
}
