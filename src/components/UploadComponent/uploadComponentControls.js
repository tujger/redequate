import Uuid from "react-uuid";

export function uploadComponentClean(uppy) {
    if (uppy) {
        const file = uppy.getFiles()[0];
        if (file) {
            uppy.removeFile(file.id);
            console.log("[UploadComponent] file removed", file);
        }
    }
}

export function uploadComponentPublish(firebase) {
    return ({uppy, name, metadata, onprogress, auth, deleteFile}) => new Promise((resolve, reject) => {
        if (!uppy) {
            resolve();
            return;
        }
        const file = uppy.getFiles()[0];

        const fetchImage = async () => {
            if (uppy._uris && uppy._uris[file.id]) {
                return uppy._uris[file.id];
            }
            return window.fetch(file.uploadURL).then(response => {
                return response.blob();
            })
        }

        const uuid = Uuid();
        const fileRef = firebase.storage().ref().child(auth + "/images/" + (name ? name + "-" : "") + uuid + "-" + file.name);

        console.log("[Upload] uploaded", file, fileRef);
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
            uploadComponentClean(uppy);
            if (deleteFile) {
                try {
                    console.log("[Upload] delete old file", deleteFile);
                    firebase.storage().refFromURL(deleteFile).delete();
                } catch (e) {
                    console.error("[Upload]", e);
                }
            }
            return ref;
        }).then(ref => {
            ref.getDownloadURL().then(url => {
                ref.getMetadata().then(metadata => {
                    resolve({url: url, metadata: metadata});
                }).catch(error => {
                    reject(error);
                })
            }).catch(error => {
                reject(error);
            })
        });
    });
}
