import React from "react";
import {Redirect, withRouter} from "react-router-dom";
import {fetchUser, sendConfirmationEmail, updateUser, user} from "../controllers/User";
import LoadingComponent from "../components/LoadingComponent";
import PasswordField from "../components/PasswordField";
import ProgressView from "../components/ProgressView";
import {Box, Button, ButtonGroup, FormHelperText, Grid, TextField} from "@material-ui/core";
import {Lock, Mail as UserIcon} from "@material-ui/icons";
import PropTypes from "prop-types";
import {connect} from "react-redux";
import {refreshAll} from "../controllers";

const Signup = (props) => {
    const {signup = true, dispatch, firebase, pages, store} = props;
    const [state, setState] = React.useState({
        email: "",
        password: "",
        confirm: "",
        error: "",
        requesting: false
    });
    const {email, password, confirm, error, requesting} = state;
    const requestSignupPassword = () => {
        if (!email) {
            setState({...state, requesting: false, error: "Empty e-mail"});
            return;
        }
        if (!password) {
            setState({...state, requesting: false, error: "Empty password"});
            return;
        }
        if (password !== confirm) {
            setState({...state, requesting: false, error: "Passwords not equal"});
            return;
        }

        dispatch(ProgressView.SHOW);
        setState({...state, requesting: true});
        firebase.auth().createUserWithEmailAndPassword(email, password).then(signupSuccess).catch(signupError);
    };

    const signupSuccess = response => {
        fetchUser(firebase)(response.user.uid, (data) => {
            updateUser(firebase)({...response.user, ...data, current: true}, () => {
                sendConfirmationEmail(firebase, store)({
                    email: email,
                    onsuccess: () => {
                      refreshAll(store);
                        setState({...state, requesting: false});
                    },
                    onerror: signupError
                })
            }, signupError);
        });
    };

    const signupError = error => {
      refreshAll(store);
        console.error(error);
        setState({...state, error: error.message, requesting: false});
    };

    if (!signup) return <Redirect to={pages.home.route}/>;

    if (!error && (!user.currentUser() || !user.currentUser().emailVerified) && firebase.auth().isSignInWithEmailLink(window.location.href)) {
        // Additional state parameters can also be passed via URL.
        // This can be used to continue the user's intended action before triggering
        // the sign-in operation.
        // Get the email if available. This should be available if the user completes
        // the flow on the same device where they started it.

        let savedEmail = (window.location.search || "").split(/[?&]/).map(token => token.split(/=/)).reduce((acc, item) => (item && item[0] === "email") ? item[1] : acc, null);
        if (!savedEmail) savedEmail = window.localStorage.getItem("emailForSignIn");
        if (!savedEmail) {
            // User opened the link on a different device. To prevent session fixation
            // attacks, ask the user to provide the associated email again. For example:
            savedEmail = window.prompt('Please provide your email for confirmation');
            if(!savedEmail) return <Redirect to={pages.home.route}/>
        }
        // The client SDK will parse the code from the link for you.
        firebase.auth().signInWithEmailLink(savedEmail, window.location.href).then(response => {
            // Clear email from storage.
            window.localStorage.removeItem('emailForSignIn');
            fetchUser(firebase)(response.user.uid, (data) => {
                updateUser(firebase)({...response.user, current: true}, () => {
                  refreshAll(store);
                    props.history.push(pages.edituser.route);
                }, signupError);
            });
        }).catch(signupError);
        return <LoadingComponent/>
    } else if (!error && user.currentUser()) {
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
        <Grid container spacing={1} alignItems="flex-end">
            <Grid item>
                <Lock/>
            </Grid>
            <Grid item xs>
                <PasswordField
                    disabled={requesting}
                    label="Password"
                    onChange={ev => {
                        setState({...state, password: ev.target.value});
                    }}
                    value={password}
                />
            </Grid>
        </Grid>
        <Box m={1}/>
        <Grid container spacing={1} alignItems="flex-end">
            <Grid item>
                <Lock/>
            </Grid>
            <Grid item xs>
                <PasswordField
                    disabled={requesting}
                    label="Confirm password"
                    onChange={ev => {
                        setState({...state, confirm: ev.target.value});
                    }}
                    value={confirm}
                />
            </Grid>
        </Grid>
        <FormHelperText error variant={"outlined"}>
            {error}
        </FormHelperText>
        <Box m={2}/>
        <ButtonGroup variant="contained" color="primary" size="large" fullWidth disabled={requesting}>
            <Button
                onClick={requestSignupPassword}
            >
                Sign up
            </Button>
            <Button
                onClick={() => props.history.push(pages.login.route)}
            >
                Cancel
            </Button>
        </ButtonGroup>
    </Grid>
};

Signup.propTypes = {
    pages: PropTypes.object,
    signup: PropTypes.bool,
};

export default connect()(withRouter(Signup));
