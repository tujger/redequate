import {delay, fail} from "../../../common";
import BackendBase from "../BackendBase";
import {recordRequest, snapshot} from "./common";
import defaultHandlers from "./handlers";

// Local simulation only; request history is persisted in IndexedDB.
export default class LocalTestBackendClient extends BackendBase {
    constructor({handlers = {}, storageKey = "redequate:backend:local-test-client"} = {}) {
        super();
        if (typeof storageKey !== "string" || !storageKey.trim()) {
            fail("backend/invalid-argument", "storageKey must be a non-empty string.");
        }
        if (!handlers || typeof handlers !== "object" || handlers instanceof Array ||
            Object.entries(handlers).some(([name, handler]) => !name.trim() || !(handler instanceof Function))) {
            fail("backend/invalid-argument", "handlers must be an object of named functions.");
        }
        this._storageKey = storageKey;
        this._handlers = {...defaultHandlers, ...Object.fromEntries(Object.entries(handlers))};
    }

    async request(name, args) {
        if (typeof name !== "string" || !name.trim()) {
            fail("backend/invalid-argument", "Request name must be a non-empty string.");
        }
        const startedAt = Date.now();
        const record = {name, args: snapshot(args), startedAt};
        try {
            await delay("LocalTestBackendClient", "request");
            if (!Object.prototype.hasOwnProperty.call(this._handlers, name)) {
                fail("backend/not-found", `No local handler registered for ${name}.`);
            }
            const result = await this._handlers[name](args);
            record.status = "fulfilled";
            record.result = snapshot(result);
            return result;
        } catch (error) {
            record.status = "rejected";
            record.error = snapshot(error instanceof Error
                ? {name: error.name, message: error.message, code: error.code}
                : error);
            throw error;
        } finally {
            record.durationMs = Date.now() - startedAt;
            await recordRequest(this._storageKey, record);
        }
    }
}
