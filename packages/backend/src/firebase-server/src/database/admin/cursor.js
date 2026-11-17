import {fail} from "../../../../../../common";
import parsePath from "../../../../../../database/src/firebase/helpers/parsePath";
import createCursor from "../../../../common/helpers/createCursor";
import FirebaseCursorServer from "../../FirebaseCursorServer";

export default function (path, options = {}, ...rest) {
    if (rest.length) fail("database/invalid-argument", "Expected (path, options?).");
    const database = this._database;
    return createCursor([path, options],
        (sourcePath, sourceOptions) => new FirebaseCursorServer(sourcePath, sourceOptions,
            {backend: this, database}), parsePath);
}
