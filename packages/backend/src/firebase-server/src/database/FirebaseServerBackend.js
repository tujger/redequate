import {getMessaging} from "firebase-admin/messaging";
import {sendToTokens} from "../notification/send";
import BackendBase from "../../../common/BackendBase";
import {getDatabase, ServerValue} from "firebase-admin/database";
import {fail} from "../../../../../common";
import read from "./admin/read";
import create from "./admin/create";
import update from "./admin/update";
import deleteRecord from "./admin/delete";

const requests = {
    "database.read": read,
    "database.create": create,
    "database.update": update,
    "database.delete": deleteRecord,
};

export default class FirebaseServerBackend extends BackendBase {
    constructor(getDatabaseInstance = getDatabase, createIncrement = ServerValue.increment, options = {}) {
        super(options);
        this.getMessagingInstance = options.getMessagingInstance ?? getMessaging;
        this.getDatabaseInstance = getDatabaseInstance;
        this.createIncrement = createIncrement;
    }

    get projectUrl() {
        return this._projectUrl ?? `https://${this.getDatabaseInstance().app.options.projectId}.web.app`;
    }

    get TIMESTAMP() {
        return ServerValue.TIMESTAMP;
    }

    increment(n) {
        return this.createIncrement(n);
    }

    async request(name, ...args) {
        if (name === "notification.send") return sendToTokens(this.getMessagingInstance(), ...args);
        if (!Object.hasOwn(requests, name)) {
            fail("backend/not-implemented", `Backend request ${name} is not implemented.`);
        }
        return requests[name](this.getDatabaseInstance(), ...args);
    }
}
