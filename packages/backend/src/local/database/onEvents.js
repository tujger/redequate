import {identifier} from "../../../../common";
import parseReadPath from "../../../../database/src/common/parseReadPath";
import resolvePath from "../../../../database/src/common/resolvePath";
import {readStore} from "./createHelpers";
import {subscribeWrites} from "./writeEvents";

export default (listener, id = identifier()) => {
    const {path: parentPath, keyField} = parseReadPath(listener.path);
    const collection = resolvePath(parentPath).split("/")[0];

    return backend => subscribeWrites(backend.storageId, id, {
        collection,
        async snapshot(transaction) {
            const value = await readStore(transaction.objectStore(collection), parentPath, {keyField});
            const fixedParams = Object.assign({}, ...parentPath.filter(segment => typeof segment === "object"));
            delete fixedParams._;
            const entries = keyField ? Object.entries(value ?? {}) : [["", value]];
            return new Map(entries.filter(([, value]) => value !== undefined && value !== null).map(([key, value]) => {
                const target = keyField ? [...parentPath, {[keyField]: key}] : parentPath;
                const address = resolvePath(target);
                return [address, {
                    path: target,
                    value,
                    params: {...fixedParams, ...(keyField ? {[keyField]: key} : {})}
                }];
            }));
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
