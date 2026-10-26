import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getMessaging} from "firebase-admin/messaging";
import {getStorage} from "firebase-admin/storage";
import create from "./database/create";
import deleteRecord from "./database/delete";
import update from "./database/update";

const app = initializeApp();

export const database = {create, update, delete: deleteRecord};
// export const projectUrl = "https://" + app.options.projectId + ".web.app";
// export const projectTitle = "The Whisky Talks";
// export const storageBucket = app.options.storageBucket;
// export const database = getDatabase(app);
// export const databaseInstance = new URL(app.options.databaseURL).hostname.split(".")[0];
// export const dataRef = database.ref.bind(database);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);
