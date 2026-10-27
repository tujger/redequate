import LocalDatabase from "../local";
import LocalBackend from "../../../backend/src/local";

export default function createLocalDatabase(options = {}) {
    const backend = new LocalBackend({storageId: options.storageId});
    return new LocalDatabase({...options, backend});
}
