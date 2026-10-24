import {LOCAL_SCHEMA} from "./storeSchema";

export {convertStores, LOCAL_SCHEMA} from "./storeSchema";

// Derived views retained for internal callers inspecting the built-in schema.
export const LOCAL_COLLECTIONS = Object.freeze(Object.fromEntries(
    Object.keys(LOCAL_SCHEMA).map(store => [store, Object.freeze({store})])));
export const STORE_SCHEMA = Object.freeze({keyPath: Object.values(LOCAL_SCHEMA)[0].keyPath});
export const indexesForStore = name => Object.fromEntries(
    Object.entries(LOCAL_SCHEMA[name]?.indexes ?? {}).map(([index, spec]) => [index, spec.keyPath]));
