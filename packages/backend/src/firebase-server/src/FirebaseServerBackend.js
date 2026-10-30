import FirebaseServerStorage from "./FirebaseServerStorage.js";
import {getMessaging} from "firebase-admin/messaging";
import {sendToTokens} from "./notification/send.js";
import BackendBase from "../../common/BackendBase.ts";
import {getDatabase, ServerValue} from "firebase-admin/database";
import {fail} from "../../../../common/index.js";
import read from "./database/admin/read.js";
import create from "./database/admin/create.js";
import update from "./database/admin/update.js";
import deleteRecord from "./database/admin/delete.js";

const requests = {
    "database.read": read,
    "database.create": create,
    "database.update": update,
    "database.delete": deleteRecord,
};

export default class FirebaseServerBackend extends BackendBase {
    constructor(getDatabaseInstance = getDatabase, createIncrement = ServerValue.increment, options = {}) {
        super(options);
        this.storage = new FirebaseServerStorage(options.getStorageInstance);
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
