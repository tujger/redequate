import {getFunctions, httpsCallable} from "firebase/functions";
import BackendBase from "../BackendBase";

export default class FirebaseBackendClient extends BackendBase {
    _functions = undefined;

    constructor({firebase}) {
        super();
        this._functions = getFunctions(firebase.app);
    }

    async request(name, args) {
        const func = httpsCallable(this._functions, name);
        return func(args).then(result => result.data);
    }
}
