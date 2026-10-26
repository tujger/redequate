import {resolvePackage} from "../../common";

const localBackends = new WeakMap();
const defaultKey = {};

const resolveLocalBackend = database => {
    const key = database ?? defaultKey;
    if (!localBackends.has(key)) {
        const backend = import("./local-client").then(({default: LocalBackendClient}) =>
            new LocalBackendClient({database})).catch(error => {
            localBackends.delete(key);
            throw error;
        });
        localBackends.set(key, backend);
    }
    return localBackends.get(key);
};

export default async (backend, {database} = {}) =>
    resolvePackage(backend, "backend", () => resolveLocalBackend(database));
