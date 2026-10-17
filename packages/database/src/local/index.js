import {delay, fail} from "../../../common";
import DatabaseBase from "../common/DatabaseBase";

// Local simulation only: passwords and fake tokens are stored in plain text.
export default class LocalDatabase extends DatabaseBase {
    constructor({storageKey = "redequate:database:local"} = {}) {
        super();
        if (!storageKey.trim()) {
            fail("database/invalid-argument", "storageKey must be a non-empty string.");
        }
        this.storageKey = storageKey;
    }
}
