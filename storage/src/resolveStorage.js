export const resolveStorage = async storage => {
    if (storage === undefined) {
        const {default: LocalTestStorage} = await import("./local-test/index.js");
        return new LocalTestStorage();
    }
    if (storage === null || typeof storage !== "object" || Array.isArray(storage)) {
        throw new Error("Dispatcher storage must be a Storage instance created with new Storage(...)");
    }
    return storage;
};
