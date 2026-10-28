import {increment} from "firebase/database";
import {getFunctions, httpsCallable} from "firebase/functions";
import BackendClientBase from "../BackendClientBase";

export default class FirebaseBackendClient extends BackendClientBase {
    _functions = undefined;

    constructor({firebase}) {
        super();
        this._functions = getFunctions(firebase.app);
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
