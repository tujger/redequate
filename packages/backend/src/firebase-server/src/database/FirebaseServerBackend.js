import BackendBase from "../../../common/BackendBase";
import {getDatabase, ServerValue} from "firebase-admin/database";
import {fail} from "../../../../../common";
import create from "./admin/create";
import update from "./admin/update";
import deleteRecord from "./admin/delete";

const requests = {
    "database.create": create,
    "database.update": update,
    "database.delete": deleteRecord,
};

export default class FirebaseServerBackend extends BackendBase {
    constructor(getDatabaseInstance = getDatabase, createIncrement = ServerValue.increment) {
        super();
        this.getDatabaseInstance = getDatabaseInstance;
        this.createIncrement = createIncrement;
    }

    increment(n) {
        return this.createIncrement(n);
    }

    async request(name, ...args) {
        if (!Object.hasOwn(requests, name)) {
            fail("backend/not-implemented", `Backend request ${name} is not implemented.`);
        }
        return requests[name](this.getDatabaseInstance(), ...args);
    }
}
