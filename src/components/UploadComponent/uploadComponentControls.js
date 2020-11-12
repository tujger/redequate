import Uuid from "react-uuid";

export function uploadComponentClean(uppy, key) {
    if (uppy) {
        Object.keys(uppy._uris).map(itemKey => {
            if (key && key !== itemKey) return;
            const file = uppy._uris[itemKey];
            if (file) {
                uppy.removeFile(file.id);
                console.log("[UploadComponent] file removed", file);
            }
            delete uppy._uris[itemKey];
        });
    }
}

export function uploadComponentPublish(firebase) {
    return ({uppy, name, metadata, onprogress, auth, deleteFile}) => new Promise((resolve, reject) => {
        if (!uppy) {
            resolve();
            return;
        }

        const promises = Object.keys(uppy._uris).map(key => {
            const file = uppy._uris[key];
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
