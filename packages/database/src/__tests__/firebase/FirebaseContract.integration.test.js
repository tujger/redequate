import FirebaseCursor from "../../firebase/cursor";
import {database, firebase} from "../../../../../src/__tests__/common";
import {databaseContract} from "../common/databaseContract";

databaseContract(() => {
    const path = "database_test";
    return {
        db: database,
        rawCursor: options => new FirebaseCursor(firebase, path, options),
        path,
        record: key => [path, {id: key}],
        put: (key, value) => firebase.database().ref(`${path}/${key}`).set(value),
        remove: key => firebase.database().ref(`${path}/${key}`).remove()
    };
});
