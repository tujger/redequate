import React from "react";
import {Redirect, useHistory} from "react-router-dom";
import {
    fetchUserPublic,
    sendConfirmationEmail,
    sendVerificationEmail,
    updateUserPublic, useCurrentUserData,
    user
} from "../controllers/User";
import LoadingComponent from "../components/LoadingComponent";
import PasswordField from "../components/PasswordField";
import ProgressView from "../components/ProgressView";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import FormHelperText from "@material-ui/core/FormHelperText";
import TextField from "@material-ui/core/TextField";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Lock from "@material-ui/icons/Lock";
import UserIcon from "@material-ui/icons/Mail";
import PropTypes from "prop-types";
import {useDispatch} from "react-redux";
import {refreshAll, useFirebase, usePages, useStore} from "../controllers";

const Signup = (props) => {
    const {signup = true} = props;
    const [state, setState] = React.useState({
        email: "",
        password: "",
        confirm: "",
        error: "",
        requesting: false
    });
    const {email, password, confirm, error, requesting} = state;
    const pages = usePages();
    const dispatch = useDispatch();
    const store = useStore();
    const firebase = useFirebase();
    const history = useHistory();
    const currentUserData = useCurrentUserData();


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
        fetchUserPublic(firebase)(response.user.uid)
            .then(data => {
                const newdata = response.user.toJSON();
                const googleData = {
                    address: newdata.address || "",
                    created: newdata.created || firebase.database.ServerValue.TIMESTAMP,
                    email: newdata.email,
                    emailVerified: newdata.emailVerified || false,
                    name: newdata.name || "",
                    phone: newdata.phone || "",
                    provider: newdata.providerData
                        .filter(item => item && item.providerId)
                        .filter((item, index) => index === 0)
                        .map(item => item.providerId)[0] || "unknown",
                    updated: newdata.updated || firebase.database.ServerValue.TIMESTAMP
                }
                updateUserPublic(firebase)(response.user.uid, {
                    created: firebase.database.ServerValue.TIMESTAMP,
                    ...googleData,
                    ...data,
                    updated: firebase.database.ServerValue.TIMESTAMP,
                    current: true
                })
            })
            .then(() => sendVerificationEmail(firebase))
            .then(() => {
                refreshAll(store);
                setState({...state, requesting: false});
            })
            .catch(signupError);
    };

    const signupError = error => {
        refreshAll(store);
        console.error(error);
        setState({...state, error: error.message, requesting: false});
    };

    if (!signup) return <Redirect to={pages.home.route}/>;

    if (!error && (user.public() && !user.public().emailVerified) && firebase.auth().isSignInWithEmailLink(window.location.href)) {
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
            savedEmail = window.prompt("Please provide your email for confirmation");
            if (!savedEmail) return <Redirect to={pages.home.route}/>
        }
        // The client SDK will parse the code from the link for you.
        firebase.auth().signInWithEmailLink(savedEmail, window.location.href)
            .then(response => {
                // Clear email from storage.
                window.localStorage.removeItem("emailForSignIn");
                return fetchUserPublic(firebase)(response.user.uid);
            })
            .then(() => updateUserPublic(firebase)({...response.user, current: true}))
            .then(() => {
                refreshAll(store);
                history.push(pages.editprofile.route);
            })
            .catch(signupError);
        return <LoadingComponent/>
    } else if (!error && user.uid()) {
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
        <ButtonGroup variant="contained" color={"secondary"} size="large" fullWidth disabled={requesting}>
            <Button
                onClick={requestSignupPassword}
            >
                Sign up
            </Button>
            <Button
                onClick={() => history.push(pages.login.route)}
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

export default Signup;
