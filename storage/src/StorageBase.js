const notImplemented = method => {
    throw new Error(`Not implemented: ${method}`);
};

export default class StorageBase {
    async upload(path, blob, metadata, onProgress) {
        return notImplemented("upload");
    }

    async resolveDownloadURL(pathOrURL) {
        return notImplemented("resolveDownloadURL");
    }

    async resolveMetadata(pathOrURL) {
        return notImplemented("resolveMetadata");
    }

    async delete(pathOrURL) {
        return notImplemented("delete");
    }
}
