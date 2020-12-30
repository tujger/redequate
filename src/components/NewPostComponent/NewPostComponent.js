import React from "react";
import {connect} from "react-redux";
import Grid from "@material-ui/core/Grid";
import withStyles from "@material-ui/styles/withStyles";
import IconButton from "@material-ui/core/IconButton";
import ImageIcon from "@material-ui/icons/InsertPhoto";
import ImageAddIcon from "@material-ui/icons/AddPhotoAlternate";
import DialogTitle from "@material-ui/core/DialogTitle";
import Hidden from "@material-ui/core/Hidden";
import DialogContent from "@material-ui/core/DialogContent";
import Box from "@material-ui/core/Box";
import {newPostComponentReducer} from "./newPostComponentReducer";
import {mentionTags, mentionUsers} from "../../controllers/mentionTypes";
import notifySnackbar from "../../controllers/notifySnackbar";
import {matchRole, normalizeSortName, Role, useCurrentUserData} from "../../controllers/UserData";
import {useFirebase, usePages, useWindowData} from "../../controllers/General";
import {styles} from "../../controllers/Theme";
import {
    uploadComponentClean,
    uploadComponentPublish
} from "../UploadComponent/uploadComponentControls";
import ProgressView from "../ProgressView";
import LoadingComponent from "../LoadingComponent";
import UploadComponent from "../UploadComponent/UploadComponent";
import MentionsInputComponent from "../MentionsInputComponent/MentionsInputComponent";
import {useHistory} from "react-router-dom";
import {tokenizeText} from "../MentionedTextComponent";
import {useTranslation} from "react-i18next";
import {updateActivity} from "../../pages/admin/audit/auditReducer";
import Wrapper from "./Wrapper";
import Images from "./Images";
import {Pagination} from "../../controllers";
import Toolbar from "./Toolbar";

const stylesCurrent = theme => ({
    content: {
        flex: "0 0 auto",
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
        imageDescriptors: givenImageDescriptors,
        infoComponent,
        inline,
        mentions = [mentionTags, mentionUsers],
        onBeforePublish = async data => data,
        onError = error => notifySnackbar(error),
        onClose = () => console.log("[NewPost] onClose()"),
        onComplete = ({key}) => console.log("[NewPost] onComplete({key})", {key}),
        replyTo,
        tag: givenTag,
        text: givenText,
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
    const {disabled, hiddenTag, images, open, ready, text, uppy, imageDescriptors} = state;
    const {camera = true, multi = true} = UploadProps;

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
            // if (text === givenText) throw t("Post.Text is not changed.");
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
                        return null;
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
                    files: uppy._uris,
                    onprogress: progress => {
                        dispatch({...ProgressView.SHOW, value: progress});
                    },
                });
                uploadComponentClean(uppy);
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
        }
        const publishComplete = async snapshot => {
            dispatch({
                type: newPostComponentReducer.SAVE,
                _savedText: undefined,
                _savedContext: undefined
            });
            setState(state => ({
                ...state,
                disabled: false,
                open: false,
                ready: false,
                uppy: null,
                images: null,
                hiddenTag: null
            }));
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
            .catch(onError)
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
        setState(state => ({...state, text: evt.target.value}));
    }

    const handleCancel = evt => {
        handleImageRemove()();
        dispatch({
            type: newPostComponentReducer.SAVE,
            _savedText: undefined,
            _savedContext: undefined
        });
        setState(state => ({...state, text: "", hiddenTag: null, images: null, uppy: null}));
        handleClose(evt);
        onClose();
    }

    const handleClose = evt => {
        if (!evt) return;
        setState(state => ({...state, open: false, ready: false}))
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

    const handleImagesChange = ({images, uppy}) => {
        setState(state => ({...state, images, uppy}));
    }

    React.useEffect(() => {
        let isMount = true;
        const throwIfNotShown = async () => {
            if (!open && !inline) throw "not-shown";
        }
        const prepareShowing = async () => {
            setState(state => ({...state, disabled: true}));
            dispatch(ProgressView.SHOW);
        }
        const importValues = async () => {
            return {
                _savedText,
                _savedContext,
                context,
                editPostData,
                inline,
                givenImageDescriptors,
                replyTo,
                givenTag,
                givenText,
                open: true
            };
        }
        const checkIfTextGiven = async props => {
            const {context, _savedContext, _savedText, givenText, givenTag} = props;
            let hiddenTag;
            if (givenTag) {
                const item = await Pagination({
                    ref: firebase.database().ref("tag"),
                    child: "id",
                    equals: givenTag
                }).next().then(items => items[0]);
                if (item) {
                    hiddenTag = String.fromCharCode(1) + `$[tag:${givenTag}:${item.key}]` + String.fromCharCode(2);
                } else {
                    notifySnackbar(Error(`${givenTag} is not found.`))
                }
            }
            if (context && context === _savedContext) {
                return {...props, text: _savedText, hiddenTag};
            }
            return {...props, text: givenText, hiddenTag};
        }
        const checkIfImageDescriptorsGiven = async props => {
            const {givenImageDescriptors} = props;
            if (givenImageDescriptors) {
                // const images = [imageDescriptors.uploadURL];
                return {...props, imageDescriptors: givenImageDescriptors}
            }
            return props;
        }
        const checkIfEditPost = async props => {
            const {context, editPostData} = props;
            if (editPostData) {
                let text = editPostData.text;
                let hiddenTag;
                if (text) {
                    const specialCharacterPos = text.indexOf(String.fromCharCode(1));
                    if (specialCharacterPos >= 0) {
                        hiddenTag = text.substring(specialCharacterPos);
                        text = text.substring(0, specialCharacterPos);
                    }
                }
                return {
                    ...props,
                    context: context || editPostData.id,
                    text,
                    hiddenTag,
                    images: editPostData.images
                };
            }
            return props;
        }
        const checkIfReplyTo = async props => {
            const {context, replyTo} = props;
            if (replyTo) {
                return {...props, context: context || replyTo};
            }
            return props;
        }
        const updateState = async props => {
            console.log(JSON.stringify(props));
            const {text, context, _savedContext} = props;
            if (context && context !== _savedContext) {
                dispatch({
                    type: newPostComponentReducer.SAVE,
                    _savedText: text,
                    _savedContext: context
                });
            }
            isMount && setState(state => ({...state, ...props, ready: true, disabled: false}));
        }
        const catchEvent = async event => {
            if (event instanceof Error) throw event;
            if (event === "not-shown") return;
            console.error(JSON.stringify(event));
        }
        const catchError = async error => {
            isMount && setState(state => ({...state, disabled: false}));
            onError && onError(error);
        }
        const finalizeShowing = async () => {
            dispatch(ProgressView.HIDE);
        }

        throwIfNotShown()
            .then(prepareShowing)
            .then(importValues)
            .then(checkIfTextGiven)
            .then(checkIfImageDescriptorsGiven)
            .then(checkIfReplyTo)
            .then(checkIfEditPost)
            .then(updateState)
            .catch(catchEvent)
            .catch(catchError)
            .finally(finalizeShowing)

        return () => {
            isMount = false;
        }
    }, [open]);

    React.useEffect(() => {
        return () => {
            uploadComponentClean(uppy);
        }
    }, [uppy])

    const uploadComponent = ready && <UploadComponent
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
        imageDescriptors={imageDescriptors}
        limits={{width: 1000, height: 1000, size: 100000}}
        multi={true}
        onsuccess={handleUploadPhotoSuccess}
        onerror={handleUploadPhotoError}
        {...UploadProps}
    />

    const toolbar = ready && <Toolbar
        bottom={!windowData.isNarrow() || inline}
        classes={classes}
        disabled={disabled}
        onCancel={handleCancel}
        onImagesChange={handleImagesChange}
        onSend={handleSend}
        title={title}
        top={windowData.isNarrow() && !inline}
        uploadComponent={uploadComponent}
    />;

    return <>
        {buttonComponent && <buttonComponent.type
            label={title}
            {...buttonComponent.props}
            onClick={handleOpen}
        />}
        {ready && <Wrapper inline={inline} onClose={handleClose}>
            {(windowData.isNarrow() && !inline) && toolbar}
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
            </DialogContent>
            {(!windowData.isNarrow() || inline) && toolbar}
            <Images
                classes={classes}
                disabled={disabled}
                images={images}
                onChange={handleImagesChange}
                uppy={uppy}
            />
        </Wrapper>}
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
