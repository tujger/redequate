import type {DataSnapshot, Query, Reference} from "firebase-admin/database";
import type {DatabaseValue} from "../../../../database/src/common/DatabaseTypes";
import FirebaseCursorBase, {type QueryMethod} from "../../../../database/src/common/FirebaseCursorBase";
import type FirebaseBackendServer from "./FirebaseBackendServer";

export default class FirebaseCursorServer extends FirebaseCursorBase {
    protected override _reference(address: string): Reference {
        return (this._backend as FirebaseBackendServer).getDatabaseInstance().ref(address);
    }

    protected override _query(reference: Query, method: QueryMethod, ...args: DatabaseValue[]): Query {
        const constrain = reference[method] as (...values: DatabaseValue[]) => Query;
        return constrain.apply(reference, args);
    }

    protected override _readSnapshot(reference: Query): Promise<DataSnapshot> {
        return reference.once("value");
    }
}
