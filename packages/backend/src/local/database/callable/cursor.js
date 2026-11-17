import createCursor from "../../../common/helpers/createCursor";
import LocalCursor from "../../../../../database/src/local/cursor";
import parsePath from "../../../../../database/src/local/helpers/parsePath";

export default function ({storageId, args}) {
    const database = this._database;
    return createCursor(args,
        (path, options) => new LocalCursor(path, options,
            {backend: this, database, context: storageId}), parsePath);
}
