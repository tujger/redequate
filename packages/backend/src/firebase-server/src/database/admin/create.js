import {fail} from "../../../../../../common";
import parsePath from "../../../../../../database/src/firebase/parsePath";
import invalidPath from "../../common/invalidPath";
import _transaction from "./_transaction";

export default async (database, path, value, ...args) => {
    if (args.length) fail("database/invalid-argument", "Expected (path, value).");
    const {parentAddress: parent, key} = parsePath(path, "create");
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        fail("database/invalid-argument", "value must be a record object.");
    }
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
