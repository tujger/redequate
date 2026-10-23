import ClearIcon from "@mui/icons-material/Clear";
import MailIcon from "@mui/icons-material/Mail";
import EmptyAvatar from "@mui/icons-material/Person";
import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {Redirect, useHistory, useParams} from "react-router-dom";
import ConfirmComponent from "../components/ConfirmComponent";
import LoadingComponent from "../components/LoadingComponent";
import ProgressView from "../components/ProgressView";
import UploadComponent from "../components/UploadComponent/UploadComponent";
import {uploadComponentClean, uploadComponentPublish} from "../components/UploadComponent/uploadComponentControls";
import {useAuth, useDatabase, useMessaging, useRedirectToLogin, useStorage} from "../controllers";
import {cacheDatas, fetchDeviceId, usePages, useStore, useWindowData} from "../controllers/General";
import {setupReceivingNotifications} from "../controllers/Notifications";
import notifySnackbar from "../controllers/notifySnackbar";
import {refreshAll} from "../controllers/Store";
import useCurrentUserData from "../controllers/useCurrentUserData";
import UserData, {logoutUser, matchRole, normalizeSortName, UserRole} from "../controllers/UserData";
import {hasWrapperControlInterface, wrapperControlCall} from "../controllers/WrapperControl";
import Button from "../controls/Button/Button";
import Switch from "../controls/Switch/Switch";
import TextField from "../controls/TextField/TextField";
import baseStyles from "../themes/Base.module.css";
import {updateActivity} from "./admin/audit/auditReducer";
import {adminFields, publicFields as publicFieldsDefault} from "./Profile";
import styles from "./styles/EditProfile.module.css";

const iOS = typeof window !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSameUser = (userData, currentUserData) => userData && currentUserData && userData.id === currentUserData.id;

function EditProfile(props) {
    const {
        adminFields: adminFieldsGiven = adminFields,
        allowDelete = true,
        notifications = true,
        publicFields = publicFieldsDefault,
        uploadable = true,
    } = props;
    const auth = useAuth();
    const [currentUserData, setCurrentUserData] = useCurrentUserData();
    const database = useDatabase();
    const dispatch = useDispatch();
    const history = useHistory();
    const messaging = useMessaging();
    const pages = usePages();
    const {id} = useParams();
    const shouldRedirectToLogin = useRedirectToLogin();
    const [state, setState] = React.useState({
        disabled: false,
    });
    const storage = useStorage();
    const store = useStore();
    const {t} = useTranslation();
    const windowData = useWindowData();

    const {state: givenState = {}} = history.location;
    const {tosuccessroute, isFirstLogin} = givenState;

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
            const blockedNames = (await database.read(["meta", {blockedNames: "blockedNames"}]) || "").split(/[\s\r\n]+/)
                .map(item => normalizeSortName(item));
            if (blockedNames.indexOf(normalizeSortName(state.name)) >= 0) {
                throw Error("This user user name is reserved for distilleries. If you are a distillery, please contact us using Contacts page.")
            }
        }
        const checkForUniqueFields = async () => {
            const uniqueError = [];
            for (const field of publicFields) {
                if (field.unique) {
                    const values = await database.cursor(["users_public", "user_id"], {
                        equalTo: (state[field.id] || "").trim(),
                        orderBy: ["name"]
                    }).next(10);
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
            const exists = await database.read(["users_public", {user_id: userData.id}, {email: "email"}]);
            if (!exists) {
                await logoutUser({auth, onLogout: () => setCurrentUserData(null)});
                refreshAll(store);
                history.replace(pages.home.route);
                throw Error(t("User.Profile is not found, forcing log out"));
            }
        }
        const deleteImageIfObsolete = async () => {
            if (userData.image && image !== userData.image) {
                console.log("[EditProfile] delete", userData.image)
                try {
                    await storage.delete(userData.image);
                } catch (e) {
                    console.error(e);
                }
            }
        }
        const publishImage = async () => {
            if (uppy) {
                const publishing = await uploadComponentPublish({
                    auth,
                    files: uppy._uris,
                    name: "profile",
                    onprogress: progress => {
                        dispatch({...ProgressView.SHOW, value: progress});
                    },
                    deleteFile: userData.public.image,
                    storage
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
        const updateFieldsInAuth = async () => {
            if (isSameUser(userData, currentUserData)) {
                auth.updateProfile({
                    public: {name: userData.name, image: userData.image}
                }).catch(console.error)
            }
        }
        const saveByAdmin = async () => {
            if (isAdmin) {
                const updates = new Map();
                if (role === UserRole.USER_NOT_VERIFIED) {
                    updates.set(["users_public", {user_id: userData.id}, "emailVerified"], false);
                } else if (role === UserRole.USER || role === UserRole.ADMIN) {
                    updates.set(["users_public", {user_id: userData.id}, "emailVerified"], true);
                }
                updates.set(["users_public", {user_id: userData.id}, "updated"], database.TIMESTAMP);
                await userData.updateRole(
                    (role === UserRole.USER || role === UserRole.USER_NOT_VERIFIED) ? null : role, updates);
                if (role !== userData.role) {
                    updateActivity({
                        database,
                        uid: currentUserData.id,
                        type: "User role change",
                        details: {
                            role: role || null,
                            previousRole: userData.role || null,
                            uid: userData.id,
                        },
                    }).catch(console.error);
                }
            }
        }
        const refreshUserData = async () => {
            await userData.fetch([UserData.ROLE, UserData.PUBLIC, UserData.FORCE]);
        }
        const updateCurrentUserData = async () => {
            if (currentUserData.id === userData.id) {
                setCurrentUserData(userData);
            }
        }
        const onSaveComplete = async () => {
            setState(state => ({...state, disabled: false, uppy: null}))
            refreshAll(store);
            isMount = false;
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
            isMount && setState(state => ({...state, disabled: false}));
        }

        let isMount = true;
        prepareSaving()
            .then(checkForRequiredFields)
            .then(checkIfNameIsBlocked)
            .then(checkForUniqueFields)
            .then(checkIfProfileExists)
            .then(deleteImageIfObsolete)
            .then(publishImage)
            .then(processPublicFields)
            .then(userData.savePublic)
            .then(updateFieldsInAuth)
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
                await logoutUser({auth, onLogout: () => setCurrentUserData(null)});
                history.replace(pages.home.route);
            } else {
                history.goBack();
            }
            isMount = false;
        }
        const publishActivity = async () => {
            updateActivity({
                database,
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
            setupReceivingNotifications(messaging)
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
                .then(() => messaging.unsubscribe())
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

    const isAdmin = matchRole([UserRole.ADMIN], currentUserData);
    const isDeleteAllowed = isAdmin || (allowDelete && isSameUser(userData, currentUserData));
    const isNotificationsAvailable = !iOS && isSameUser(userData, currentUserData) && notifications && matchRole([UserRole.ADMIN, UserRole.USER], currentUserData);
    const fields = [...publicFields, ...(isAdmin ? adminFieldsGiven : [])];

    React.useEffect(() => {
        if (shouldRedirectToLogin) return;
        let isMounted = true;
        dispatch(ProgressView.SHOW);
        let userData;
        if (!id || id === ":id") {
            userData = new UserData(database).fromJSON(currentUserData.toJSON());
        } else {
            userData = cacheDatas.put(id, new UserData(database).create(id));
        }
        userData.fetch([UserData.PUBLIC, UserData.ROLE])
            .then(() => isMounted && isSameUser(userData, currentUserData) && userData.fetchPrivate(fetchDeviceId()))
            .then(() => isMounted && setState(state => ({
                ...state,
                userData,
                ...userData.public,
                role: userData.role
            })))
            .catch(error => {
                if (!isMounted) return;
                notifySnackbar(error);
                history.goBack();
            })
            .finally(() => isMounted && dispatch(ProgressView.HIDE))
        return () => {
            isMounted = false;
            dispatch(ProgressView.HIDE);
        }
    }, [id, currentUserData, database, dispatch, history, shouldRedirectToLogin])

    React.useEffect(() => () => {
        uploadComponentClean(uppy);
    }, [uppy]);

    if (shouldRedirectToLogin || !userData) return <LoadingComponent/>
    if (userData.id !== currentUserData.id && !matchRole([UserRole.ADMIN], currentUserData)) {
        return <Redirect to={pages.editprofile.route}/>
    }

    return <div className={baseStyles.content}>
        <div className={styles.profile}>
            <div className={styles.profileFieldImage}>
                {image
                    ? <img src={image} alt={t("User.User photo")} className={styles.profileImage}/>
                    : <EmptyAvatar className={styles.profileImage}/>}
                {image && <Button
                    className={[styles.clearImage, styles.desktopOnly].join(" ")}
                    color={"inherit"}
                    icon={<ClearIcon/>}
                    onClick={() => {
                        setState(state => ({...state, image: "", uppy: null}));
                    }}
                    title={t("Common.Clear")}
                />}
                <div className={styles.photoActions}>
                    {uploadable && <React.Suspense fallback={<LoadingComponent/>}>
                        <UploadComponent
                            button={<Button
                                children={windowData.isNarrow() ? t("User.Set image") : t("Common.Change")}
                                fullWidth={!windowData.isNarrow()}
                                title={t("User.Set image")}
                            />}
                            camera={false}
                            color={"primary"}
                            limits={{width: 300, height: 300}}
                            onsuccess={handleUploadPhotoSuccess}
                            onerror={handleUploadPhotoError}
                            variant={"contained"}
                        />
                    </React.Suspense>}
                    {image && <Button
                        className={styles.mobileOnly}
                        onClick={() => {
                            setState(state => ({...state, image: "", uppy: null}));
                        }}
                        title={t("Common.Clear")}
                    >
                        {t("Common.Clear")}
                    </Button>}
                </div>
            </div>
            <div className={styles.profileFields}>
                <div className={styles.fieldRow}>
                    <div className={styles.fieldIcon}>
                        <MailIcon/>
                    </div>
                    <div className={styles.fieldControl}>
                        <TextField
                            disabled
                            fullWidth
                            label={t("User.E-mail")}
                            value={userData.email || ""}
                        />
                    </div>
                </div>
                {userData.public && fields && fields.map(field => {
                    if (field.editComponent === null) return null;
                    const editComponent = field.editComponent || <TextField/>;
                    const missedRequired = requiredError.indexOf(field.id) >= 0;
                    const uniqueRequired = uniqueError.indexOf(field.id) >= 0;
                    const handleChange = ev => {
                        const value = ev.target.value || "";
                        setState(state => ({...state, [field.id]: value}));
                    };
                    return <React.Fragment key={field.id}>
                        <div className={styles.fieldSpacer}/>
                        <div className={styles.fieldRow}>
                            <div className={styles.fieldIcon}>
                                {field.icon}
                            </div>
                            <div className={styles.fieldControl}>
                                {editComponent instanceof Function
                                    ? editComponent({
                                        ...editComponent.props,
                                        color: "secondary",
                                        disabled,
                                        error: missedRequired || uniqueRequired,
                                        fullWidth: true,
                                        label: t(field.label),
                                        onChange: handleChange,
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
                                        onChange={handleChange}
                                        required={field.required}
                                        value={state[field.id] || ""}
                                    />}
                                {(missedRequired || uniqueRequired) &&
                                    <span className={styles.helperError}>{missedRequired
                                        ? t("Common.Please enter value")
                                        : (uniqueRequired
                                            ? t("User.This name is already taken")
                                            : null)}</span>}
                            </div>
                        </div>
                    </React.Fragment>
                })}
                {isNotificationsAvailable && <>
                    <div className={styles.fieldSpacer}/>
                    <label className={styles.notifications}>
                        <Switch
                            disabled={disabled}
                            checked={Boolean(userData.private[fetchDeviceId()] && userData.private[fetchDeviceId()].notification)}
                            onChange={handleNotifications}
                        />
                        <span>{t("User.Get notifications")}</span>
                    </label>
                </>}
                <div className={styles.largeSpacer}/>
                {isFirstLogin && <div className={styles.actionGroup}>
                    <Button
                        disabled={disabled}
                        fullWidth
                        onClick={saveUser}
                    >
                        {t("User.Register")}
                    </Button>
                </div>}
                {!isFirstLogin && <div className={styles.actionGroup}>
                    <Button
                        disabled={disabled}
                        fullWidth
                        onClick={saveUser}
                    >
                        {t("Common.Save")}
                    </Button>
                    <Button
                        disabled={disabled}
                        fullWidth
                        onClick={() => history.goBack()}
                    >
                        {t("Common.Cancel")}
                    </Button>
                </div>}
                {isDeleteAllowed && <>
                    <Button
                        className={styles.deleteAction}
                        onClick={handleClickDelete}
                        color={"alert"}
                        variant={"text"}
                    >
                        {t("User.Delete account")}
                    </Button>
                </>}
            </div>
        </div>
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
    </div>;
}

export default EditProfile;
