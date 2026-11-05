import {getDatabase, ServerValue} from "firebase-admin/database";
import {getMessaging} from "firebase-admin/messaging";
import type {getStorage} from "firebase-admin/storage";
import {fail} from "../../../../common";
import BackendBase from "../../common/BackendBase";
import create from "./database/admin/create";
import cursor from "./database/admin/cursor";
import deleteRecord from "./database/admin/delete";
import read from "./database/admin/read";
import update from "./database/admin/update";
import FirebaseServerStorage from "./FirebaseServerStorage";
import {send} from "./notification/send";
import userContext from "./common/userContext";

const requests = {
    "database.create": create,
    "database.cursor": cursor,
    "database.delete": deleteRecord,
    "database.read": read,
    "database.update": update,
    "notification.send": send,
};

export default class FirebaseServerBackend extends BackendBase {
    readonly getDatabaseInstance: typeof getDatabase;
    readonly getMessagingInstance: typeof getMessaging;
    readonly createIncrement: typeof ServerValue.increment;

    constructor(
        getDatabaseInstance: typeof getDatabase = getDatabase,
        createIncrement: typeof ServerValue.increment = ServerValue.increment,
        options: NonNullable<ConstructorParameters<typeof BackendBase>[0]> & {
            getStorageInstance?: typeof getStorage;
            getMessagingInstance?: typeof getMessaging;
        } = {},
    ) {
        super(options);
        this.setStorage(new FirebaseServerStorage(options.getStorageInstance));
        this.getMessagingInstance = options.getMessagingInstance ?? getMessaging;
        this.getDatabaseInstance = getDatabaseInstance;
        this.createIncrement = createIncrement;
    }

    get projectUrl(): string {
        return this._projectUrl ?? `https://${this.getDatabaseInstance().app.options.projectId}.web.app`;
    }

    get TIMESTAMP() {
        return ServerValue.TIMESTAMP;
    }

    increment(n: number) {
        return this.createIncrement(n);
    }

    async getCurrentUser(): Promise<string | undefined> {
        return userContext.getStore();
    }

    async request(name: string, ...args: unknown[]): Promise<unknown> {
        if (!Object.hasOwn(requests, name)) {
            fail("backend/not-implemented", `Backend request ${name} is not implemented.`);
        }
        return requests[name].call(this, ...args);
    }
}
