import type {Database, DataSnapshot, Query, Reference} from "firebase-admin/database";
import FirebaseCursorBase, {type QueryMethod} from "../../../../database/src/common/FirebaseCursorBase";
import type {DatabasePath, DatabaseCursorOptions, DatabaseValue} from "../../../../database/src/common/DatabaseTypes";
import type BackendBase from "../../common/BackendBase";

export default class FirebaseServerCursor extends FirebaseCursorBase {
    readonly #database: Database;

    constructor(database: Database, path: DatabasePath, options: DatabaseCursorOptions = {}, backend?: BackendBase) {
        super(path, options, backend);
        this.#database = database;
    }

    protected override _reference(address: string): Reference {
        return this.#database.ref(address);
    }

    protected override _query(reference: Query, method: QueryMethod, ...args: DatabaseValue[]): Query {
        const constrain = reference[method] as (...values: DatabaseValue[]) => Query;
        return constrain.apply(reference, args);
    }

    protected override _readSnapshot(reference: Query): Promise<DataSnapshot> {
        return reference.once("value");
    }
}
