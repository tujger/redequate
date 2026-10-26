import stores from "./stores.json";
import {identifier} from "../../../common";
import {openLocalDatabase} from "../../../common/src/localDatabase";

const tokenOperation = async (storageId, operation) => {
    const database = await openLocalDatabase(storageId, stores);
    try {
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction("$messaging", operation === "read" ? "readonly" : "readwrite");
            const store = transaction.objectStore("$messaging");
            let token, failure;
            transaction.oncomplete = () => resolve(token);
            transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("LocalMessaging transaction aborted."));
            if (operation === "delete") {
                store.delete("token");
                return;
            }
            const request = store.get("token");
            request.onsuccess = () => {
                try {
                    token = request.result?.token;
                    if (operation === "subscribe" && !token) {
                        token = identifier();
                        store.put({key: "token", token});
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
};

export const readToken = storageId => tokenOperation(storageId, "read");
export const subscribeToken = storageId => tokenOperation(storageId, "subscribe");
export const deleteToken = storageId => tokenOperation(storageId, "delete");
