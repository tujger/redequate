import stores from "./stores.json";
import {openLocalDatabase} from "../../../common/src/localDatabase";
import {fail} from "../../../common";

export async function fileOperation(storage, operation, value) {
    if (operation !== "upload" && (typeof value !== "string" || !value.trim())) {
        fail("storage/invalid-argument", "A non-empty file path or URL is required.");
    }
    const database = await openLocalDatabase(storage.storageId, stores);
    try {
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction("$storage", operation === "read" ? "readonly" : "readwrite");
            const files = transaction.objectStore("$storage");
            let result, failure;
            transaction.oncomplete = () => resolve(result);
            transaction.onabort = () => reject(failure || transaction.error || new Error("LocalStorage transaction aborted."));
            if (operation === "upload") {
                files.add(value);
                return;
            }
            const request = value.startsWith("data:") ? files.index("url").get(value) : files.get(value);
            request.onsuccess = () => {
                try {
                    if (!request.result) fail("storage/object-not-found", "File not found.");
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
    reader.onabort = () => reject(new Error("LocalStorage file reading aborted."));
    reader.readAsDataURL(blob);
});
