import React from "react";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import TextField from "@material-ui/core/TextField";
import Box from "@material-ui/core/Box";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import Hidden from "@material-ui/core/Hidden";
import FormHelperText from "@material-ui/core/FormHelperText";
import Grid from "@material-ui/core/Grid";
import ClearIcon from "@material-ui/icons/Clear";
import MailIcon from "@material-ui/icons/Mail";
import EmptyAvatar from "@material-ui/icons/Person";
import {Redirect, useHistory, useParams} from "react-router-dom";
import {
    logoutUser,
    matchRole,
    normalizeSortName,
    Role,
    useCurrentUserData,
    UserData
} from "../controllers/UserData";
import ProgressView from "../components/ProgressView";
import {useDispatch} from "react-redux";
import {refreshAll} from "../controllers/Store";
import withStyles from "@material-ui/styles/withStyles";
import {
    cacheDatas,
    fetchDeviceId,
    useFirebase,
    usePages,
    useStore,
    useWindowData
} from "../controllers/General";
import {hasWrapperControlInterface, wrapperControlCall} from "../controllers/WrapperControl";
import notifySnackbar from "../controllers/notifySnackbar";
import {setupReceivingNotifications} from "../controllers/Notifications";
import {styles} from "../controllers/Theme";
import {adminFields, publicFields as publicFieldsDefault} from "./Profile";
import LoadingComponent from "../components/LoadingComponent";
import Pagination from "../controllers/FirebasePagination";
import ConfirmComponent from "../components/ConfirmComponent";
import {
    uploadComponentClean,
    uploadComponentPublish
} from "../components/UploadComponent/uploadComponentControls";
import UploadComponent from "../components/UploadComponent/UploadComponent";
import {updateActivity} from "./admin/audit/auditReducer";
import {useTranslation} from "react-i18next";
// const UploadComponent = React.lazy(() => import(/* webpackChunkName: 'upload' */"../components/UploadComponent/UploadComponent"));
// import AvatarEdit from "react-avatar-edit";

const stylesCurrent = theme => ({
    // image: {
    //     color: "darkgray",
    //     marginBottom: theme.spacing(1),
    //     objectFit: "cover",
    //     [theme.breakpoints.up("sm")]: {
    //         height: theme.spacing(18),
    //         width: theme.spacing(18),
    //     },
    //     [theme.breakpoints.down("sm")]: {
    //         height: theme.spacing(24),
    //         width: theme.spacing(24),
    //     },
    // },
    profileImage: {
        [theme.breakpoints.down("sm")]: {
            width: theme.spacing(25),
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
    clearImage: {
        backgroundColor: "transparent",
        position: "absolute",
        right: 0,
        top: 0,
        [theme.breakpoints.up("sm")]: {
            color: "white",
        },
    },
    content: {
        flexDirection: "row"
    }
});

const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);

function EditProfile(props) {
    // eslint-disable-next-line react/prop-types
    let {
        adminFields: adminFieldsGiven = adminFields,
        allowDelete = true,
        classes,
        notifications = true,
        publicFields = publicFieldsDefault,
        uploadable = true,
    } = props;
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const store = useStore();
    const windowData = useWindowData();
    const {id} = useParams();
    const [state, setState] = React.useState({
        error: null,
        disabled: false,
    });
    const {state: givenState = {}} = history.location;
    const {tosuccessroute, isFirstLogin} = givenState;
    const {t} = useTranslation();

    // data = givenData || data || userData;// || new UserData(firebase).fromJSON(JSON.parse(window.localStorage.getItem(history.location.pathname)));

    const {
        image,
        disabled,
        requiredError = [],
        uniqueError = [],
        userData,
        deleteOpen,
        role,
        uppy
    } = state;

    const saveUser = async () => {
        const prepareSaving = async () => {
            dispatch(ProgressView.SHOW);
            setState(state => ({...state, requiredError: [], uniqueError: [], disabled: true}));
        }
        const checkForRequiredFields = async () => {
            const requiredError = [];
            publicFields.forEach(field => {
                if (field && field.required && (!state[field.id] || !state[field.id].toString().trim().length)) {
                    requiredError.push(field.id);
                }
            })
            if (requiredError.length > 0) {
                setState(state => ({...state, requiredError}));
                throw "";
            }
        }
        const checkIfNameIsBlocked = async () => {
            const snapshot = await firebase.database().ref("meta/blockedNames").once("value");
            const blockedNames = (snapshot.val() || "").split(/[\s\r\n]+/)
                .map(item => normalizeSortName(item));
            if (blockedNames.indexOf(normalizeSortName(state.name)) >= 0) {
                throw Error("This user user name is reserved for distilleries. If you are a distillery, please contact us using Contacts page.")
            }
        }
        const checkForUniqueFields = async () => {
            const uniqueError = [];
            for (const field of publicFields) {
                if (field.unique) {
                    const values = await new Pagination({
                        ref: firebase.database().ref("users_public"),
                        child: "name",
                        equals: (state[field.id] !== undefined && (state[field.id] || "").constructor.name === "String")
                            ? (state[field.id] || "").trim() : state[field.id]
                    }).next();
                    for (const value of (values || [])) {
                        if (value.key && value.key !== userData.id) {
                            uniqueError.push(field.id);
                        }
                    }
                }
            }
            if (uniqueError.length > 0) {
                setState(state => ({...state, uniqueError}));
                throw ""
            }
        }
        const checkIfProfileExists = async () => {
            const exists = await firebase.database().ref("users_public").child(userData.id).child("email").once("value").then(snapshot => snapshot.exists());
            if (!exists) {
                await logoutUser(firebase, store)();
                refreshAll(store);
                history.replace(pages.home.route);
                throw Error(t("User.Profile is not found, forcing log out"));
            }
        }
        const deleteImageIfObsolete = async () => {
            if (userData.image && image !== userData.image) {
                console.log("[EditProfile] delete", userData.image)
                try {
                    await firebase.storage().refFromURL(userData.image).delete();
                } catch (e) {
                    console.error(e);
                }
            }
        }
        const publishImage = async () => {
            if (uppy) {
                const publishing = await uploadComponentPublish(firebase)({
                    auth: userData.id,
                    files: uppy._uris,
                    name: "profile",
                    onprogress: progress => {
                        dispatch({...ProgressView.SHOW, value: progress});
                    },
                    deleteFile: userData.public.image
                });
                uploadComponentClean(uppy);
                const {url} = (publishing[0] || {});
                userData.set({
                    image: url || image || null,
                });
            } else {
                userData.set({
                    image: image || null,
                });
            }
        }
        const processPublicFields = async () => {
            const additionalPublic = {};
            publicFields.forEach(field => {
                if (state[field.id] !== undefined) {
                    additionalPublic[field.id] = state[field.id];
                }
            })
            userData.set({
                ...additionalPublic,
            });
        }
        const updateFieldsInFirebase = async () => {
            if (isSameUser(userData, currentUserData)) {
                firebase.auth().currentUser.updateProfile({
                    displayName: userData.name,
                    photoURL: userData.image
                }).catch(console.error)
            }
        }
        const saveByAdmin = async () => {
            if (isAdmin) {
                const updates = {};
                updates[`roles/${userData.id}`] = (role === Role.USER || role === Role.USER_NOT_VERIFIED) ? null : role;
                if (role === Role.USER_NOT_VERIFIED) {
                    updates[`users_public/${userData.id}/emailVerified`] = false;
                } else if (role === Role.USER || role === Role.ADMIN) {
                    updates[`users_public/${userData.id}/emailVerified`] = true;
                }
                updates[`users_public/${userData.id}/updated`] = firebase.database.ServerValue.TIMESTAMP;
                if (role !== userData.role) {
                    updateActivity({
                        firebase,
                        uid: currentUserData.id,
                        type: "User role change",
                        details: {
                            role: role || null,
                            previousRole: userData.role || null,
                            uid: userData.id,
                        },
                    }).catch(console.error);
                }
                return firebase.database().ref().update(updates);
            }
        }
        const refreshUserData = async () => {
            await userData.fetch([UserData.ROLE, UserData.PUBLIC, UserData.FORCE]);
        }
        const updateCurrentUserData = async () => {
            if (currentUserData.id === userData.id) {
                dispatch({type: "currentUserData", userData});
            }
        }
        const onSaveComplete = async () => {
            setState(state => ({...state, disabled: false, uppy: null}))
            refreshAll(store);
            if (isAdmin) {
                history.goBack();
            } else if (tosuccessroute) {
                history.push(tosuccessroute);
            } else {
                history.goBack();
            }
        }
        const finalizeSaving = async () => {
            dispatch(ProgressView.HIDE);
            setState(state => ({...state, disabled: false}));
        }

        prepareSaving()
            .then(checkForRequiredFields)
            .then(checkIfNameIsBlocked)
            .then(checkForUniqueFields)
            .then(checkIfProfileExists)
            .then(deleteImageIfObsolete)
            .then(publishImage)
            .then(processPublicFields)
            .then(userData.savePublic)
            .then(updateFieldsInFirebase)
            .then(saveByAdmin)
            .then(refreshUserData)
            .then(updateCurrentUserData)
            .then(onSaveComplete)
            .catch(notifySnackbar)
            .finally(finalizeSaving);
    };

    const handleUploadPhotoSuccess = ({uppy, snapshot}) => {
        setState(state => ({...state, uppy, image: snapshot.uploadURL}));
    }

    const handleUploadPhotoError = (error) => {
        console.error("[EditProfile] upload", error)
        uploadComponentClean(uppy);
        setState(state => ({...state, uppy: null}));
    }

    const handleClickDelete = () => {
        setState(state => ({...state, deleteOpen: true}));
    }

    const deleteUser = () => {
        let isMount = true;
        const prepareDeleting = async () => {
            dispatch(ProgressView.SHOW);
            setState(state => ({...state, disabled: true, deleteOpen: false}));
        }
        const deleteUserData = async () => {
            console.log("[EditProfile] delete user by", currentUserData.role, userData.id);
            return userData.delete();
        }
        const onDeleteComplete = async () => {
            notifySnackbar(t("User.User deleted"));
            if (isSameUser(userData, currentUserData)) {
                logoutUser(firebase, store)();
                history.replace(pages.home.route);
            } else {
                history.goBack();
            }
            isMount = false;
        }
        const publishActivity = async () => {
            updateActivity({
                firebase,
                uid: currentUserData.id,
                type: "User delete",
                details: userData.toJSON(),
            }).catch(console.error);
        }
        const finalizeDeleting = async () => {
            dispatch(ProgressView.HIDE);
            isMount && setState(state => ({...state, disabled: false, deleteOpen: false}));
        }

        prepareDeleting()
            .then(deleteUserData)
            .then(onDeleteComplete)
            .then(publishActivity)
            .catch(notifySnackbar)
            .finally(finalizeDeleting);
    }

    const handleNotifications = (evt, enable) => {
        dispatch(ProgressView.SHOW);
        setState(state => ({...state, disabled: true}));
        if (enable) {
            setupReceivingNotifications(firebase)
                .then(token => {
                    userData.private[fetchDeviceId()].notification = token;
                    return userData.savePrivate();
                })
                .then(() => notifySnackbar(t("User.Subscribed")))
                .catch(notifySnackbar)
                .finally(() => {
                    dispatch(ProgressView.HIDE);
                    setState(state => ({...state, disabled: false}));
                });
        } else {
            userData.private[fetchDeviceId()].notification = null;
            userData.savePrivate()
                .then(() => firebase.messaging().deleteToken())
                .catch(error => {
                    if (error.code === "messaging/unsupported-browser" && hasWrapperControlInterface()) {
                        return wrapperControlCall({
                            method: "unsubscribeNotifications",
                            timeout: 30000
                        })
                            .then(result => {
                                console.log("UNSUBSCRIBE RESULT " + JSON.stringify(result));
                            })
                    } else return error;
                })
                .then(() => notifySnackbar(t("User.Unsubscribed")))
                .catch(notifySnackbar)
                .finally(() => {
                    dispatch(ProgressView.HIDE);
                    setState(state => ({...state, disabled: false}));
                });
            notifySnackbar({title: "Unsubscribed"});
        }
    };

    const isAdmin = matchRole([Role.ADMIN], currentUserData);
    // const isEditAllowed = !disabled && (isSameUser(userData, currentUserData) && matchRole([Role.ADMIN, Role.USER], currentUserData));
    const isSameUser = (userData, currentUserData) => userData && currentUserData && userData.id === currentUserData.id;
    const isDeleteAllowed = isAdmin || (allowDelete && isSameUser(userData, currentUserData));
    const isNotificationsAvailable = !iOS && firebase.messaging && isSameUser(userData, currentUserData) && notifications && matchRole([Role.ADMIN, Role.USER], currentUserData);
    const fields = [...publicFields, ...(isAdmin ? adminFieldsGiven : [])];

    React.useEffect(() => {
        let isMounted = true;
        dispatch(ProgressView.SHOW);
        let userData;
        if (!id || id === ":id") {
            userData = currentUserData;
        } else {
            userData = cacheDatas.put(id, UserData(firebase).create(id));
        }
        userData.fetch([UserData.PUBLIC, UserData.ROLE])
            .then(() => isSameUser(userData, currentUserData) && userData.fetchPrivate(fetchDeviceId()))
            .then(() => isMounted && setState(state => ({
                ...state,
                userData,
                ...userData.public,
                role: userData.role
            })))
            .catch(error => {
                notifySnackbar(error);
                history.goBack();
            })
            .finally(() => dispatch(ProgressView.HIDE))
        return () => {
            uploadComponentClean(uppy);
            isMounted = false;
        }
    }, [id])

    if (!userData) return <LoadingComponent/>
    if (userData.id !== currentUserData.id && !matchRole([Role.ADMIN], currentUserData)) {
        return <Redirect to={pages.editprofile.route}/>
    }

    return <Grid className={classes.center} container>
        <Box m={0.5}/>
        <Grid container className={classes.profile} spacing={1}>
            <Grid item className={classes.profileFieldImage}>
                {image
                    ? <img src={image} alt={t("User.User photo")} className={classes.profileImage}/>
                    : <EmptyAvatar className={classes.profileImage}/>}
                {image && <Hidden smDown>
                    <IconButton
                        aria-label={t("Common.Clear")}
                        children={<ClearIcon/>}
                        className={classes.clearImage}
                        onClick={() => {
                            setState(state => ({...state, image: "", uppy: null}));
                        }}
                        title={t("Common.Clear")}
                    />
                </Hidden>}
                <Grid container justify={"center"}>
                    {uploadable && <React.Suspense fallback={<LoadingComponent/>}>
                        <UploadComponent
                            button={<Button
                                aria-label={t("User.Set image")}
                                children={windowData.isNarrow() ? t("User.Set image") : t("Common.Change")}
                                color={"secondary"}
                                fullWidth={!windowData.isNarrow()}
                                title={t("User.Set image")}
                                variant={"contained"}
                            />}
                            camera={false}
                            color={"primary"}
                            firebase={firebase}
                            limits={{width: 300, height: 300}}
                            onsuccess={handleUploadPhotoSuccess}
                            onerror={handleUploadPhotoError}
                            variant={"contained"}
                        />
                    </React.Suspense>}
                    {image && <Hidden mdUp>
                        <Button
                            aria-label={t("Common.Clear")}
                            children={t("Common.Clear")}
                            color={"secondary"}
                            onClick={() => {
                                setState(state => ({...state, image: "", uppy: null}));
                            }}
                            title={t("Common.Clear")}
                            variant={"contained"}
                        />
                    </Hidden>}
                </Grid>
            </Grid>
            <Grid item className={classes.profileFields} xs>
                <Grid container spacing={1} alignItems={"flex-end"}>
                    <Grid item>
                        <MailIcon/>
                    </Grid>
                    <Grid item xs>
                        <TextField
                            color={"secondary"}
                            disabled
                            fullWidth
                            label={t("User.E-mail")}
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
                        <Grid container spacing={1} wrap={"nowrap"} alignItems={"flex-end"}>
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
                                        label: t(field.label),
                                        onChange: ev => {
                                            ev.persist();
                                            setState(state => ({
                                                ...state,
                                                [field.id]: ev.target.value || ""
                                            }));
                                        },
                                        required: field.required,
                                        value: state[field.id] || ""
                                    })
                                    : <editComponent.type
                                        {...editComponent.props}
                                        color={"secondary"}
                                        disabled={disabled}
                                        error={missedRequired || uniqueRequired}
                                        fullWidth
                                        label={t(field.label)}
                                        onChange={ev => {
                                            ev.persist();
                                            setState(state => ({
                                                ...state,
                                                [field.id]: ev.target.value || ""
                                            }));
                                        }}
                                        required={field.required}
                                        value={state[field.id] || ""}
                                    />}
                                {missedRequired || uniqueRequired
                                    ? <FormHelperText error>{missedRequired
                                        ? t("Common.Please enter value")
                                        : (uniqueRequired
                                            ? t("User.This name is already taken")
                                            : null)}</FormHelperText>
                                    : null}
                            </Grid>
                        </Grid>
                    </React.Fragment>
                })}
                {isNotificationsAvailable && <>
                    <Box m={1}/>
                    <Grid container><FormControlLabel
                        control={
                            <Switch
                                disabled={disabled}
                                checked={Boolean(userData.private[fetchDeviceId()] && userData.private[fetchDeviceId()].notification)}
                                onChange={handleNotifications}
                            />
                        }
                        label={t("User.Get notifications")}
                    /></Grid>
                </>}
                <Box m={2}/>
                {isFirstLogin && <ButtonGroup
                    color={"secondary"}
                    disabled={disabled}
                    fullWidth
                    size={"large"}
                    variant={"contained"}
                >
                    <Button
                        children={t("User.Register")}
                        onClick={saveUser}
                    />
                </ButtonGroup>}
                {!isFirstLogin && <ButtonGroup
                    color={"secondary"}
                    disabled={disabled}
                    fullWidth
                    size={"large"}
                    variant={"contained"}
                >
                    <Button
                        children={t("Common.Save")}
                        onClick={saveUser}
                    />
                    <Button
                        children={t("Common.Cancel")}
                        onClick={() => history.goBack()}
                    />
                </ButtonGroup>}
                {isDeleteAllowed && <>
                    <Box m={8}/>
                    <Grid container justify={"center"}>
                        <Button
                            children={t("User.Delete account")}
                            onClick={handleClickDelete}
                            style={{color: "#ff0000"}}
                            variant={"text"}
                        />
                    </Grid>
                </>}
            </Grid>
        </Grid>
        {isDeleteAllowed && deleteOpen && <ConfirmComponent
            confirmLabel={t("Common.Delete")}
            critical
            onCancel={() => setState(state => ({...state, deleteOpen: false}))}
            onConfirm={deleteUser}
            title={t("User.Delete user data?")}
        >
            {t("User.Account and all data will be deleted and can not be restored.")}
            <br/>
            {t("Common.WARNING! This action will be proceeded immediately!")}
        </ConfirmComponent>}
    </Grid>
}

export default withStyles(stylesCurrent)(withStyles(styles)(EditProfile));
