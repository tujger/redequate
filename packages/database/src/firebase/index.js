import {composeCursor} from "../common";
import DatabaseBase from "../DatabaseBase";
import addEventListener from "./addEventListener";
import createRecord from "./create";
import cursor from "./cursor";
import deleteRecord from "./delete";
import read from "./read";
import update from "./update";
import write from "./write";

export default class FirebaseDatabase extends DatabaseBase {
    #firebase;

    constructor({firebase, onError}) {
        super({onError});
        this.#firebase = firebase;
    }

    addEventListener(path, options = {}) {
        let callbackFailure;
        const report = (error, reason, context) => {
            try {
                this.handleError(error, options, reason, context);
            } catch (failure) {
                callbackFailure = {error: failure};
                throw failure;
            }
        };
        const callbackOptions = {
            onError: report
        };
        // A callback can run during registration. Do not report its failure twice.
        const registrationOptions = {
            onError: (error, reason, context) => {
                if (callbackFailure && Object.is(callbackFailure.error, error)) {
                    throw error;
                }
                this.handleError(error, options, reason, context);
            }
        };
        return this.run(() => {
            const {onChange, onChildAdd, onChildChange, onChildRemove, orderBy} = options;
            const wrap = (name, callback, argument) => {
                if (typeof callback !== "function") {
                    return callback;
                }
                return value => this.run(() => callback(value), callbackOptions,
                    `addEventListener.${name}`, {path, [argument]: value});
            };
            const listener = addEventListener(this.#firebase, path, {
                onChange: wrap("onChange", onChange, "value"),
                onChildAdd: wrap("onChildAdd", onChildAdd, "entry"),
                onChildChange: wrap("onChildChange", onChildChange, "entry"),
                onChildRemove: wrap("onChildRemove", onChildRemove, "entry"),
                onError: error => report(error, "addEventListener", {path, orderBy}),
                orderBy
            });
            return {
                remove: () => this.run(() => listener.remove(), options,
                    "addEventListener.remove", {path})
            };
        }, registrationOptions, "addEventListener", {path});
    }

    create(path, options = {}) {
        return this.run(() => {
            const draft = createRecord(this.#firebase, path);
            return {
                temporaryKey: draft.temporaryKey,
                save: async value => this.run(() => draft.save(value), options,
                    "create.save", {path, value})
            };
        }, options, "create", {path});
    }

    async delete(path, options = {}) {
        return this.run(() => deleteRecord(this.#firebase, path), options, "delete", {path});
    }

    async read(path, options = {}) {
        return this.run(() => read(this.#firebase, path, options), options, "read",
            {path, equalTo: options?.equalTo, orderBy: options?.orderBy});
    }

    async write(path, value, options = {}) {
        return this.run(() => write(this.#firebase, path, value), options, "write", {path, value});
    }

    async update(path, changes, options = {}) {
        const batch = typeof path !== "string" && !Array.isArray(path);
        return this.run(() => update(this.#firebase, path, batch ? undefined : changes),
            batch ? changes ?? options : options, "update", batch ? {updates: path} : {path, changes});
    }

    cursor(path, options = {}) {
        if (Array.isArray(path) && path.some(part => typeof part === "object")) {
            return this.identifyCursor(composeCursor(path, options,
                (sourcePath, sourceOptions, tracking) => this.#createCursor(sourcePath, sourceOptions, tracking),
                (operation, reason, context) => this.run(operation, options, reason, {path, ...context})));
        }
        return this.identifyCursor(this.#createCursor(path, options));
    }

    #createCursor(path, options, tracking) {
        return this.run(() => {
            const source = cursor(this.#firebase, path, options, tracking);
            return {
                get position() {
                    return source.position;
                },
                next: async (n = 1) => this.run(() => source.next(n), options,
                    "cursor.next", {path, n}),
                reset: () => this.run(() => source.reset(), options, "cursor.reset", {path})
            };
        }, options, "cursor", {path});
    }

    get TIMESTAMP() {
        return this.run(() => this.#firebase.database.ServerValue.TIMESTAMP,
            undefined, "TIMESTAMP", {});
    }

    increment(delta, options = {}) {
        return this.run(() => this.#firebase.database.ServerValue.increment(delta),
            options, "increment", {delta});
    }
}
