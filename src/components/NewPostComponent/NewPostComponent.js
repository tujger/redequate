import React from "react";
import {connect} from "react-redux";
import Grid from "@material-ui/core/Grid";
import withStyles from "@material-ui/styles/withStyles";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import BackIcon from "@material-ui/icons/ArrowBack";
import ImageIcon from "@material-ui/icons/InsertPhoto";
import ImageAddIcon from "@material-ui/icons/AddPhotoAlternate";
import DialogTitle from "@material-ui/core/DialogTitle";
import Hidden from "@material-ui/core/Hidden";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import ClearIcon from "@material-ui/icons/Clear";
import Box from "@material-ui/core/Box";
import {newPostComponentReducer} from "./newPostComponentReducer";
import SendIcon from "@material-ui/icons/Send";
import {mentionTags, mentionUsers} from "../../controllers/mentionTypes";
import notifySnackbar from "../../controllers/notifySnackbar";
import {matchRole, normalizeSortName, Role, useCurrentUserData} from "../../controllers/UserData";
import {cacheDatas, useFirebase, usePages, useWindowData} from "../../controllers/General";
import {styles} from "../../controllers/Theme";
import {
    uploadComponentClean,
    uploadComponentPublish
} from "../UploadComponent/uploadComponentControls";
import ProgressView from "../ProgressView";
import ModalComponent from "../ModalComponent";
import NavigationToolbar from "../NavigationToolbar";
import LoadingComponent from "../LoadingComponent";
import UploadComponent from "../UploadComponent/UploadComponent";
import MentionsInputComponent from "../MentionsInputComponent/MentionsInputComponent";
import {useHistory} from "react-router-dom";
import {tokenizeText} from "../MentionedTextComponent";
import {useTranslation} from "react-i18next";
import {updateActivity} from "../../pages/admin/audit/auditReducer";

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
        color: theme.palette.getContrastText(theme.palette.primary.main),
    },
    "@global": {
        [theme.breakpoints.down("xs")]: {
            ".uppy-Dashboard--modal .uppy-Dashboard-inner": {
                top: 0,
            },
        }
    },
});

const NewPostComponent = props => {
    const {t} = useTranslation();
    const {
        _savedText,
        _savedContext,
        buttonComponent,
        classes,
        context,
        dispatch,
        editPostData,
        hint = t("Post.Type message, use @ to mention other users and # for tag."),
        infoComponent,
        mentions = [mentionTags, mentionUsers],
        onBeforePublish = async data => data,
        onError = error => notifySnackbar(error),
        onClose = () => console.log("[NewPost] onClose()"),
        onComplete = ({key}) => console.log("[NewPost] onComplete({key})", {key}),
        replyTo,
        text: initialText,
        title = replyTo ? t("Post.New reply") : t("Post.New post"),
        type = "posts",
        UploadProps = {}
    } = props;
    const currentUserData = useCurrentUserData();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const windowData = useWindowData();
    const [state, setState] = React.useState({});
    const {disabled, hiddenTag, images, open, uppy} = state;
    const {camera = true, multi = true} = UploadProps;

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
        setState(state => ({...state, open: true}));
        if (buttonComponent && buttonComponent.props && buttonComponent.props.onClick) {
            buttonComponent.props.onClick(evt);
        }
    }

    const handleSend = () => {
        const preparePublishing = async () => {
            setState(state => ({...state, disabled: true}));
            dispatch(ProgressView.SHOW);
        }
        const checkIfTextChanged = async () => {
            if (!text) throw t("Post.Text is empty.");
            if (text === initialText) throw t("Post.Text is not changed.");
            if (editPostData && text === editPostData.text && !images && !uppy) throw t("Post.Text is not changed.");
            return text;
        }
        const parseTokens = async (text) => {
            const newtokens = [];
            const tokens = tokenizeText(text);
            tokens.forEach(token => {
                if (token.type !== "text") {
                    newtokens.push(token);
                } else {
                    const tokens = token.value.split(/(#[\w]+)/);
                    tokens.map(newtoken => {
                        if (newtoken.indexOf("#") === 0) {
                            newtoken = newtoken.replace(/^#/, "");
                            const normalizedToken = normalizeSortName(newtoken);
                            newtokens.push({type: "tag", value: newtoken, id: normalizedToken});
                        } else {
                            newtokens.push({type: "text", value: newtoken});
                        }
                    })
                }
            })
            let newtext = newtokens.map(token => {
                if (token.type === "cr") {
                    return "\n";
                } else if (token.type === "text") {
                    return token.value;
                } else if (token.type) {
                    return `$[${token.type}:${token.id}:${token.value}]`;
                } else {
                    return token;
                }
            }).join("");
            if (hiddenTag) newtext += hiddenTag;
            return newtext;
        }
        const removeOldImages = async text => {
            if (editPostData) {
                let removeImages = [];
                if (editPostData.images) {
                    for (const image of editPostData.images) {
                        if (images.indexOf(image) >= 0) continue;
                        removeImages.push(image);
                    }
                }
                removeImages = removeImages.map(async url => firebase.storage()
                    .refFromURL(url)
                    .delete()
                );
                Promise.all(removeImages).catch(console.error);
            }
            return {text, images};
        }
        const publishImage = async ({text, images}) => {
            let newImages = [];
            if (uppy) {
                const publish = await uploadComponentPublish(firebase)({
                    auth: currentUserData.id,
                    uppy,
                    onprogress: progress => {
                        dispatch({...ProgressView.SHOW, value: progress});
                    },
                });
                newImages = publish.map(item => item.url) || [];
                images = [...(images || []), ...(newImages || [])];
            }
            setState(state => ({...state, images}));
            return {text, images};
        }
        const buildData = async ({text, images}) => ({
            created: firebase.database.ServerValue.TIMESTAMP,
            images: images || null,
            to: replyTo || 0,
            text: text || null,
            uid: currentUserData.id,
        });
        const publishData = async data => {
            if (editPostData) {
                const {images, text} = data;
                const {edit = {}} = editPostData;
                const newEdit = firebase.database().ref().child(type).push();
                edit[newEdit.key] = {
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    uid: currentUserData.id,
                };
                const updates = {images, text, edit};
                return firebase.database().ref().child(type).child(editPostData.id).update(updates)
                .then(() => {
                    updateActivity({
                        firebase,
                        uid: currentUserData.id,
                        type: "Post edit",
                        details: {
                            postId: editPostData.id,
                            path: `${editPostData.root ? editPostData.root + "/" : ""}${editPostData.replyTo ? editPostData.replyTo + "/" : ""}${editPostData.id}` || null,
                            uid: editPostData.uid,
                        }
                    })
                    return {key: editPostData.id};
                });
            } else {
                return firebase.database().ref().child(type).push(data);
            }
            throw data;
        }
        const publishComplete = async snapshot => {
            dispatch({
                type: newPostComponentReducer.SAVE,
                _savedText: undefined,
                _savedContext: undefined
            });
            setState(state => ({...state, disabled: false, open: false}));
            onComplete({key: snapshot.key})
        }
        const finalizePublishing = async () => {
            setState(state => ({...state, disabled: false}));
            dispatch(ProgressView.HIDE);
        }

        preparePublishing()
        .then(checkIfTextChanged)
        .then(parseTokens)
        .then(removeOldImages)
        .then(publishImage)
        .then(buildData)
        .then(onBeforePublish)
        .then(publishData)
        .then(publishComplete)
        .catch(onError || notifySnackbar)
        .finally(finalizePublishing)
    }

    const handleKeyUp = event => {
        if (event.key === "Enter" && event.ctrlKey) {
            event.stopPropagation();
            event.preventDefault();
            handleSend();
        }
    }

    const handleChange = (evt) => {
        dispatch({
            type: newPostComponentReducer.SAVE,
            _savedText: evt.target.value,
            _savedContext: context
        });
    }

    const handleCancel = evt => {
        handleImageRemove()();
        dispatch({
            type: newPostComponentReducer.SAVE,
            _savedText: undefined,
            _savedContext: undefined
        });
        handleClose(evt);
        onClose();
    }

    const handleClose = evt => {
        if (!evt) return;
        setState(state => ({...state, open: false}))
        if (evt) onClose(evt);
    }

    const handleUploadPhotoSuccess = ({uppy}) => {
        console.log("[NewPost] upload", uppy);
        setState(state => ({...state, uppy}));
    }

    const handleUploadPhotoError = (error) => {
        console.error("[NewPost] upload", error);
        handleImageRemove()();
    }

    const handleImageRemove = key => () => {
        uploadComponentClean(uppy, key);
        setState(state => ({...state, uppy}));
    }

    const handleSavedImageRemove = index => () => {
        const newImages = images.filter((image, i) => i !== index);
        setState(state => ({...state, images: newImages}));
    }

    React.useEffect(() => {
        if (!open) return;
        if (editPostData) {
            let _savedText = editPostData.text;
            let hiddenTag = undefined;
            if(_savedText) {
                const specialCharacterPos = _savedText.indexOf(String.fromCharCode(1));
                if(specialCharacterPos >= 0) {
                    hiddenTag = _savedText.substring(specialCharacterPos);
                    _savedText = _savedText.substring(0, specialCharacterPos);
                }
            }
            dispatch({
                type: newPostComponentReducer.SAVE,
                _savedText,
                _savedContext: context
            });
            setState(state => ({...state, editPostData, images: editPostData.images, hiddenTag}));
        }
        return () => {
        }
    }, [open])

    React.useEffect(() => {
        return () => {
            uploadComponentClean(uppy);
        }
    }, [uppy])

    const uploadComponent = open && <UploadComponent
        button={windowData.isNarrow()
            ? <IconButton
                children={multi ? <ImageAddIcon/> : <ImageIcon/>}
                disabled={disabled}
                style={{color: "inherit"}}
            />
            : <IconButton
                children={multi ? <ImageAddIcon/> : <ImageIcon/>}
                color={"secondary"}
                disabled={disabled}
                size={"small"}
            />}
        camera={camera}
        firebase={firebase}
        limits={{width: 1000, height: 1000, size: 100000}}
        multi={true}
        onsuccess={handleUploadPhotoSuccess}
        onerror={handleUploadPhotoError}
        {...UploadProps}
    />

    const imagesComponent = open && <>
        {images && images.map((image, index) => {
            return <Grid item key={index}>
                <img
                    alt={"Image"}
                    className={classes._preview}
                    src={image}
                    title={"Image"}
                />
                <IconButton
                    children={<ClearIcon/>}
                    color={"secondary"}
                    disabled={disabled}
                    onClick={handleSavedImageRemove(index)}
                    size={"small"}
                    title={t("Post.Remove image")}
                />
            </Grid>
        })}
        {uppy && Object.keys(uppy._uris).map((key) => {
            const file = uppy._uris[key];
            return <Grid item key={key}>
                <img
                    alt={file.name}
                    className={classes._preview}
                    src={file.uploadURL}
                    title={file.name}
                />
                <IconButton
                    children={<ClearIcon/>}
                    color={"secondary"}
                    disabled={disabled}
                    onClick={handleImageRemove(key)}
                    size={"small"}
                    title={t("Post.Remove image")}
                />
            </Grid>
        })}
    </>

    return <>
        {buttonComponent && <buttonComponent.type
            label={title}
            {...buttonComponent.props}
            onClick={handleOpen}
        />}
        {open && <ModalComponent open={true} onClose={handleClose}>
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
                        aria-label={t("Common.Send")}
                        children={<SendIcon/>}
                        onClick={handleSend}
                        style={{color: "inherit"}}
                        title={t("Common.Send")}
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
                        placeholder={hint}
                        value={text}
                    />
                </React.Suspense>
                <Hidden mdUp>
                    <Box m={1}/>
                    <Grid container justify={"center"}>
                        {imagesComponent}
                    </Grid>
                </Hidden>
            </DialogContent>
            <Hidden smDown>
                <DialogActions>
                    <Grid item xs>
                        <Grid container>
                            <Grid item>{uploadComponent}</Grid>
                            {imagesComponent}
                        </Grid>
                    </Grid>
                    <Button onClick={handleCancel} color={"secondary"} disabled={disabled}>
                        {t("Common.Cancel")}
                    </Button>
                    <Button onClick={handleSend} color={"secondary"} disabled={disabled}>
                        {t("Common.Send")}
                    </Button>
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
