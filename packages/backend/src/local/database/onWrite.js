import {identifier} from "../../../../common";
import parseReadPath from "../../../../database/src/common/parseReadPath";
import resolvePath from "../../../../database/src/common/resolvePath";
import {readStore} from "./createHelpers";
import {subscribeWrites} from "./writeEvents";

export default ({path, onWrite}) => {
    const {path: parentPath, keyField} = parseReadPath(path);
    const collection = resolvePath(parentPath).split("/")[0];
    const id = identifier();

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
            return onWrite({value, previous, params, backend});
        },
    });
};
