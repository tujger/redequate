import {increment, serverTimestamp} from "firebase/database";
import {getFunctions, httpsCallable} from "firebase/functions";
import {StorageBase} from "../../../storage";
import {BackendBase} from "../common";

class FirebaseClientStorage extends StorageBase {
    async delete(pathOrURL) {
        console.log("[FirebaseClientStorage] delete ignored", {pathOrURL});
    }
}

export default class FirebaseBackendClient extends BackendBase {
    _functions = undefined;

    constructor({firebase, ...options}) {
        super({...options, storage: new FirebaseClientStorage()});
        this._functions = getFunctions(firebase.app);
    }

    get TIMESTAMP() {
        return serverTimestamp();
    }

    increment(n) {
        return increment(n);
    }

    async request(name, ...args) {
        const endpoint = name.replaceAll(".", "-");
        const func = httpsCallable(this._functions, endpoint);
        const payload = args.length > 1 ? args : args[0];
        return func(payload).then(result => result.data);
    }
}
