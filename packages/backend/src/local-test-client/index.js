import {fail} from "../../../_common/src/_packages";
import BackendBase from "../BackendBase";

export default class LocalTestBackendClient extends BackendBase {
    constructor({storageKey = "redequate:backend:local-test-client"} = {}) {
        super();
        if (typeof storageKey !== "string" || !storageKey.trim()) {
            fail("storage/invalid-argument", "storageKey must be a non-empty string.");
        }
        this._storageKey = storageKey;
    }
}
