import React from "react";
import Button from "@material-ui/core/Button";
import FlipIcon from "@material-ui/icons/FlipCameraAndroid";
import Uppy from "@uppy/core"
import Tus from "@uppy/tus"
import ProgressBar from "@uppy/progress-bar";
import Webcam from "@uppy/webcam";
import Dashboard from "@uppy/dashboard";
import {connect} from "react-redux";
import PropTypes from "prop-types";
import withStyles from "@material-ui/styles/withStyles";
import Resizer from "react-image-file-resizer";
import ReactDOM from "react-dom";
import {notifySnackbar} from "../../controllers/Notifications";
import "@uppy/core/dist/style.css";
import "@uppy/progress-bar/dist/style.css";
import "@uppy/dashboard/dist/style.css";
import "@uppy/webcam/dist/style.css";

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

const UploadComponent = ({button, camera = true, onsuccess, onerror, limits, facingMode: givenFacingMode}) => {
    const [state, setState] = React.useState({facingMode: givenFacingMode || "user"});
    const {uppy, facingMode} = state;

    const refDashboard = React.useRef(null);
    const refButton = React.useRef(null);

    React.useEffect(() => {
        const uppy = Uppy({
            allowMultipleUploads: false,
            autoProceed: true,
            locale: {
                strings: {
                    dropPasteImport: "" // "Drop files here",
                }
            },
            restrictions: {
                maxNumberOfFiles: 1,
                maxFileSize: MAX_FILE_SIZE * 1024,
                allowedFileTypes: ["image/*"]
            },
        })
        uppy.on("file-added", (result) => {
            if (!maxWidth) return;
            if (maxSize && maxSize > result.size) return;
            const quality = limits ? limits.quality || 75 : 75;
            const type = result.type === "image/png" ? "PNG" : "JPEG";
            console.log(result)
            console.log(`[UploadComponent] resize ${result.name} to ${maxWidth}x${maxHeight} with quality ${quality}`);
            Resizer.imageFileResizer(
                result.data,
                maxWidth,
                maxHeight,
                type,
                quality,
                0,
                uri => {
                    uppy._uris = uppy._uris || {};
                    uppy._uris[result.id] = uri;
                    setState(state => ({...state, uppy}))
                },
                "blob"
            )
        });
        uppy.on("complete", (result) => {
        });
        uppy.on("error", (error) => {
            console.error(error);
        });
        uppy.on("dashboard:modal-open", () => {
            console.log("Modal is open", uppy);
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
                    done: "Cancel",
                }
            },
            note: `Images up to ${MAX_FILE_SIZE} kb${maxWidth ? ` (will be resized to ${maxWidth}x${maxHeight} max)` : ""}`,
            theme: "auto",
        }).use(Tus, {
            endpoint: "https://master.tus.io/files/",
            removeFingerprintOnSuccess: true
        }).use(ProgressBar, {
            target: Dashboard
        });
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
        setState({...state, uppy: uppy});
    }, [])

    let maxWidth, maxHeight, maxSize;
    if (limits) {
        maxSize = limits.size;
        maxHeight = limits.height;
        maxWidth = limits.width || maxHeight;
        maxHeight = maxHeight || maxWidth;
    }

    return <React.Fragment>
        {button
            ? <button.type {...button.props} ref={refButton} onClick={(event) => {
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
