import React from "react";
import Button from "@material-ui/core/Button";
import Uppy from "@uppy/core"
import Tus from "@uppy/tus"
import ProgressBar from "@uppy/progress-bar";
import Webcam from "@uppy/webcam";
import Dashboard from "@uppy/dashboard";
import Uuid from "react-uuid";
import "@uppy/core/dist/style.css"
import "@uppy/progress-bar/dist/style.css"
import "@uppy/dashboard/dist/style.css"
import "@uppy/webcam/dist/style.css"
import {connect} from "react-redux";
import PropTypes from "prop-types";
import useTheme from "@material-ui/styles/useTheme";

const maxFileSize = 1024;

const UploadComponent = ({button, onsuccess, onerror}) => {
    const [state, setState] = React.useState({});
    const {uppy} = state;

    const refDashboard = React.useRef(null);
    const refButton = React.useRef(null);
    const theme = useTheme();

    React.useEffect(() => {

        const uppy = Uppy({
            restrictions: {
                maxNumberOfFiles: 1,
                maxFileSize: maxFileSize * 1024,
                allowedFileTypes: ["image/*"]
            },
            autoProceed: true,
            locale: {
                strings: {
                    dropPasteImport: ""//"Drop files here",
                }
            }
        })
        uppy.on("complete", (result) => {
            // console.log("successful files:", result.successful)
            // console.log("failed files:", result.failed);
        });
        uppy.on("dashboard:modal-open", () => {
            // console.log("Modal is open", uppy)
        });
        uppy.on("upload-success", (file, snapshot) => {
            if (onsuccess) {
                onsuccess({uppy, file, snapshot});
            } else {
                console.warn("Define 'onsuccess'; snapshot is", snapshot);
            }
        });
        uppy.use(Dashboard, {
            target: refDashboard.current,
            trigger: refButton.current,
            // trigger: "#" + refButton.current.id,
            replaceTargetContent: true,
            closeModalOnClickOutside: true,
            proudlyDisplayPoweredByUppy: false,
            browserBackButtonClose: true,
            showProgressDetails: true,
            hideProgressAfterFinish: true,
            closeAfterFinish: true,
            note: `Images up to ${maxFileSize} kb`,
            theme: "auto",
        }).use(Tus, {
            endpoint: "https://master.tus.io/files/",
            removeFingerprintOnSuccess: true
        }).use(ProgressBar, {
            target: Dashboard
        }).use(Webcam, {
            target: Dashboard,
            modes: [
                "picture"
            ],
            facingMode: "user"
        });
        setState({...state, uppy: uppy});
    }, [])

    const dashboardStyle = `.uppy-Dashboard-close {
        display: none;
    }
    @media only screen and (max-width: 820px) {
        .uppy-Dashboard--modal .uppy-Dashboard-inner {
            border-radius: 0;
            bottom: 0;
            left: 0;
            right: 0;
            top: ${theme.spacing(8)}px;
        }
    }
    ${theme.breakpoints.down("xs")} {
        .uppy-Dashboard--modal .uppy-Dashboard-inner {
            border-radius: 0;
            bottom: 0;
            left: 0;
            right: 0;
            top: ${theme.spacing(7)}px;
        }
    }`;

    return <React.Fragment>
        {button ?
            <button.type {...button.props} ref={refButton} onClick={(event) => {
                uppy && uppy.reset();
                button.props.onClick && button.props.onClick(event);
            }}/>
            : <Button onClick={() => {
                uppy && uppy.reset();
            }} ref={refButton} children={"Upload"}/>
        }
        <style>{dashboardStyle}</style>
        <div ref={refDashboard}/>
    </React.Fragment>
}

UploadComponent.propTypes = {
    button: PropTypes.any,
    firebase: PropTypes.any,
};

export default connect()(UploadComponent);

export const publishFile = firebase => ({uppy, file, snapshot, metadata, onprogress, defaultUrl, auth, deleteFile}) => new Promise((resolve, reject) => {

    if (!uppy || !file) {
        resolve({url: defaultUrl, metadata: {}});
        return;
    }

    const uuid = Uuid();
    const fileRef = firebase.storage().ref().child(auth + "/images/" + uuid + "-" + file.name);
    console.log("[Upload] uploaded", file, snapshot, fileRef);
    return fetch(snapshot.uploadURL).then(response => {
        return response.blob();
    }).then(blob => {
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
                let progressValue = (snapshot.bytesTransferred / snapshot.totalBytes * 100).toFixed(0);
                onprogress && onprogress(progressValue);
            }, error => {
                reject(error);
            }, () => {
                resolve1(uploadTask.snapshot.ref);
            });
        });
    }).then(ref => {
        uppy.removeFile(file.id);
        if (deleteFile) {
            try {
                console.log("[Upload] delete old file", deleteFile);
                const ref = firebase.storage().refFromURL(deleteFile);
                const res = ref.delete();
                console.log("delete", res);
                res.then(console.log)
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
