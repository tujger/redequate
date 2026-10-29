import {fail} from "../../../../../../common";
import resolvePath from "../../../../../../database/src/common/resolvePath";
import invalidPath from "../../common/invalidPath";

export default async (database, ...args) => {
    if (args.length !== 1) fail("database/invalid-argument", "Expected (path).");
    const address = resolvePath(args[0]);
    if (invalidPath.test(address)) fail("database/invalid-argument", "Invalid Firebase path.");
    await database.ref(address).remove();
    return null;
};
