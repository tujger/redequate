// Every path root is a physical store in a version-one database.
export const LOCAL_COLLECTIONS = Object.freeze(Object.fromEntries([
    "posts", "replies", "chats", "_chats", "alerts", "users_public", "users_private",
    "roles", "tag", "_tag", "extra", "mutual", "mutualrequests",
    "mutualstamps", "activity", "_activity", "errors", "meta", "_counters"
].map(store => [store, Object.freeze({store, ...(["posts", "replies"].includes(store) ? {idField: "post_id"} : {})})])));

export const STORE_SCHEMA = Object.freeze({
    keyPath: "_rowId",
    indexes: {
        _identity: ["_collection", "_key"],
        _key0: ["_collection", "_key0"],
        _key1: ["_collection", "_key1"],
        _key0_key1: ["_collection", "_key0", "_key1"],
        _cursorKey: ["_collection", "_cursorKey", "_key"],
        _cursorCreated: ["_collection", "_cursorCreated", "_cursorKey", "_key"],
        _cursorTimestamp: ["_collection", "_cursorTimestamp", "_cursorKey", "_key"],
        _cursorNested: ["_collection", "_cursorNested"],
        _cursorUnsupportedCreated: ["_collection", "_cursorUnsupportedCreated"],
        _cursorUnsupportedTimestamp: ["_collection", "_cursorUnsupportedTimestamp"],
        _cursorUnsupportedField: ["_collection", "_cursorUnsupportedField"],
        _scopeKey: ["_scope", "_cursorKey", "_key"],
        _scopeCreated: ["_scope", "_cursorCreated", "_cursorKey", "_key"],
        _scopeTimestamp: ["_scope", "_cursorTimestamp", "_cursorKey", "_key"],
        _scopeId: ["_scope", "_scopeIndexId", "_cursorKey", "_key"],
        _scopeUid: ["_scope", "_scopeIndexUid", "_cursorKey", "_key"],
        _scopeUidId: ["_scope", "_scopeIndexUidId", "_cursorKey", "_key"],
        _scopePrivate: ["_scope", "_scopeIndexPrivate", "_cursorKey", "_key"],
        _scopeDeep: ["_scope", "_cursorDeep"],
        _scopeUnsupportedCreated: ["_scope", "_cursorUnsupportedCreated"],
        _scopeUnsupportedTimestamp: ["_scope", "_cursorUnsupportedTimestamp"],
        _scopeUnsupportedField: ["_scope", "_scopeUnsupportedField"],
        _toKey: ["_collection", "_indexTo", "_cursorKey", "_key"],
        _nameKey: ["_collection", "_indexName", "_cursorKey", "_key"],
        _emailKey: ["_collection", "_indexEmail", "_cursorKey", "_key"],
        _sortNameKey: ["_collection", "_indexSortName", "_cursorKey", "_key"],
        _typeKey: ["_collection", "_indexType", "_cursorKey", "_key"],
        _uidKey: ["_collection", "_indexUid", "_cursorKey", "_key"],
        _visitKey: ["_collection", "_indexVisit", "_cursorKey", "_key"],
        _emailVerifiedKey: ["_collection", "_indexEmailVerified", "_cursorKey", "_key"],
        _idKey: ["_collection", "_indexId", "_cursorKey", "_key"],
        _hiddenKey: ["_collection", "_indexHidden", "_cursorKey", "_key"],
        _labelKey: ["_collection", "_indexLabel", "_cursorKey", "_key"],
        _idUidKey: ["_collection", "_indexIdUid", "_cursorKey", "_key"],
    }
});

const scoped = new Set(["chats", "_chats", "alerts", "mutual", "mutualrequests", "mutualstamps", "_tag"]);
const fields = {
    posts: ["_toKey"],
    replies: ["_toKey"],
    users_public: ["_nameKey", "_emailKey", "_sortNameKey", "_visitKey", "_emailVerifiedKey"],
    tag: ["_sortNameKey", "_uidKey", "_idKey", "_labelKey", "_hiddenKey"],
    activity: ["_typeKey", "_uidKey"],
    errors: ["_uidKey"],
    extra: ["_idKey", "_idUidKey"]
};
const common = ["_identity", "_key0", "_key1", "_key0_key1", "_cursorKey", "_cursorCreated", "_cursorTimestamp",
    "_cursorNested", "_cursorUnsupportedCreated", "_cursorUnsupportedTimestamp", "_cursorUnsupportedField"];
export const indexesForStore = name => Object.fromEntries([
    ...common,
    ...(scoped.has(name) ? ["_scopeKey", "_scopeDeep"] : []),
    ...(name === "chats" ? ["_scopeCreated", "_scopeUnsupportedCreated"] : []),
    ...(["_chats", "alerts"].includes(name) ? ["_scopeTimestamp", "_scopeUnsupportedTimestamp"] : []),
    ...(["mutual", "mutualrequests"].includes(name)
        ? ["_scopeId", "_scopeUid", "_scopeUidId", "_scopeUnsupportedField"]
        : []),
    ...(name === "_chats" ? ["_scopePrivate", "_scopeUnsupportedField"] : []),
    ...(fields[name] ?? [])
].map(index => [index, STORE_SCHEMA.indexes[index]]));
