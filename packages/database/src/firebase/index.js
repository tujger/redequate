import DatabaseBase from "../common/DatabaseBase";
import addEventListener from "./addEventListener";
import createRecord from "./create";
import FirebaseCursor from "./cursor";
import {composeCursor} from "../common/ComposedDatabaseCursor";
import deleteRecord from "./delete";
import read from "./read";
import update from "./update";
import parsePath from "./parsePath";
import {fail} from "../../../common";

export default class FirebaseDatabase extends DatabaseBase {
    #firebase;

    constructor({backend, firebase, onError}) {
        super({backend, onError});
        this.#firebase = firebase;
    }

    addEventListener(path, options = {}) {
        return super.addEventListener(path, options,
            callbacks => addEventListener(this.#firebase, path, callbacks));
    }

    async create(path, value) {
        return createRecord(this.#firebase, path, value, this.run.bind(this), super.create.bind(this));
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
                {...options, onError: options?.onError ?? this.onError}, this._backend), run, path,
            pathIsDatabasePath ? () => parsePath(path, "collection").address : undefined);
    }

    async delete(path, options = {}) {
        return deleteRecord(path, options, this.run.bind(this), super.delete.bind(this));
    }

    async read(path, options = {}) {
        if (path === "" || (Array.isArray(path) && !path.length)) {
            fail("database/invalid-argument", "read requires a non-empty path.");
        }
        return this.run(() => read(this.#firebase, path, options), options, "read",
            {path, equalTo: options?.equalTo, orderBy: options?.orderBy});
    }

    async update(path, changes, options = {}) {
        return update(path, changes, options, this.run.bind(this), super.update.bind(this));
    }
}
