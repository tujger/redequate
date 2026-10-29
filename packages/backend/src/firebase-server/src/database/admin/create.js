import {fail} from "../../../../../../common";
import parseCreatePath from "../../../../../../database/src/common/parseCreatePath";
import resolvePath from "../../../../../../database/src/common/resolvePath";
import invalidPath from "../../common/invalidPath";

export default async (database, ...args) => {
    if (args.length !== 2) fail("database/invalid-argument", "Expected (path, value).");
    const [path, value] = args;
    const {parentPath, key} = parseCreatePath(path);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        fail("database/invalid-argument", "value must be a record object.");
    }
    const parent = resolvePath(parentPath);
    if (invalidPath.test(parent) || key !== undefined && (invalidPath.test(key) || key.includes("/"))) {
        fail("database/invalid-argument", "Invalid Firebase path or record key.");
    }
    const collection = database.ref(parent);
    const reference = key === undefined ? collection.push() : collection.child(key);
    const {committed} = await reference.transaction(current => current === null ? value : undefined, undefined, false);
    if (!committed) fail("database/conflict", "Record already exists.");
    return reference.key;
};
