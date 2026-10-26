import {LOCAL_DATABASE_NAME} from "../../../common/src/localDatabase";
import {delay, fail, identifier} from "../../../common";
import StorageBase from "../StorageBase";
import {fileOperation, toDataURL} from "./common";

// Local simulation only: IndexedDB is used for store blobs
export default class LocalStorage extends StorageBase {
    constructor({storageId = LOCAL_DATABASE_NAME} = {}) {
        super();
        if (typeof storageId !== "string" || !storageId.trim()) {
            fail("storage/invalid-argument", "storageId must be a non-empty string.");
        }
        this.storageId = storageId;
    }

    async upload({auth, blob, metadata = {}, name, onProgress} = {}) {
        await delay("LocalStorage", "upload");
        if (!auth || !(auth.resolveCurrentUser instanceof Function) || !(blob instanceof window.Blob) ||
            !metadata || typeof metadata !== "object" || metadata instanceof Array ||
            (name !== undefined && typeof name !== "string") ||
            (onProgress !== undefined && !(onProgress instanceof Function))) {
            fail("storage/invalid-argument", "Upload requires Auth, Blob, metadata and an optional name/progress callback.");
        }
        const user = await auth.resolveCurrentUser();
        if (!user || typeof user.id !== "string" || !user.id) {
            fail("storage/unauthenticated", "An authenticated user is required.");
        }
        onProgress?.("0");
        const uuid = identifier();
        const contentType = blob.type || "application/octet-stream";
        const type = blob.type.split("/")[0] || "application";
        const filename = blob.name || name || "file";
        const fullPath = `${user.id}/${type}/${name ? `${name}-` : ""}${uuid}-${filename}`;
        const fileMetadata = window.structuredClone({
            contentType,
            fullPath,
            name: fullPath.split("/").pop(),
            size: blob.size,
            customMetadata: {...metadata, uid: user.id, filename}
        });
        const url = `${await toDataURL(blob.slice(0, blob.size, contentType))}#${uuid}`;
        await fileOperation(this, "upload", {fullPath, blob, url, metadata: fileMetadata});
        onProgress?.("100");
        return {url, metadata: fileMetadata};
    }

    async resolveDownloadURL(pathOrURL) {
        await delay("LocalStorage", "resolveDownloadURL");
        return (await fileOperation(this, "read", pathOrURL)).url;
    }

    async resolveMetadata(pathOrURL) {
        await delay("LocalStorage", "resolveMetadata");
        return (await fileOperation(this, "read", pathOrURL)).metadata;
    }

    async delete(pathOrURL) {
        await delay("LocalStorage", "delete");
        await fileOperation(this, "delete", pathOrURL);
    }
}
