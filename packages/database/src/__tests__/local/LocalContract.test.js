import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";
import {databaseContract} from "../common/databaseContract";

let serial = 0;
beforeEach(() => { globalThis.indexedDB = new IDBFactory(); });

databaseContract(() => {
    const db = new LocalDatabase({storageKey: `contract-${++serial}`});
    const path = "meta";
    const record = key => [path, {id: key, _: true}];
    return {
        db,
        local: true,
        path,
        record,
        createdRecord: key => [path, {id: key}],
        put: (key, value) => db.update(record(key), () => value),
        remove: key => db.delete(record(key))
    };
});
