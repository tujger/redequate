import React from "react";
import {useHistory, useParams} from "react-router-dom";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import Hidden from "@material-ui/core/Hidden";
import Box from "@material-ui/core/Box";
import {useDispatch} from "react-redux";
import Switch from "@material-ui/core/Switch";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import IconButton from "@material-ui/core/IconButton";
import ClearIcon from "@material-ui/icons/Clear";
import withStyles from "@material-ui/styles/withStyles";
import TagIcon from "@material-ui/icons/Label";
import {cacheDatas, useFirebase, usePages, useWindowData} from "../controllers/General";
import ProgressView from "../components/ProgressView";
import notifySnackbar from "../controllers/notifySnackbar";
import {uploadComponentClean, uploadComponentPublish} from "../components/UploadComponent/uploadComponentControls";
import LoadingComponent from "../components/LoadingComponent";
import UploadComponent from "../components/UploadComponent/UploadComponent";
import MentionsInputComponent from "../components/MentionsInputComponent/MentionsInputComponent";
import {mentionTags, mentionUsers} from "../controllers/mentionTypes";
import ConfirmComponent from "../components/ConfirmComponent";
import {styles} from "../controllers/Theme";
import Pagination from "../controllers/FirebasePagination";
import {matchRole, normalizeSortName, Role, useCurrentUserData, UserData} from "../controllers/UserData";
import {tokenizeText} from "../components";
import MentionedTextComponent from "../components/MentionedTextComponent";

const stylesCurrent = theme => ({
    image: {
        color: "darkgray",
        marginBottom: theme.spacing(1),
        objectFit: "cover",
        [theme.breakpoints.up("sm")]: {
            height: theme.spacing(18),
            width: theme.spacing(18),
        },
        [theme.breakpoints.down("sm")]: {
            height: theme.spacing(24),
            width: theme.spacing(24),
        },
    },
    _image: {
        [theme.breakpoints.down("sm")]: {
            borderRadius: theme.spacing(2),
            width: "100%"
        },
    },
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    },
    photo: {
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        justifyContent: "start",
        position: "relative",
        [theme.breakpoints.down("sm")]: {
            width: "100%",
        },
    },
    clearPhoto: {
        backgroundColor: "transparent",
        position: "absolute",
        right: 0,
        top: 0,
        [theme.breakpoints.up("sm")]: {
            color: "white",
        },
    },
    _description: {
        height: 120
    },
    content: {},
});

const EditTag = ({classes, allowOwner = true, ...rest}) => {
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const windowData = useWindowData();
    const [state, setState] = React.useState({});
    const {tag, disabled, hideTagOpen, image, uppy, showTagOpen, deleteTagOpen, changeOwnerOpen, newId, owner = ""} = state;
    const {id} = useParams();

    const isNew = id === undefined;
    const isCurrentUserAdmin = matchRole([Role.ADMIN], currentUserData);

    const handleBeforeSaveTag = () => {
        const ownerToken = tokenizeText(owner)[0];
        const ownerUid = (ownerToken && ownerToken.type === "user" && ownerToken.id) || "";
        if (isNew) {
            tag.uid = currentUserData.id;
        } else if (tag.uid !== ownerUid) {
            setState(state => ({...state, changeOwnerOpen: true}));
            return;
        }
        saveTag();
    }

    const saveTag = async () => {
        dispatch(ProgressView.SHOW);
        setState(state => ({...state, disabled: true, changeOwnerOpen: false}));
        // for (let x in {"developer": 1, "genres": 1, "platforms": 1, "publisher": 1}) {
        //     tag.data[x] = adjustValue(tag.data[x], true);
        // }

        const checkIfLabelNotEmpty = async () => {
            if (!tag.label) {
                throw Error("Can not save item, label isn't defined");
            }
        }
        const updateIdIfChanged = async () => {
            const updatedId = normalizeSortName(tag.label);
            if (!isNew && updatedId !== tag.id) {
                throw Error("Label has been changed too significantly");
            }

            const existed = await new Pagination({
                ref: firebase.database().ref("tag"),
                child: "id",
                equals: updatedId,
            }).next();

            if (existed.filter(item => item.key !== id).length) {
                console.error(`[EditTag] not unique '${updatedId}' from '${tag.label}' for '${id}, found: ${JSON.stringify(existed)}`);
                throw Error("Label is not unique");
            }
            tag.id = updatedId;
        }
        const publishImageIfChanged = async () => {
            let publishing = {};
            if (uppy) {
                console.log("[EditTag] publish image", uppy)
                publishing = await uploadComponentPublish(firebase)({
                    auth: ".main",//currentUserData.id,
                    uppy,
                    name: tag.label,
                    onprogress: progress => {
                        dispatch({...ProgressView.SHOW, value: progress});
                    },
                    deleteFile: tag.image
                });
            }
            const {url: imageSaved} = (publishing[0] || {});
            tag.image = imageSaved || image || null;
        }
        const updateTimestamp = async () => {
            tag.timestamp = tag.timestamp || firebase.database.ServerValue.TIMESTAMP;
        }
        const updateUid = async () => {
            tag.uid = tag.uid !== undefined ? tag.uid : currentUserData.id;
            if (changeOwnerOpen) {
                const ownerToken = tokenizeText(owner)[0];
                if (ownerToken && ownerToken.type === "user") {
                    tag.uid = ownerToken.id;
                } else {
                    tag.uid = "0";
                }
                console.log(ownerToken, tag.uid)
            }
        }
        const updateSortName = async () => {
            if (!tag.hidden) {
                tag._sort_name = tag._sort_name || tag.id;
            }
        }
        const publishTag = async () => {
            return firebase.database().ref("tag").child(id || newId).set(tag);
        }
        const removeCachedTag = async () => {
            cacheDatas.remove(id || newId);
        }
        const onPublishSuccess = async () => {
            if (tag.hidden) {
                history.push(pages.home.route);
            } else {
                history.push(pages.tag.route + tag.id)
            }
        }

        checkIfLabelNotEmpty()
            .then(updateIdIfChanged)
            .then(publishImageIfChanged)
            .then(updateTimestamp)
            .then(updateUid)
            .then(updateSortName)
            .then(publishTag)
            .then(removeCachedTag)
            .then(onPublishSuccess)
            .catch(notifySnackbar)
            .finally(() => {
                dispatch(ProgressView.HIDE);
                setState(state => ({...state, disabled: false}));
            })

        console.log("[EditTag] save", tag)
    }

    // const adjustValue = (text, plain, separator = ",;") => {
    //     console.log(text)
    //     let tokens = (text || "")
    //         .split(new RegExp("[" + separator + "]\\s*"))
    //         .filter(token => !!token.trim())
    //         .map((token) => {
    //             if (token.trim()) {
    //                 if (plain) {
    //                     return token.trim();
    //                 } else {
    //                     return token.trim();
    //                     // return `$[item:${token.toLowerCase()}:${token}]`;
    //                 }
    //             } else {
    //                 return token;
    //             }
    //         })
    //     return tokens.join("; ");
    // }

    const toggleTag = (event, value) => {
        if (value && !tag.hidden) {
            setState(state => ({...state, hideTagOpen: true}));
        } else if (!value && tag.hidden) {
            setState(state => ({...state, showTagOpen: true}));
        }
    }

    const handleCancelAction = () => {
        setState(state => ({...state, hideTagOpen: false, showTagOpen: false, deleteTagOpen: false, changeOwnerOpen: false}));
    }

    const hideTag = () => {
        dispatch(ProgressView.SHOW);
        setState(state => ({...state, disabled: true, hideTagOpen: false}));

        const updates = {};
        updates[`tag/${id}/hidden`] = true;
        updates[`tag/${id}/_sort_name`] = null;
        console.log("[EditTag] updates", updates)
        firebase.database().ref().update(updates)
            .then(() => {
                tag.hidden = true;
                notifySnackbar({
                    title: `${tag.label} has been hidden.`,
                    variant: "warning"
                });
            })
            .catch(error => {
                delete tag.hidden;
                notifySnackbar(error);
            })
            .finally(() => {
                dispatch(ProgressView.HIDE);
                setState(state => ({...state, tag, disabled: false}));
            })
    }

    const showTag = () => {
        dispatch(ProgressView.SHOW);
        setState(state => ({...state, disabled: true, showTagOpen: false}));

        const updates = {};
        delete tag.hidden;
        updates[`tag/${id}/hidden`] = null;
        tag._sort_name = tag.id;
        updates[`tag/${id}/_sort_name`] = tag._sort_name;
        console.log("[EditTag] updates", updates)

        firebase.database().ref().update(updates)
            .then(() => {
                notifySnackbar({
                    title: `${tag.label} is visible now.`,
                    variant: "warning"
                });
            })
            .catch(error => {
                tag.hidden = true;
                notifySnackbar(error);
            })
            .finally(() => {
                dispatch(ProgressView.HIDE);
                setState(state => ({...state, tag, disabled: false}));
            })
    }

    const handleClickDelete = () => {
        setState(state => ({...state, deleteTagOpen: true}));
    }

    const deleteTag = () => {
        dispatch(ProgressView.SHOW);
        setState(state => ({...state, disabled: true, deleteTagOpen: false}));
        let updates = {};
        // let updatesLength = 0;
        // const addUpdate = async (path, value) => {
        //     updates[path] = value || null;
        //     updatesLength++;
        //     if (updatesLength > 1000) await updateUpdates();
        // }

        // const updateUpdates = () => {
        //     console.log("[EditTag]", updatesLength, updates);
        //     const upds = updates;
        //     updates = {};
        //     updatesLength = 0;
        //     return firebase.database().ref().update(upds);
        // }

        updates[`tag/${id}`] = null;
        updates[`_tag/${id}`] = null;
        // updates[`extra/${game.id}`] = null;
        // updates[`_counters/${game.id}`] = null;
        // updates[`_game_scores/${game.id}`] = null;
        // updates[`_stat/${game.id}`] = null;
        // new Pagination({
        //     ref: firebase.database().ref("_posts"),
        //     child: "gid",
        //     equals: tag.id,
        //     size: 10000,
        //     timeout: 180000,
        //     update: async (key, post) => {
        //         await addUpdate(`_posts/${key}`);
        //         await addUpdate(`posts/${post.id}`);
        //     }
        // }).next()
        //     .then(() => new Pagination({
        //         ref: firebase.database().ref("watch"),
        //         child: "wid",
        //         equals: game.id,
        //         size: 10000,
        //         timeout: 180000,
        //         update: async (key, watch) => {
        //             // console.log("watch", key, watch);
        //             await addUpdate(`watch/${key}`);
        //             await new Pagination({
        //                 ref: firebase.database().ref("watchstamps").child(watch.uid),
        //                 value: true,
        //                 equals: game.id,
        //                 size: 10000,
        //                 timeout: 180000,
        //                 update: async (key, watchstamp) => {
        //                     await addUpdate(`watchstamps/${watch.uid}/${key}`);
        //                 }
        //             }).next()
        //         }
        //     }).next())
        //     .then(() => {
        //         console.log(updates)
        //         return updateUpdates();
        //     })
        //     .then(() => {
        //         notifySnackbar(`Game ${game.data.name} has been deleted.`);
        //         history.push(pages.games.route);
        //     })
        //     .catch(notifySnackbar)
        //     .finally(() => {
        //         dispatch(ProgressView.HIDE);
        //         setState(state => ({...state, game, disabled: false}));
        //     })
    }

    const handleUploadPhotoSuccess = ({uppy, snapshot}) => {
        setState(state => ({...state, uppy, image: snapshot.uploadURL}));
    }

    const handleUploadPhotoError = (error) => {
        console.error("[EditTag] upload", error)
        uploadComponentClean(uppy);
        setState(state => ({...state, uppy: null}));
    }

    React.useEffect(() => {
        if (!id) {
            const tagRef = firebase.database().ref("tag").push();
            const tag = {};
            setState(state => ({...state, tag, newId: tagRef.key}));
        } else if (id) {
            firebase.database().ref("tag").child(id).once("value")
                .then(snapshot => {
                    if (snapshot.exists()) return snapshot.val();
                    throw Error(`${id} is not found`);
                })
                .then(tag => {
                    if (isCurrentUserAdmin) {
                        return tag;
                    } else if (allowOwner && tag.uid === currentUserData.id) {
                        return tag;
                    }
                    throw Error(`You can not manage ${tag.label}`);
                })
                .then(tag => setState(state => ({...state, tag, image: tag && tag.image})))
                .catch(error => {
                    notifySnackbar(error);
                    history.goBack();
                });
        }
        return () => {
            uploadComponentClean(uppy);
        }
        // eslint-disable-next-line
    }, [id]);

    React.useEffect(() => {
        if (!tag || !tag.uid || tag.uid === "0") return;
        UserData(firebase).fetch(tag.uid)
            .then(userData => {
                setState(state => ({...state, owner: `$[user:${tag.uid}:${userData.name}]`}));
            })
            .catch(notifySnackbar);
    }, [tag])

    if (!tag) return <LoadingComponent/>;
    return <Grid container className={classes.center}>
        <Grid container spacing={1}>
            <Grid item className={classes.photo}>
                {image ? <img src={image} alt={""} className={[classes.profileImage, classes._image].join(" ")}/>
                    : <TagIcon className={classes.profileImage}/>}
                {image && <Hidden smDown>
                    <IconButton
                        aria-label={"Clear"}
                        children={<ClearIcon/>}
                        className={classes.clearPhoto}
                        onClick={() => {
                            setState({...state, image: "", uppy: null});
                        }}
                        title={"Clear"}
                    />
                </Hidden>}
                <Grid container justify={"center"}>
                    <React.Suspense fallback={<LoadingComponent/>}>
                        <UploadComponent
                            button={<Button
                                aria-label={"Change"}
                                children={"Change"}
                                color={"secondary"}
                                fullWidth={!windowData.isNarrow()}
                                title={"Change"}
                                variant={"contained"}
                            />}
                            camera={false}
                            color={"primary"}
                            firebase={firebase}
                            limits={{width: 800, height: 600, size: 200000}}
                            onsuccess={handleUploadPhotoSuccess}
                            onerror={handleUploadPhotoError}
                            variant={"contained"}
                        />
                    </React.Suspense>
                    {image && <Hidden mdUp>
                        <Button
                            aria-label={"Clear"}
                            children={"Clear"}
                            color={"secondary"}
                            onClick={() => {
                                setState({...state, image: "", uppy: null});
                            }}
                            title={"Clear"}
                            variant={"contained"}
                        />
                    </Hidden>}
                </Grid>
            </Grid>
            <Grid item xs>
                <Grid container alignItems={"flex-end"}>
                    <TextField
                        color={"secondary"}
                        disabled={disabled}
                        required
                        fullWidth
                        label={"Name"}
                        onChange={ev => {
                            tag.label = ev.target.value;
                            setState({...state, tag, random: Math.random()});
                        }}
                        value={tag.label || ""}
                    />
                </Grid>
                <Box m={1}/>
                <Grid container alignItems={"flex-end"}>
                    <MentionsInputComponent
                        className={classes._description}
                        color={"secondary"}
                        disabled={disabled}
                        fullWidth
                        mentionsParams={[
                            mentionTags,
                            mentionUsers
                        ]}
                        multiline
                        onApply={(value) => console.log(value)}
                        onChange={ev => {
                            tag.description = ev.target.value;
                            setState({...state, tag});
                        }}
                        label={"Description"}
                        value={tag.description}
                        focused={true}/>
                </Grid>
                <Box m={1}/>
                {!uppy && <>
                    <Grid container alignItems={"flex-end"}>
                        <TextField
                            color={"secondary"}
                            disabled={disabled}
                            fullWidth
                            label={"Image URL"}
                            onChange={ev => {
                                const image = ev.target.value;
                                setState({...state, image, random: Math.random()});
                            }}
                            value={image || ""}
                        />
                    </Grid>
                    <Grid container alignItems={"flex-end"}>
                        {!disabled && <Typography variant={"subtitle2"}>
                            <a
                                href={`https://www.google.com/search?q=${tag.label} &source=lnms&tbm=isch&sa=X`}
                                rel={"noopener noreferrer"}
                                target={"_blank"}>Search for the image on Google</a>
                        </Typography>}
                    </Grid>
                    <Box m={1}/>
                </>}
                {!isNew && <>
                    <Grid container alignItems={"flex-end"}>
                        <MentionsInputComponent
                            color={"secondary"}
                            disabled={disabled}
                            fullWidth
                            mentionsParams={[
                                {
                                    ...mentionUsers,
                                    trigger: "",
                                    displayTransform: (id, display) => display
                                }
                            ]}
                            onApply={(value) => console.log(value)}
                            onChange={(ev, a, b, tokens) => {
                                // console.log(ev.target.value, a, b, c)
                                tokens = tokens || [];
                                let text = ev.target.value;
                                if (tokens.length) {
                                    const token = tokens[tokens.length - 1];
                                    text = token ? `$[user:${token.id}:${token.display}]` : "";
                                }
                                setState(state => ({...state, owner: text}));
                            }}
                            label={"Change owner"}
                            value={owner}/>
                    </Grid>
                    <Box m={1}/>
                </>}
                {!isNew && <>
                    <Grid container alignItems={"flex-end"}>
                        <FormControlLabel
                            control={<Switch
                                checked={tag.hidden || false}
                                disabled={disabled}
                                onChange={toggleTag}
                            />}
                            label={"Deactivate"}
                            style={{color: "#ff0000"}}
                        />
                    </Grid>
                    <Box m={1}/>
                </>}
                <ButtonGroup
                    color={"secondary"}
                    disabled={disabled}
                    fullWidth
                    size={"large"}
                    variant={"contained"}
                >
                    <Button onClick={handleBeforeSaveTag}>Save</Button>
                    <Button onClick={() => history.goBack()}>Cancel</Button>
                </ButtonGroup>
                {!isNew && <>
                    <Box m={4}/>
                    <Grid container justify={"center"}>
                        <Button onClick={handleClickDelete} style={{color: "#ff0000"}}>
                            Permanently remove
                        </Button>
                    </Grid>
                </>}
            </Grid>
            {hideTagOpen && <ConfirmComponent
                confirmLabel={"Hide"}
                critical
                onCancel={handleCancelAction}
                onConfirm={hideTag}
                title={"Hide item?"}
            >
                <b>{tag.label}</b> will be hidden, unavailable for view, not presented in suggestions. All
                related posts will be available.
                <br/>
                WARNING! This action will be proceeded immediately!
            </ConfirmComponent>}
            {showTagOpen && <ConfirmComponent
                confirmLabel={"Show"}
                critical
                onCancel={handleCancelAction}
                onConfirm={showTag}
                title={"Show item?"}
            >
                The hidden <b>{tag.label}</b> will be restored to show.
                <br/>
                WARNING! This action will be proceeded immediately!
            </ConfirmComponent>}
            {deleteTagOpen && <ConfirmComponent
                confirmLabel={"Delete"}
                critical
                onCancel={handleCancelAction}
                onConfirm={deleteTag}
                title={"Delete tag?"}
            >
                <b>{tag.label}</b> will be deleted and can not be restored.
                <br/>
                WARNING! This action will be proceeded immediately!
            </ConfirmComponent>}
            {changeOwnerOpen && <ConfirmComponent
                confirmLabel={"Continue"}
                critical
                onCancel={handleCancelAction}
                onConfirm={saveTag}
                title={"Change owner?"}
            >
                <MentionedTextComponent
                    mentions={[{...mentionUsers, displayTransform: (id, display) => display}]}
                    text={`You are going to ${owner ? `change owner to ${owner}` : "remove owner"}.${isCurrentUserAdmin ? "" : `\nWARNING! You will not be able to manage ${tag.label} anymore!`}`}
                />
            </ConfirmComponent>}
        </Grid>
    </Grid>
};

export default withStyles(theme => ({
    ...styles(theme),
    ...stylesCurrent(theme)
}))(EditTag);

export const mentionPlatforms = firebase => ({
    appendSpaceOnAdd: false,
    displayTransform: (a, b) => b,
    markup: "$[item:__id__:__display__]",
    pagination: (start) => new Pagination({
        ref: firebase.database().ref("_platforms"),
        child: "_sort_name",
        start: normalizeSortName(start),
        order: "asc"
    }),
    transform: item => ({id: item.key, display: item.value.name}),
    trigger: /(?:[,;]\s+)?(([^,;]*))$/,
});
