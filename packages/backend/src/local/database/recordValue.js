import {fail} from "../../../../common";

const isObject = value => value !== null && typeof value === "object";
const set = (object, name, value) => Object.defineProperty(object, name,
    {value, enumerable: true, writable: true, configurable: true});
const incompatible = () => {
    throw Object.assign(new Error("Incompatible Local record format; recreate the local database explicitly."), {name: "VersionError"});
};

export const decodeRecordValue = (record, keyFields = []) => {
    if (record === undefined) return undefined;
    if (Object.hasOwn(record, "_record") || Object.hasOwn(record, "_encoded")) return incompatible();
    if (Object.hasOwn(record, "_value")) {
        if (isObject(record._value) && !Array.isArray(record._value)) return incompatible();
        return structuredClone(record._value);
    }
    const value = structuredClone(record);
    delete value._id;
    for (const field of new Set(keyFields)) {
        const path = field.split("."), parents = [];
        let node = value;
        for (const name of path.slice(0, -1)) {
            if (!isObject(node) || !Object.hasOwn(node, name)) { node = undefined; break; }
            parents.push([node, name]);
            node = node[name];
        }
        if (!isObject(node)) continue;
        delete node[path.at(-1)];
        for (const [parent, name] of parents.reverse()) {
            if (!isObject(parent[name]) || Object.keys(parent[name]).length) break;
            delete parent[name];
        }
    }
    return value;
};

export const encodeRecordValue = value => {
    if (!isObject(value) || Array.isArray(value)) return {_value: value};
    if (["_value", "_record", "_encoded"].some(name => Object.hasOwn(value, name))) {
        fail("database/invalid-argument", "Reserved Local record field.");
    }
    const record = structuredClone(value);
    delete record._id;
    return record;
};

export const setRecordField = (record, path, value) => {
    if (["_value", "_record", "_encoded"].includes(path[0])) {
        fail("database/invalid-argument", "Reserved Local address field.");
    }
    let node = record;
    for (const name of path.slice(0, -1)) {
        if (Object.hasOwn(node, name) && !isObject(node[name])) {
            fail("database/invalid-argument", "An indexed address requires object parents.");
        }
        if (!Object.hasOwn(node, name)) set(node, name, {});
        node = node[name];
    }
    set(node, path.at(-1), value);
};
