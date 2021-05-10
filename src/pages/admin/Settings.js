import React from "react";
import TextField from "@material-ui/core/TextField";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import InputLabel from "@material-ui/core/InputLabel";
import Typography from "@material-ui/core/Typography";
import FormControl from "@material-ui/core/FormControl";
import Switch from "@material-ui/core/Switch";
import FormHelperText from "@material-ui/core/FormHelperText";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import DynamicLinksIcon from "@material-ui/icons/Link";
import UploadsIcon from "@material-ui/icons/CloudUpload";
import SupportIcon from "@material-ui/icons/Person";
import BlockedNamesIcon from "@material-ui/icons/PersonAddDisabled";
import MaintenanceIcon from "@material-ui/icons/Settings";
import JoinUsIcon from "@material-ui/icons/PanTool";
import PostIcon from "@material-ui/icons/ChatBubbleOutline";
import AllIcon from "@material-ui/icons/ExpandMore";
import {useDispatch} from "react-redux";
import withStyles from "@material-ui/styles/withStyles";
import {useHistory} from "react-router-dom";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import {useCurrentUserData, UserData} from "../../controllers/UserData";
import ProgressView from "../../components/ProgressView";
import notifySnackbar from "../../controllers/notifySnackbar";
import {useFirebase, useMetaInfo, useWindowData} from "../../controllers/General";
import LoadingComponent from "../../components/LoadingComponent";
import ConfirmComponent from "../../components/ConfirmComponent";
import {styles} from "../../controllers/Theme";
import {mentionUsers} from "../../controllers/mentionTypes";
import Pagination from "../../controllers/FirebasePagination";
import MentionedSelectComponent from "../../components/MentionedSelectComponent";
import {updateActivity} from "./audit/auditReducer";
import {tokenizeText} from "../../components/MentionedTextComponent";

const stylesCurrent = theme => ({
    _content: {
        flexDirection: "column",
        padding: theme.spacing(1),
    },
    _root: {
        // display: "flex",
    },
    _tabs: {}
});

const Settings = ({classes, uploadable}) => {
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const windowData = useWindowData();
    const {maintenance: maintenanceGiven} = useMetaInfo();
    const [state, setState] = React.useState({
        error: null,
        details: {},
        disabled: true,
        message: "Sorry, site is under technical maintenance now. Please come back later.",
        tab: 0,
    });
    const {
        disabled,
        blockedNames,
        dynamicLinksUrlPrefix,
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
        const updates = {};
        dispatch(ProgressView.SHOW);
        setState(state => ({...state, disabled: true, maintenanceOpen: false}));
        if (value) {
            updates["meta/maintenance"] = {
                message: message || "",
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                person: {name: currentUserData.public.name, email: currentUserData.public.email}
            }
        } else {
            updates["meta/maintenance"] = null;
        }
        firebase.database().ref().update(updates)
            .then(() => firebase.database().ref("meta").once("value", snapshot => snapshot.val()))
            .then(() => setState(state => ({...state, maintenance: value, disabled: false})))
            .then(() => notifySnackbar(`Maintenance is ${value ? "on" : "off"}.`))
            .then(() => updateActivity({
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

    const handleChangeTab = (event, tab) => {
        setState(state => ({...state, tab}));
    };

    const handleSave = evt => {
        const updates = {};
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
                updates.support = token.id || null;
                return;
            }
            throw Error(`Incorrect token: ${JSON.stringify(token)}`);
        }
        const addBlockedNames = async () => {
            updates.blockedNames = blockedNames || null;
        }
        const addPreferenceDynamicLinksUrlPrefix = async () => {
            settings.dynamicLinksUrlPrefix = dynamicLinksUrlPrefix || null;
        }
        const addPreferenceTranslateLimit = async () => {
            settings.translateLimit = +translateLimit || null;
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
            if (uploadsAudio) settings.uploadsTypes.push("audio/*");
            if (uploadsImages) settings.uploadsTypes.push("images/*");
            if (uploadsVideo) settings.uploadsTypes.push("video/*");
            if (!settings.uploadsTypes.length) settings.uploadsTypes = null;
            settings.uploadsMaxHeight = uploadsAllow ? +uploadsMaxHeight || 1000 : null;
            settings.uploadsMaxSize = uploadsAllow ? +uploadsMaxSize || 100 : null;
            settings.uploadsMaxWidth = uploadsAllow ? +uploadsMaxWidth || 1000 : null;
            settings.uploadsQuality = uploadsAllow ? +uploadsQuality || 75 : null;
        }
        const publish = async () => {
            updates.settings = settings;
            console.log(updates)
            return firebase.database().ref().child("meta").update(updates);
        }
        const updateServiceActivity = async () => {
            if (Object.keys(details).length > 0) {
                updateActivity({
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
            .then(addPreferenceJoinUs)
            .then(addPreferencePosts)
            .then(addPreferenceUploads)
            .then(publish)
            .then(notifyAboutSaved)
            .then(updateServiceActivity)
            .catch(notifySnackbar)
            .finally(finalizeSaving);
    }

    const tabProps = (icon, label, value) => {
        return {
            icon: windowData.isNarrow() ? icon : undefined,
            label: windowData.isNarrow() ? undefined : label,
            value: value,
        }
    }

    React.useEffect(() => {
        const prepareFetching = async () => {
            dispatch(ProgressView.SHOW);
            setState(state => ({...state, disabled: true}));
            return {};
        }
        const fetchBlockedNames = async props => {
            const ref = firebase.database().ref("meta/blockedNames");
            const snapshot = await ref.once("value");
            const blockedNames = snapshot.val() || "";
            return {...props, blockedNames};
        }
        const fetchMaintenance = async props => {
            const ref = firebase.database().ref("meta/maintenance");
            const snapshot = await ref.once("value");
            const meta = snapshot.val();
            return {...props, maintenance: Boolean(meta), ...(meta || {})};
        }
        const fetchSettings = async props => {
            const ref = firebase.database().ref("meta/settings");
            const snapshot = await ref.once("value");
            const settings = snapshot.val() || {};
            return {...props, ...settings};
        }
        const fetchSupport = async props => {
            const ref = firebase.database().ref("meta/support");
            const snapshot = await ref.once("value");
            const supportId = snapshot.val();
            if (supportId) {
                return UserData(firebase).fetch(supportId)
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
            console.log(props)
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
    }, [])

    if (loaded === undefined) return <LoadingComponent/>;
    return <Grid container className={[classes.center].join(" ")}>
        <div className={classes._root}>
            <Tabs
                aria-label={"Settings"}
                className={classes._tabs}
                onChange={handleChangeTab}
                scrollButtons={"auto"}
                value={tab}
                variant={"scrollable"}
            >
                <Tab {...tabProps(<MaintenanceIcon/>, "Maintenance", 0)}/>
                <Tab {...tabProps(<SupportIcon/>, "Personality", 1)}/>
                <Tab {...tabProps(<BlockedNamesIcon/>, "User profiles", 2)}/>
                <Tab {...tabProps(<DynamicLinksIcon/>, "Convenience", 3)}/>
                <Tab {...tabProps(<JoinUsIcon/>, "Welcome popup", 4)}/>
                <Tab {...tabProps(<PostIcon/>, "Posts", 5)}/>
                {uploadable && <Tab {...tabProps(<UploadsIcon/>, "Uploads", 6)}/>}
                <Tab {...tabProps(<AllIcon/>, "All options", -1)}/>
            </Tabs>
            <Grid container className={classes._content}>
                {(tab === 0 || tab === -1) && <>
                    {windowData.isNarrow() && <Grid container>
                        <Typography variant={"button"}>Maintenance</Typography>
                    </Grid>}
                    <Box m={1}/>
                    {givenTimestamp && <>
                        <Grid container>
                            Maintenance set up
                            by {givenPerson.name} at {new Date(givenTimestamp).toLocaleString()}.
                        </Grid>
                        <Box m={1}/>
                    </>}
                    <Option
                        checked={maintenance}
                        disabled={disabled}
                        onChange={handleSwitchMaintenance}
                        label={maintenance ? "Maintenance in on" : "Maintenance is off"}
                    />
                    <Box m={1}/>
                </>}
                {(tab === 1 || tab === -1) && <>
                    {windowData.isNarrow() && <Grid container>
                        <Typography variant={"button"}>Personality</Typography>
                    </Grid>}
                    <Box m={1}/>
                    <Grid container>
                        <MentionedSelectComponent
                            id={"select"}
                            label={"Support person"}
                            mention={{
                                ...mentionUsers,
                                trigger: "",
                                displayTransform: (id, display) => display,
                                pagination: () => new Pagination({
                                    ref: firebase.database().ref("roles"),
                                    value: true,
                                    equals: "admin",
                                    size: 1000,
                                    transform: item => UserData(firebase)
                                        .fetch(item.key)
                                        .then(value => ({key: item.key, value}))
                                        .catch(notifySnackbar)
                                })
                            }}
                            onChange={(evt, value) => {
                                handleChange("support")({target: {value}})
                            }}
                            value={support || ""}
                        />
                    </Grid>
                    <Box m={1}/>
                </>}
                {(tab === 2 || tab === -1) && <>
                    {windowData.isNarrow() && <Grid container>
                        <Typography variant={"button"}>User profiles</Typography>
                    </Grid>}
                    <Box m={1}/>
                    <Option
                        disabled={disabled}
                        label={"Blocked names"}
                        multiline
                        onChange={handleChange("blockedNames")}
                        rows={5}
                        value={blockedNames || ""}/>
                    <Box m={1}/>
                </>}
                {(tab === 3 || tab === -1) && <>
                    {windowData.isNarrow() && <Grid container>
                        <Typography variant={"button"}>Convenience</Typography>
                    </Grid>}
                    <Box m={1}/>
                    <Option
                        disabled={disabled}
                        label={"Dynamic links URL prefix"}
                        onChange={handleChange("dynamicLinksUrlPrefix")}
                        value={dynamicLinksUrlPrefix || ""}/>
                    <Option
                        disabled={disabled}
                        label={"Allow translate up to, chars/month"}
                        onChange={handleChange("translateLimit")}
                        type={"number"}
                        value={translateLimit || ""}/>
                    <Box m={1}/>
                </>}
                {(tab === 4 || tab === -1) && <>
                    {windowData.isNarrow() && <Grid container>
                        <Typography variant={"button"}>Welcome popup</Typography>
                    </Grid>}
                    <Box m={1}/>
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
                        multiline
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
                    <Box m={1}/>
                    <Option
                        disabled={disabled}
                        label={"One Tap client id"}
                        onChange={handleChange("oneTapCliendId")}
                        placeholder={"One Tap client id"}
                        value={oneTapCliendId || ""}/>
                    <FormHelperText>
                        <a href={"https://developers.google.com/identity/one-tap"}
                           target={"_blank"}>Learn more</a>
                    </FormHelperText>
                    <Box m={1}/>
                </>}
                {(tab === 5 || tab === -1) && <>
                    {windowData.isNarrow() && <Grid container>
                        <Typography variant={"button"}>Posts</Typography>
                    </Grid>}
                    <Box m={1}/>
                    <Option
                        checked={postsAllowEdit || false}
                        disabled={disabled}
                        label={"Allow edit"}
                        onChange={handleSwitch("postsAllowEdit")}/>
                    <Grid container>
                        <FormControl fullWidth>
                            <InputLabel>Rotate replies</InputLabel>
                            <Select
                                color={"secondary"}
                                onChange={handleChange("postsRotateReplies")}
                                value={postsRotateReplies || ""}
                                displayEmpty={true}
                            >
                                <MenuItem value={""}>None</MenuItem>
                                <MenuItem value={"inside"}>Inside post</MenuItem>
                                <MenuItem value={"outside"}>Outside of post</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Box m={1}/>
                </>}
                {uploadable && (tab === 6 || tab === -1) && <>
                    {windowData.isNarrow() && <Grid container>
                        <Typography variant={"button"}>Uploads</Typography>
                    </Grid>}
                    <Box m={1}/>
                    <Option
                        checked={uploadsAllow || false}
                        disabled={disabled}
                        label={"Allow uploads"}
                        onChange={handleSwitch("uploadsAllow")}/>
                    {uploadsAllow && <Grid container>
                        <Grid item><Box m={1}/></Grid>
                        <Grid item>
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
                        </Grid>
                    </Grid>}
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
                    <Box m={1}/>
                </>}
            </Grid>
        </div>
        <Box m={1}/>
        <ButtonGroup
            color={"secondary"}
            disabled={disabled}
            fullWidth
            size={"large"}
            variant={"contained"}
        >
            <Button children={"Save"} onClick={handleSave}/>
            <Button children={"Cancel"} onClick={() => history.goBack()}/>
        </ButtonGroup>
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
            <Box m={5}/>
            <TextField
                color={"secondary"}
                fullWidth
                label={"Message for visitors"}
                multiline
                rows={3}
                onChange={handleChangeMessage}
                value={message}
            />
        </ConfirmComponent>}
    </Grid>
};

export default withStyles(stylesCurrent)(withStyles(styles)(Settings));

const Option = ({checked, disabled, label, onChange, value, ...rest}) => {

    if (value !== undefined) {
        return <Grid container>
            <TextField
                {...rest}
                color={"secondary"}
                disabled={disabled}
                fullWidth
                label={label}
                onChange={onChange}
                value={value}
            />
        </Grid>
    }

    return <Grid container>
        <FormControlLabel
            color={"secondary"}
            control={<Switch
                onChange={onChange}
                checked={checked}
            />}
            disabled={disabled}
            label={label}
        />
    </Grid>
}
