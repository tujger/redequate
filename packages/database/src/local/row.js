export const IDENTITY_INDEX = Object.freeze({keyPath: "_local.path", unique: true});

const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const set = (object, name, value) => Object.defineProperty(object, name,
    {value, enumerable: true, configurable: true, writable: true});

// Keep public object fields once. Only injected or overwritten fields need
// reconstruction metadata; scalar and array values have no object fields.
export const encodeRow = (row, store) => {
    const object = record(row.value);
    const fields = object ? {...row.value} : {};
    const tokens = JSON.parse(row._key).map(token => token[0] === "fixed"
        ? [token[0], token[1], Object.hasOwn(row, token[1]) ? row[token[1]] : token[2]]
        : token[0] === "dynamic" ? [token[0], token[1], token[2], row[`_value${token[1]}`] ?? token[3]] : token);
    const metadata = {path: JSON.stringify(tokens)};
    if (!object) metadata.value = row.value;
    const originals = {};
    const added = new Set();
    const project = (name, value) => {
        if (object && Object.hasOwn(row.value, name)) {
            if (!Object.is(row.value[name], value)) set(originals, name, row.value[name]);
        } else if (object) added.add(name);
        set(fields, name, value);
    };
    const last = tokens.at(-1);
    const leaf = last?.[0] === "fixed" ? last[1] : last?.[0] === "dynamic" ? last[2] : undefined;
    const projected = new Set();
    // Project ancestor identities only for compound indexes describing this child.
    for (const name of store.indexNames) {
        if (name === "_identity") continue;
        const paths = store.index(name).keyPath;
        if (Array.isArray(paths) && paths.includes(leaf)) paths.forEach(path => projected.add(path));
        else if (paths === leaf) projected.add(leaf);
    }
    for (const token of tokens) {
        if (token[0] === "literal") continue;
        const name = token[0] === "fixed" ? token[1] : token[2];
        if (!projected.has(name)) continue;
        const value = token === last && tokens.length > 1 && token[0] === "fixed" && token[1] === token[2]
            ? row.value : token.at(-1);
        project(name, value);
    }
    for (const name of ["_id", "_local"]) {
        if (object && Object.hasOwn(row.value, name)) set(originals, name, row.value[name]);
        added.delete(name);
    }
    if (added.size) metadata.added = [...added];
    if (Object.keys(originals).length) metadata.originals = originals;
    delete fields._id;
    return {...fields, ...(row._id === undefined ? {} : {_id: row._id}), _local: metadata};
};

const logicalRow = (collection, path, value, id) => {
    const row = {};
    if (record(value)) {
        for (const name of Object.keys(value)) {
            if (!["_collection", "_key", "_id", "value", "id"].includes(name) && !/^_(?:key|value)\d+$/.test(name)) {
                set(row, name, name);
            }
        }
    }
    let level = -1;
    for (const token of JSON.parse(path)) {
        if (token[0] === "fixed") set(row, token[1], token[2]);
        if (token[0] === "dynamic") {
            row[`_key${token[1]}`] = token[2];
            row[`_value${token[1]}`] = token[3];
            if (token[1] > level) { row.id = token[3]; level = token[1]; }
        }
    }
    return {...row, _collection: collection, _key: path, _id: id, value};
};

export const decodeRow = (row, collection) => {
    const metadata = row?._local;
    if (typeof metadata?._key === "string") {
        // Read the previous envelope during its atomic schema upgrade.
        return {...logicalRow(collection, metadata._key, metadata.value, row._id), ...metadata, _id: row._id};
    }
    if (typeof metadata?.path !== "string") return undefined;
    let value;
    if (Object.hasOwn(metadata, "value")) value = metadata.value;
    else {
        value = {...row};
        delete value._id;
        delete value._local;
        for (const name of metadata.added ?? []) delete value[name];
        for (const [name, original] of Object.entries(metadata.originals ?? {})) set(value, name, original);
    }
    return logicalRow(collection, metadata.path, value, row._id);
};
