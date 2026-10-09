export const fail = (code, message) => {
    throw Object.assign(new Error(message), {code: `storage/${code}`});
};

export async function delay(method) {
    const milliseconds = Math.floor(Math.random() * 2001);
    if (milliseconds > 100) console.debug(`[LocalTestStorage] ${method}: ${milliseconds} ms`);
    await new Promise(resolve => setTimeout(resolve, milliseconds));
}

const openDatabase = storage => new Promise((resolve, reject) => {
    const request = window.indexedDB.open(storage._storageKey, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
        const files = request.result.createObjectStore("files", {keyPath: "fullPath"});
        files.createIndex("url", "url", {unique: true});
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
        reject(new Error("LocalTestStorage database upgrade is blocked."));
    };
});

export async function fileOperation(storage, operation, value) {
    if (operation !== "upload" && (typeof value !== "string" || !value.trim())) {
        fail("invalid-argument", "A non-empty file path or URL is required.");
    }
    const database = await openDatabase(storage);
    try {
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction("files", operation === "read" ? "readonly" : "readwrite");
            const files = transaction.objectStore("files");
            let result, failure;
            transaction.oncomplete = () => resolve(result);
            transaction.onabort = () => reject(failure || transaction.error || new Error("LocalTestStorage transaction aborted."));
            if (operation === "upload") {
                files.add(value);
                return;
            }
            const request = value.startsWith("data:") ? files.index("url").get(value) : files.get(value);
            request.onsuccess = () => {
                try {
                    if (!request.result) fail("object-not-found", "File not found.");
                    if (operation === "delete") {
                        files.delete(request.result.fullPath);
                    } else {
                        result = request.result;
                    }
                } catch (error) {
                    failure = error;
                    transaction.abort();
                }
            };
        });
    } finally {
        database.close();
    }
}

export const toDataURL = blob => new Promise((resolve, reject) => {
    const reader = new window.FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.onabort = () => reject(new Error("LocalTestStorage file reading aborted."));
    reader.readAsDataURL(blob);
});
