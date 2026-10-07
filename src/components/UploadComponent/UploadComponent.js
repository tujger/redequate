import AudioIcon from "@material-ui/icons/Audiotrack";
import FlipIcon from "@material-ui/icons/FlipCameraAndroid";
import VideoIcon from "@material-ui/icons/Movie";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import ProgressBar from "@uppy/progress-bar";
import Webcam from "@uppy/webcam";
import PropTypes from "prop-types";
import React from "react";
import {createRoot} from "react-dom/client";
import "@uppy/core/dist/style.css";
import "@uppy/progress-bar/dist/style.css";
import "@uppy/dashboard/dist/style.css";
import "@uppy/webcam/dist/style.css";
import Button from "../../controls/Button/Button";
import {useTranslation} from "react-i18next";
import {connect} from "react-redux";
import {useMetaInfo} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import styles from "./styles/UploadComponent.module.css";
import {uploadComponentClean, uploadComponentResize} from "./uploadComponentControls";

const MAX_FILE_SIZE = 20 * 1024;

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
    const cameraButtonRoots = React.useRef(new Set());

    const {
        width = uploadsMaxWidth,
        height = uploadsMaxHeight,
        size = uploadsMaxSize * 1024,
        quality = uploadsQuality
    } = limits;

    const allowedFileTypes = ["image/*"];// uploadsTypes || [];

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
                        const root = createRoot(node);
                        cameraButtonRoots.current.add(root);
                        root.render(<button
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
                        />);
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
        return () => {
            cameraButtonRoots.current.forEach(root => root.unmount());
            cameraButtonRoots.current.clear();
            uppy.close();
        };
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
        <div className={styles.root} ref={refDashboard}/>
    </>
}

UploadComponent.propTypes = {
    button: PropTypes.any,
};

export default connect()(UploadComponent);

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
