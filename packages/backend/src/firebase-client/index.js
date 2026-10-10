import BackendBase from "../BackendBase";

export default class FirebaseBackendClient extends BackendBase {
    _firebase = undefined;

    constructor({firebase}) {
        super();
        this._firebase = firebase;
    }

    async callAs(name, options) {
        const func = this._firebase.functions().httpsCallable(name);
        return func(options).then(result => result.data);
    }

}
