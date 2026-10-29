import {fail} from "../../../../../../common";
import parsePath from "../../../../../../database/src/firebase/parsePath";
import invalidPath from "../../common/invalidPath";

export default async (database, path, ...args) => {
    if (args.length) fail("database/invalid-argument", "Expected (path).");
    const address = parsePath(path).address;
    if (invalidPath.test(address)) fail("database/invalid-argument", "Invalid Firebase path.");
    const snapshot = await database.ref(address).get();
    return snapshot.val();
};
