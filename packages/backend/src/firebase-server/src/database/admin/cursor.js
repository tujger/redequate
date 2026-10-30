import {fail} from "../../../../../../common";
import parsePath from "../../../../../../database/src/firebase/parsePath";
import createCursor from "../../../../common/helpers/createCursor.js";
import FirebaseServerCursor from "../../FirebaseServerCursor.js";

export default function (path, options = {}, ...rest) {
    if (rest.length) fail("database/invalid-argument", "Expected (path, options?).");
    const database = this.getDatabaseInstance();
    return createCursor([path, options],
        (sourcePath, sourceOptions) => new FirebaseServerCursor(database, sourcePath, sourceOptions, this), parsePath);
}
