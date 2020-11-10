import React from "react";
import {connect} from "react-redux";
import Grid from "@material-ui/core/Grid";
import withStyles from "@material-ui/styles/withStyles";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import BackIcon from "@material-ui/icons/ArrowBack";
import ImageIcon from "@material-ui/icons/InsertPhoto";
import DialogTitle from "@material-ui/core/DialogTitle";
import Hidden from "@material-ui/core/Hidden";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import ClearIcon from "@material-ui/icons/Clear";
import Box from "@material-ui/core/Box";
import {newPostComponentReducer} from "./newPostComponentReducer";
import SendIcon from "@material-ui/icons/Send";
import {mentionUsers} from "../../controllers/mentionTypes";
import notifySnackbar from "../../controllers/notifySnackbar";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import {useFirebase, usePages, useWindowData} from "../../controllers/General";
import {styles} from "../../controllers/Theme";
import {uploadComponentClean, uploadComponentPublish} from "../UploadComponent/uploadComponentControls";
import ProgressView from "../ProgressView";
import ModalComponent from "../ModalComponent";
import NavigationToolbar from "../NavigationToolbar";
import LoadingComponent from "../LoadingComponent";
import UploadComponent from "../UploadComponent/UploadComponent";
import MentionsInputComponent from "../MentionsInputComponent/MentionsInputComponent";
import {useHistory} from "react-router-dom";

const stylesCurrent = theme => ({
    content: {
        padding: theme.spacing(1),
    },
    messagebox: {
        height: theme.spacing(40),
    },
    _preview: {
        objectFit: "contain",
        [theme.breakpoints.up("md")]: {
            maxHeight: theme.spacing(4),
        },
        [theme.breakpoints.down("sm")]: {
            maxHeight: theme.spacing(20),
        },
    },
    toolbar: {
        ...theme.mixins.toolbar,
        backgroundColor: theme.palette.primary.main,
    },
    "@global": {
        [theme.breakpoints.down("xs")]: {
            ".uppy-Dashboard--modal .uppy-Dashboard-inner": {
                top: 0,
            },
        }
    },
});

const NewPostComponent = (
    {
        _savedText,
        _savedContext,
        buttonComponent,
        classes,
        context,
        dispatch,
        infoComponent,
        mentions = [mentionUsers],
        onError = error => notifySnackbar(error),
        onClose = () => console.log("[NewPost] onClose()"),
        onComplete = data => console.log("[NewPost] onComplete(data)", data),
        replyTo,
        text: initialText,
        title = replyTo ? "New reply" : "New post",
        tooltip,
        type = "posts",
    }) => {
    const currentUserData = useCurrentUserData();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const windowData = useWindowData();
    const [state, setState] = React.useState({});
    const {disabled, uppy, file, open} = state;

    const text = context === _savedContext ? _savedText : initialText;

    const handleOpen = evt => {
        evt && evt.stopPropagation();
        if (!currentUserData || !currentUserData.id) {
            history.push(pages.login.route);
            return;
        }
        const isPostingAllowed = matchRole([Role.ADMIN, Role.USER], currentUserData);
        if (!isPostingAllowed) {
            history.push(pages.profile.route);
            return;
        }
        setState(state => ({...state, open: true}))
    }

    const publishImage = async () => {
        if (file) {
            const publish = await uploadComponentPublish(firebase)({
                auth: currentUserData.id,
                uppy,
                onprogress: progress => {
                    dispatch({...ProgressView.SHOW, value: progress});
                },
            });
            const {url} = publish;
            return url;
        }
        return null;
    }

    const handleSend = () => {
        if (text && text.length) {
            setState(state => ({...state, disabled: true}));
            dispatch(ProgressView.SHOW);
            const uid = currentUserData.id;
            publishImage()
                .then(image => ({
                    created: firebase.database.ServerValue.TIMESTAMP,
                    ...(image ? {images: [image]} : {}),
                    ...(replyTo ? {to: replyTo} : {}),
                    text,
                    uid,
                }))
                .then(data => firebase.database().ref().child(type).push(data))
                .then(snapshot => {
                    dispatch({type: newPostComponentReducer.SAVE, _savedText: undefined, _savedContext: context});
                    setState(state => ({...state, disabled: false, open: false}));
                    onComplete(snapshot.key);
                })
                .catch(error => {
                    setState(state => ({...state, disabled: false}));
                    onError(error);
                })
                .finally(() => {
                    dispatch(ProgressView.HIDE)
                });
        }
    }

    const handleKeyUp = event => {
        if (event.key === "Enter" && event.ctrlKey) {
            event.stopPropagation();
            event.preventDefault();
            handleSend();
        }
    }

    const handleChange = (evt) => {
        dispatch({type: newPostComponentReducer.SAVE, _savedText: evt.target.value, _savedContext: context});
    }

    const handleCancel = evt => {
        dispatch({type: newPostComponentReducer.SAVE, _savedText: undefined, _savedContext: undefined});
        handleClose(evt);
        onClose();
    }

    const handleClose = evt => {
        if (!evt) return;
        setState(state => ({...state, open: false}))
        if (evt) onClose(evt);
    }

    const handleUploadPhotoSuccess = ({uppy}) => {
        const file = uppy.getFiles()[0];
        console.log("[NewPost] upload", file, uppy);
        setState(state => ({...state, uppy, file}));
    }

    const handleUploadPhotoError = (error) => {
        console.error("[NewPost] upload", error);
        handleImageRemove();
    }

    const handleImageRemove = () => {
        uploadComponentClean(uppy);
        setState(state => ({...state, uppy: null, file: null}));
    }

    React.useEffect(() => {
        return () => {
            uploadComponentClean(uppy);
        }
    }, [uppy])

    const uploadComponent = <UploadComponent
        button={windowData.isNarrow()
            ? <IconButton
                children={<ImageIcon/>}
                disabled={disabled}
            />
            : <IconButton
                children={<ImageIcon/>}
                color={"secondary"}
                disabled={disabled}
                size={"small"}
            />}
        camera={false}
        firebase={firebase}
        limits={{width: 1000, height: 1000, size: 100000}}
        onsuccess={handleUploadPhotoSuccess}
        onerror={handleUploadPhotoError}
    />

    return <>
        <buttonComponent.type
            {...buttonComponent.props}
            onClick={handleOpen}
        />
        {open && <ModalComponent open={open} onClose={handleClose}>
            <Hidden mdUp>
                <NavigationToolbar
                    backButton={<IconButton
                        children={<BackIcon/>}
                        disabled={disabled}
                        onClick={handleCancel}
                    />}
                    children={title}
                    className={classes.toolbar}
                    mediumButton={uploadComponent}
                    rightButton={<IconButton
                        aria-label={"Send"}
                        children={<SendIcon/>}
                        onClick={handleSend}
                        title={"Send"}
                    />}
                />
            </Hidden>
            <Hidden smDown>
                <DialogTitle>{title}</DialogTitle>
            </Hidden>
            <DialogContent classes={{root: classes.content}}>
                {infoComponent}
                <React.Suspense fallback={<LoadingComponent/>}>
                    <MentionsInputComponent
                        autofocus={true}
                        className={classes.messagebox}
                        color={"secondary"}
                        disabled={disabled}
                        firebase={firebase}
                        mentionsParams={mentions}
                        multiline={true}
                        onChange={handleChange}
                        onKeyUp={handleKeyUp}
                        placeholder={"Type message, use @ to tag other users and # for games."}
                        value={text}
                    />
                </React.Suspense>
                <Hidden mdUp>
                    <Box m={1}/>
                    <Grid container justify={"center"}>
                        {file && file.uploadURL && <img
                            alt={file.name}
                            className={classes._preview}
                            src={file.uploadURL}
                            title={file.name}
                        />}
                        {file && <Grid item><IconButton
                            children={<ClearIcon/>}
                            color={"secondary"}
                            disabled={disabled}
                            onClick={handleImageRemove}
                            size={"small"}
                            title={"Remove image"}
                        /></Grid>}
                    </Grid>
                </Hidden>
            </DialogContent>
            <Hidden smDown>
                <DialogActions>
                    <Grid item xs>
                        <Grid container>
                            {!file && <Grid item>{uploadComponent}</Grid>}
                            {file && file.uploadURL && <img
                                alt={file.name}
                                className={classes._preview}
                                src={file.uploadURL}
                                title={file.name}
                            />}
                            {file && <Grid item><IconButton
                                children={<ClearIcon/>}
                                color={"secondary"}
                                disabled={disabled}
                                onClick={handleImageRemove}
                                size={"small"}
                                title={"Remove image"}
                            /></Grid>}
                        </Grid>
                    </Grid>
                    <Button onClick={handleCancel} color={"secondary"} disabled={disabled}>Cancel</Button>
                    <Button onClick={handleSend} color={"secondary"} disabled={disabled}>Send</Button>
                </DialogActions>
            </Hidden>
        </ModalComponent>}
    </>
};

const mapStateToProps = ({newPostComponentReducer}) => ({
    _savedText: newPostComponentReducer._savedText,
    _savedContext: newPostComponentReducer._savedContext,
});

export default connect(mapStateToProps)(withStyles(theme => ({
    ...stylesCurrent(theme),
    ...styles(theme)
}))(NewPostComponent));
