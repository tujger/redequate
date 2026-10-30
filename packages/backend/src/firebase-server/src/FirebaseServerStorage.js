import StorageBase from "../../../../storage/src/StorageBase";
import {getStorage} from "firebase-admin/storage";
import {fail} from "../../../../common";

export default class FirebaseServerStorage extends StorageBase {
    constructor(getStorageInstance = getStorage) {
        super();
        this.getStorageInstance = getStorageInstance;
    }

    async delete(pathOrURL) {
        if (typeof pathOrURL !== "string" || !pathOrURL.trim()) {
            fail("storage/invalid-argument", "Expected a non-empty file path or URL.");
        }
        const bucket = this.getStorageInstance().bucket();
        let name = pathOrURL;
        if (/^[a-z][a-z0-9+.-]*:/i.test(name)) {
            const url = new URL(name);
            if (url.protocol === "gs:") {
                if (url.hostname !== bucket.name) fail("storage/invalid-argument", "The file belongs to another bucket.");
                name = decodeURIComponent(url.pathname.slice(1));
            } else if (["https:", "http:"].includes(url.protocol)) {
                const firebase = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
                const google = url.hostname === "storage.googleapis.com" && url.pathname.match(/^\/([^/]+)\/(.+)$/);
                const match = firebase || google;
                if (!match || decodeURIComponent(match[1]) !== bucket.name) fail("storage/invalid-argument", "Expected a URL in the configured bucket.");
                name = decodeURIComponent(match[2]);
            } else fail("storage/invalid-argument", "Unsupported Storage URL.");
        }
        if (!name) fail("storage/invalid-argument", "Expected a file path.");
        await bucket.file(name).delete({ignoreNotFound: true});
    }
}
