// Mirror Dispatcher wiring while keeping each test's services explicit.
import BackendBase from "../../packages/backend/src/common/BackendBase";
import DatabaseBase from "../../packages/database/src/common/DatabaseBase";

export default function createService(Service, options = {}) {
    const service = new Service(options);
    for (const [name, setter] of [["backend", "setBackend"], ["database", "setDatabase"], ["auth", "setAuth"], ["storage", "setStorage"]]) {
        if (options[name] !== undefined && typeof service[setter] === "function") service[setter](options[name]);
    }
    if (service instanceof DatabaseBase && typeof options.backend?.setDatabase === "function") {
        options.backend.setDatabase(service);
    }
    if (service instanceof BackendBase && typeof options.database?.setBackend === "function") {
        options.database.setBackend(service);
    }
    return service;
}

// Explicit fixture for tests of unindexed singleton documents; built-in meta is indexed.
export const singletonMetaStore = {store: "singleton", storeConfig: {keyPath: "_id", autoIncrement: true}, storeSchema: []};
