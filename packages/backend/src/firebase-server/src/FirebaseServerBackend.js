import {getDatabase, ServerValue} from "firebase-admin/database";
import {getMessaging} from "firebase-admin/messaging";
import {fail} from "../../../../common";
import BackendBase from "../../common/BackendBase.ts";
import create from "./database/admin/create";
import cursor from "./database/admin/cursor";
import deleteRecord from "./database/admin/delete";
import read from "./database/admin/read";
import update from "./database/admin/update";
import FirebaseServerStorage from "./FirebaseServerStorage.js";
import {send} from "./notification/send.js";

const requests = {
    "database.create": create,
    "database.cursor": cursor,
    "database.delete": deleteRecord,
    "database.read": read,
    "database.update": update,
    "notification.send": send,
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
        if (!Object.hasOwn(requests, name)) {
            fail("backend/not-implemented", `Backend request ${name} is not implemented.`);
        }
        return requests[name].call(this, ...args);
    }
}
