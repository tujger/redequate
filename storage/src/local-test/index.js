import StorageBase from "../StorageBase";

export default class LocalTestStorage extends StorageBase {
    constructor({storageKey = "redequate:storage:local-test"} = {}) {
        super();
    }
}
