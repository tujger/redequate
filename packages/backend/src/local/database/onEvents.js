import {fail, identifier} from "../../../../common";
import parsePath from "../../../../database/src/local/parsePath";
import {readStoreMatches} from "./callable/createHelpers";
import {subscribeWrites} from "./writeEvents";

export default (listener, id = identifier()) => {
    const {pattern, collection} = parsePath(listener.path, "listener");

    return backend => subscribeWrites(backend.storageId, id, {
        collection,
        async snapshot(transaction) {
            const entries = await readStoreMatches(transaction.objectStore(collection), pattern);
            const matches = new Map();
            for (const entry of entries) {
                const address = parsePath(entry.path).address;
                if (matches.has(address)) fail("database/invalid-argument", "A listener path must identify each matching record uniquely.");
                matches.set(address, entry);
            }
            return matches;
        },
        deliver({value, previous, params}) {
            const event = previous === null ? "onCreate" : value === null ? "onDelete" : "onUpdate";
            if (typeof listener[event] !== "function") return;
            console.debug("[Backend]", `called '${event}' for '${collection}/${id}'`, {value, previous, params});
            if (event === "onCreate") return listener.onCreate({value, params});
            if (event === "onDelete") return listener.onDelete({value: previous, params});
            return listener.onUpdate({value, previous, params});
        },
    });
};
