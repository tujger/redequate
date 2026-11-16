import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getDatabase} from "firebase-admin/database";
import {getMessaging} from "firebase-admin/messaging";
import {getStorage} from "firebase-admin/storage";

const app = initializeApp();

export const url = "https://" + app.options.projectId + ".web.app";
// export const projectTitle = "The Whisky Talks";
// export const storageBucket = app.options.storageBucket;
// export const database = getDatabase(app);
// export const databaseInstance = new URL(app.options.databaseURL).hostname.split(".")[0];
// export const dataRef = database.ref.bind(database);
export const auth = getAuth(app);
export const database = getDatabase(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);

export default {
    auth,
    database,
    messaging,
    storage,
    url,
}
