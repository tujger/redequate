import React, {useState} from "react";
import TextField from "@material-ui/core/TextField";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import InfoIcon from "@material-ui/icons/Info";
import MaintenanceIcon from "@material-ui/icons/Settings";
import {useHistory} from "react-router-dom";
import {useCurrentUserData} from "../../controllers/UserData";
import ProgressView from "../../components/ProgressView";
import {useDispatch} from "react-redux";
import withStyles from "@material-ui/styles/withStyles";
import {notifySnackbar, useFirebase, useStore, useTechnicalInfo} from "../../controllers";
import LoadingComponent from "../../components/LoadingComponent";
import ConfirmComponent from "../../components/ConfirmComponent";

const styles = theme => ({});

const Service = (props) => {
    const dispatch = useDispatch();
    const store = useStore();
    const firebase = useFirebase();
    const history = useHistory();
    const currentUserData = useCurrentUserData();
    const {maintenance: maintenanceGiven} = useTechnicalInfo();
    const [state, setState] = useState({
        error: null,
        disabled: false,
        message: "Sorry, site is under technical maintenance now. Please come back later."
    });
    const {disabled, maintenanceOpen, message, maintenance} = state;
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

    if (maintenance === undefined) return <LoadingComponent/>;
    return <React.Fragment>
        <Grid container spacing={1} alignItems={"center"}>
            <Grid item>
                <InfoIcon/>
            </Grid>
            <Grid item xs>
                Technical information
            </Grid>
        </Grid>
        <Box m={1}/>
        {givenTimestamp && <React.Fragment><Grid container spacing={1} alignItems={"center"}>
            <Grid item>
                <InfoIcon/>
            </Grid>
            <Grid item xs>
                Maintenance set up by {givenPerson.name} at {new Date(givenTimestamp).toLocaleString()}.
            </Grid>
        </Grid>
            <Box m={1}/></React.Fragment>}
        <Grid container spacing={1} alignItems="center">
            <Grid item>
                <MaintenanceIcon/>
            </Grid>
            <Grid item xs>
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
    </React.Fragment>
};

export default withStyles(styles)(Service);

