import React from "react";
import TextField from "@material-ui/core/TextField";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import Switch from "@material-ui/core/Switch";
import InfoIcon from "@material-ui/icons/Info";
import DynamicLinksIcon from "@material-ui/icons/Link";
import SupportIcon from "@material-ui/icons/Person";
import BlockedNamesIcon from "@material-ui/icons/PersonAddDisabled";
import MaintenanceIcon from "@material-ui/icons/Settings";
import {useCurrentUserData, UserData} from "../../controllers/UserData";
import ProgressView from "../../components/ProgressView";
import {useDispatch} from "react-redux";
import withStyles from "@material-ui/styles/withStyles";
import notifySnackbar from "../../controllers/notifySnackbar";
import {useFirebase, useTechnicalInfo} from "../../controllers/General";
import LoadingComponent from "../../components/LoadingComponent";
import ConfirmComponent from "../../components/ConfirmComponent";
import {styles} from "../../controllers/Theme";
import MentionsInputComponent from "../../components/MentionsInputComponent/MentionsInputComponent";
import {mentionUsers} from "../../controllers/mentionTypes";
import Pagination from "../../controllers/FirebasePagination";
import {tokenizeText} from "../../components";
import {useHistory, useParams} from "react-router-dom";
import {updateActivity} from "./Activity";

const Service = ({classes}) => {
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();

    const currentUserData = useCurrentUserData();
    const {maintenance: maintenanceGiven} = useTechnicalInfo();
    const [state, setState] = React.useState({
        error: null,
        disabled: false,
        message: "Sorry, site is under technical maintenance now. Please come back later.",
    });
    const {disabled, maintenanceOpen, message, maintenance, support, blockedNames, dynamicLinksUrlPrefix} = state;
    const {timestamp: givenTimestamp, person: givenPerson} = maintenanceGiven || {};

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
            .catch(notifySnackbar)
            .finally(finallyCallback)
    }

    const handleChangeMessage = evt => {
        setState({...state, message: evt.target.value});
    }

    const handleSave = evt => {
        const updates = {};
        const prepareSaving = async () => {
            dispatch(ProgressView.SHOW);
            setState(state => ({...state, disabled: true}));
        }
        const parseSupport = async () => {
            const token = tokenizeText(support)[0];
            if (token && token.type === "user") {
                return token;
            }
            throw Error("Support is incorrect")
        }
        const addSupport = async token => {
            if (token.type === "user") {
                updates.support = token.id;
                return;
            }
            throw Error(`Incorrect token: ${JSON.stringify(token)}`);
        }
        const addBlockedNames = async () => {
            updates.blockedNames = blockedNames;
        }
        const addDynamicLinksUrlPrefix = async () => {
            updates.dynamicLinksUrlPrefix = dynamicLinksUrlPrefix;
        }
        const publish = async () => {
            return firebase.database().ref().child("meta").update(updates);
        }
        const updateServiceActivity = async () => {
            return updateActivity({firebase, uid: currentUserData.id, type})
        }
        const notifyAboutSaved = async () => {
            notifySnackbar("Saved");
        }
        const finalizeSaving = async () => {
            dispatch(ProgressView.HIDE);
            setState(state => ({...state, disabled: false}));
        }

        prepareSaving()
            .then(parseSupport)
            .then(addSupport)
            .then(addBlockedNames)
            .then(addDynamicLinksUrlPrefix)
            .then(publish)
            .then(notifyAboutSaved)
            .catch(notifySnackbar)
            .finally(finalizeSaving);
    }

    React.useEffect(() => {
        const maintenanceRef = firebase.database().ref("meta/maintenance");
        maintenanceRef.once("value", snapshot => {
            const meta = snapshot.val();
            setState(state => ({
                ...state,
                maintenance: Boolean(meta),
                ...meta
            }));
        })
    }, [])

    React.useEffect(() => {
        const supportRef = firebase.database().ref("meta/support");
        supportRef.once("value", snapshot => {
            const supportId = snapshot.val();
            if (supportId) {
                UserData(firebase).fetch(supportId)
                    .then(userData => {
                        setState(state => ({...state, support: `$[user:${supportId}:${userData.name}]`}));
                    })
                    .catch(error => {
                        notifySnackbar(error);
                        setState(state => ({...state, support: ""}))
                    });
            } else {
                setState(state => ({...state, support: ""}));
            }
        })
    }, [])

    React.useEffect(() => {
        const ref = firebase.database().ref("meta");
        ref.once("value", snapshot => {
            const val = snapshot.val();
            const {blockedNames = "", dynamicLinksUrlPrefix = ""} = val;
            setState(state => ({...state, blockedNames, dynamicLinksUrlPrefix}));
        })
    }, [])

    if (maintenance === undefined) return <LoadingComponent/>;
    return <Grid container className={classes.center}>
        {givenTimestamp && <>
            <Grid container spacing={1} alignItems={"center"}>
                <Grid item>
                    <InfoIcon/>
                </Grid>
                <Grid item xs>
                    Maintenance set up by {givenPerson.name} at {new Date(givenTimestamp).toLocaleString()}.
                </Grid>
            </Grid>
            <Box m={1}/>
        </>}
        <Grid container spacing={1} alignItems={"center"}>
            <Grid item>
                <MaintenanceIcon/>
            </Grid>
            <Grid item>
                <FormControlLabel
                    color={"secondary"}
                    control={<Switch
                        onChange={handleSwitchMaintenance}
                        checked={maintenance}
                    />}
                    disabled={disabled}
                    label={"Maintenance"}
                />
            </Grid>
        </Grid>
        <Box m={1}/>
        <Grid container alignItems={"flex-end"} spacing={1}>
            <Grid item>
                <SupportIcon/>
            </Grid>
            <Grid item xs>
                <MentionsInputComponent
                    color={"secondary"}
                    disabled={support === undefined}
                    mentionsParams={[{
                        ...mentionUsers,
                        trigger: "",
                        displayTransform: (id, display) => display,
                        pagination: () => new Pagination({
                            ref: firebase.database().ref("roles"),
                            value: true,
                            equals: "admin",
                            size: 1000,
                            transform: item => UserData(firebase)
                                .fetch(item.key, [UserData.PUBLIC, UserData.ROLE])
                                .then(value => ({key: item.key, value}))
                                .catch(notifySnackbar)
                        }),
                    }]}
                    onApply={(value) => console.log(value)}
                    onChange={(ev, a, b, tokens) => {
                        // console.log(ev.target.value, a, b, c)
                        tokens = tokens || [];
                        let text = ev.target.value;
                        if (tokens.length) {
                            const token = tokens[tokens.length - 1];
                            text = token ? `$[user:${token.id}:${token.display}]` : "";
                        }
                        setState(state => ({...state, support: text}));
                    }}
                    label={"Support person"}
                    value={support || ""}
                />
            </Grid>
        </Grid>
        <Box m={1}/>
        <Grid container alignItems={"flex-end"} spacing={1}>
            <Grid item>
                <BlockedNamesIcon/>
            </Grid>
            <Grid item xs>
                <TextField
                    color={"secondary"}
                    disabled={blockedNames === undefined}
                    fullWidth
                    label={"Blocked names"}
                    multiline
                    onChange={ev => setState(state => ({...state, blockedNames: ev.target.value}))}
                    rows={5}
                    value={blockedNames || ""}
                />
            </Grid>
        </Grid>
        <Box m={1}/>
        <Grid container alignItems={"flex-end"} spacing={1}>
            <Grid item>
                <DynamicLinksIcon/>
            </Grid>
            <Grid item xs>
                <TextField
                    color={"secondary"}
                    disabled={dynamicLinksUrlPrefix === undefined}
                    fullWidth
                    label={"Dynamic links URL prefix"}
                    onChange={ev => setState(state => ({...state, dynamicLinksUrlPrefix: ev.target.value}))}
                    value={dynamicLinksUrlPrefix || ""}
                />
            </Grid>
        </Grid>
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

export default withStyles(styles)(Service);
