import stores from "./stores.json";
import {IDENTITY_INDEX} from "./row";

const plain = value => value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;

const validPath = path => typeof path === "string"
    ? /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(path)
    : Array.isArray(path) && path.length > 0 && path.every(part => typeof part === "string" && validPath(part));

const sameIndex = (left, right) => JSON.stringify(left.keyPath) === JSON.stringify(right.keyPath) &&
    left.unique === right.unique && !!left.multiEntry === !!right.multiEntry;

/** Convert and merge the public stores.json format without changing its inputs. */
export const convertStores = (additional = []) => {
    if (!Array.isArray(additional)) throw new TypeError("Local stores must be an array.");
    const result = Object.create(null);
    for (const entry of [...stores, ...additional]) {
        if (!plain(entry) || typeof entry.store !== "string" || !entry.store || entry.store.includes("/") ||
            !plain(entry.storeConfig) || entry.storeConfig.keyPath !== "_id" ||
            entry.storeConfig.autoIncrement !== true || !Array.isArray(entry.storeSchema)) {
            throw new TypeError("Local stores require a name, keyPath _id, autoIncrement true and storeSchema array.");
        }
        const {store: name} = entry;
        const definition = result[name] ??= {
            ...entry.storeConfig, indexes: Object.create(null)
        };
        for (const index of entry.storeSchema) {
            if (!plain(index) || typeof index.name !== "string" || !index.name || !validPath(index.keypath) ||
                (index.options !== undefined && !plain(index.options)) ||
                Object.keys(index.options ?? {}).some(option => !["unique", "multiEntry"].includes(option)) ||
                ["unique", "multiEntry"].some(option => index.options?.[option] !== undefined &&
                    typeof index.options[option] !== "boolean") ||
                (index.options?.multiEntry && Array.isArray(index.keypath))) {
                throw new TypeError(`Invalid Local index in store ${name}.`);
            }
            const paths = Array.isArray(index.keypath) ? index.keypath : [index.keypath];
            if (paths.some(path => ["_local", "_id"].includes(path.split(".")[0]))) {
                throw new TypeError(`Reserved Local index keyPath: ${name}.${index.name}`);
            }
            const description = {
                keyPath: structuredClone(index.keypath), unique: index.options?.unique ?? false,
                ...(index.options?.multiEntry ? {multiEntry: true} : {})
            };
            if (Object.hasOwn(definition.indexes, index.name) && !sameIndex(definition.indexes[index.name], description)) {
                throw new TypeError(`Conflicting Local index: ${name}.${index.name}`);
            }
            definition.indexes[index.name] = description;
        }
    }
    for (const definition of Object.values(result)) {
        if (Object.hasOwn(definition.indexes, "_identity")) throw new TypeError("Reserved Local index: _identity");
        definition.indexes._identity = {...IDENTITY_INDEX};
    }
    return result;
};

export const LOCAL_SCHEMA = convertStores();
