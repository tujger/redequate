import {identifier} from "../../../common";
import {openLocalDatabase} from "../../../common/src/localDatabase";

const stores = {accounts: "auth_accounts", links: "auth_links", mail: "auth_mail"};
const stateKey = auth => `auth:${auth.storageKey}`;

const storageError = error => {
    if (error?.code?.startsWith?.("auth/")) return error;
    if (error?.name === "ConstraintError") {
        return Object.assign(new Error("This email or record key is already registered."), {code: "auth/email-already-in-use", cause: error});
    }
    return Object.assign(new Error("Local authentication storage is unavailable."), {code: "auth/storage-unavailable", cause: error});
};

const operation = async execute => {
    let database;
    try {
        database = await openLocalDatabase();
        return await execute(database);
    } catch (error) {
        throw storageError(error);
    } finally {
        database?.close();
    }
};

export const readState = auth => operation(database => new Promise((resolve, reject) => {
    const transaction = database.transaction(["auth_state", ...Object.values(stores)], "readonly");
    const state = {revision: null, accounts: [], session: null, redirect: null, links: [], mail: []};
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => {};
    transaction.oncomplete = () => resolve(state);
    const request = transaction.objectStore("auth_state").get(stateKey(auth));
    request.onsuccess = () => {
        const record = request.result;
        if (!record) return;
        state.revision = record.revision;
        state.session = record.userKey === null ? null : {key: record.userKey, token: record.token};
        state.redirect = record.redirectKey;
    };
    for (const [field, name] of Object.entries(stores)) {
        const request = transaction.objectStore(name).index("namespace").getAll(auth.storageKey);
        request.onsuccess = () => { state[field] = request.result; };
    }
}));

export const writeState = (auth, state, {expectedRevision = state.revision, restore = false} = {}) => operation(database => new Promise((resolve, reject) => {
    const transaction = database.transaction(["auth_state", ...Object.values(stores)], "readwrite");
    let failure;
    let result = null;
    transaction.onabort = () => reject(failure || transaction.error);
    transaction.onerror = () => {};
    transaction.oncomplete = () => resolve(result);
    const stateStore = transaction.objectStore("auth_state");
    const request = stateStore.get(stateKey(auth));
    request.onsuccess = () => {
        if ((request.result?.revision ?? null) !== expectedRevision) {
            if (restore) return;
            failure = Object.assign(new Error("Local authentication changed during the operation."), {code: "auth/state-changed"});
            transaction.abort();
            return;
        }
        const revision = restore ? state.revision : identifier();
        result = {...state, revision};
        if (revision === null) stateStore.delete(stateKey(auth));
        else stateStore.put({
            key: stateKey(auth), namespace: auth.storageKey, revision,
            userKey: state.session?.key ?? null, token: state.session?.token ?? null,
            redirectKey: state.redirect
        });
        for (const [field, name] of Object.entries(stores)) {
            const store = transaction.objectStore(name);
            const keys = store.index("namespace").getAllKeys(auth.storageKey);
            keys.onsuccess = () => {
                for (const key of keys.result) store.delete(key);
                for (const record of state[field]) store.add({...record, namespace: auth.storageKey});
            };
        }
    };
}));
