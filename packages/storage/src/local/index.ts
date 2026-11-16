import type {StorageMetadata} from "../StorageBase";
import {LOCAL_DATABASE_NAME} from "../../../common/src/localDatabase";
import {delay, fail, identifier} from "../../../common";
import StorageBase from "../StorageBase";
import {fileOperation, toDataURL} from "./common";

// Local simulation only: IndexedDB is used for store blobs
export default class LocalStorage extends StorageBase {
    readonly storageId: string;

    constructor({storageId = LOCAL_DATABASE_NAME}: {storageId?: string} = {}) {
        super();
        if (typeof storageId !== "string" || !storageId.trim()) {
            fail("storage/invalid-argument", "storageId must be a non-empty string.");
        }
        this.storageId = storageId;
    }

    async upload(options?: Parameters<StorageBase["upload"]>[0]): Promise<{url: string; metadata: StorageMetadata}> {
        const {blob, metadata = {}, name, onProgress, uid: uidGiven} = options ?? {};
        await delay("LocalStorage", "upload");
        if (!(blob instanceof window.Blob) ||
            !metadata || typeof metadata !== "object" || metadata instanceof Array ||
            (name !== undefined && typeof name !== "string") ||
            (onProgress !== undefined && !(onProgress instanceof Function))) {
            return fail("storage/invalid-argument", "Upload requires Blob, metadata and an optional name/progress callback.");
        }
        if (!this._auth) return fail("storage/auth-required", "An Auth provider is required.");
        const user = await this._auth.resolveCurrentUser();
        if (!user || typeof user.id !== "string" || !user.id) {
            fail("storage/unauthenticated", "An authenticated user is required.");
        }
        onProgress?.("0");
        const uuid = identifier();
        const contentType = blob.type || "application/octet-stream";
        const type = blob.type.split("/")[0] || "application";
        const filename = blob.name || name || "file";
        const uid = uidGiven ?? user.id;
        const fullPath = `${uid}/${type}/${name ? `${name}-` : ""}${uuid}-${filename}`;
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

    async resolveDownloadURL(pathOrURL: string): Promise<string> {
        await delay("LocalStorage", "resolveDownloadURL");
        return ((await fileOperation(this, "read", pathOrURL)) as {url: string}).url;
    }

    async resolveMetadata(pathOrURL: string): Promise<StorageMetadata> {
        await delay("LocalStorage", "resolveMetadata");
        return ((await fileOperation(this, "read", pathOrURL)) as {metadata: StorageMetadata}).metadata;
    }

    async delete(pathOrURL: string): Promise<void> {
        await delay("LocalStorage", "delete");
        await fileOperation(this, "delete", pathOrURL);
    }
}
