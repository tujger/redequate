import {initializeApp, deleteApp} from "firebase/app";
import {getAuth, connectAuthEmulator, signInAnonymously} from "firebase/auth";
import {getDatabase, connectDatabaseEmulator, goOffline} from "firebase/database";
import {createRequire} from "node:module";
const serverRequire = createRequire(`${process.env.SHALLOW_TEST_FRAMEWORK_ROOT ?? process.cwd()}/packages/backend/src/firebase-server/package.json`);
const {initializeApp: initializeAdminApp, deleteApp: deleteAdminApp} = serverRequire("firebase-admin/app");
const {getDatabase: getAdminDatabase} = serverRequire("firebase-admin/database");
import FirebaseDatabase from "../../firebase";
import FirebaseBackendServer from "../../../../backend/src/firebase-server/src/FirebaseBackendServer";

it("reads only immediate keys through authenticated Client/Admin REST and enforces Rules", async () => {
    const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
    const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const projectId = process.env.GCLOUD_PROJECT;
    if (!/^127\.0\.0\.1:\d+$/.test(host) || !/^127\.0\.0\.1:\d+$/.test(authHost) || !projectId?.startsWith("demo-")) {
        throw Error("Shallow integration requires isolated loopback demo emulators.");
    }
    const config = {projectId, apiKey: "demo-key", databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`};
    const url = path => `http://${host}/${path}.json?ns=${projectId}-default-rtdb`;
    const seed = await fetch(url("mutual"), {method: "PUT", headers: {Authorization: "Bearer owner"},
        body: JSON.stringify({friend: {r1: {uid: "a", nested: {secret: "not requested"}}, r2: {uid: "b"}}, following: {r3: {uid: "a"}}, scalar: 7})});
    expect(seed.ok).toBe(true);
    const savedRules = await (await fetch(url(".settings/rules"), {headers: {Authorization: "Bearer owner"}})).json();
    const setRules = rules => fetch(url(".settings/rules"), {method: "PUT", headers: {Authorization: "Bearer owner"}, body: typeof rules === "string" ? rules : JSON.stringify(rules)});
    const app = initializeApp(config, `shallow-client-${Date.now()}`);
    const anonymousApp = initializeApp(config, `shallow-denied-${Date.now()}`);
    const adminApp = initializeAdminApp(config, `shallow-admin-${Date.now()}`);
    const db = getDatabase(app), deniedDb = getDatabase(anonymousApp);
    connectDatabaseEmulator(db, "127.0.0.1", Number(host.split(":")[1]));
    connectDatabaseEmulator(deniedDb, "127.0.0.1", Number(host.split(":")[1]));
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${authHost}`, {disableWarnings: true});
    connectAuthEmulator(getAuth(anonymousApp), `http://${authHost}`, {disableWarnings: true});
    try {
        expect((await setRules({rules: {".read": false, ".write": false, mutual: {".read": "auth != null"}}})).ok).toBe(true);
        await signInAnonymously(auth);
        const database = new FirebaseDatabase({firebase: {app}});
        expect((await database.read(["mutual", "mutual_type"], {shallow: true})).sort()).toEqual(["following", "friend", "scalar"]);
        expect((await database.read(["mutual", {mutual_type: "friend"}, "mutual_id"], {shallow: true})).sort()).toEqual(["r1", "r2"]);
        expect(await database.read(["mutual", {mutual_type: "missing"}], {shallow: true})).toEqual([]);
        expect(await database.read(["mutual", {mutual_type: "scalar"}], {shallow: true})).toEqual([]);
        const denied = new FirebaseDatabase({firebase: {app: anonymousApp}});
        await expect(denied.read(["mutual", "mutual_type"], {shallow: true})).rejects.toMatchObject({code: "database/permission-denied"});
        const backend = new FirebaseBackendServer(() => getAdminDatabase(adminApp));
        expect((await backend.request("database.read", ["mutual", "mutual_type"], {shallow: true})).sort()).toEqual(["following", "friend", "scalar"]);
    } finally {
        await setRules(savedRules);
        await fetch(url("mutual"), {method: "DELETE", headers: {Authorization: "Bearer owner"}});
        goOffline(db); goOffline(deniedDb);
        await Promise.all([deleteApp(app), deleteApp(anonymousApp), deleteAdminApp(adminApp)]);
    }
});
