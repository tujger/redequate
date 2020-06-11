import React from "react";
import {user} from "../controllers/User";
import {Redirect, useHistory} from "react-router-dom";
import ProgressView from "../components/ProgressView";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import FormHelperText from "@material-ui/core/FormHelperText";
import TextField from "@material-ui/core/TextField";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import UserIcon from "@material-ui/icons/Mail";
import {useDispatch} from "react-redux";
import {notifySnackbar, useFirebase, usePages, useStore} from "../controllers";

const RestorePassword = (props) => {
    const [state, setState] = React.useState({
        email: "",
        error: "",
        requesting: false
    });
    const {email, error, requesting} = state;
    const pages = usePages();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();


    const requestRestorePassword = () => {
        dispatch(ProgressView.SHOW);
        setState({...state, requesting: true});
        firebase.auth().sendPasswordResetEmail(email).then(() => {
            notifySnackbar({
                title: "Instructions has sent to e-mail"
            });
            dispatch(ProgressView.HIDE);
            history.push(pages.login.route);
        }).catch(error => {
            notifySnackbar({
                title: error.message,
                variant: "error"
            });
            dispatch(ProgressView.HIDE);
            setState({...state, error: error.message, requesting: false});
        });
    };

    if (user.uid()) {
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
                    disabled={requesting}
                    label="E-mail"
                    fullWidth
                    onChange={ev => {
                        setState({...state, email: ev.target.value});
                    }}
                    value={email}
                />
            </Grid>
        </Grid>
        <Box m={1}/>
        <FormHelperText error variant={"outlined"}>
            {error}
        </FormHelperText>
        <Box m={2}/>
        <ButtonGroup variant="contained" color="primary" size="large" fullWidth>
            <Button
                onClick={requestRestorePassword}
            >
                Restore
            </Button>
            <Button onClick={() => history.push(pages.login.route)}>
                Cancel
            </Button>
        </ButtonGroup>
    </Grid>
};

export default RestorePassword;
