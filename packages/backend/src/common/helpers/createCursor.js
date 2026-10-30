import {fail} from "../../../../common";
import {composeCursor} from "../../../../database/src/common/ComposedDatabaseCursor";

export default (args, createSource, parsePath) => {
    if (![1, 2].includes(args.length)) {
        fail("database/invalid-argument", "Expected (path, options?).");
    }
    const [path, options = {}] = args;
    const single = typeof path === "string" || (Array.isArray(path) &&
        (path.length === 0 || typeof path[0] === "string"));
    const queries = Array.isArray(path) && !single ? path : [{path}];
    return composeCursor(queries, options, createSource, operation => operation(), path,
        single ? () => parsePath(path, "collection").address : undefined);
};
