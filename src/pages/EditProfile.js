import React from "react";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import TextField from "@material-ui/core/TextField";
import Box from "@material-ui/core/Box";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import FormHelperText from "@material-ui/core/FormHelperText";
import Grid from "@material-ui/core/Grid";
import ClearIcon from "@material-ui/icons/Clear";
import MailIcon from "@material-ui/icons/Mail";
import EmptyAvatar from "@material-ui/icons/Person";
import {Redirect, useHistory, useParams} from "react-router-dom";
import {matchRole, Role, useCurrentUserData, UserData} from "../controllers/UserData";
import ProgressView from "../components/ProgressView";
import {useDispatch} from "react-redux";
import {refreshAll} from "../controllers/Store";
import UploadComponent, {publishFile} from "../components/UploadComponent";
import withStyles from "@material-ui/styles/withStyles";
import {
    cacheDatas,
    fetchDeviceId,
    hasWrapperControlInterface,
    notifySnackbar,
    setupReceivingNotifications, TextMaskEmail,
    useFirebase,
    usePages,
    useStore,
    wrapperControlCall
} from "../controllers";
import {adminFields, publicFields} from "./Profile";
import LoadingComponent from "../components/LoadingComponent";
import Pagination from "../controllers/FirebasePagination";
import ConfirmComponent from "../components/ConfirmComponent";
// import AvatarEdit from "react-avatar-edit";

const styles = theme => ({
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
        justifyContent: "start"
    },
    clearPhoto: {
        backgroundColor: "transparent",
        position: "absolute",
        top: 0,
        right: 0,
        color: "white",
    },
    content: {}
});

let uppy, file, snapshot;
function EditProfile(props) {
    let {classes, uploadable = true, notifications = true, publicFields = publicFields, adminFields: adminFieldsGiven = adminFields, privateFields} = props;
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const store = useStore();
    const {id} = useParams();
    const [state, setState] = React.useState({
        error: null,
        disabled: false,
    });

    const {state: givenState = {}} = history.location;
    const {tosuccessroute} = givenState;

    // data = givenData || data || userData;// || new UserData(firebase).fromJSON(JSON.parse(window.localStorage.getItem(history.location.pathname)));

    const {image, disabled, requiredError = [], uniqueError = [], userData, deleteOpen, role} = state;
    uppy = state.uppy;
    file = state.file;
    snapshot = state.snapshot;

    const onerror = error => {
        setState({...state, disabled: false});
        notifySnackbar(error);
        refreshAll(store);
    };

    const requiredFilled = () => {
        const requiredError = [];
        publicFields.forEach(field => {
            if (field && field.required && (!state[field.id] || !state[field.id].toString().trim().length)) {
                requiredError.push(field.id);
            }
        })
        if (requiredError.length > 0) {
            setState(state => ({...state, requiredError}));
            return false;
        }
        return true;
    }

    const checkUnique = async () => {
        const uniqueError = [];
        for (let field of publicFields) {
            if (field.unique) {
                const values = await new Pagination({
                    ref: firebase.database().ref("users_public"),
                    child: "name",
                    equals: (state[field.id] !== undefined && (state[field.id] || "").constructor.name === "String")
                        ? (state[field.id] || "").trim() : state[field.id]
                }).next();
                for (let value of (values || [])) {
                    if (value.key && value.key !== userData.id) {
                        uniqueError.push(field.id);
                    }
                }
            }
        }
        if (uniqueError.length > 0) {
            setState(state => ({...state, uniqueError}));
            return false;
        }
        return true;
    }

    const saveUser = async () => {
        if (!requiredFilled()) return;

        dispatch(ProgressView.SHOW);
        setState(state => ({...state, requiredError: [], uniqueError: [], disabled: true}));
        const unique = await checkUnique();
        if (!unique) {
            setState(state => ({...state, disabled: false}));
            dispatch(ProgressView.HIDE);
            return;
        }

        let publishing = {};

        if (uppy) {
            publishing = await publishFile(firebase)({
                auth: userData.id,
                uppy,
                file,
                snapshot,
                onprogress: progress => {
                    dispatch({...ProgressView.SHOW, value: progress});
                },
                defaultUrl: image,
                deleteFile: userData.public.image
            });
        }
        const {url: imageSaved, metadata} = publishing;

        if (isAdminAllowed) await saveUserByAdmin();

        const additionalPublic = {};
        publicFields.forEach(field => {
            if (state[field.id]) {
                additionalPublic[field.id] = state[field.id];
            }
        })

        userData.set({
            ...additionalPublic,
            image: imageSaved || image || "",
        }).then(() => userData.savePublic())
            .then(() => userData.fetch([UserData.UPDATED, UserData.FORCE]))
            .then(() => {
                if (currentUserData.id === userData.id) {
                    dispatch({type: "currentUserData", userData});
                }
            })
            .then(() => {
                refreshAll(store);
                setState({...state, disabled: false, uppy: null})
                if (isAdminAllowed) {
                    history.goBack();
                } else if (tosuccessroute) {
                    history.push(tosuccessroute);
                } else {
                    history.goBack();
                }
            })
            .catch(onerror)
            .finally(() => dispatch(ProgressView.HIDE));
    };

    const saveUserByAdmin = () => {
        const updates = {};
        updates[`roles/${userData.id}`] = (role === Role.USER || role === Role.USER_NOT_VERIFIED) ? null : role;
        if (role === Role.USER_NOT_VERIFIED) {
            updates[`users_public/${userData.id}/emailVerified`] = false;
        } else if (role === Role.USER || role === Role.ADMIN) {
            updates[`users_public/${userData.id}/emailVerified`] = true;
        }
        updates[`users_public/${userData.id}/updated`] = firebase.database.ServerValue.TIMESTAMP;
        return firebase.database().ref().update(updates)
            .then(() => userData.fetch([UserData.ROLE, UserData.PUBLIC, UserData.FORCE]))
    }

    const handleUploadPhotoSuccess = ({uppy, file, snapshot}) => {
        removeUploadedFile();
        setState({...state, uppy, file, snapshot, image: snapshot.uploadURL});
    }

    const handleUploadPhotoError = (error) => {
        console.error("[EditProfile] upload", error)
        removeUploadedFile();
        setState({...state, uppy: null, file: null, snapshot: null});
    }

    const removeUploadedFile = () => {
        if (uppy && file) {
            uppy.removeFile(file.id);
            console.log("[EditProfile] file removed", snapshot);
        }
    }

    const handleClickDelete = () => {
        setState(state => ({...state, deleteOpen: true}));
    }

    const deleteUser = () => {
        dispatch(ProgressView.SHOW);
        setState(state => ({...state, disabled: true, deleteOpen: false}));
        console.log("delete user by admin", userData.id)

        userData.delete()
            .then(() => {
                notifySnackbar("User deleted");
                setState(state => ({...state, disabled: false}));
                history.goBack();
            })
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE))
    }

    const handleAdminAction = disabled => {
        setState({...state, disabled})
    }

    const onClose = () => {
        setState({...state, preview: null})
    }

    const onCrop = (preview) => {
        setState({...state, preview})
    }

    const onBeforeFileLoad = (elem) => {
        if (elem.target.files[0].size > 71680) {
            alert("File is too big!");
            elem.target.value = "";
        }
    }

    const handleNotifications = (evt, enable) => {
        dispatch(ProgressView.SHOW);
        setState({...state, disabled: true});
        if (enable) {
            setupReceivingNotifications(firebase)
                // .then(token => fetchUserPrivate(firebase)(currentUserData.id)
                //     .then(data => updateUserPrivate(firebase)(currentUserData.id, fetchDeviceId(), {notification: token}))
                .then(token => {
                    userData.private[fetchDeviceId()].notification = token;
                    return userData.savePrivate();
                })
                .then(() => notifySnackbar("Subscribed"))
                .catch(notifySnackbar)
                .finally(() => {
                    dispatch(ProgressView.HIDE);
                    setState({...state, disabled: false});
                });
        } else {
            userData.private[fetchDeviceId()].notification = null;
            userData.savePrivate()
                .then(() => firebase.messaging().deleteToken())
                .catch(error => {
                    if (error.code === "messaging/unsupported-browser" && hasWrapperControlInterface()) {
                        return wrapperControlCall({method: "unsubscribeNotifications", timeout: 30000})
                            .then(result => {
                                console.log("UNSUBSCRIBE RESULT " + JSON.stringify(result));
                            })
                    } else return error;
                })
                .then(() => notifySnackbar("Unsubscribed"))
                .catch(notifySnackbar)
                .finally(() => {
                    dispatch(ProgressView.HIDE);
                    setState({...state, disabled: false});
                });
            // fetchUserPrivate(firebase)(currentUserData.id)
            //     .then(data => updateUserPrivate(firebase)(currentUserData.id, fetchDeviceId(), {notification: null}))
            //     .then(result => {
            // localStorage.removeItem("notification-token");
            notifySnackbar({title: "Unsubscribed"});
            // });
        }
    };

    const isSameUser = (userData, currentUserData) => userData && currentUserData && userData.id === currentUserData.id;

    React.useEffect(() => {
        dispatch(ProgressView.SHOW);
        let userData;
        if (!id || id === ":id") {
            userData = currentUserData;
        } else {
            userData = cacheDatas.put(id, UserData(firebase).create(id));
        }
        userData.fetch([UserData.PUBLIC, UserData.ROLE])
            .then(() => isSameUser(userData, currentUserData) && userData.fetchPrivate(fetchDeviceId()))
            .then(() => setState({...state, userData, ...userData.public, role: userData.role}))
            .catch(error => {
                notifySnackbar(error);
                history.goBack();
            })
            .finally(() => dispatch(ProgressView.HIDE))
        return () => {
            removeUploadedFile();
        }
    }, [id])

    if (!userData) return <LoadingComponent/>
    if (userData.id !== currentUserData.id && !matchRole([Role.ADMIN], currentUserData)) {
        return <Redirect to={pages.editself.route}/>
    }

    const isAdminAllowed = matchRole([Role.ADMIN], currentUserData);
    const isEditAllowed = !disabled && (isSameUser(userData, currentUserData) && matchRole([Role.ADMIN, Role.USER], currentUserData));
    const fields = [...publicFields, ...(isAdminAllowed ? adminFieldsGiven : [])];
    const isNotificationsAvailable = firebase.messaging && isSameUser(userData, currentUserData) && notifications && matchRole([Role.ADMIN, Role.USER], currentUserData);

    return <Grid container spacing={1}>
        <Box m={0.5}/>
        <Grid item className={classes.photo}>
            <Grid container>
                {image ? <img src={image} alt="" className={classes.image}/>
                    : <EmptyAvatar className={classes.image}/>}
                <IconButton className={classes.clearPhoto} onClick={() => {
                    setState({...state, image: "", uppy: null});
                }}><ClearIcon/></IconButton>
            </Grid>
            {uploadable && <UploadComponent
                button={<Button variant={"contained"} color={"secondary"} children={"Change"}/>}
                color={"primary"}
                firebase={firebase}
                limits={{width: 300, height: 300, size: 100000}}
                onsuccess={handleUploadPhotoSuccess}
                onerror={handleUploadPhotoError}
                variant={"contained"}
            />}
            {/*<AvatarEdit
                width={390}
                cropRadius={1}
                height={295}
                onCrop={onCrop}
                onClose={onClose}
                onBeforeFileLoad={onBeforeFileLoad}
                src={image}
            />*/}
        </Grid>
        <Grid item xs>
            <Grid container spacing={1} alignItems="flex-end">
                <Grid item>
                    <MailIcon/>
                </Grid>
                <Grid item xs>
                    <TextField
                        color={"secondary"}
                        disabled
                        fullWidth
                        label="E-mail"
                        value={userData.email || ""}
                    />
                </Grid>
            </Grid>
            {userData.public && fields && fields.map(field => {
                if (field.editComponent === null) return null;
                const editComponent = field.editComponent || <TextField/>;
                const missedRequired = requiredError.indexOf(field.id) >= 0;
                const uniqueRequired = uniqueError.indexOf(field.id) >= 0;
                return <React.Fragment key={field.id}>
                    <Box m={1}/>
                    <Grid container spacing={1} wrap={"nowrap"} alignItems="flex-end">
                        <Grid item>
                            {field.icon}
                        </Grid>
                        <Grid item xs>
                            {editComponent instanceof Function
                                ? editComponent({
                                    ...editComponent.props,
                                    color: "secondary",
                                    disabled,
                                    error: missedRequired || uniqueRequired,
                                    fullWidth: true,
                                    label: field.label,
                                    onChange: ev => {
                                        setState({...state, [field.id]: ev.target.value || ""});
                                    },
                                    required: field.required,
                                    value: state[field.id] || ""
                                }) :
                                <editComponent.type
                                    {...editComponent.props}
                                    color={"secondary"}
                                    disabled={disabled}
                                    error={missedRequired || uniqueRequired}
                                    fullWidth
                                    label={field.label}
                                    onChange={ev => {
                                        setState({...state, [field.id]: ev.target.value || ""});
                                    }}
                                    required={field.required}
                                    value={state[field.id] || ""}
                                />}
                            {missedRequired || uniqueRequired ? <FormHelperText error>{missedRequired ? "Please enter value"
                                : (uniqueRequired ? "This name is already taken" : null)}</FormHelperText> : null}
                        </Grid>
                    </Grid>
                </React.Fragment>
            })}
            {isNotificationsAvailable && <React.Fragment>
                <Box m={1}/>
                <Grid container><FormControlLabel
                    control={
                        <Switch
                            disabled={disabled}
                            checked={Boolean(userData.private[fetchDeviceId()] && userData.private[fetchDeviceId()].notification)}
                            onChange={handleNotifications}
                        />
                    }
                    label={"Get notifications"}
                /></Grid>
            </React.Fragment>}
            <Box m={2}/>
            <ButtonGroup variant="contained" color={"secondary"} size="large" fullWidth
                         disabled={disabled}>
                <Button onClick={saveUser}>
                    Save
                </Button>
                <Button onClick={() => history.goBack()}>
                    Cancel
                </Button>
            </ButtonGroup>
            {isAdminAllowed && <React.Fragment>
                <Box m={8}/>
                <Grid container justify={"center"}>
                    <Button onClick={handleClickDelete} variant={"text"} style={{color: "#ff0000"}}>
                        Delete user account
                    </Button>
                </Grid></React.Fragment>}
        </Grid>
        {deleteOpen && <ConfirmComponent
            confirmLabel={"Delete"}
            critical
            onCancel={() => setState(state => ({...state, deleteOpen: false}))}
            onConfirm={deleteUser}
            title={"Delete user data?"}
        >
            User's <b>{userData.name}</b> account and all his data will be deleted and can not be
            restored.
            <br/>
            WARNING! This action will be proceeded immediately!
        </ConfirmComponent>}
    </Grid>
};

export default withStyles(styles)(EditProfile);

