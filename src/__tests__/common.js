import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/database";
import FirebaseAuth from "../../auth/src/firebase";
import {createStore} from "redux";
import {currentUserData, useCurrentUserData} from "../controllers/UserData";

export const projectId = process.env.GCLOUD_PROJECT;
export const databaseNamespace = `${projectId}-default-rtdb`;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const databaseHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
if (!projectId?.startsWith("demo-") || authHost !== "127.0.0.1:9099" || databaseHost !== "127.0.0.1:9000") {
    throw new Error("Run integration tests with npm run test:integration; local emulators are required");
}
firebase.initializeApp({
    apiKey: "emulator-only-key",
    authDomain: "localhost",
    projectId,
    databaseURL: `https://${databaseNamespace}.firebaseio.com`,
});
firebase.auth().useEmulator(`http://${authHost}`, {disableWarnings: true});
firebase.database().useEmulator("127.0.0.1", 9000);
export {firebase};
export const auth = new FirebaseAuth({firebase});
export const store = createStore((state, action) => ({
    ...state,
    ...currentUserData(state, action),
}), {userData: null});

export async function emulatorRequest(path, options = {}) {
    const response = await fetch(`http://${authHost}/emulator/v1/projects/${projectId}/${path}`, options);
    if (!response.ok) throw new Error(`Auth emulator ${response.status}`);
    return response.status === 204 ? null : response.json();
}

export async function seedDatabase(value) {
    const response = await fetch(`http://${databaseHost}/.json?ns=${databaseNamespace}`, {
        method: "PUT",
        headers: {Authorization: "Bearer owner", "Content-Type": "application/json"},
        body: JSON.stringify(value),
    });
    if (!response.ok) throw new Error(`Database emulator ${response.status}`);
}

beforeEach(async () => {
    await firebase.auth().signOut();
    useCurrentUserData(null);
    await emulatorRequest("accounts", {method: "DELETE"});
    await seedDatabase(null);
    window.localStorage.clear();
});

afterAll(async () => {
    await firebase.auth().signOut();
    firebase.database().goOffline();
    await firebase.app().delete();
});
