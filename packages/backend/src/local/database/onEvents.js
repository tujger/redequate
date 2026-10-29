import {fail, identifier} from "../../../../common";
import parsePath, {PATH_VARIABLE} from "../../../../database/src/common/parsePath";
import resolvePath from "../../../../database/src/common/resolvePath";
import {readStoreMatches} from "./callable/createHelpers";
import {subscribeWrites} from "./writeEvents";

export default (listener, id = identifier()) => {
    const parsed = parsePath(listener.path);
    if (!parsed.path.length) fail("database/invalid-argument", "A listener requires a nonempty path.");
    const variables = parsed.segments.flatMap((segment, index) => index > 0 && segment.value === PATH_VARIABLE
        ? [{index, field: segment.name, parameter: segment.parameter ?? segment.name}] : []);
    const names = variables.map(({parameter}) => parameter);
    if (new Set(names).size !== names.length || names.some(name => /[{}\/]/.test(name))) {
        fail("database/invalid-argument", "Listener variables must have distinct nonempty names without slashes or braces.");
    }
    const params = Object.fromEntries(parsed.segments.flatMap((segment, index) => index > 0 &&
        typeof parsed.path[index] === "object" && segment.value !== PATH_VARIABLE ? [[segment.name, segment.value]] : []));
    const pattern = {path: parsed.path, variables, params};
    const collection = resolvePath(pattern.path.slice(0, 1)).split("/")[0];

    return backend => subscribeWrites(backend.storageId, id, {
        collection,
        async snapshot(transaction) {
            const entries = await readStoreMatches(transaction.objectStore(collection), pattern);
            const matches = new Map();
            for (const entry of entries) {
                const address = resolvePath(entry.path);
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
