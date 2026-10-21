// Every path root is a physical store in a new version-one database.
export const LOCAL_COLLECTIONS = Object.freeze(Object.fromEntries([
    "posts", "chats", "_chats", "alerts", "users_public", "users_private",
    "roles", "tag", "_tag", "extra", "mutual", "mutualrequests",
    "mutualstamps", "activity", "_activity", "errors", "meta", "_counters"
].map(store => [store, Object.freeze({store, ...(["posts", "replies"].includes(store) ? {idField: "post_id"} : {})})])));

export const STORE_SCHEMA = Object.freeze({
    keyPath: ["_collection", "_key"],
    indexes: {
        _key0: ["_collection", "_key0"],
        _key1: ["_collection", "_key1"],
        _key0_key1: ["_collection", "_key0", "_key1"],
        _cursorKey: ["_collection", "_cursorKey", "_key"],
        _cursorCreated: ["_collection", "_cursorCreated", "_cursorKey", "_key"],
        _cursorNested: ["_collection", "_cursorNested"],
        _cursorUnsupportedCreated: ["_collection", "_cursorUnsupportedCreated"],
        _cursorUnsupportedField: ["_collection", "_cursorUnsupportedField"],
        _scopeKey: ["_scope", "_cursorKey", "_key"],
        _scopeCreated: ["_scope", "_cursorCreated", "_cursorKey", "_key"],
        _scopeTimestamp: ["_scope", "_cursorTimestamp", "_cursorKey", "_key"],
        _scopeId: ["_scope", "_scopeIndexId", "_cursorKey", "_key"],
        _scopeUid: ["_scope", "_scopeIndexUid", "_cursorKey", "_key"],
        _scopeDeep: ["_scope", "_cursorDeep"],
        _scopeUnsupportedCreated: ["_scope", "_cursorUnsupportedCreated"],
        _scopeUnsupportedTimestamp: ["_scope", "_cursorUnsupportedTimestamp"],
        _scopeUnsupportedField: ["_scope", "_scopeUnsupportedField"],
        _toKey: ["_collection", "_indexTo", "_cursorKey", "_key"],
        _nameKey: ["_collection", "_indexName", "_cursorKey", "_key"],
        _emailKey: ["_collection", "_indexEmail", "_cursorKey", "_key"],
        _sortNameKey: ["_collection", "_indexSortName", "_cursorKey", "_key"],
        _typeKey: ["_collection", "_indexType", "_cursorKey", "_key"],
        _uidKey: ["_collection", "_indexUid", "_cursorKey", "_key"]
    }
});

const scoped = new Set(["chats", "_chats", "alerts", "mutual", "mutualrequests", "mutualstamps", "_tag"]);
const fields = {
    posts: ["_toKey"],
    users_public: ["_nameKey", "_emailKey", "_sortNameKey"],
    tag: ["_sortNameKey", "_uidKey"],
    activity: ["_typeKey", "_uidKey"]
};
const common = ["_key0", "_key1", "_key0_key1", "_cursorKey", "_cursorCreated",
    "_cursorNested", "_cursorUnsupportedCreated", "_cursorUnsupportedField"];
export const indexesForStore = name => Object.fromEntries([
    ...common,
    ...(scoped.has(name) ? ["_scopeKey", "_scopeDeep"] : []),
    ...(name === "chats" ? ["_scopeCreated", "_scopeUnsupportedCreated"] : []),
    ...(["_chats", "alerts"].includes(name) ? ["_scopeTimestamp", "_scopeUnsupportedTimestamp"] : []),
    ...(["mutual", "mutualrequests"].includes(name)
        ? ["_scopeId", "_scopeUid", "_scopeUnsupportedField"]
        : []),
    ...(fields[name] ?? [])
].map(index => [index, STORE_SCHEMA.indexes[index]]));
