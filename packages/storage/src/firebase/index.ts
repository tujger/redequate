import type {FirebaseApp} from "firebase/app";
import type {FirebaseStorage as StorageInstance, FullMetadata, StorageReference} from "firebase/storage";
import {deleteObject, getDownloadURL, getMetadata, getStorage, ref, uploadBytesResumable} from "firebase/storage";
import {fail} from "../../../common";
import {v4 as Uuid} from "uuid";
import StorageBase from "../StorageBase";

export default class FirebaseStorage extends StorageBase {
    protected _storage: StorageInstance;

    constructor({firebase}: {firebase: {app: FirebaseApp}}) {
        super();
        this._storage = getStorage(firebase.app);
    }

    async delete(pathOrURL: string): Promise<void> {
        return deleteObject(ref(this._storage, pathOrURL));
    }

    async resolveDownloadURL(pathOrURL: string): Promise<string> {
        return getDownloadURL(ref(this._storage, pathOrURL));
    }

    async resolveMetadata(pathOrURL: string): Promise<FullMetadata> {
        return getMetadata(ref(this._storage, pathOrURL));
    }

    async upload({blob, metadata, name, onProgress}: Parameters<StorageBase["upload"]>[0]): Promise<{url: string; metadata: FullMetadata}> {
        if (!this._auth) return fail("storage/auth-required", "An Auth provider is required.");
        const user = await this._auth.resolveCurrentUser();
        if (!user || typeof user.id !== "string" || !user.id) {
            return fail("storage/unauthenticated", "An authenticated user is required.");
        }
        const uid = user.id;
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

        return new Promise<StorageReference>((resolve, reject) => {
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
