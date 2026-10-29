import {fail} from "../../../../../../common";
import resolvePath from "../../../../../../database/src/common/resolvePath";
import invalidPath from "../../common/invalidPath";

export default async (database, ...args) => {
    if (args.length !== 2) fail("database/invalid-argument", "Expected (path, value).");
    const [path, value] = args;
    const address = resolvePath(path);
    if (invalidPath.test(address)) fail("database/invalid-argument", "Invalid Firebase path.");
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
