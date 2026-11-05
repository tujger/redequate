import type AuthBase from "../../auth/src/AuthBase";
import {notImplemented} from "../../common";

export interface StorageMetadata {
    contentType?: string;
    fullPath: string;
    name: string;
    size: number;
    customMetadata?: Record<string, string>;
}

export default class StorageBase {
    protected _auth?: AuthBase;

    setAuth(auth: AuthBase): void {
        this._auth = auth;
    }

    async upload({blob, metadata, name, onProgress, uid}: {
        blob: Blob & {name?: string};
        metadata?: Record<string, string>;
        name?: string;
        onProgress?: (percent: string) => void;
        uid?: string;
    }): Promise<{url: string; metadata: StorageMetadata}> {
        return notImplemented("upload");
    }

    async resolveDownloadURL(pathOrURL: string): Promise<string> {
        return notImplemented("resolveDownloadURL");
    }

    async resolveMetadata(pathOrURL: string): Promise<StorageMetadata> {
        return notImplemented("resolveMetadata");
    }

    async delete(pathOrURL: string): Promise<void> {
        return notImplemented("delete");
    }
}
