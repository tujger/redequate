// One schema owner for local providers sharing this origin's IndexedDB.
export const LOCAL_DATABASE_NAME = "redequate:local";

export const openLocalDatabase = () => new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(LOCAL_DATABASE_NAME, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
        for (const name of ["auth_accounts", "auth_state", "auth_links", "auth_mail"]) {
            const store = request.result.createObjectStore(name, {keyPath: "key"});
            store.createIndex("namespace", "namespace");
            if (name === "auth_accounts") store.createIndex("email", ["namespace", "email"], {unique: true});
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
