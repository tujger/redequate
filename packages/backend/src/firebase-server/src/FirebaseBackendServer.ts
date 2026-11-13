import {getAuth} from "firebase-admin/auth";
import {getDatabase, ServerValue} from "firebase-admin/database";
import {getMessaging} from "firebase-admin/messaging";
import type {getStorage} from "firebase-admin/storage";
import {fail, UserRole} from "../../../../common";
import BackendBase from "../../common/BackendBase";
import userContext from "./common/userContext";
import create from "./database/admin/create";
import cursor from "./database/admin/cursor";
import deleteRecord from "./database/admin/delete";
import read from "./database/admin/read";
import update from "./database/admin/update";
import sendEmail from "./email/send";
import FirebaseStorageServer from "./FirebaseStorageServer";
import sendNotification from "./notification/send";

const requests = {
    "database.create": create,
    "database.cursor": cursor,
    "database.delete": deleteRecord,
    "database.read": read,
    "database.update": update,
    "email.send": sendEmail,
    "notification.send": sendNotification,
};

export default class FirebaseBackendServer extends BackendBase {
    readonly getAuthInstance: typeof getAuth;
    readonly getDatabaseInstance: typeof getDatabase;
    readonly getMessagingInstance: typeof getMessaging;
    readonly createIncrement: typeof ServerValue.increment;

    constructor(
        getDatabaseInstance: typeof getDatabase = getDatabase,
        createIncrement: typeof ServerValue.increment = ServerValue.increment,
        options: NonNullable<ConstructorParameters<typeof BackendBase>[0]> & {
            getAuthInstance?: typeof getAuth;
            getStorageInstance?: typeof getStorage;
            getMessagingInstance?: typeof getMessaging;
        } = {},
    ) {
        super(options);
        this.setStorage(new FirebaseStorageServer(options.getStorageInstance));
        this.getAuthInstance = options.getAuthInstance ?? getAuth;
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

    async changeRole(uid: string, role: string | null): Promise<void> {
        await this.getAuthInstance(this.getDatabaseInstance().app)
            .setCustomUserClaims(uid, role === UserRole.ADMIN ? {admin: true} : null);
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
