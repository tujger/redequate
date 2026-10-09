import {v4 as Uuid} from "uuid";
import StorageBase from "../StorageBase";

export default class FirebaseStorage extends StorageBase {
    _firebase = undefined;

    constructor({firebase}) {
        super();
        this._firebase = firebase;
    }

    async delete(pathOrURL) {
        return this._firebase.storage()
            .refFromURL(pathOrURL)
            .delete()
    }

    async resolveMetadata(pathOrURL) {
        const ref = this._firebase.storage().refFromURL(pathOrURL);
        if (ref) {
            return await ref.getMetadata();
        }
    }

    async upload({auth, blob, metadata, name, onProgress}) {
        // return super.upload(path, blob, metadata, onProgress);
        const uid = typeof auth === "string" ? auth : (await auth.resolveCurrentUser()).id;
        const uuid = Uuid();
        const type = blob.type.split("/")[0];
        const ref = this._firebase.storage().ref().child(uid + "/" + type + "/" + name + "-" + uuid + "-" + blob.name);

        const publishTask = ref.put(blob, {
            contentType: blob.type,
            customMetadata: {
                ...metadata,
                uid,
                // message: Uuid(),
                filename: blob.name ?? name
            }
        });

        return new Promise((resolve, reject) => {
            publishTask.on(this._firebase.storage.TaskEvent.STATE_CHANGED, (snapshot) => {
                const progressValue = (snapshot.bytesTransferred / snapshot.totalBytes * 100).toFixed(0);
                onProgress?.(progressValue);
            }, error => {
                reject(error);
            }, () => {
                resolve(publishTask.snapshot.ref)
            });
        }).then(ref => {
            return ref.getDownloadURL().then(url => {
                return ref.getMetadata().then(metadata => {
                    return {url, metadata};
                })
            })
        });
    }
}
