import DatabaseBase from "../DatabaseBase";
import addEventListener from "./addEventListener";
import createRecord from "./create";
import deleteRecord from "./delete";
import read from "./read";
import update from "./update";
import write from "./write";

export default class FirebaseDatabase extends DatabaseBase {
    #firebase = undefined;

    constructor({firebase}) {
        super();
        this.#firebase = firebase;
    }

    addEventListener(path, {onChange, onChildAdd, onChildChange, onChildRemove, onError, orderBy}) {
        return addEventListener(this.#firebase, path, {
            onChange,
            onChildAdd,
            onChildChange,
            onChildRemove,
            onError,
            orderBy
        });
    }

    create(path) {
        return createRecord(this.#firebase, path);
    }

    async delete(path, {} = {}) {
        return deleteRecord(this.#firebase, path);
    }

    async read(path, {equalTo, orderBy} = {}) {
        return read(this.#firebase, path, {equalTo, orderBy});
    }

    async write(path, value, {} = {}) {
        return write(this.#firebase, path, value);
    }

    async update(path, changes, {} = {}) {
        return update(this.#firebase, path, changes);
    }

    get TIMESTAMP() {
        return this.#firebase.database.ServerValue.TIMESTAMP
    }

    increment(delta) {
        return this.#firebase.database.ServerValue.increment(delta)
    }
}
