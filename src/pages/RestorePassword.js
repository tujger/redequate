import React from "react";
import {useCurrentUserData} from "../controllers/UserData";
import {Redirect, useHistory} from "react-router-dom";
import ProgressView from "../components/ProgressView";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import TextField from "@material-ui/core/TextField";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import UserIcon from "@material-ui/icons/Mail";
import {useDispatch} from "react-redux";
import {notifySnackbar, useFirebase, usePages} from "../controllers";

const RestorePassword = (props) => {
    const [state, setState] = React.useState({
        email: "",
        requesting: false
    });
    const {email, requesting} = state;
    const pages = usePages();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const currentUserData = useCurrentUserData();

    const requestRestorePassword = () => {
        dispatch(ProgressView.SHOW);
        setState({...state, requesting: true});
        firebase.auth().sendPasswordResetEmail(email).then(() => {
            notifySnackbar("Instructions have been sent to e-mail.");
            history.push(pages.login.route);
        }).catch(error => {
            notifySnackbar(error);
        }).finally(() => {
            dispatch(ProgressView.HIDE);
            setState({...state, requesting: false});
        });
    };

    if (currentUserData && currentUserData.id) {
        return <Redirect to={pages.profile.route}/>
    }

    return <Grid container>
        <Box m={0.5}/>
        <Grid container spacing={1} alignItems="flex-end">
            <Grid item>
                <UserIcon/>
            </Grid>
            <Grid item xs>
                <TextField
                    color={"secondary"}
                    disabled={requesting}
                    label="E-mail"
                    fullWidth
                    onChange={ev => setState({...state, email: ev.target.value})}
                    value={email}
                />
            </Grid>
        </Grid>
        <Box m={2}/>
        <ButtonGroup variant="contained" color={"secondary"} size="large" fullWidth>
            <Button onClick={requestRestorePassword}>
                Restore
            </Button>
            <Button onClick={() => history.push(pages.login.route)}>
                Cancel
            </Button>
        </ButtonGroup>
    </Grid>
};

export default RestorePassword;
