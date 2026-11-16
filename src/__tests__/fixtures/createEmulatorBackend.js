import {getAuth} from "firebase/auth";
import {serverTimestamp, increment, push, ref, getDatabase} from "firebase/database";
import parsePath from "../../../packages/database/src/firebase/parsePath";

// The adapter suite runs Auth/RTDB only. Exercise its writes against real RTDB
// rules and ETags; Functions transport is covered by the applications' suites.
export default function createEmulatorBackend(firebase) {
    const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
    const project = process.env.GCLOUD_PROJECT;
    if (!project?.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(host ?? "") || Number(host.split(":")[1]) < 10000) {
        throw new Error("An isolated RTDB emulator is required.");
    }
    const request = async (address, method, value, headers = {}) => {
        const url = new URL(`http://${host}/${address}.json`);
        url.searchParams.set("ns", `${project}-default-rtdb`);
        const user = getAuth(firebase.app).currentUser;
        if (user) url.searchParams.set("auth", await user.getIdToken());
        const response = await fetch(url, {method, headers: {"Content-Type": "application/json", ...headers},
            ...(method === "GET" ? {} : {body: JSON.stringify(value)})});
        const result = await response.json();
        if (!response.ok && response.status !== 412) {
            throw Object.assign(new Error(result.error ?? "Emulator request failed"), {code: "database/permission-denied"});
        }
        return {value: result, etag: response.headers.get("etag"), committed: response.ok};
    };
    return {
        get TIMESTAMP() { return serverTimestamp(); },
        increment,
        async request(name, path, value, options = {}) {
            if (name === "database.create") {
                const {parentAddress, key: supplied} = parsePath(path, "create");
                const key = supplied ?? push(ref(getDatabase(firebase.app), parentAddress)).key;
                const address = [parentAddress, key].filter(Boolean).join("/");
                const current = await request(address, "GET", undefined, {"X-Firebase-ETag": "true"});
                if (current.value !== null) throw Object.assign(new Error("Record already exists"), {code: "database/conflict"});
                const saved = await request(address, "PUT", value, {"If-Match": current.etag});
                if (!saved.committed) throw Object.assign(new Error("Record already exists"), {code: "database/conflict"});
                return key;
            }
            const address = parsePath(path).address;
            if (name === "database.delete") { await request(address, "DELETE"); return null; }
            if (name !== "database.update") throw new Error(`Unsupported test backend command: ${name}`);
            if (options.mode === "read") {
                const {value, etag} = await request(address, "GET", undefined, {"X-Firebase-ETag": "true"});
                return {value, etag};
            }
            if (options.mode === "replace") return request(address, "PUT", value, {"If-Match": options.etag, "X-Firebase-ETag": "true"});
            const changes = value instanceof Map
                ? Object.fromEntries([...value].map(([path, child]) => [parsePath(path).address, child])) : value;
            await request(address, "PATCH", changes);
            return null;
        },
    };
}
