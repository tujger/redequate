import React from "react";
import {user} from "../controllers/User";
import {Redirect, withRouter} from "react-router-dom";
import ProgressView from "../components/ProgressView";
import Snackbar from "../components/Snackbar";
import {Box, Button, ButtonGroup, FormHelperText, Grid, TextField} from "@material-ui/core";
import {Mail as UserIcon} from "@material-ui/icons";
import {connect} from "react-redux";

const RestorePassword = (props) => {
    const {dispatch, firebase, pages} = props;
    const [state, setState] = React.useState({
        email: "",
        error: "",
        requesting: false
    });
    const {email, error, requesting} = state;
    const requestRestorePassword = () => {
        dispatch(ProgressView.SHOW);
        setState({...state, requesting: true});
        firebase.auth().sendPasswordResetEmail(email).then(function () {
            dispatch({type: Snackbar.SHOW, message: "Instructions has sent to e-mail"});
            dispatch(ProgressView.HIDE);
            props.history.push(pages.login.route);
        }).catch(error => {
            dispatch(ProgressView.HIDE);
            setState({...state, error: error.message, requesting: false});
        });
    };

    if (user.currentUser()) {
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
            <Button
                onClick={() => props.history.push(pages.login.route)}
            >
                Cancel
            </Button>
        </ButtonGroup>
    </Grid>
};

export default connect()(withRouter(RestorePassword));
