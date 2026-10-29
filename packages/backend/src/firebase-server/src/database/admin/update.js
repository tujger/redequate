import {fail} from "../../../../../../common";
import resolvePath from "../../../../../../database/src/common/resolvePath";
import invalidPath from "../../common/invalidPath";
import {conditionalUpdate} from "./_transaction";

export default async (database, path, value, options = {}, ...args) => {
    if (args.length) fail("database/invalid-argument", "Expected (path, value, options?).");
    const address = resolvePath(path);
    if (invalidPath.test(address)) fail("database/invalid-argument", "Invalid Firebase path.");
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
        fail("database/invalid-argument", "Invalid update options.");
    }
    if (options.mode !== undefined) return conditionalUpdate(database, address, value, options);
    if (address) {
        await database.ref(address).set(value);
    } else {
        const changes = value instanceof Map
            ? Object.fromEntries([...value].map(([path, value]) => [resolvePath(path), value]))
            : value;
        if (changes === null || typeof changes !== "object" || Array.isArray(changes)) {
            fail("database/invalid-argument", "Batch updates require an object or Map.");
        }
        await database.ref().update(changes);
    }
    return null;
};
