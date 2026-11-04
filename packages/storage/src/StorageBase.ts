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
    async upload({auth, blob, metadata, name, onProgress}: {
        auth: string | Pick<AuthBase, "resolveCurrentUser">;
        blob: Blob & {name?: string};
        metadata?: Record<string, string>;
        name?: string;
        onProgress?: (percent: string) => void;
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
