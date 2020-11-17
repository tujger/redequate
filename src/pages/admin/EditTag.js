import React from "react";
import {useHistory, useParams} from "react-router-dom";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import Box from "@material-ui/core/Box";
import {useDispatch} from "react-redux";
import Switch from "@material-ui/core/Switch";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import IconButton from "@material-ui/core/IconButton";
import ClearIcon from "@material-ui/icons/Clear";
import withStyles from "@material-ui/styles/withStyles";
import GameIcon from "@material-ui/icons/LocalBar";
import {cacheDatas, useFirebase, usePages} from "../../controllers/General";
import ProgressView from "../../components/ProgressView";
import notifySnackbar from "../../controllers/notifySnackbar";
import {uploadComponentClean, uploadComponentPublish} from "../../components/UploadComponent/uploadComponentControls";
import LoadingComponent from "../../components/LoadingComponent";
import UploadComponent from "../../components/UploadComponent/UploadComponent";
import MentionsInputComponent from "../../components/MentionsInputComponent/MentionsInputComponent";
import {mentionTags, mentionUsers} from "../../controllers/mentionTypes";
import ConfirmComponent from "../../components/ConfirmComponent";
import {styles} from "../../controllers/Theme";
import Pagination from "../../controllers/FirebasePagination";
import {normalizeSortName} from "../../controllers/UserData";

const stylesCurrent = theme => ({
    image: {
        [theme.breakpoints.up("sm")]: {
            width: theme.spacing(18),
            height: theme.spacing(18),
        },
        [theme.breakpoints.down("sm")]: {
            width: theme.spacing(24),
            height: theme.spacing(24),
        },
        color: "darkgray",
        objectFit: "cover"
    },
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    },
    photo: {
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "start",
        [theme.breakpoints.down("sm")]: {
            marginRight: 100,
        },
    },
    clearPhoto: {
        backgroundColor: "transparent",
        position: "absolute",
        top: 0,
        right: 0,
        color: "white",
    },
    _description: {
        height: 120
    },
    content: {},
});

const EditTag = ({new: isNew, classes, ...rest}) => {
    const history = useHistory();
    const firebase = useFirebase();
    const dispatch = useDispatch();
    const pages = usePages();
    const [state, setState] = React.useState({});
    const {tag, disabled, hideTagOpen, image, uppy, showTagOpen, deleteTagOpen} = state;
    const {id} = useParams();

    const saveTag = async () => {
        dispatch(ProgressView.SHOW);
        setState(state => ({...state, disabled: true}));
        // for (let x in {"developer": 1, "genres": 1, "platforms": 1, "publisher": 1}) {
        //     tag.data[x] = adjustValue(tag.data[x], true);
        // }
        if (!tag.label) {
            notifySnackbar(new Error("Can not save tag, name isn't defined"));
            dispatch(ProgressView.HIDE);
            setState(state => ({...state, disabled: false}));
            return;
        }

        let publishing = {};
        if (uppy) {
            console.log("[EditTag] publish image", uppy)
            try {
                publishing = await uploadComponentPublish(firebase)({
                    auth: ".main",//currentUserData.id,
                    uppy,
                    name: tag.label,
                    onprogress: progress => {
                        dispatch({...ProgressView.SHOW, value: progress});
                    },
                    deleteFile: tag.image
                });
            } catch (error) {
                notifySnackbar(error);
                dispatch(ProgressView.HIDE);
                setState(state => ({...state, disabled: false}));
                return;
            }
        }
        const {url: imageSaved} = (publishing[0] || {});

        tag.image = imageSaved || image || null;

        firebase.database().ref("tag").child(id).set(tag)
            .then(() => history.goBack())
            .then(() => cacheDatas.remove(id))
            .catch(notifySnackbar)
            .finally(() => {
                dispatch(ProgressView.HIDE);
                setState(state => ({...state, disabled: false}));
            })
        console.log("[EditTag] save", tag)
    }

    const adjustValue = (text, plain, separator = ",;") => {
        console.log(text)
        let tokens = (text || "")
            .split(new RegExp("[" + separator + "]\\s*"))
            .filter(token => !!token.trim())
            .map((token) => {
                if (token.trim()) {
                    if (plain) {
                        return token.trim();
                    } else {
                        return token.trim();
                        // return `$[item:${token.toLowerCase()}:${token}]`;
                    }
                } else {
                    return token;
                }
            })
        return tokens.join("; ");
    }

    const toggleTag = (event, value) => {
        if (value && !tag.hidden) {
            setState(state => ({...state, hideTagOpen: true}));
        } else if (!value && tag.hidden) {
            setState(state => ({...state, showTagOpen: true}));
        }
    }

    const handleCancelAction = () => {
        setState(state => ({...state, hideTagOpen: false, showTagOpen: false, deleteTagOpen: false}));
    }

    const hideTag = () => {
        dispatch(ProgressView.SHOW);
        setState(state => ({...state, disabled: true, hideTagOpen: false}));

        const updates = {};
        // updates[`_game_scores/${game.id}`] = null;
        updates[`tag/${id}/hidden`] = true;
        updates[`tag/${id}/_sort_name`] = null;
        console.log("[EditTag] updates", updates)
        firebase.database().ref().update(updates)
            .then(() => {
                tag.hidden = true;
                notifySnackbar({
                    title: `Tag ${tag.label} and all related resources have been hidden.`,
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
        // updates[`_game_scores/${game.id}`] = null;
        delete tag.hidden;
        updates[`tag/${id}/hidden`] = null;
        updates[`tag/${id}/_sort_name`] = tag._sort_name;
        // updates[`_game_scores/${game.id}/score`] = 0.001;
        console.log("[EditTag] updates", updates)

        firebase.database().ref().update(updates)
            .then(() => {
                notifySnackbar({
                    title: `Tag ${tag.label} is visible now. Score will be recalculated during an hour.`,
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
        let updatesLength = 0;
        const addUpdate = async (path, value) => {
            updates[path] = value || null;
            updatesLength++;
            if (updatesLength > 1000) await updateUpdates();
        }

        const updateUpdates = () => {
            console.log("[FU]", updatesLength, updates);
            const upds = updates;
            updates = {};
            updatesLength = 0;
            return firebase.database().ref().update(upds);
        }

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
        setState({...state, uppy, image: snapshot.uploadURL});
    }

    const handleUploadPhotoError = (error) => {
        console.error("[EditTag] upload", error)
        uploadComponentClean(uppy);
        setState({...state, uppy: null});
    }

    React.useEffect(() => {
        if (isNew) {
            // const tagRef = firebase.database().ref("tag").push();
            // const tag = new GameData(firebase).create({id: gameRef.key});
            // setState(state => ({...state, game, gameRef}));
        } else if (id) {
            firebase.database().ref("tag").child(id).once("value")
                .then(snapshot => {
                    if(snapshot.exists()) return snapshot.val();
                    throw Error("Tag not found");
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

    if (!tag) return <LoadingComponent/>;
    return <Grid container className={classes.center}>
        <Grid container spacing={1} alignItems={"flex-start"}>
            <Grid item className={classes.photo}>
                <Grid container>
                    {image ? <img src={image} alt="" className={classes.image}/>
                        : <GameIcon className={classes.image}/>}
                    <IconButton
                        children={<ClearIcon/>}
                        className={classes.clearPhoto}
                        onClick={() => setState(state => ({...state, image: "", uppy: null}))}
                    />
                </Grid>
                <React.Suspense fallback={<LoadingComponent/>}>
                    <UploadComponent
                        button={<Button variant={"contained"} color={"secondary"} children={"Change"}/>}
                        camera={false}
                        color={"primary"}
                        firebase={firebase}
                        limits={{width: 800, height: 600, size: 200000}}
                        onsuccess={handleUploadPhotoSuccess}
                        onerror={handleUploadPhotoError}
                        variant={"contained"}
                    />
                </React.Suspense>
            </Grid>
            <Grid item xs>
                <Grid container alignItems="flex-end">
                    <TextField
                        color={"secondary"}
                        disabled={disabled}
                        required
                        fullWidth
                        label="Name"
                        onChange={ev => {
                            tag.label = ev.target.value;
                            setState({...state, tag, random: Math.random()});
                        }}
                        value={tag.label || ""}
                    />
                </Grid>
                <Box m={1}/>
                <Grid container alignItems="flex-end">
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
                {!uppy && <React.Fragment>
                    <Grid container alignItems="flex-end">
                        <TextField
                            color={"secondary"}
                            disabled={disabled}
                            fullWidth
                            label="Image URL"
                            onChange={ev => {
                                const image = ev.target.value;
                                setState({...state, image, random: Math.random()});
                            }}
                            value={image || ""}
                        />
                    </Grid>
                    <Grid container alignItems="flex-end">
                        {!disabled && <Typography variant={"subtitle2"}>
                            <a
                                href={`https://www.google.com/search?q=${tag.label} &source=lnms&tbm=isch&sa=X`}
                                rel={"noopener noreferrer"}
                                target={"_blank"}>Search for the image on Google</a>
                        </Typography>}
                    </Grid>
                    <Box m={1}/>
                </React.Fragment>}
                {!isNew && <React.Fragment><Grid container alignItems="flex-end">
                    <FormControlLabel
                        control={<Switch
                            checked={tag.hidden || false}
                            disabled={disabled}
                            onChange={toggleTag}
                        />}
                        label="Deactivate this tag"
                        style={{color: "#ff0000"}}
                    />
                </Grid>
                    <Box m={1}/>
                </React.Fragment>}
                <ButtonGroup
                    color={"secondary"}
                    disabled={disabled}
                    fullWidth
                    size="large"
                    variant="contained"
                >
                    <Button onClick={saveTag}>Save</Button>
                    <Button onClick={() => history.goBack()}>Cancel</Button>
                </ButtonGroup>
                {!isNew && <React.Fragment>
                    <Box m={4}/>
                    <Grid container justify={"center"}>
                        <Button onClick={handleClickDelete} style={{color: "#ff0000"}}>
                            Permanently remove tag
                        </Button>
                    </Grid></React.Fragment>}
            </Grid>
            {hideTagOpen && <ConfirmComponent
                confirmLabel={"Hide"}
                critical
                onCancel={handleCancelAction}
                onConfirm={hideTag}
                title={"Hide tag?"}
            >
                The tag <b>{tag.label}</b> will be hidden, unavailable for view, not presented in suggestions. All
                posts in followings and watchlist will be available.
                <br/>
                WARNING! This action will be proceeded immediately!
            </ConfirmComponent>}
            {showTagOpen && <ConfirmComponent
                confirmLabel={"Show"}
                critical
                onCancel={handleCancelAction}
                onConfirm={showTag}
                title={"Show tag?"}
            >
                The hidden tag <b>{tag.label}</b> will be restored to show.
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
                The tag <b>{tag.label}</b>, all its posts, replies, watchlist items will be deleted and can not be
                restored.
                <br/>
                WARNING! This action will be proceeded immediately!
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
