import React from "react";
import Button from "@material-ui/core/Button";
import VideoIcon from "@material-ui/icons/Movie";
import AudioIcon from "@material-ui/icons/Audiotrack";
import FlipIcon from "@material-ui/icons/FlipCameraAndroid";
import Uppy from "@uppy/core";
import ProgressBar from "@uppy/progress-bar";
import Webcam from "@uppy/webcam";
import Dashboard from "@uppy/dashboard";
import {connect} from "react-redux";
import PropTypes from "prop-types";
import withStyles from "@material-ui/styles/withStyles";
import ReactDOM from "react-dom";
import "@uppy/core/dist/style.css";
import "@uppy/progress-bar/dist/style.css";
import "@uppy/dashboard/dist/style.css";
import "@uppy/webcam/dist/style.css";
import {useTranslation} from "react-i18next";
import notifySnackbar from "../../controllers/notifySnackbar";
import {uploadComponentClean, uploadComponentResize} from "./uploadComponentControls";
import {useMetaInfo, usePages, useStore} from "../../controllers/General";

const MAX_FILE_SIZE = 20 * 1024;

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
        ".uppy-Dashboard--modal .uppy-Webcam-button--switch": {
            backgroundColor: theme.palette.secondary.light,
            color: theme.palette.secondary.contrastText,
            marginRight: theme.spacing(1.5),
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
            },
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
            },
        }
    },
})

const UploadComponent = (
    {
        button,
        camera = true,
        imageDescriptors,
        onsuccess,
        onerror,
        limits = {},
        facingMode: givenFacingMode,
        multi = true
    }) => {
    const [state, setState] = React.useState({facingMode: givenFacingMode || "user"});
    const {uppy, facingMode} = state;
    const {t} = useTranslation();
    const metaInfo = useMetaInfo();
    const {settings = {}} = metaInfo || {};
    const {uploadsAllow, uploadsTypes,
        uploadsMaxHeight, uploadsMaxSize, uploadsMaxWidth, uploadsQuality} = settings;

    const refDashboard = React.useRef(null);
    const refButton = React.useRef(null);

    const {
        width = uploadsMaxWidth,
        height = uploadsMaxHeight,
        size = uploadsMaxSize * 1024,
        quality = uploadsQuality
    } = limits;

    const allowedFileTypes = uploadsTypes || [];

    React.useEffect(() => {
        if (!uploadsAllow) return;
        const uppy = Uppy({
            allowMultipleUploads: multi,
            autoProceed: true,
            locale: {
                strings: {
                    dropPasteImport: "" // "Drop files here",
                }
            },
            restrictions: {
                maxNumberOfFiles: multi ? 10 : 1,
                maxFileSize: MAX_FILE_SIZE * 1024,
                allowedFileTypes
            },
        })
        uppy.on("file-added", (result) => {
            // if (!maxWidth) return;
            // if (maxSize && maxSize > result.size) return;
            const type = result.type.split("/")[0];

            uppy._uris = uppy._uris || {};
            if (!multi) {
                Object.keys(uppy._uris).map(item => {
                    uploadComponentClean(uppy, item.id);
                })
            }

            if (type === "image") {
                console.log(`[UploadComponent] resize ${result.name} to ${width}x${height} with quality ${quality}`);

                uploadComponentResize({
                    descriptor: result,
                    limits: {
                        maxWidth: width,
                        maxHeight: height,
                        quality,
                    }
                })
                    .then(result => {
                        uppy._uris[result.id] = result;
                        uppy.emit("upload-success", result, {
                            status: "complete",
                            body: null,
                            uploadURL: result.uploadURL
                        });
                        setState(state => ({...state, uppy}));
                    })
                    .catch(console.error);
            } else if (type === "video") {
                console.log(type, result);
                uppy._uris[result.id] = result;
                let uploadURL = <VideoIcon/>;
                getVideoCover(result.data)
                    .then(blob => new Promise((resolve) => {
                        var a = new window.FileReader();
                        a.onload = function(e) {
                            uploadURL = e.target.result;
                            resolve();
                        }
                        a.readAsDataURL(blob);
                    }))
                    .finally(() => {
                        result.uploadURL = uploadURL;
                        uppy.emit("upload-success", result, {
                            status: "complete",
                            body: null,
                            uploadURL
                        });
                        setState(state => ({...state, uppy}));
                    })
            } else if (type === "audio") {
                console.log(type, result);
                uppy._uris[result.id] = result;
                const uploadURL = <AudioIcon/>;
                result.uploadURL = uploadURL;
                uppy.emit("upload-success", result, {
                    status: "complete",
                    body: null,
                    uploadURL
                });
                setState(state => ({...state, uppy}));
            } else {
                console.log(type, result);
                setState(state => ({...state, uppy}));
            }
        });
        uppy.on("complete", (result) => {
        });
        uppy.on("error", (error) => {
            console.error(error);
        });
        uppy.on("dashboard:modal-open", () => {
            console.log("[UploadComponent] popup is open", uppy);
            if (camera === true) return;
            setTimeout(() => {
                try {
                    const dashboard = uppy.getPlugin("Dashboard");
                    const browseButton = dashboard.el.getElementsByClassName("uppy-Dashboard-browse")[0];
                    browseButton.click();

                    // const nodes = dashboard.el.getElementsByClassName("uppy-Dashboard-input");
                    // for (let node of nodes) {
                    //     if(!node.addEventListener) continue;
                    //     node.addEventListener("click", evt => {
                    //         debugger;
                    //         console.log(this, evt)
                    //     })
                    // }
                } catch (e) {
                    console.error(e);
                }
            }, 0);
        });
        uppy.on("state-update", (options) => {
            setTimeout(() => {
                const webcam = uppy.getPlugin("Webcam");
                if (webcam && webcam.el) {
                    const pictureButton = webcam.el.getElementsByClassName("uppy-Webcam-button--picture")[0];
                    const switchButton = webcam.el.getElementsByClassName("uppy-Webcam-button--switch")[0];
                    if (pictureButton && !switchButton) {
                        const node = document.createElement("div");
                        pictureButton.parentElement.insertBefore(node, pictureButton);
                        ReactDOM.render(<button
                            children={<FlipIcon/>}
                            className={"uppy-u-reset uppy-c-btn uppy-Webcam-button uppy-Webcam-button--switch"}
                            onClick={() => {
                                try {
                                    console.log(webcam);
                                    const currentFacingMode = webcam.opts.facingMode;
                                    const newMode = {};
                                    if (currentFacingMode === "user") {
                                        newMode.facingMode = "environment";
                                        newMode.mirror = false;
                                    } else {
                                        newMode.facingMode = "user";
                                        newMode.mirror = true;
                                    }
                                    webcam.setOptions(newMode);
                                    if (webcam.stream) webcam._stop();
                                    webcam.setPluginState();
                                    webcam._start();
                                } catch (error) {
                                    notifySnackbar(error);
                                }
                            }}
                            type={"button"}
                        />, node);
                    }
                }
            }, 0)
            // console.log("Modal is open", uppy)
        });
        uppy.on("upload-success", (file, snapshot) => {
            if (onsuccess) {
                onsuccess({uppy, file, snapshot});
            } else {
                console.warn("[UploadComponent] define 'onsuccess'; snapshot is", snapshot);
            }
        });
        uppy.use(Dashboard, {
            target: refDashboard.current,
            trigger: refButton.current,
            replaceTargetContent: true,
            closeModalOnClickOutside: true,
            proudlyDisplayPoweredByUppy: false,
            browserBackButtonClose: true,
            showProgressDetails: true,
            hideProgressAfterFinish: true,
            closeAfterFinish: true,
            locale: {
                strings: {
                    done: t("Common.Cancel"),
                }
            },
            note: t("Upload.Files up to {{maxFileSize}} kb (images will be resized to {{maxWidth}}x{{maxHeight}} max)", {
                maxFileSize: MAX_FILE_SIZE,
                maxWidth: width,
                maxHeight: height
            }),
            // note: `Images up to ${MAX_FILE_SIZE} kb${maxWidth ? ` (will be resized to ${maxWidth}x${maxHeight} max)` : ""}`,
            theme: "auto",
        });
        uppy.use(ProgressBar, {
            target: Dashboard,
            fixed: false,
            hideAfterFinish: true
        })
        // uppy.use(Tus, {
        //     endpoint: "https://master.tus.io/files/",
        //     removeFingerprintOnSuccess: true
        // }).use(ProgressBar, {
        //     target: Dashboard
        // });
        // uppy.use(FileInput, {
        //     target: Dashboard,
        //     pretty: true,
        //     inputName: "files[]",
        //     locale: {
        //     }
        // })
        if (camera === true) {
            uppy.use(Webcam, {
                facingMode: facingMode,
                locale: {
                    strings: {
                        allowAccessDescription: "" // "Drop files here",
                    }
                },
                modes: [
                    "picture"
                ],
                target: Dashboard,
            });
        }
        if (imageDescriptors && imageDescriptors.length) {
            uppy._uris = uppy._uris || {};
            for (const descriptor of imageDescriptors) {
                uppy._uris[descriptor.id] = descriptor;
                uppy.emit("upload-success", descriptor, {
                    status: "complete",
                    body: null,
                    uploadURL: descriptor.uploadURL
                });
            }
        }
        setState(state => ({...state, uppy: uppy}));
    }, [])

    // let maxWidth, maxHeight;
    // if (limits) {
    //     maxHeight = height;
    //     maxWidth = width || maxHeight;
    //     maxHeight = maxHeight || maxWidth;
    // }

    if (!uploadsAllow) return null;
    return <>
        {button
            ? <button.type
                {...button.props}
                onClick={evt => {
                    evt && evt.stopPropagation();
                    uppy && !multi && uppy.reset();
                    button.props.onClick && button.props.onClick(evt);
                }}
                ref={refButton}
            />
            : <Button
                children={t("Upload.Upload")}
                onClick={evt => {
                    evt && evt.stopPropagation();
                    uppy && !multi && uppy.reset();
                }}
                ref={refButton}
            />
        }
        <div ref={refDashboard}/>
    </>
}

UploadComponent.propTypes = {
    button: PropTypes.any,
};

export default connect()(withStyles(styles)(UploadComponent));

function getVideoCover(file, seekTo = 0.0) {
    return new Promise((resolve, reject) => {
        const videoPlayer = document.createElement("video");
        videoPlayer.setAttribute("src", URL.createObjectURL(file));
        videoPlayer.load();
        videoPlayer.addEventListener("error", reject);
        videoPlayer.addEventListener("loadedmetadata", () => {
            if (videoPlayer.duration < seekTo) {
                reject(Error("Video is too short."));
                return;
            }
            setTimeout(() => {
                videoPlayer.currentTime = seekTo;
            }, 200);
            videoPlayer.addEventListener("seeked", () => {
                const canvas = document.createElement("canvas");
                canvas.width = videoPlayer.videoWidth;
                canvas.height = videoPlayer.videoHeight;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
                ctx.canvas.toBlob(blob => resolve(blob), "image/jpeg", 0.75);
            });
        });
    });
}
