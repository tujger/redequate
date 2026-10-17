const reportError = error => console.error("[LocalBackendClient] Request history failed", error);

export const snapshot = value => {
    try {
        return window.structuredClone(value);
    } catch (error) {
        reportError(error);
        return {uncloneable: true};
    }
};

const openDatabase = storageKey => new Promise((resolve, reject) => {
    const request = window.indexedDB.open(storageKey, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
        request.result.createObjectStore("requests", {keyPath: "id", autoIncrement: true});
    };
    request.onsuccess = () => {
        if (blocked) {
            request.result.close();
            return;
        }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
        blocked = true;
        reject(new Error("LocalBackendClient database upgrade is blocked."));
    };
});

export async function recordRequest(storageKey, record) {
    let database;
    try {
        database = await openDatabase(storageKey);
        await new Promise((resolve, reject) => {
            const transaction = database.transaction("requests", "readwrite");
            transaction.oncomplete = () => resolve();
            transaction.onabort = () => reject(transaction.error || new Error("LocalBackendClient transaction aborted."));
            transaction.objectStore("requests").add(record);
        });
    } catch (error) {
        reportError(error);
    } finally {
        database?.close();
    }
}
