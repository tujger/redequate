import {notImplemented} from "../../_common/src/_packages";

export default class StorageBase {
    async upload({auth, blob, metadata, name, onProgress}) {
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
