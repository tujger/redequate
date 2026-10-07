import AudioIcon from "@mui/icons-material/Audiotrack";
import FlipIcon from "@mui/icons-material/FlipCameraAndroid";
import VideoIcon from "@mui/icons-material/Movie";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import Webcam from "@uppy/webcam";
import React from "react";
import {createPortal} from "react-dom";
import "@uppy/core/css/style.css";
import "@uppy/dashboard/css/style.css";
import "@uppy/webcam/css/style.css";
import {useTranslation} from "react-i18next";
import {connect} from "react-redux";
import {useMetaInfo} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import Button from "../../controls/Button/Button";
import useRippleEffect from "../../helpers/useRippleEffect";
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
    const {uppy, facingMode, cameraTarget} = state;
    const {t} = useTranslation();
    const metaInfo = useMetaInfo();
    const {settings = {}} = metaInfo || {};
    const {
        uploadsAllow, uploadsTypes,
        uploadsMaxHeight, uploadsMaxSize, uploadsMaxWidth, uploadsQuality
    } = settings;

    const refDashboard = React.useRef(null);
    const refButton = React.useRef(null);

    const {
        width = uploadsMaxWidth,
        height = uploadsMaxHeight,
        size = uploadsMaxSize * 1024,
        quality = uploadsQuality
    } = limits;

    const allowedFileTypes = ["image/*"];// uploadsTypes || [];

    React.useEffect(() => {
        if (!uploadsAllow) return;
        let active = true;
        let browseTimer;
        const fileTokens = new Map();
        const uppy = new Uppy({
            allowMultipleUploadBatches: multi,
            autoProceed: true,
            restrictions: {
                maxNumberOfFiles: multi ? 10 : 1,
                maxFileSize: MAX_FILE_SIZE * 1024,
                allowedFileTypes
            },
        });
        uppy._uris = {};
        uppy.on("file-added", file => {
            let cancel;
            const cancelled = new Promise(resolve => {
                cancel = () => resolve(null);
            });
            fileTokens.set(file.id, {cancelled, cancel});
            if (!multi) {
                Object.keys(uppy._uris).forEach(key => {
                    if (key === file.id) delete uppy._uris[key];
                    else uploadComponentClean(uppy, key);
                });
            }
        });
        uppy.on("file-removed", file => {
            fileTokens.get(file.id)?.cancel();
            fileTokens.delete(file.id);
        });
        // Prepare local previews inside Uppy's upload lifecycle. Publishing to
        // Firebase remains the responsibility of uploadComponentPublish.
        uppy.addUploader(async fileIDs => {
            const files = fileIDs.map(id => uppy.getFile(id)).filter(Boolean);
            uppy.emit("upload-start", files);
            await Promise.all(files.map(async file => {
                const token = fileTokens.get(file.id);
                const isCurrent = () => active && fileTokens.get(file.id) === token && uppy.getFile(file.id);
                try {
                    const prepared = (async () => {
                        let result = file;
                        const type = file.type.split("/")[0];
                        if (type === "image") {
                            result = await uploadComponentResize({
                                descriptor: file,
                                limits: {maxWidth: width, maxHeight: height, quality}
                            });
                        } else if (type === "video") {
                            result = {...file, uploadURL: <VideoIcon/>};
                            try {
                                const blob = await getVideoCover(file.data);
                                result.uploadURL = await new Promise((resolve, reject) => {
                                    const reader = new window.FileReader();
                                    reader.onload = () => resolve(reader.result);
                                    reader.onerror = () => reject(reader.error);
                                    reader.readAsDataURL(blob);
                                });
                            } catch (error) {
                                console.error(error);
                            }
                        } else if (type === "audio") {
                            result = {...file, uploadURL: <AudioIcon/>};
                        }
                        return result;
                    })();
                    const result = await Promise.race([prepared, token.cancelled]);
                    if (!isCurrent() || !result) return;
                    uppy._uris[result.id] = result;
                    uppy.emit("upload-success", result, {
                        status: "complete",
                        body: null,
                        uploadURL: result.uploadURL
                    });
                    if (active) setState(state => ({...state, uppy}));
                } catch (error) {
                    if (isCurrent()) uppy.emit("upload-error", file, error);
                }
            }));
        });
        uppy.on("error", error => console.error(error));
        uppy.on("dashboard:modal-open", () => {
            if (camera === true) return;
            clearTimeout(browseTimer);
            browseTimer = setTimeout(() => {
                if (!active) return;
                const dashboard = uppy.getPlugin("Dashboard");
                dashboard.el.querySelector(".uppy-Dashboard-browse")?.click();
            }, 0);
        });
        // Preact owns Webcam's DOM. Mount a React portal beside its snapshot
        // button and let React own the switch control and its cleanup.
        let cameraNode;
        const syncCameraButton = () => {
            if (!active || !refDashboard.current) return;
            const pictureButton = refDashboard.current.querySelector(".uppy-Webcam-button--picture");
            if ((!cameraNode && !pictureButton) || (cameraNode && cameraNode.parentElement === pictureButton?.parentElement)) return;
            cameraNode?.remove();
            cameraNode = undefined;
            if (pictureButton) {
                cameraNode = document.createElement("div");
                pictureButton.parentElement.insertBefore(cameraNode, pictureButton);
            }
            setState(state => ({...state, cameraTarget: cameraNode}));
        };
        const observer = new MutationObserver(syncCameraButton);
        observer.observe(refDashboard.current, {childList: true, subtree: true});
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
            closeModalOnClickOutside: true,
            proudlyDisplayPoweredByUppy: false,
            browserBackButtonClose: true,
            hideProgressDetails: false,
            hideProgressAfterFinish: true,
            closeAfterFinish: true,
            locale: {
                strings: {
                    dropPasteImport: "",
                    done: t("Common.Cancel"),
                }
            },
            note: t("Upload.Files up to {{maxFileSize}} kb (images will be resized to {{maxWidth}}x{{maxHeight}} max)", {
                maxFileSize: MAX_FILE_SIZE,
                maxWidth: width,
                maxHeight: height
            }),
            theme: "auto",
        });
        if (camera === true) {
            uppy.use(Webcam, {
                videoConstraints: {facingMode},
                mirror: facingMode === "user",
                mobileNativeCamera: false,
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
        setState(state => ({...state, uppy, cameraTarget: undefined}));
        return () => {
            active = false;
            clearTimeout(browseTimer);
            observer.disconnect();
            fileTokens.forEach(token => token.cancel());
            fileTokens.clear();
            uppy.destroy();
        };
    }, [uploadsAllow]);

    if (!uploadsAllow) return null;
    return <>
        {button
            ? <button.type
                {...button.props}
                onClick={evt => {
                    evt && evt.stopPropagation();
                    uppy && !multi && uppy.cancelAll();
                    button.props.onClick && button.props.onClick(evt);
                }}
                ref={refButton}
            />
            : <Button
                children={t("Upload.Upload")}
                onClick={evt => {
                    evt && evt.stopPropagation();
                    uppy && !multi && uppy.cancelAll();
                }}
                ref={refButton}
            />
        }
        <div
            className={styles.root}
            ref={refDashboard}
            style={{"--upload-camera-mirror": facingMode === "user" ? -1 : 1}}
        />
        {cameraTarget && uppy && createPortal(<CameraSwitch
            uppy={uppy}
            onFacingModeChange={facingMode => setState(state => ({...state, facingMode}))}
        />, cameraTarget)}
    </>
}

export default connect()(UploadComponent);

function CameraSwitch({uppy, onFacingModeChange}) {
    const onPointerDown = useRippleEffect();
    const [switching, setSwitching] = React.useState(false);
    const active = React.useRef(true);
    const {t} = useTranslation();
    React.useEffect(() => {
        active.current = true;
        return () => {
            active.current = false;
        };
    }, []);
    return <button
        children={<FlipIcon/>}
        className={`uppy-u-reset uppy-c-btn uppy-Webcam-button uppy-Webcam-button--switch ${styles.cameraSwitch}`}
        aria-label={t("Upload.Switch camera")}
        disabled={switching}
        onPointerDown={onPointerDown}
        onClick={async () => {
            const webcam = uppy.getPlugin("Webcam");
            if (!webcam || switching) return;
            setSwitching(true);
            try {
                const facingMode = webcam.opts.videoConstraints?.facingMode === "user" ? "environment" : "user";
                webcam.setOptions({videoConstraints: {facingMode}, mirror: facingMode === "user"});
                onFacingModeChange(facingMode);
                // Start immediately after stop so Webcam render cannot reopen
                // the old stream between the two operations.
                await Promise.all([webcam.stop(), webcam.start()]);
                if (!active.current) await webcam.stop();
            } catch (error) {
                if (active.current) notifySnackbar(error);
            } finally {
                if (active.current) setSwitching(false);
            }
        }}
        type="button"
    />;
}

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
