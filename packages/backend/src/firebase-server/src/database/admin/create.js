import {fail} from "../../../../../../common";
import parsePath from "../../../../../../database/src/common/parsePath";
import resolvePath from "../../../../../../database/src/common/resolvePath";
import invalidPath from "../../common/invalidPath";
import _transaction from "./_transaction";

export default async (database, path, value, ...args) => {
    if (args.length) fail("database/invalid-argument", "Expected (path, value).");
    const parsed = parsePath(path);
    if (parsed.literal || parsed.path.length < 2) fail("database/invalid-argument", "create requires a collection path followed by a key field name.");
    const parentPath = parsed.path.slice(0, -1);
    const last = parsed.path.at(-1);
    const fieldName = typeof last === "string" ? last : parsed.segments.at(-1).name;
    const key = typeof last === "string" ? undefined : last[fieldName];
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        fail("database/invalid-argument", "value must be a record object.");
    }
    const parent = resolvePath(parentPath);
    if (invalidPath.test(parent) || key !== undefined && (invalidPath.test(key) || key.includes("/"))) {
        fail("database/invalid-argument", "Invalid Firebase path or record key.");
    }
    console.debug("[Backend:Admin:Create]", `create [${parent}]`, {value});
    const collection = database.ref(parent);
    const reference = key === undefined ? collection.push() : collection.child(key);
    const {committed} = await _transaction(reference, current => current === null ? value : undefined);
    if (!committed) fail("database/conflict", "Record already exists.");
    return reference.key;
};
