import {fail} from "../../../../../../common";
import resolvePath from "../../../../../../database/src/common/resolvePath";
import invalidPath from "../../common/invalidPath";

export default async (database, path, ...args) => {
    if (args.length) fail("database/invalid-argument", "Expected (path).");
    const address = resolvePath(args[0]);
    if (invalidPath.test(address)) fail("database/invalid-argument", "Invalid Firebase path.");
    console.debug("[Backend:Admin:Delete]", `delete [${address}]`);
    await database.ref(address).remove();
    return null;
};
