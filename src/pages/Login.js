import React from "react";
import {
    fetchUserPrivate,
    fetchUserPublic,
    logoutUser,
    updateUserPrivate,
    updateUserPublic,
    user
} from "../controllers/User";
import LoadingComponent from "../components/LoadingComponent";
import PasswordField from "../components/PasswordField";
import ProgressView from "../components/ProgressView";
import {Link, Redirect, useHistory, useLocation, withRouter} from "react-router-dom";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import TextField from "@material-ui/core/TextField";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Lock from "@material-ui/icons/Lock";
import UserIcon from "@material-ui/icons/Mail";
import GoogleLogo from "../images/google-logo.svg";
import PropTypes from "prop-types";
import {useDispatch} from "react-redux";
import {notifySnackbar, setupReceivingNotifications} from "../controllers/Notifications";
import {fetchDeviceId, useFirebase, usePages, useStore} from "../controllers/General";
import {refreshAll} from "../controllers/Store";
import {browserName, deviceType, osName, osVersion} from "react-device-detect";

const Login = (props) => {
    const {popup = true, layout = <LoginLayout/>} = props;
    const [state, setState] = React.useState({
        email: "",
        password: "",
        requesting: false
    });
    const {email, password, requesting} = state;
    const pages = usePages();
    const dispatch = useDispatch();
    const store = useStore();
    const firebase = useFirebase();
    const location = useLocation();

    const requestLoginGoogle = () => {
        dispatch(ProgressView.SHOW);
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            if (popup) {
                logoutUser(firebase)().then(() => {
                    setState({...state, requesting: true});
                    firebase.auth().signInWithPopup(provider).then(loginSuccess).catch(loginError);
                }).catch(loginError)
            } else {
                logoutUser(firebase)().then(() => {
                    window.localStorage.setItem(pages.login.route, provider.providerId);
                    firebase.auth().signInWithRedirect(provider);
                }).catch(loginError)
            }
        } catch (error) {
            loginError(error);
        }
    };

    const requestLoginPassword = () => {
        dispatch(ProgressView.SHOW);
        setState({...state, requesting: true});
        firebase.auth().signInWithEmailAndPassword(email, password).then(loginSuccess).catch(loginError);
    };

    const loginSuccess = response => {
        if (!response.user) {
            loginError(new Error("Login failed. Please try again"));
            return;
        }
        const {uid, email, emailVerified, displayName: name, phoneNumber: phone, photoURL: image, providerData = []} = response.user.toJSON();
        const provider = providerData.filter(item => item && item.providerId).filter((item, index) => index === 0).map(item => item.providerId)[0];

        fetchUserPublic(firebase)(uid)
            .then(data => updateUserPublic(firebase)(uid,
                {
                    created: firebase.database.ServerValue.TIMESTAMP,
                    updated: firebase.database.ServerValue.TIMESTAMP,
                    email,
                    name,
                    phone,
                    image,
                    provider,
                    ...data,
                    emailVerified,
                    current: true
                }))
            .then(() => fetchUserPrivate(firebase)(uid, fetchDeviceId()))
            .then(data => updateUserPrivate(firebase)(uid, fetchDeviceId(), {
                ...data, osName, osVersion, deviceType, browserName
            }))
            .then((data) => {
                if (data && data.notification) {
                    return setupReceivingNotifications(firebase)
                        .then(token => fetchUserPrivate(firebase)(uid)
                            .then(data => updateUserPrivate(firebase)(uid, fetchDeviceId(), {notification: token}))
                            .then(result => {
                                notifySnackbar({title: "Subscribed"});
                                dispatch(ProgressView.HIDE);
                                setState({...state, disabled: false});
                            }))
                        .catch(notifySnackbar)
                }
                // return this;
            })
            .then(() => {
                dispatch({type: "user", user});
            })
            .catch(loginError)
            .finally(() => {
                setState({...state, requesting: false});
                refreshAll(store);
            });
    };

    const loginError = error => {
        dispatch(ProgressView.HIDE);
        notifySnackbar(error);
        logoutUser(firebase)();
        setState({...state, requesting: false});
    };

    if (!popup && window.localStorage.getItem(pages.login.route)) {
        firebase.auth().getRedirectResult().then(loginSuccess).catch(loginError);
        window.localStorage.removeItem(pages.login.route);
        return <LoadingComponent/>;
    }

    if (user.uid()) {
        if (location.pathname === pages.login.route) {
            return <Redirect to={pages.profile.route}/>
        } else {
            return <Redirect to={location.pathname}/>
        }
    }

    return <layout.type {...props} {...layout.props} email={email} onChangeEmail={ev => {
        setState({...state, email: ev.target.value});
    }} onChangePassword={ev => {
        setState({...state, password: ev.target.value});
    }} onRequestGoogle={requestLoginGoogle} onRequestLogin={requestLoginPassword} password={password}
                        disabled={requesting}/>
};

const LoginLayout = ({disabled, email, onChangeEmail, password, onChangePassword, onRequestLogin, onRequestGoogle, signup = true}) => {
    const pages = usePages();
    const history = useHistory();

    return <Grid container>
        <Box m={0.5}/>
        <Grid container spacing={1} alignItems="flex-end">
            <Grid item>
                <UserIcon/>
            </Grid>
            <Grid item xs>
                <TextField
                    disabled={disabled}
                    label="E-mail"
                    fullWidth
                    onChange={onChangeEmail}
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
                    disabled={disabled}
                    label={"Password"}
                    onChange={onChangePassword}
                    value={password}
                />
            </Grid>
        </Grid>
        <Grid container spacing={1} alignItems="flex-end">
            <Grid item>
                <Box m={1.5}/>
            </Grid>
            <Grid item>
                <Link to={pages.restore.route}>Forgot password?</Link>
            </Grid>
        </Grid>
        <Box m={1}/>
        <ButtonGroup disabled={disabled} variant="contained" color="primary" size="large" fullWidth>
            <Button onClick={onRequestLogin}>
                Login
            </Button>
            {signup && <Button onClick={() => history.push(pages.signup.route)}>
                Sign up
            </Button>}
        </ButtonGroup>
        <Box m={2}/>
        <Grid container justify="center">
            <Button disabled={disabled} onClick={onRequestGoogle}>
                <img src={GoogleLogo} width={20} height={20} alt={""}/>
                <Box m={0.5}/>
                Log in with Google
            </Button>
        </Grid>
    </Grid>
}

Login.propTypes = {
    signup: PropTypes.bool,
    popup: PropTypes.bool,
    pages: PropTypes.object,
    layout: PropTypes.any,
};

export default withRouter(Login);
