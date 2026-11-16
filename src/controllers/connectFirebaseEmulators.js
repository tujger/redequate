import {connectAuthEmulator, getAuth} from "firebase/auth";
import {connectDatabaseEmulator, getDatabase} from "firebase/database";
import {connectFunctionsEmulator, getFunctions} from "firebase/functions";
import {connectStorageEmulator, getStorage} from "firebase/storage";

/** Connect before constructing providers; LAN traffic uses the frontend's HTTPS proxies. */
export default function connectFirebaseEmulators(firebase, emulators, location = globalThis.location) {
    if (!location?.origin || !location.hostname) throw new Error("Firebase emulators require a browser location.");
    for (const service of ["database", "functions", "storage"]) {
        if (!Number.isInteger(emulators?.[service]?.port) || emulators[service].port < 1 || emulators[service].port > 65535) {
            throw new Error(`Missing or invalid ${service} emulator port.`);
        }
    }
    const {hostname: host, port, origin} = location;
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(host);
    const servicePort = service => loopback ? emulators[service].port : Number(port || 443);
    connectAuthEmulator(getAuth(firebase.app), origin);
    connectDatabaseEmulator(getDatabase(firebase.app), host, servicePort("database"));
    connectFunctionsEmulator(getFunctions(firebase.app), host, servicePort("functions"));
    connectStorageEmulator(getStorage(firebase.app), host, servicePort("storage"));
}
