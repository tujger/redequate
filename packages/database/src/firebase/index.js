import {serverTimestamp, increment} from "firebase/database";
import DatabaseBase from "../common/DatabaseBase";
import addEventListener from "./addEventListener";
import createRecord from "./create";
import FirebaseCursor from "./cursor";
import {composeCursor} from "../common/ComposedDatabaseCursor";
import deleteRecord from "./delete";
import read from "./read";
import update from "./update";
import resolvePath from "../common/resolvePath";
import {fail} from "../../../common";

export default class FirebaseDatabase extends DatabaseBase {
    #firebase;
    #backend;

    constructor({backend, firebase, onError}) {
        super({onError});
        this.#backend = backend;
        this.#firebase = firebase;
    }

    addEventListener(path, options = {}) {
        return super.addEventListener(path, options,
            callbacks => addEventListener(this.#firebase, path, callbacks));
    }

    async create(path, value) {
        return createRecord(this.#firebase, this.#backend, path, value, this.run.bind(this));
    }

    cursor(path, options = {}) {
        const run = this.run.bind(this);
        const pathIsDatabasePath = typeof path === "string" ||
            (path instanceof Array && (path.length === 0 || typeof path[0] === "string"));
        const queries = path instanceof Array && !pathIsDatabasePath
            ? path
            : [{path}];
        // Leave invalid options intact for the composition's constructor to validate.
        const effective = options === null || typeof options !== "object" || options instanceof Array
            ? options
            : {...options, onError: options.onError ?? this.onError};
        return composeCursor(queries, effective,
            (path, options) => new FirebaseCursor(this.#firebase, path,
                {...options, onError: options?.onError ?? this.onError}), run, path,
            pathIsDatabasePath ? () => resolvePath(Array.isArray(path) && path.length > 1 &&
                typeof path.at(-1) === "string" ? path.slice(0, -1) : path) : undefined);
    }

    async delete(path, options = {}) {
        return this.run(() => deleteRecord(this.#firebase, path), options, "delete", {path});
    }

    async read(path, options = {}) {
        if (path === "" || (Array.isArray(path) && !path.length)) {
            fail("database/invalid-argument", "read requires a non-empty path.");
        }
        return this.run(() => read(this.#firebase, path, options), options, "read",
            {path, equalTo: options?.equalTo, orderBy: options?.orderBy});
    }

    async update(path, changes, options = {}) {
        const batch = typeof path !== "string" && !(path instanceof Array);
        return this.run(() => update(this.#firebase, this.#backend, path, batch ? undefined : changes),
            batch ? changes ?? options : options, "update", batch ? {updates: path} : {path, changes});
    }

    get TIMESTAMP() {
        return serverTimestamp();
    }

    increment(delta) {
        return increment(delta);
    }
}
