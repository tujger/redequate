import {deleteObject, getDownloadURL, getMetadata, getStorage, ref, uploadBytesResumable} from "firebase/storage";
import {v4 as Uuid} from "uuid";
import StorageBase from "../StorageBase";

export default class FirebaseStorage extends StorageBase {
    _storage = undefined;

    constructor({firebase}) {
        super();
        this._storage = getStorage(firebase.app);
    }

    async delete(pathOrURL) {
        return deleteObject(ref(this._storage, pathOrURL));
    }

    async resolveDownloadURL(pathOrURL) {
        return getDownloadURL(ref(this._storage, pathOrURL));
    }

    async resolveMetadata(pathOrURL) {
        return getMetadata(ref(this._storage, pathOrURL));
    }

    async upload({auth, blob, metadata, name, onProgress}) {
        // return super.upload(path, blob, metadata, onProgress);
        const uid = typeof auth === "string" ? auth : (await auth.resolveCurrentUser()).id;
        const uuid = Uuid();
        const type = blob.type.split("/")[0];
        const reference = ref(this._storage, uid + "/" + type + "/" + name + "-" + uuid + "-" + blob.name);

        const publishTask = uploadBytesResumable(reference, blob, {
            contentType: blob.type,
            customMetadata: {
                ...metadata,
                uid,
                // message: Uuid(),
                filename: blob.name ?? name
            }
        });

        return new Promise((resolve, reject) => {
            publishTask.on("state_changed", (snapshot) => {
                const progressValue = (snapshot.bytesTransferred / snapshot.totalBytes * 100).toFixed(0);
                onProgress?.(progressValue);
            }, error => {
                reject(error);
            }, () => {
                resolve(publishTask.snapshot.ref)
            });
        }).then(ref => {
            return getDownloadURL(ref).then(url => {
                return getMetadata(ref).then(metadata => {
                    return {url, metadata};
                })
            })
        });
    }
}
