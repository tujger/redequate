import ClearIcon from "@mui/icons-material/Clear";
import TagIcon from "@mui/icons-material/Label";
import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {useHistory, useParams} from "react-router-dom";
import {useStorage} from "../../packages/storage";
import ConfirmComponent from "../components/ConfirmComponent";
import LoadingComponent from "../components/LoadingComponent";
import MentionedSelectComponent from "../components/MentionedSelectComponent";
import MentionedTextComponent, {tokenizeText} from "../components/MentionedTextComponent";
import MentionsInputComponent from "../components/MentionsInputComponent/MentionsInputComponent";
import {mutualRequest} from "../components/MutualComponent";
import ProgressView from "../components/ProgressView";
import UploadComponent from "../components/UploadComponent/UploadComponent";
import {uploadComponentClean, uploadComponentPublish} from "../components/UploadComponent/uploadComponentControls";
import Pagination from "../controllers/FirebasePagination";
import {cacheDatas, useFirebase, usePages, useWindowData} from "../controllers/General";
import {mentionTags, mentionUsers} from "../controllers/mentionTypes";
import notifySnackbar from "../controllers/notifySnackbar";
import {matchRole, normalizeSortName, Role, useCurrentUserData, UserData} from "../controllers/UserData";
import Button from "../controls/Button/Button";
import Switch from "../controls/Switch/Switch";
import TextField from "../controls/TextField/TextField";
import {updateActivity} from "../pages/admin/audit/auditReducer";
import baseStyles from "../themes/Base.module.css";
import styles from "./styles/EditTag.module.css";

export default ({allowOwner = true}) => {
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const windowData = useWindowData();
    const [state, setState] = React.useState({});
    const {
        tag,
        disabled,
        hideTagOpen,
        image,
        uppy,
        showTagOpen,
        deleteTagOpen,
        changeOwnerOpen,
        newId,
        owner = ""
    } = state;
    const {id} = useParams();
    const {t} = useTranslation();
    const storage = useStorage();

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
        let ownerChanged = null;
        const preparePublishing = async () => {
            dispatch(ProgressView.SHOW);
            setState(state => ({...state, disabled: true, changeOwnerOpen: false}));
        }
        const updateTagKey = async () => {
            tag._key = id || newId;
        }
        const checkIfLabelNotEmpty = async () => {
            tag.label = (tag.label || "").trim();
            if (!tag.label) {
                throw Error(t("Tag.Can not save tag, label isn't defined."));
            }
        }
        const checkIfIdValid = async () => {
            const updatedId = tag.id || normalizeSortName(tag.label);
            const existing = await new Pagination({
                ref: "tag",
                child: "id",
                equals: updatedId,
            }).next();
            const other = existing.filter(item => item.key !== tag._key);
            if (other.length) {
                console.error(`[EditTag] already exists '${updatedId}' from '${tag.label}' for '${tag._key}', found: ${JSON.stringify(other)}`);
                const existingTag = other[0];
                if (existingTag.value.uid) {
                    throw Error(t("Tag.{{label}} already exists, please modify.", {label: tag.label}));
                }
                tag._key = existingTag.key;
            }
            return updatedId;
        }
        const checkIfLabelValid = async updatedId => {
            const existing = await new Pagination({
                ref: "tag",
                child: "label",
                equals: tag.label,
            }).next();
            console.log(existing);
            const labels = existing.filter(item => item.key !== tag._key);
            if (labels.length) {
                console.error(`[EditTag] not available '${tag.label}' for '${updatedId}/${tag._key}, found: ${JSON.stringify(labels)}`);
                throw Error(t("Tag.{{label}} is not available, please modify.", {label: tag.label}));
            }
            tag.id = updatedId;
        }
        const publishImageIfChanged = async () => {
            let publishing = {};
            if (uppy) {
                console.log("[EditTag] publish image", uppy)
                publishing = await uploadComponentPublish({
                    auth: ".main",
                    files: uppy._uris,
                    name: tag.label,
                    onprogress: progress => {
                        dispatch({...ProgressView.SHOW, value: progress});
                    },
                    deleteFile: tag.image,
                    storage
                });
                uploadComponentClean(uppy);
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
                ownerChanged = tag.uid;
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
                tag._sort_name = normalizeSortName(tag.label);
            } else {
                tag._sort_name = null;
            }
        }
        const extractTagKey = async () => {
            const key = tag._key;
            delete tag._key;
            return key;
        }
        const publishTag = async key => {
            await firebase.database().ref("tag").child(key).set(tag);
            return key;
        }
        const auditActivity = async key => {
            if (ownerChanged !== null) {
                updateActivity({
                    uid: currentUserData.id,
                    type: "Tag owner changed",
                    details: {
                        id: tag.id,
                        uid: {
                            new: tag.uid,
                            old: ownerChanged,
                        }
                    }
                });
            }
            return key;
        }
        const removeCachedTag = async key => {
            cacheDatas.remove(key);
            return key;
        }
        const subscribeToTag = async key => {
            if (isNew) {
                return mutualRequest({
                    firebase,
                    currentUserData,
                    mutualId: key,
                    mutualType: "tag",
                    typeId: "watching"
                });
            }
        }
        const onPublishSuccess = async () => {
            if (tag.hidden) {
                history.push(pages.home.route);
            } else {
                history.replace(pages.tag.route + tag.id)
            }
        }
        const finalizePublishing = async () => {
            dispatch(ProgressView.HIDE);
            setState(state => ({...state, disabled: false}));
        }

        preparePublishing()
            .then(updateTagKey)
            .then(checkIfLabelNotEmpty)
            .then(checkIfIdValid)
            .then(checkIfLabelValid)
            .then(publishImageIfChanged)
            .then(updateTimestamp)
            .then(updateUid)
            .then(updateSortName)
            .then(extractTagKey)
            .then(publishTag)
            .then(auditActivity)
            .then(removeCachedTag)
            .then(subscribeToTag)
            .then(onPublishSuccess)
            .catch(notifySnackbar)
            .finally(finalizePublishing)
        console.log("[EditTag] save", tag)
    }

    const toggleTag = (event, value) => {
        if (value && !tag.hidden) {
            setState(state => ({...state, hideTagOpen: true}));
        } else if (!value && tag.hidden) {
            setState(state => ({...state, showTagOpen: true}));
        }
    }

    const handleCancelAction = () => {
        setState(state => ({
            ...state,
            hideTagOpen: false,
            showTagOpen: false,
            deleteTagOpen: false,
            changeOwnerOpen: false
        }));
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
                    title: t("Tag.{{label}} has been hidden.", {label: tag.label}),
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
                    title: t("Tag.{{label}} is visible now.", {label: tag.label}),
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
        const prepareDeleting = async () => {
            dispatch(ProgressView.SHOW);
            setState(state => ({...state, disabled: true, deleteTagOpen: false}));
        }
        const createUpdates = async () => {
            const updates = {};
            updates[`tag/${id}`] = null;
            return updates;
        }
        const publishUpdates = async updates => {
            console.log(updates);
            return firebase.database().ref().update(updates);
        }
        const onComplete = async () => {
            // history.goBack();
            history.replace(pages.home.route);
        }
        const finalizeDeleting = async () => {
            setState(state => ({...state, disabled: false}));
            dispatch(ProgressView.HIDE);
        }

        prepareDeleting()
            .then(createUpdates)
            .then(publishUpdates)
            .then(onComplete)
            .catch(notifySnackbar)
            .finally(finalizeDeleting);
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
                    throw Error(t("Tag.{{id}} is not found.", {id: id}));
                })
                .then(tag => {
                    if (isCurrentUserAdmin) {
                        return tag;
                    } else if (allowOwner && tag.uid === currentUserData.id) {
                        return tag;
                    }
                    throw Error(t("Tag.You can not manage {{label}}", {label: tag.label}));
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
        UserData().fetch(tag.uid)
            .then(userData => {
                setState(state => ({...state, owner: `$[user:${tag.uid}:${userData.name}]`}));
            })
            .catch(notifySnackbar);
    }, [tag])

    if (!tag) return <LoadingComponent/>;
    return <div className={baseStyles.content}>
        <div className={styles.profile}>
            <div className={styles.profileFieldImage}>
                {image
                    ? <img src={image} alt={""} className={styles.profileImage}/>
                    : <TagIcon className={styles.profileImage}/>}
                {image && <Button
                    className={styles.clearImageDesktop}
                    color={"inherit"}
                    icon={<ClearIcon/>}
                    onClick={() => {
                        setState({...state, image: "", uppy: null});
                    }}
                    title={t("Common.Clear")}
                />}
                <div className={styles.imageActions}>
                    <React.Suspense fallback={<LoadingComponent/>}>
                        <UploadComponent
                            button={<Button
                                children={windowData.isNarrow() ? t("Tag.Set image") : t("Common.Change")}
                                fullWidth={!windowData.isNarrow()}
                                title={t("Tag.Set image")}
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
                    {image && <div className={styles.clearImageMobile}>
                        <Button
                            children={t("Common.Clear")}
                            onClick={() => {
                                setState({...state, image: "", uppy: null});
                            }}
                            title={t("Common.Clear")}
                        />
                    </div>}
                </div>
            </div>
            <div className={styles.profileFields}>
                <div className={styles.profileField}>
                    <TextField
                        disabled={disabled}
                        required
                        fullWidth
                        label={t("Tag.Name")}
                        onChange={ev => {
                            tag.label = ev.target.value;
                            setState({...state, tag, random: Math.random()});
                        }}
                        value={tag.label || ""}
                    />
                </div>
                <div className={styles.spacer}/>
                <div className={styles.profileField}>
                    <MentionsInputComponent
                        className={styles.description}
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
                        label={t("Tag.Description")}
                        value={tag.description}
                        focused={true}/>
                </div>
                <div className={styles.spacer}/>
                {!uppy && isCurrentUserAdmin && <>
                    <div className={styles.profileField}>
                        <TextField
                            disabled={disabled}
                            fullWidth
                            label={t("Tag.Image URL")}
                            onChange={ev => {
                                const image = ev.target.value;
                                setState({...state, image, random: Math.random()});
                            }}
                            value={image || ""}
                        />
                    </div>
                    <div className={styles.profileField}>
                        {!disabled && <div className={styles.imageSearch}>
                            <a
                                href={`https://www.google.com/search?q=${tag.label} &source=lnms&tbm=isch&sa=X`}
                                rel={"noopener noreferrer"}
                                target={"_blank"}>{t("Tag.Search for the image on Google")}</a>
                        </div>}
                    </div>
                    <div className={styles.spacer}/>
                </>}
                {!isNew && <>
                    <div className={styles.profileField}>
                        <MentionedSelectComponent
                            className={styles.ownerField}
                            combobox
                            disabled={disabled}
                            label={t("Tag.Change owner")}
                            mention={{
                                ...mentionUsers,
                                trigger: "",
                                displayTransform: (id, display) => display
                            }}
                            onChange={(ev, owner) => setState(state => ({...state, owner}))}
                            value={owner}
                        />
                    </div>
                    <div className={styles.spacer}/>
                </>}
                {!isNew && <>
                    <div className={styles.profileField}>
                        <label className={styles.deactivate}>
                            <Switch
                                checked={tag.hidden || false}
                                disabled={disabled}
                                onChange={toggleTag}
                            />
                            <span>{t("Tag.Deactivate")}</span>
                        </label>
                    </div>
                    <div className={styles.spacer}/>
                </>}
                <div className={styles.actions}>
                    <Button
                        children={t("Common.Save")}
                        disabled={disabled}
                        fullWidth
                        onClick={handleBeforeSaveTag}
                    />
                    <Button
                        children={t("Common.Cancel")}
                        disabled={disabled}
                        fullWidth
                        onClick={() => history.goBack()}
                    />
                </div>
                {!isNew && <>
                    <div className={styles.deleteAction}>
                        <Button
                            children={t("Tag.Permanently remove")}
                            color={"alert"}
                            onClick={handleClickDelete}
                            variant={"text"}
                        />
                    </div>
                </>}
            </div>
            {hideTagOpen && <ConfirmComponent
                confirmLabel={t("Tag.Hide")}
                critical
                onCancel={handleCancelAction}
                onConfirm={hideTag}
                title={t("Tag.Hide {{label}}?", {label: tag.label})}
            >
                {t("Tag.{{label}} will be hidden, unavailable for view, not presented in suggestions. All related posts will be available.", {label: tag.label})}
                <br/>
                {t("Common.WARNING! This action will be proceeded immediately!")}
            </ConfirmComponent>}
            {showTagOpen && <ConfirmComponent
                confirmLabel={t("Tag.Show")}
                critical
                onCancel={handleCancelAction}
                onConfirm={showTag}
                title={t("Tag.Show {{label}}?", {label: tag.label})}
            >
                {t("Tag.The hidden {{label}} will be restored to show.", {label: tag.label})}
                <br/>
                {t("Common.WARNING! This action will be proceeded immediately!")}
            </ConfirmComponent>}
            {deleteTagOpen && <ConfirmComponent
                confirmLabel={t("Common.Delete")}
                critical
                onCancel={handleCancelAction}
                onConfirm={deleteTag}
                title={t("Tag.Delete {{label}}?", {label: tag.label})}
            >
                {t("Tag.{{label}} will be deleted and can not be restored.", {label: tag.label})}
                <br/>
                {t("Common.WARNING! This action will be proceeded immediately!")}
            </ConfirmComponent>}
            {changeOwnerOpen && <ConfirmComponent
                confirmLabel={t("Common.Continue")}
                critical
                onCancel={handleCancelAction}
                onConfirm={saveTag}
                title={t("Tag.Change owner?")}
            >
                <MentionedTextComponent
                    mentions={[{...mentionUsers, displayTransform: (id, display) => display}]}
                    text={(owner
                            ? t("Tag.You are going to change owner to {{person}}.", {owner: owner})
                            : t("Tag.You are going to remove owner."))
                        + (isCurrentUserAdmin ? "" : "\n" + t("Tag.WARNING! You will not be able to manage {{label}} anymore!", {label: tag.label}))
                    }
                />
            </ConfirmComponent>}
        </div>
    </div>
};
