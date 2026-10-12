import DatabaseBase from "../DatabaseBase";
import addEventListener from "./addEventListener";
import deleteRecord from "./delete";
import read from "./read";
import update from "./update";
import write from "./write";

export default class FirebaseDatabase extends DatabaseBase {
    _firebase = undefined;

    constructor({firebase}) {
        super();
        this._firebase = firebase;
    }

    addEventListener(path, {onChange, onChildAdd, onChildChange, onChildRemove, onError, orderBy}) {
        return addEventListener.call(this, path, {
            onChange,
            onChildAdd,
            onChildChange,
            onChildRemove,
            onError,
            orderBy
        });
    }

    async delete(path, {} = {}) {
        return deleteRecord.call(this, path);
    }

    async read(path, {equalTo, orderBy} = {}) {
        return read.call(this, path, {equalTo, orderBy});
    }

    async write(path, value, {} = {}) {
        return write.call(this, path, value);
    }

    async update(path, changes, {} = {}) {
        return update.call(this, path, changes);
    }

    get TIMESTAMP() {
        return this._firebase.database.ServerValue.TIMESTAMP
    }
}
