import {ref, set, remove} from "firebase/database";
import FirebaseCursor from "../../firebase/cursor";
import {database, firebase, sdkDatabase, backend} from "../../../../../src/__tests__/common";
import {databaseContract} from "../common/databaseContract";

databaseContract(() => {
    const path = "database_test";
    return {
        db: database,
        rawCursor: options => new FirebaseCursor(firebase, path, options, backend),
        path,
        record: key => [path, {id: key}],
        put: (key, value) => set(ref(sdkDatabase, `${path}/${key}`), value),
        remove: key => remove(ref(sdkDatabase, `${path}/${key}`))
    };
});
