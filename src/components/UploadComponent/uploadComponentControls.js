import Resizer from "react-image-file-resizer";

export async function uploadComponentClean(uppy, key) {
    if (uppy?._uris) {
        Object.keys(uppy._uris).map(itemKey => {
            if (key && key !== itemKey) return;
            const file = uppy._uris[itemKey];
            if (file) {
                uppy.removeFile(file.id);
                console.log("[UploadComponent] file removed from uppy", file);
            }
            delete uppy._uris[itemKey];
        });
    }
}

async function uploadComponentDelete(deleteFile, storage) {
    if (deleteFile) {
        try {
            console.log("[Upload] delete old file from firebase", deleteFile);
            return storage.delete(deleteFile);
        } catch (e) {
            console.error("[Upload]", e);
        }
    }
}

export function uploadComponentPublish({files, name, metadata, onprogress, auth, deleteFile, storage}) {
    return new Promise((resolve, reject) => {
        if (!files) {
            resolve();
            return;
        }

        const promises = Object.keys(files).map(key => {
            const importVariables = async () => {
                return {deleteFile, files, key, metadata, name, onprogress, auth};
            }
            const extractItem = async props => {
                const {files, key} = props;
                return {...props, item: files[key]};
            }
            const detectType = async props => {
                const {item} = props;
                const type = item.type.split("/")[0];
                return {...props, type};
            }
            const extractBlobImage = async props => {
                const {item, type} = props;
                if (type === "image") {
                    const blob = await window.fetch(item.uploadURL).then(response => {
                        return response.blob();
                    })
                    return {...props, blob};
                }
                return props;
            }
            const extractBlobAttahed = attachedType => async props => {
                const {item, type} = props;
                if (type === attachedType) {
                    const blob = new window.Blob([await item.data.arrayBuffer()], {
                        type: item.type,
                        name: item.name
                    });
                    return {...props, blob};
                }
                return props;
            }
            const publishBlob = async props => {
                const {blob, onprogress, name} = props;
                const result = await storage.upload({
                    auth,
                    name,
                    blob,
                    metadata,
                    onProgress: onprogress
                })
                return {...props, ...result}
            }
            const deleteObsoleteFile = async props => {
                if (props.deleteFile) {
                    uploadComponentDelete(props.deleteFile, storage).catch(console.error);
                }
                return props;
            }
            const exportResult = async props => {
                console.log("props", props);
                const {url, metadata} = props;
                return {url, metadata};
            }

            return importVariables()
                .then(extractItem)
                .then(detectType)
                .then(extractBlobImage)
                .then(extractBlobAttahed("video"))
                .then(extractBlobAttahed("audio"))
                .then(publishBlob)
                .then(deleteObsoleteFile)
                .then(exportResult)
        })

        Promise.all(promises)
            .then(resolve)
            .catch(reject);
    });
}

export const uploadComponentResize = ({descriptor = {}, limits = {}}) => new Promise((resolve, reject) => {
    const {data, type} = descriptor;
    const imageType = type === "image/png" ? "PNG" : "JPEG";

    const {maxWidth, maxHeight, quality} = limits;
    try {
        Resizer.imageFileResizer(
            data,
            maxWidth,
            maxHeight,
            imageType,
            quality,
            0,
            uri => {
                console.log(JSON.stringify(descriptor));
                descriptor.uploadURL = uri;
                resolve(descriptor);
            },
            "base64"
        )
    } catch (e) {
        reject(e);
    }
})
