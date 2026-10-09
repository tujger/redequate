import StorageBase from "../StorageBase";

export default class FirebaseStorage extends StorageBase {
    _firebase = undefined;

    constructor({firebase}) {
        super();
        this._firebase = firebase;
    }

}
