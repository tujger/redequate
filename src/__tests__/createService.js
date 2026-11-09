// Mirror Dispatcher wiring while keeping each test's services explicit.
export default function createService(Service, options = {}) {
    const service = new Service(options);
    for (const [name, setter] of [["backend", "setBackend"], ["database", "setDatabase"], ["auth", "setAuth"], ["storage", "setStorage"]]) {
        if (options[name] !== undefined && typeof service[setter] === "function") service[setter](options[name]);
    }
    return service;
}

// Explicit fixture for tests of unindexed singleton documents; built-in meta is indexed.
export const singletonMetaStore = {store: "singleton", storeConfig: {keyPath: "_id", autoIncrement: true}, storeSchema: []};
