import StorageBase from "../StorageBase";
import {delay, fail, fileOperation, toDataURL} from "./common";

export default class LocalTestStorage extends StorageBase {
    constructor({storageKey = "redequate:storage:local-test"} = {}) {
        super();
        if (typeof storageKey !== "string" || !storageKey.trim()) {
            fail("invalid-argument", "storageKey must be a non-empty string.");
        }
        this._storageKey = storageKey;
    }

    async upload({auth, blob, metadata = {}, name, onProgress} = {}) {
        await delay("upload");
        if (!auth || typeof auth.resolveCurrentUser !== "function" || !(blob instanceof window.Blob) ||
            !metadata || typeof metadata !== "object" || Array.isArray(metadata) ||
            (name !== undefined && typeof name !== "string") ||
            (onProgress !== undefined && typeof onProgress !== "function")) {
            fail("invalid-argument", "Upload requires Auth, Blob, metadata and an optional name/progress callback.");
        }
        const user = await auth.resolveCurrentUser();
        if (!user || typeof user.id !== "string" || !user.id) {
            fail("unauthenticated", "An authenticated user is required.");
        }
        onProgress?.("0");
        const uuid = window.crypto.randomUUID();
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
        await delay("resolveDownloadURL");
        return (await fileOperation(this, "read", pathOrURL)).url;
    }

    async resolveMetadata(pathOrURL) {
        await delay("resolveMetadata");
        return (await fileOperation(this, "read", pathOrURL)).metadata;
    }

    async delete(pathOrURL) {
        await delay("delete");
        await fileOperation(this, "delete", pathOrURL);
    }
}
