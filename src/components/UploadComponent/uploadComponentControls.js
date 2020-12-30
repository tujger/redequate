import Uuid from "react-uuid";
import Resizer from "react-image-file-resizer";

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

export async function uploadComponentDelete(firebase, deleteFile) {
    if (deleteFile) {
        try {
            console.log("[Upload] delete old file from firebase", deleteFile);
            return firebase.storage().refFromURL(deleteFile).delete();
        } catch (e) {
            console.error("[Upload]", e);
        }
    }
}

export function uploadComponentPublish(firebase) {
    return ({files, name, metadata, onprogress, auth, deleteFile}) => new Promise((resolve, reject) => {
        if (!files) {
            resolve();
            return;
        }

        const promises = Object.keys(files).map(key => {
            const file = files[key];
            const fetchImage = async () => {
                // if (uppy._uris && uppy._uris[file.id]) {
                //     return uppy._uris[file.id].uploadURL;
                // }
                return window.fetch(file.uploadURL).then(response => {
                    return response.blob();
                })
            }
            const uuid = Uuid();
            const fileRef = firebase.storage().ref().child(auth + "/images/" + (name ? name + "-" : "") + uuid + "-" + file.name);

            console.log("[Upload] uploaded to firebase", file, fileRef);
            return fetchImage().then(blob => {
                // eslint-disable-next-line promise/param-names
                return new Promise((resolve1, reject1) => {
                    const uploadTask = fileRef.put(blob, {
                        contentType: file.type,
                        customMetadata: {
                            ...metadata,
                            uid: auth,
                            // message: Uuid(),
                            filename: file.name
                        }
                    });
                    uploadTask.on(firebase.storage.TaskEvent.STATE_CHANGED, (snapshot) => {
                        const progressValue = (snapshot.bytesTransferred / snapshot.totalBytes * 100).toFixed(0);
                        onprogress && onprogress(progressValue);
                    }, error => {
                        reject(error);
                    }, () => {
                        resolve1(uploadTask.snapshot.ref);
                    });
                });
            }).then(ref => {
                if (deleteFile) {
                    uploadComponentDelete(firebase, deleteFile).catch(console.error);
                }
                return ref;
            }).then(ref => {
                return ref.getDownloadURL().then(url => {
                    return ref.getMetadata().then(metadata => {
                        return {url: url, metadata: metadata};
                    })
                })
            });
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
    Resizer.imageFileResizer(
        data,
        maxWidth,
        maxHeight,
        imageType,
        quality,
        0,
        uri => {
            console.error(JSON.stringify(descriptor));
            descriptor.uploadURL = uri;
            resolve(descriptor);
        },
        "base64"
    )
})
