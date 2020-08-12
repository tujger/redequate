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
import withStyles from "@material-ui/styles/withStyles";

const maxFileSize = 1024;

const styles = theme => ({
    "@global": {
        disabled: {},
        ".uppy-Dashboard--modal .uppy-DashboardTab-name": {},
        ".uppy-Dashboard--modal .uppy-DashboardTab-btn, .uppy-Dashboard--modal .uppy-Dashboard-close, .uppy-Dashboard--modal .uppy-DashboardContent-back": {
            ...theme.typography.button,
            backgroundColor: theme.palette.secondary.main,
            borderRadius: theme.shape.borderRadius,
            boxSizing: "border-box",
            color: theme.palette.secondary.contrastText,
            minWidth: 64,
            padding: "6px 16px",
            transition: theme.transitions.create(["background-color", "box-shadow", "border"], {
                duration: theme.transitions.duration.short,
            }),
            width: "auto",
            "&:hover": {
                backgroundColor: theme.palette.secondary.dark,
                color: theme.palette.secondary.contrastText,
                textDecoration: "none",
            },
            "&$disabled": {
                color: theme.palette.action.disabled,
            },
        },
        [theme.breakpoints.up("sm")]: {
            disabled: {},
            ".uppy-Dashboard--modal .uppy-Dashboard-close": {
                display: "none"
            },
            ".uppy-Dashboard--modal .uppy-Dashboard-inner": {},
            ".uppy-Dashboard--modal .uppy-DashboardContent-back": {
                position: "absolute",
                right: theme.spacing(1),
            },
            ".uppy-Dashboard--modal .uppy-DashboardContent-bar": {
                ...theme.mixins.toolbar,
            },
            ".uppy-Dashboard--modal .uppy-DashboardContent-title": {
                ...theme.typography.h6,
                top: "auto",
            },
            ".uppy-Dashboard--modal .uppy-DashboardTab-btn": {
                backgroundColor: "transparent",
                color: theme.palette.secondary.main,
                "&:hover": {
                    backgroundColor: theme.palette.secondary.main,
                    color: theme.palette.secondary.contrastText,
                },
            },
            ".uppy-Dashboard--modal .uppy-DashboardTab-name": {
                fontSize: "inherit",
                lineHeight: "inherit",
                whiteSpace: "nowrap",
            }
        },
        [theme.breakpoints.down("xs")]: {
            disabled: {},
            selected: {},
            ".uppy-Dashboard--modal .uppy-Dashboard-close": {
                fontSize: 0,
                marginBottom: theme.spacing(1),
                marginLeft: "auto",
                marginTop: theme.spacing(1),
                position: "relative",
                right: theme.spacing(1),
                top: "auto",
                "&:before": {
                    ...theme.typography.body1,
                    content: "\"Cancel\"",
                }
            },
            ".uppy-Dashboard--modal .uppy-Dashboard-inner": {
                borderRadius: 0,
                bottom: 0,
                display: "flex",
                flexDirection: "column",
                left: 0,
                right: 0,
                top: theme.spacing(7)
            },
            ".uppy-Dashboard--modal .uppy-Dashboard-AddFiles": {
                // height: "calc()",
            },
            ".uppy-Dashboard--modal .uppy-DashboardContent-back": {
                display: "none",
            },
            ".uppy-Dashboard--modal .uppy-DashboardTab-btn": {
                ...theme.typography.body1,
                minHeight: 48,
                paddingTop: 6,
                paddingBottom: 6,
                boxSizing: "border-box",
                width: "100%",
                overflow: "hidden",
                whiteSpace: "nowrap",
                backgroundColor: "transparent",
                color: theme.palette.secondary.main,
                "&:hover": {
                    backgroundColor: theme.palette.secondary.main,
                    color: theme.palette.secondary.contrastText,
                },
            },
            ".uppy-Dashboard--modal .uppy-DashboardContent-panelBody": {
                marginTop: -40,
                zIndex: 1010,
            }
        }
    },
})

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
        uppy.on("error", (error) => {
            console.error(error);
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
            locale: {
                strings: {
                    done: "Cancel",
                }
            },
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
        <div ref={refDashboard}/>
    </React.Fragment>
}

UploadComponent.propTypes = {
    button: PropTypes.any,
    firebase: PropTypes.any,
};

export default connect()(withStyles(styles)(UploadComponent));

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
