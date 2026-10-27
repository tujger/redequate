import LocalDatabase from "../local";
import LocalBackend from "../../../backend/src/local";

export default function createLocalDatabase(options = {}) {
    const backend = new LocalBackend({storageId: options.storageId});
    return new LocalDatabase({...options, backend});
}

export async function readNativeStore(storageId, collection) {
    const {openDatabase} = await import("../local/helpers");
    const database = await openDatabase(storageId);
    try {
        return await new Promise((resolve, reject) => {
            const request = database.transaction(collection).objectStore(collection).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } finally { database.close(); }
}
