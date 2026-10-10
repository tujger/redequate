import BackendBase from "../BackendBase";

export default class FirebaseBackendClient extends BackendBase {
    _firebase = undefined;

    constructor({firebase}) {
        super();
        this._firebase = firebase;
    }

    async callFunction(name, args) {
        const func = await this._firebase.functions().httpsCallable(name);
        return func(args).then(result => result.data);
    }
}
