import DatabaseBase from "../common/DatabaseBase";
import addEventListener from "./addEventListener";
import createRecord from "./create";
import FirebaseCursor from "./cursor";
import {composeCursor} from "../common/ComposedDatabaseCursor";
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
        return super.addEventListener(path, options,
            callbacks => addEventListener(this.#firebase, path, callbacks));
    }

    create(path, options = {}) {
        return createRecord(this.#firebase, path, options, this.run.bind(this));
    }

    cursor(path, options = {}) {
        const queries = path instanceof Array && path.some(part => typeof part === "object")
            ? path : [{path}];
        return composeCursor(queries, options,
            (path, options) => new FirebaseCursor(this.#firebase, path, options),
            this.run.bind(this), path);
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
        const batch = typeof path !== "string" && !(path instanceof Array);
        return this.run(() => update(this.#firebase, path, batch ? undefined : changes),
            batch ? changes ?? options : options, "update", batch ? {updates: path} : {path, changes});
    }

    get TIMESTAMP() {
        return this.#firebase.database.ServerValue.TIMESTAMP;
    }

    increment(delta) {
        return this.#firebase.database.ServerValue.increment(delta);
    }
}
