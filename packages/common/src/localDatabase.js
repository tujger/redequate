// One schema owner for local providers sharing this origin's IndexedDB.
export const LOCAL_DATABASE_NAME = "redequate:local";

export const openLocalDatabase = () => new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(LOCAL_DATABASE_NAME, 2);
    let blocked = false;
    request.onupgradeneeded = () => {
        for (const name of ["auth_accounts", "auth_state", "auth_links", "auth_mail"]) {
            const store = request.result.objectStoreNames.contains(name)
                ? request.transaction.objectStore(name)
                : request.result.createObjectStore(name, {keyPath: "key"});
            if (!store.indexNames.contains("namespace")) store.createIndex("namespace", "namespace");
            if (name === "auth_accounts" && !store.indexNames.contains("email")) {
                store.createIndex("email", ["namespace", "email"], {unique: true});
            }
        }
        if (!request.result.objectStoreNames.contains("database_records")) {
            request.result.createObjectStore("database_records", {keyPath: ["namespace", "key"]});
        }
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
        blocked = true;
        reject(new Error("Local database upgrade is blocked."));
    };
    request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        if (blocked) database.close();
        else resolve(database);
    };
});
