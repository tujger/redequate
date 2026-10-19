import PostIcon from "@mui/icons-material/ChatBubbleOutlined";
import UploadsIcon from "@mui/icons-material/CloudUpload";
import AllIcon from "@mui/icons-material/ExpandMore";
import DynamicLinksIcon from "@mui/icons-material/Link";
import JoinUsIcon from "@mui/icons-material/PanTool";
import SupportIcon from "@mui/icons-material/Person";
import BlockedNamesIcon from "@mui/icons-material/PersonAddDisabled";
import MaintenanceIcon from "@mui/icons-material/Settings";
import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {useHistory} from "react-router-dom";
import ConfirmComponent from "../../components/ConfirmComponent";
import LoadingComponent from "../../components/LoadingComponent";
import MentionedSelectComponent from "../../components/MentionedSelectComponent";
import {tokenizeText} from "../../components/MentionedTextComponent";
import ProgressView from "../../components/ProgressView";
import {useDatabase, useRedirectToLogin} from "../../controllers";
import {useMetaInfo, useWindowData} from "../../controllers/General";
import {mentionUsers} from "../../controllers/mentionTypes";
import notifySnackbar from "../../controllers/notifySnackbar";
import {useCurrentUserDataValue} from "../../controllers/useCurrentUserData";
import {UserData} from "../../controllers/UserData";
import Button from "../../controls/Button/Button";
import Select from "../../controls/Select/Select";
import Switch from "../../controls/Switch/Switch";
import Tabs from "../../controls/Tabs/Tabs";
import TextField from "../../controls/TextField/TextField";
import baseStyles from "../../themes/Base.module.css";
import {updateActivity} from "./audit/auditReducer";
import styles from "./styles/Settings.module.css";

export default ({uploadable}) => {
    const currentUserData = useCurrentUserDataValue();
    const database = useDatabase();
    const dispatch = useDispatch();
    const history = useHistory();
    const {maintenance: maintenanceGiven} = useMetaInfo();
    const shouldRedirectToLogin = useRedirectToLogin();
    const [state, setState] = React.useState({
        error: null,
        details: {},
        disabled: true,
        message: "Sorry, site is under technical maintenance now. Please come back later.",
        tab: 0,
    });
    const {t} = useTranslation();
    const windowData = useWindowData();

    const isNarrow = windowData.isNarrow();

    const {
        disabled,
        blockedNames,
        dynamicLinksUrlPrefix,
        geoapifyApiKey,
        joinUsCancel,
        joinUsConfirm,
        joinUsScroll,
        joinUsText,
        joinUsTimeout,
        joinUsTitle,
        loaded,
        maintenanceOpen,
        message,
        maintenance,
        oneTapCliendId,
        postsAllowEdit,
        postsRotateReplies,
        support,
        details,
        tab,
        translateLimit,
        uploadsAllow,
        uploadsTypes = [],
        uploadsMaxHeight,
        uploadsMaxSize,
        uploadsMaxWidth,
        uploadsQuality
    } = state;
    const {timestamp: givenTimestamp, person: givenPerson} = maintenanceGiven || {};

    const parseUploadables = () => {
        let value = uploadable || [];
        if (value === true) value = ["images/*"];
        return value;
    }

    const uploadableTypes = parseUploadables();

    const finallyCallback = () => {
        dispatch(ProgressView.HIDE);
        setState(state => ({...state, disabled: false}));
    };

    const handleSwitchMaintenance = (evt, value) => {
        if (value) {
            setState(state => ({...state, maintenanceOpen: true}));
        } else {
            switchMaintenance(value)
        }
    }

    const switchMaintenance = (value) => {
        const updates = new Map();
        dispatch(ProgressView.SHOW);
        setState(state => ({...state, disabled: true, maintenanceOpen: false}));
        if (value) {
            updates.set(["meta", "maintenance"], {
                message: message || "",
                timestamp: database.TIMESTAMP,
                person: {name: currentUserData.public.name, email: currentUserData.public.email}
            })
        } else {
            updates.set(["meta", "maintenance"], null);
        }
        database.update(updates)
            .then(() => database.read("meta"))
            .then(() => setState(state => ({...state, maintenance: value, disabled: false})))
            .then(() => notifySnackbar(`Maintenance is ${value ? "on" : "off"}.`))
            .then(() => updateActivity({
                database,
                uid: currentUserData.id,
                type: "Maintenance",
                details: {
                    message: message || null,
                    state: value ? "on" : "off",
                }
            }))
            .catch(notifySnackbar)
            .finally(finallyCallback)
    }

    const handleChangeMessage = evt => {
        setState({...state, message: evt.target.value});
    }

    const handleChange = type => (ev, value) => {
        setState(state => ({
            ...state,
            [type]: ev.target.value,
            details: {
                ...state.details,
                [type]: ev.target.value
            }
        }))
    }

    const handleSwitch = type => (ev, value) => {
        setState(state => ({
            ...state,
            [type]: value,
            details: {
                ...state.details,
                [type]: value
            }
        }))
    }

    const handleChangeTab = tab => {
        setState(state => ({...state, tab}));
    };

    const handleSave = evt => {
        const updates = new Map();
        const settings = {}
        const prepareSaving = async () => {
            dispatch(ProgressView.SHOW);
            setState(state => ({...state, disabled: true}));
        }
        const parseSupport = async () => {
            const token = tokenizeText(support)[0];
            if (token && token.type === "user") {
                return token;
            }
            throw Error("Support person is incorrect")
        }
        const addSupport = async token => {
            if (token.type === "user") {
                updates.set(["meta", "support"], token.id || null);
                return;
            }
            throw Error(`Incorrect token: ${JSON.stringify(token)}`);
        }
        const addBlockedNames = async () => {
            updates.set(["meta", "blockedNames"], blockedNames || null);
        }
        const addPreferenceDynamicLinksUrlPrefix = async () => {
            settings.dynamicLinksUrlPrefix = dynamicLinksUrlPrefix || null;
        }
        const addPreferenceTranslateLimit = async () => {
            settings.translateLimit = +translateLimit || null;
        }
        const addPreferenceGeoapifyApiKey = async () => {
            settings.geoapifyApiKey = geoapifyApiKey || null;
        }
        const addPreferenceJoinUs = async () => {
            settings.joinUsCancel = joinUsCancel || null;
            settings.joinUsConfirm = joinUsConfirm || null;
            settings.joinUsScroll = +joinUsScroll || null;
            settings.joinUsText = joinUsText || null;
            settings.joinUsTimeout = +joinUsTimeout || null;
            settings.joinUsTitle = joinUsTitle || null;
            settings.oneTapCliendId = oneTapCliendId || null;
        }
        const addPreferencePosts = async () => {
            settings.postsRotateReplies = postsRotateReplies || null;
            settings.postsAllowEdit = postsAllowEdit || null;
        }
        const addPreferenceUploads = async () => {
            settings.uploadsAllow = uploadsAllow || null;
            settings.uploadsTypes = [];
            if (settings.uploadsAudio) settings.uploadsTypes.push("audio/*");
            if (settings.uploadsImages) settings.uploadsTypes.push("images/*");
            if (settings.uploadsVideo) settings.uploadsTypes.push("video/*");
            if (!settings.uploadsTypes.length) settings.uploadsTypes = null;
            settings.uploadsMaxHeight = uploadsAllow ? +uploadsMaxHeight || 1000 : null;
            settings.uploadsMaxSize = uploadsAllow ? +uploadsMaxSize || 100 : null;
            settings.uploadsMaxWidth = uploadsAllow ? +uploadsMaxWidth || 1000 : null;
            settings.uploadsQuality = uploadsAllow ? +uploadsQuality || 75 : null;
        }
        const publish = async () => {
            updates.set(["meta", "settings"], settings);
            console.log(updates);
            return database.update(updates);
        }
        const updateServiceActivity = async () => {
            if (Object.keys(details).length > 0) {
                updateActivity({
                    database,
                    uid: currentUserData.id,
                    type: "Settings updated",
                    details
                });
            }
        }
        const notifyAboutSaved = async () => {
            notifySnackbar("Saved");
        }
        const finalizeSaving = async () => {
            dispatch(ProgressView.HIDE);
            setState(state => ({...state, disabled: false, details: {}}));
        }

        prepareSaving()
            .then(addBlockedNames)
            .then(parseSupport)
            .then(addSupport)
            .then(addPreferenceDynamicLinksUrlPrefix)
            .then(addPreferenceTranslateLimit)
            .then(addPreferenceGeoapifyApiKey)
            .then(addPreferenceJoinUs)
            .then(addPreferencePosts)
            .then(addPreferenceUploads)
            .then(publish)
            .then(notifyAboutSaved)
            .then(updateServiceActivity)
            .catch(notifySnackbar)
            .finally(finalizeSaving);
    }

    const tabItems = [
        {icon: <MaintenanceIcon/>, label: "Maintenance", value: 0},
        {icon: <SupportIcon/>, label: "Personality", value: 1},
        {icon: <BlockedNamesIcon/>, label: "User profiles", value: 2},
        {icon: <DynamicLinksIcon/>, label: "Convenience", value: 3},
        {icon: <JoinUsIcon/>, label: "Welcome popup", value: 4},
        {icon: <PostIcon/>, label: "Posts", value: 5},
        ...(uploadable ? [{icon: <UploadsIcon/>, label: "Uploads", value: 6}] : []),
        {icon: <AllIcon/>, label: "All options", value: -1},
    ];
    React.useEffect(() => {
        if (shouldRedirectToLogin) return;
        const prepareFetching = async () => {
            dispatch(ProgressView.SHOW);
            setState(state => ({...state, disabled: true}));
            return {};
        }
        const fetchBlockedNames = async props => {
            const blockedNames = (await database.read(["meta", "blockedNames"])) || "";
            return {...props, blockedNames};
        }
        const fetchMaintenance = async props => {
            const meta = await database.read(["meta", "maintenance"]);
            return {...props, maintenance: Boolean(meta), ...(meta || {})};
        }
        const fetchSettings = async props => {
            const settings = (await database.read(["meta", "settings"])) || {};
            return {...props, ...settings};
        }
        const fetchSupport = async props => {
            const supportId = await database.read(["meta", "support"]);
            if (supportId) {
                return new UserData(database).fetch(supportId)
                    .then(userData => ({
                        ...props,
                        support: `$[user:${supportId}:${userData.name}]`
                    }))
                    .catch(error => {
                        notifySnackbar(error);
                        return {...props, support: ""}
                    });
            } else {
                return {...props, support: ""}
            }
        }
        const updateState = async props => {
            setState(state => ({...state, ...props}));
        }
        const finalizeFetching = async () => {
            dispatch(ProgressView.HIDE);
            setState(state => ({...state, disabled: false, loaded: true}));
        }

        prepareFetching()
            .then(fetchBlockedNames)
            .then(fetchMaintenance)
            .then(fetchSettings)
            .then(fetchSupport)
            .then(updateState)
            .catch(notifySnackbar)
            .finally(finalizeFetching);
    }, [shouldRedirectToLogin])

    if (shouldRedirectToLogin || loaded === undefined) return <LoadingComponent/>;
    const selectedTab = tabItems.find(item => item.value === tab);
    return <div className={baseStyles.content}>
        <Tabs
            className={styles.root}
            items={tabItems}
            onChange={handleChangeTab}
            value={tab}
        />
        <div
            aria-label={selectedTab ? selectedTab.label : "Settings"}
            className={styles.options}
            id={"settings-panel"}
            role={"tabpanel"}
        >
            {(tab === 0 || tab === -1) && <>
                {isNarrow && <h2 className={styles.sectionHeading}>Maintenance</h2>}
                {givenTimestamp && <div className={styles.maintenanceInfo}>
                    Maintenance set up by {givenPerson.name} at {new Date(givenTimestamp).toLocaleString()}.
                </div>}
                <Option
                    checked={maintenance}
                    disabled={disabled}
                    onChange={handleSwitchMaintenance}
                    label={maintenance ? "Maintenance in on" : "Maintenance is off"}
                />
            </>}
            {(tab === 1 || tab === -1) && <>
                {isNarrow && <h2 className={styles.sectionHeading}>Personality</h2>}
                <div className={styles.option}>
                    <MentionedSelectComponent
                        id={"select"}
                        label={"Support person"}
                        mention={{
                            ...mentionUsers,
                            trigger: "",
                            cursor: () => database.cursor(["roles"], {
                                equalTo: "admin"
                            }),
                            transform: item => new UserData(database)
                                .fetch(item.key)
                                .then(item => {
                                    return {id: item.id, display: item.name};
                                })
                                .catch(notifySnackbar),
                        }}
                        onChange={(evt, value) => {
                            handleChange("support")({target: {value}})
                        }}
                        value={support || ""}
                    />
                </div>
            </>}
            {(tab === 2 || tab === -1) && <>
                {isNarrow && <h2 className={styles.sectionHeading}>User profiles</h2>}
                <Option
                    disabled={disabled}
                    label={"Blocked names"}
                    multiline
                    onChange={handleChange("blockedNames")}
                    rows={5}
                    value={blockedNames || ""}/>
            </>}
            {(tab === 3 || tab === -1) && <>
                {isNarrow && <h2 className={styles.sectionHeading}>Convenience</h2>}
                <Option
                    disabled={disabled}
                    label={t("Settings.Dynamic links URL prefix")}
                    onChange={handleChange("dynamicLinksUrlPrefix")}
                    value={dynamicLinksUrlPrefix || ""}/>
                <Option
                    disabled={disabled}
                    label={t("Settings.Allow translate up to, chars/month")}
                    onChange={handleChange("translateLimit")}
                    type={"number"}
                    value={translateLimit || ""}/>
                <Option
                    disabled={disabled}
                    label={t("Settings.Geoapify API key")}
                    onChange={handleChange("geoapifyApiKey")}
                    value={geoapifyApiKey || ""}/>
            </>}
            {(tab === 4 || tab === -1) && <>
                {isNarrow && <h2 className={styles.sectionHeading}>Welcome popup</h2>}
                <Option
                    disabled={disabled}
                    label={"Title"}
                    onChange={handleChange("joinUsTitle")}
                    value={joinUsTitle || ""}/>
                <Option
                    disabled={disabled}
                    label={"Message"}
                    multiline
                    onChange={handleChange("joinUsText")}
                    value={joinUsText || ""}/>
                <Option
                    disabled={disabled}
                    label={"Cancel button label"}
                    onChange={handleChange("joinUsCancel")}
                    value={joinUsCancel || ""}/>
                <Option
                    disabled={disabled}
                    label={"Confirm button label"}
                    onChange={handleChange("joinUsConfirm")}
                    placeholder={"Join us"}
                    value={joinUsConfirm || ""}/>
                <Option
                    disabled={disabled}
                    label={"Popup on timeout, s"}
                    onChange={handleChange("joinUsTimeout")}
                    type={"number"}
                    value={joinUsTimeout | ""}/>
                <Option
                    disabled={disabled}
                    label={"Popup on scroll, px"}
                    onChange={handleChange("joinUsScroll")}
                    type={"number"}
                    value={joinUsScroll || ""}/>
                <Option
                    disabled={disabled}
                    label={"One Tap client id"}
                    onChange={handleChange("oneTapCliendId")}
                    placeholder={"One Tap client id"}
                    value={oneTapCliendId || ""}/>
                <div className={styles.helperText}>
                    <a
                        href={"https://developers.google.com/identity/one-tap"}
                        rel={"noopener noreferrer"}
                        target={"_blank"}
                    >Learn more</a>
                </div>
            </>}
            {(tab === 5 || tab === -1) && <>
                {isNarrow && <h2 className={styles.sectionHeading}>Posts</h2>}
                <Option
                    checked={postsAllowEdit || false}
                    disabled={disabled}
                    label={"Allow edit"}
                    onChange={handleSwitch("postsAllowEdit")}/>
                <div className={styles.selectField}>
                    <span className={styles.selectLabel}>Rotate replies</span>
                    <Select
                        className={styles.select}
                        color={"secondary"}
                        disabled={disabled}
                        displayEmpty={true}
                        inputProps={{"aria-label": "Rotate replies"}}
                        onChange={handleChange("postsRotateReplies")}
                        options={[
                            {label: "None", value: ""},
                            {label: "Inside post", value: "inside"},
                            {label: "Outside of post", value: "outside"},
                        ]}
                        value={postsRotateReplies || ""}
                    />
                </div>
            </>}
            {uploadable && (tab === 6 || tab === -1) && <>
                {isNarrow && <h2 className={styles.sectionHeading}>Uploads</h2>}
                <Option
                    checked={uploadsAllow || false}
                    disabled={disabled}
                    label={"Allow uploads"}
                    onChange={handleSwitch("uploadsAllow")}/>
                {uploadsAllow && <div className={styles.uploadTypes}>
                    <div className={styles.spacer}/>
                    <div className={styles.uploadTypeOptions}>
                        {uploadableTypes.includes("audio/*") && <Option
                            checked={uploadsTypes.includes("audio/*")}
                            disabled={disabled}
                            label={"Allow audio/*"}
                            onChange={handleSwitch("uploadsAudio")}/>}
                        {uploadableTypes.includes("images/*") && <Option
                            checked={uploadsTypes.includes("images/*")}
                            disabled={disabled}
                            onChange={handleSwitch("uploadsImages")}
                            label={"Allow images/*"}/>}
                        {uploadableTypes.includes("video/*") && <Option
                            checked={uploadsTypes.includes("video/*")}
                            disabled={disabled}
                            label={"Allow video/*"}
                            onChange={handleSwitch("uploadsVideo")}/>}
                    </div>
                </div>}
                <Option
                    disabled={disabled}
                    label={"Max width, px"}
                    onChange={handleChange("uploadsMaxWidth")}
                    type={"number"}
                    value={uploadsMaxWidth | 1000}/>
                <Option
                    disabled={disabled}
                    label={"Max height, px"}
                    onChange={handleChange("uploadsMaxHeight")}
                    type={"number"}
                    value={uploadsMaxHeight || 1000}/>
                <Option
                    disabled={disabled}
                    label={"Quality for JPEG and PNG, %"}
                    onChange={handleChange("uploadsQuality")}
                    type={"number"}
                    value={uploadsQuality || 75}/>
                <Option
                    disabled={disabled}
                    label={"Limit size, kb"}
                    onChange={handleChange("uploadsMaxSize")}
                    type={"number"}
                    value={uploadsMaxSize || 100}/>
            </>}
        </div>
        <div className={styles.actions}>
            <Button
                children={"Save"}
                disabled={disabled}
                fullWidth
                onClick={handleSave}
            />
            <Button
                children={"Cancel"}
                disabled={disabled}
                fullWidth
                onClick={() => history.goBack()}
            />
        </div>
        {maintenanceOpen && <ConfirmComponent
            confirmLabel={"Confirm"}
            critical
            onCancel={() => setState(state => ({...state, maintenanceOpen: false}))}
            onConfirm={() => switchMaintenance(true)}
            title={"Turn on maintenance?"}
        >
            The service will be temporarily disabled for all users except administrators.
            <br/>
            WARNING! This action will be proceeded immediately!
            <div className={styles.modalSpacer}/>
            <label className={styles.textareaField}>
                <span>Message for visitors</span>
                <textarea
                    className={styles.textarea}
                    onChange={handleChangeMessage}
                    rows={3}
                    value={message}
                />
            </label>
        </ConfirmComponent>}
    </div>
};

const Option = ({checked, disabled, label, multiline, onChange, rows, value, ...rest}) => {
    if (value !== undefined && multiline) {
        return <label className={styles.textareaField}>
            <span>{label}</span>
            <textarea
                {...rest}
                className={styles.textarea}
                disabled={disabled}
                onChange={onChange}
                rows={rows || 4}
                value={value}
            />
        </label>;
    }

    if (value !== undefined) {
        return <div className={styles.option}>
            <TextField
                {...rest}
                color={"secondary"}
                disabled={disabled}
                fullWidth
                label={label}
                onChange={onChange}
                value={value}
            />
        </div>;
    }

    return <label className={[styles.switchOption, disabled && styles.disabled].filter(Boolean).join(" ")}>
        <Switch
            checked={checked}
            disabled={disabled}
            onChange={onChange}
        />
        <span>{label}</span>
    </label>;
};
