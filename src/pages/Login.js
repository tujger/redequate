import React from "react";
import {logoutUser, sendVerificationEmail, useCurrentUserData} from "../controllers/UserData";
import LoadingComponent from "../components/LoadingComponent";
import PasswordField from "../components/PasswordField";
import ProgressView from "../components/ProgressView";
import {Redirect, useHistory, useLocation, withRouter} from "react-router-dom";
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
import {TextMaskEmail, UserData} from "../controllers";

const Login = (props) => {
    const {popup = true, onLogin, transformUserData, layout = <LoginLayout/>} = props;
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
    const currentUserData = useCurrentUserData();
    const history = useHistory();

    const errorCallback = error => {
        notifySnackbar(error);
        dispatch({type: "currentUserData", userData: null});
        return logoutUser(firebase, store)();
    };

    const finallyCallback = () => {
        setState({...state, requesting: false});
        dispatch(ProgressView.HIDE);
        refreshAll(store);
    }

    const requestLoginGoogle = () => {
        dispatch(ProgressView.SHOW);
        logoutUser(firebase, store)()
            .then(() => {
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.setCustomParameters({prompt: "select_account"});
                dispatch({type: "currentUserData", userData: null});
                if (popup) {
                    setState({...state, requesting: true});
                    return firebase.auth().signInWithPopup(provider).then(loginSuccess);
                } else {
                    window.localStorage.setItem(pages.login.route, provider.providerId);
                    return firebase.auth().signInWithRedirect(provider);
                }
            })
            .catch(errorCallback)
    };

    const requestLoginPassword = () => {
        dispatch(ProgressView.SHOW);
        setState({...state, requesting: true});
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then(loginSuccess)
            .catch(errorCallback)
            .finally(finallyCallback);
    };

    const loginSuccess = response => {
        if (!response.user) {
            throw new Error("Login failed. Please try again");
        }
        let isFirstLogin = false;
        const ud = new UserData(firebase).fromFirebaseAuth(response.user.toJSON());
        if (!ud.verified) {
            notifySnackbar({
                buttonLabel: "Resend verification",
                onButtonClick: () => sendVerificationEmail(firebase),
                priority: "high",
                title: "Your account is not yet verified.",
                variant: "warning",
            })
            return;
        }
        return ud.fetch([UserData.ROLE, UserData.PUBLIC, UserData.FORCE])
            .then(() => ud.fetchPrivate(fetchDeviceId(), true))
            .then(() => ud.setPrivate(fetchDeviceId(), {osName, osVersion, deviceType, browserName}))
            .then(() => ud.savePrivate())
            .then(() => {
                if (!ud.persisted) {
                    isFirstLogin = true;
                    if (transformUserData) return transformUserData(ud);
                }
                return ud;
            })
            .then(ud => isFirstLogin ? ud.savePublic() : ud)
            .then(ud => {
                useCurrentUserData(ud);
                dispatch({type: "currentUserData", userData: ud});
            })
            .then(() => {
                if (ud.private[fetchDeviceId()].notification) {
                    return setupReceivingNotifications(firebase)
                        .then(token => ud.setPrivate(fetchDeviceId(), {notification: token})
                            .then(() => ud.savePrivate()))
                        .then(() => {
                            notifySnackbar({title: "Subscribed to notifications"});
                            setState({...state, disabled: false});
                        })
                        .catch(notifySnackbar)
                }
            })
            .then(() => {
                refreshAll(store);
                if (onLogin) {
                    onLogin(isFirstLogin);
                } else {
                    if (isFirstLogin) history.replace(pages.editprofile.route);
                    else history.replace(pages.home.route);
                }
            });
    };

    if (!popup && window.localStorage.getItem(pages.login.route)) {
        window.localStorage.removeItem(pages.login.route);
        firebase.auth().getRedirectResult()
            .then(loginSuccess)
            .catch(errorCallback)
            .finally(finallyCallback);
        return <LoadingComponent/>;
    }

    if (currentUserData && currentUserData.id) {
        if (location.pathname === pages.login.route) {
            return <Redirect to={pages.profile.route}/>
        } else {
            return <Redirect to={location.pathname}/>
        }
    }

    return <layout.type
        {...props}
        {...layout.props}
        disabled={requesting}
        email={email}
        onChangeEmail={ev => setState({...state, email: ev.target.value})}
        onChangePassword={ev => setState({...state, password: ev.target.value})}
        onRequestGoogle={requestLoginGoogle}
        onRequestLogin={requestLoginPassword}
        password={password}
    />
};

const LoginLayout =
    ({
         disabled,
         email,
         logo,
         onChangeEmail,
         onChangePassword,
         onRequestGoogle,
         onRequestLogin,
         password,
         signup = true
     }) => {
        const pages = usePages();
        const history = useHistory();

        return <Grid container>
            {logo}
            <Box m={1}/>
            <Grid container spacing={1} alignItems="flex-end">
                <Grid item>
                    <UserIcon/>
                </Grid>
                <Grid item xs>
                    <TextField
                        color={"secondary"}
                        disabled={disabled}
                        fullWidth
                        label="E-mail"
                        onChange={onChangeEmail}
                        value={email}
                        InputProps={{
                            inputComponent: TextMaskEmail
                        }}
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
                        color={"secondary"}
                        disabled={disabled}
                        label={"Password"}
                        onChange={onChangePassword}
                        value={password}
                    />
                </Grid>
            </Grid>
            <Box m={1}/>
            <Grid container spacing={1} alignItems="center">
                <Button disabled={disabled} onClick={onRequestLogin} variant={"contained"} color={"secondary"}
                        size="large"
                        fullWidth>
                    Continue
                </Button>
            </Grid>
            <Box m={1}/>
            <ButtonGroup disabled={disabled} variant={"text"} color={"default"} size="large" fullWidth>
                {signup && <Button onClick={() => history.push(pages.signup.route)}>
                    Create account
                </Button>}
                <Button onClick={() => history.push(pages.restore.route)}>
                    Forgot password?
                </Button>}
            </ButtonGroup>
            <Box m={1}/>
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
    layout: PropTypes.element,
    logo: PropTypes.any,
    onLogin: PropTypes.func,
    popup: PropTypes.bool,
    signup: PropTypes.bool,
    transformUserData: PropTypes.func,
};

export default withRouter(Login);
