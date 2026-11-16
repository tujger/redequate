import stores from "./stores.json";
import {identifier} from "../../../common";
import {openLocalDatabase} from "../../../common/src/localDatabase";

const fields = ["accounts", "links", "mail"];

const storageError = error => {
    if (error?.code?.startsWith?.("auth/")) return error;
    if (error?.name === "ConstraintError") {
        return Object.assign(new Error("This email or record key is already registered."), {code: "auth/email-already-in-use", cause: error});
    }
    return Object.assign(new Error("Local authentication storage is unavailable."), {code: "auth/storage-unavailable", cause: error});
};

const operation = async (auth, execute) => {
    let database;
    try {
        database = await openLocalDatabase(auth.storageId, stores);
        return await execute(database);
    } catch (error) {
        throw storageError(error);
    } finally {
        database?.close();
    }
};

export const readState = auth => operation(auth, database => new Promise((resolve, reject) => {
    const transaction = database.transaction("$auth", "readonly");
    const state = {revision: null, accounts: [], session: null, redirect: null, links: [], mail: []};
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => {};
    transaction.oncomplete = () => resolve(state);
    const request = transaction.objectStore("$auth").get(["state", "session"]);
    request.onsuccess = () => {
        const record = request.result;
        if (!record) return;
        state.revision = record.revision;
        state.session = record.userKey === null ? null : {key: record.userKey, token: record.token};
        state.redirect = record.redirectKey;
    };
    for (const field of fields) {
        const request = transaction.objectStore("$auth").index("kind").getAll(field);
        request.onsuccess = () => { state[field] = request.result.map(record => record.value); };
    }
}));

export const writeState = (auth, state, {expectedRevision = state.revision, restore = false} = {}) => operation(auth, database => new Promise((resolve, reject) => {
    const transaction = database.transaction("$auth", "readwrite");
    let failure;
    let result = null;
    transaction.onabort = () => reject(failure || transaction.error);
    transaction.onerror = () => {};
    transaction.oncomplete = () => resolve(result);
    const stateStore = transaction.objectStore("$auth");
    const request = stateStore.get(["state", "session"]);
    request.onsuccess = () => {
        if ((request.result?.revision ?? null) !== expectedRevision) {
            if (restore) return;
            failure = Object.assign(new Error("Local authentication changed during the operation."), {code: "auth/state-changed"});
            transaction.abort();
            return;
        }
        const revision = restore ? state.revision : identifier();
        result = {...state, revision};
        if (revision === null) stateStore.delete(["state", "session"]);
        else stateStore.put({
            kind: "state", key: "session", revision,
            userKey: state.session?.key ?? null, token: state.session?.token ?? null,
            redirectKey: state.redirect
        });
        for (const field of fields) {
            const keys = stateStore.index("kind").getAllKeys(field);
            keys.onsuccess = () => {
                for (const key of keys.result) stateStore.delete(key);
                for (const record of state[field]) stateStore.add({
                    kind: field, key: record.key, value: record,
                    ...(field === "accounts" ? {accountEmail: record.email} : {})
                });
            };
        }
    };
}));
