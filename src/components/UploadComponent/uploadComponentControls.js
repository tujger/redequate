import Uuid from "react-uuid";
import Resizer from "react-image-file-resizer";
import {firebaseMessaging as firebase} from "../../controllers/Firebase";

export async function uploadComponentClean(uppy, key) {
    if (uppy) {
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

export async function uploadComponentDelete(deleteFile) {
    if (deleteFile) {
        try {
            console.log("[Upload] delete old file from firebase", deleteFile);
            return firebase.storage().refFromURL(deleteFile).delete();
        } catch (e) {
            console.error("[Upload]", e);
        }
    }
}

export function uploadComponentPublish({files, name, metadata, onprogress, auth, deleteFile}) {
    return new Promise((resolve, reject) => {
        if (!files) {
            resolve();
            return;
        }

        const promises = Object.keys(files).map(key => {
            const importVariables = async () => {
                return {deleteFile, files, key, metadata, name, onprogress, uid: auth};
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
            const createUuid = async props => {
                const uuid = Uuid();
                return {...props, uuid};
            }
            const createRef = async props => {
                const {item, name, type, uid, uuid} = props;
                const ref = firebase.storage().ref().child(uid + "/" + type + "/" + (name ? name + "-" : "") + uuid + "-" + item.name);
                return {...props, ref};
            }
            const extractBlobImage = async props => {
                const {item, type} = props;
                // if (uppy._uris && uppy._uris[file.id]) {
                //     return uppy._uris[file.id].uploadURL;
                // }
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
                    const blob = new window.Blob([await item.data.arrayBuffer()], {type: item.type});
                    return {...props, blob};
                }
                return props;
            }
            const createPublishTask = async props => {
                const {blob, item, metadata, ref, uid} = props;
                const publishTask = ref.put(blob, {
                    contentType: item.type,
                    customMetadata: {
                        ...metadata,
                        uid,
                        // message: Uuid(),
                        filename: item.name
                    }
                });
                return {...props, publishTask};
            }
            const publishBlob = props => new Promise((resolve, reject) => {
                const {onprogress, publishTask} = props;
                publishTask.on(firebase.storage.TaskEvent.STATE_CHANGED, (snapshot) => {
                    const progressValue = (snapshot.bytesTransferred / snapshot.totalBytes * 100).toFixed(0);
                    onprogress && onprogress(progressValue);
                }, error => {
                    reject(error);
                }, () => {
                    resolve({...props, result: publishTask.snapshot.ref});
                });
            })
            const deleteObsoleteFile = async props => {
                if (props.deleteFile) {
                    uploadComponentDelete(props.deleteFile).catch(console.error);
                }
                return props;
            }
            const extractDownloadUrl = async props => {
                const {result} = props;
                return result.getDownloadURL().then(url => {
                    return result.getMetadata().then(metadata => {
                        return {...props, url, metadata};
                    })
                })
            }
            const exportResult = async props => {
                console.log("props", props);
                const {url, metadata} = props;
                return {url, metadata};
            }

            return importVariables()
                .then(extractItem)
                .then(detectType)
                .then(createUuid)
                .then(createRef)
                .then(extractBlobImage)
                .then(extractBlobAttahed("video"))
                .then(extractBlobAttahed("audio"))
                .then(createPublishTask)
                .then(publishBlob)
                .then(deleteObsoleteFile)
                .then(extractDownloadUrl)
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
