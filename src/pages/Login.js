import React from "react";
import {logoutUser, Role, sendVerificationEmail, useCurrentUserData} from "../controllers/UserData";
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
import FacebookLogo from "../images/facebook-logo.svg";
import PropTypes from "prop-types";
import {useDispatch} from "react-redux";
import {setupReceivingNotifications} from "../controllers/Notifications";
import {fetchDeviceId, useFirebase, usePages, useStore} from "../controllers/General";
import {refreshAll} from "../controllers/Store";
import {browserName, deviceType, osName, osVersion} from "react-device-detect";
import {UserData} from "../controllers";
import ConfirmComponent from "../components/ConfirmComponent";
import {notifySnackbar} from "../controllers/notifySnackbar";
import withStyles from "@material-ui/styles/withStyles";
import {styles} from "../controllers/Theme";
import {useTranslation} from "react-i18next";
import LoadingComponent from "../components/LoadingComponent";

const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);

function Login(props) {
    const {
        agreementComponent = null,
        layout = <LoginLayout/>,
        onLogin,
        popup = true,
        transformUserDataOnFirstLogin,
    } = props;
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const location = useLocation();
    const pages = usePages();
    const store = useStore();
    const {i18n, t} = useTranslation();
    const [state, setState] = React.useState({});
    const {
        showAgreement = false,
        email = "",
        password = "",
        requesting = true,
        response = null
    } = state;

    const errorCallback = error => {
        notifySnackbar(error);
        dispatch(ProgressView.HIDE);
        dispatch({type: "currentUserData", userData: null});
        setState(state => ({...state, requesting: false}));
        // refreshAll(store);
        window.localStorage.removeItem(pages.login.route);
        return logoutUser(firebase, store)();
    };

    const finallyCallback = () => {
        dispatch(ProgressView.HIDE);
    }

    const requestLoginGoogle = () => {
        dispatch(ProgressView.SHOW);
        window.localStorage.removeItem(pages.login.route);
        logoutUser(firebase, store)()
            .then(() => {
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.setCustomParameters({prompt: "select_account"});
                provider.addScope("https://www.googleapis.com/auth/userinfo.email");
                dispatch({type: "currentUserData", userData: null});
                if (popup) {
                    setState(state => ({...state, requesting: true}));
                    return firebase.auth().signInWithPopup(provider)
                        .then(loginSuccess)
                        .then(finallyCallback);
                } else {
                    window.localStorage.setItem(pages.login.route, provider.providerId);
                    return firebase.auth().signInWithRedirect(provider);
                }
            })
            .catch(errorCallback)
    };

    const requestLoginFacebook = () => {
        dispatch(ProgressView.SHOW);
        window.localStorage.removeItem(pages.login.route);
        logoutUser(firebase, store)()
            .then(() => {
                const provider = new firebase.auth.FacebookAuthProvider();
                provider.addScope("email");
                provider.setCustomParameters({prompt: "select_account"});
                dispatch({type: "currentUserData", userData: null});
                if (popup) {
                    setState(state => ({...state, requesting: true}));
                    return firebase.auth().signInWithPopup(provider)
                        .then(loginSuccess)
                        .then(finallyCallback);
                } else {
                    window.localStorage.setItem(pages.login.route, provider.providerId);
                    return firebase.auth().signInWithRedirect(provider);
                }
            })
            .catch(errorCallback)
    }

    const requestLoginToken = (token) => {
        dispatch(ProgressView.SHOW);
        logoutUser(firebase, store)()
            .then(() => {
                setState(state => ({...state, requesting: true}));
                const credential = firebase.auth.GoogleAuthProvider.credential(token);
                return firebase.auth().signInWithCredential(credential)
                    .then(loginSuccess)
                    .then(finallyCallback);
            })
            .catch(errorCallback)
    }

    const requestLoginPassword = () => {
        dispatch(ProgressView.SHOW);
        setState(state => ({...state, requesting: true}));
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then(loginSuccess)
            .catch(errorCallback)
            .finally(finallyCallback);
    };

    const loginSuccess = response => {
        // if (!response) return;
        // if (!response.user) {
        //     throw new Error(t("Login.Login failed. Please try again"));
        // }
        // let isFirstLogin = false;
        // let isFirstOnDevice = false;
        // const ud = new UserData(firebase).fromFirebaseAuth(response.user.toJSON());
        // if (!ud.verified) {
        //     notifySnackbar({
        //         buttonLabel: t("Login.Resend verification"),
        //         onButtonClick: () => sendVerificationEmail(firebase),
        //         priority: "high",
        //         title: t("Login.Your account is not yet verified."),
        //         variant: "warning",
        //     })
        //     setState(state => ({...state, requesting: false}));
        //     return;
        // }
        // return ud.fetch([UserData.ROLE, UserData.PUBLIC, UserData.FORCE])
        //     .then(() => ud.fetchPrivate(fetchDeviceId(), true))
        //     .then(() => i18n.changeLanguage(ud.private[fetchDeviceId()].locale))
        //     .then(() => {
        //         if (!ud.private[fetchDeviceId()].osName) isFirstOnDevice = true
        //     })
        //     .then(() => ud.setPrivate(fetchDeviceId(), {
        //         osName,
        //         osVersion,
        //         deviceType,
        //         browserName,
        //         agreement: true
        //     }))
        //     .then(() => ud.savePrivate())
        //     .then(() => {
        //         if (!ud.persisted) {
        //             isFirstLogin = true;
        //             if (transformUserDataOnFirstLogin) return transformUserDataOnFirstLogin(ud);
        //         }
        //         return ud;
        //     })
        //     .then(ud => isFirstLogin ? ud.savePublic() : ud.updateVisitTimestamp())
        //     .then(ud => {
        //         useCurrentUserData(ud);
        //         dispatch({type: "currentUserData", userData: ud});
        //     })
        //     .then(() => {
        //         if (iOS) return;
        //         if (isFirstOnDevice || ud.private[fetchDeviceId()].notification) {
        //             return setupReceivingNotifications(firebase)
        //                 .then(token => ud.setPrivate(fetchDeviceId(), {notification: token})
        //                     .then(() => ud.savePrivate()))
        //                 .then(() => notifySnackbar({title: t("Login.Subscribed to notifications")}))
        //                 .then(() => setTimeout(() => {
        //                     setState(state => ({...state, disabled: false}))
        //                 }, 10))
        //                 .catch(error => {
        //                     if (error && error.code === "messaging/failed-service-worker-registration") return;
        //                     throw error;
        //                 })
        //                 .catch(notifySnackbar)
        //         }
        //     })
        //     .then(() => {
        //         refreshAll(store);
        //         if (onLogin && onLogin(isFirstLogin)) return;
        //         if (isFirstLogin) history.replace(pages.editprofile.route, {isFirstLogin: true});
        //         else history.replace(pages.home.route);
        //     });

        const importValues = async () => {
            return {deviceId: fetchDeviceId(), response}
        }
        const checkIfResponseValid = async props => {
            const {response} = props;
            if (!response) throw "empty-response";
            if (!response.user) {
                throw new Error(t("Login.Login failed. Please try again"));
            }
            return props;
        }
        const createUserDataFromResponse = async props => {
            const {response} = props;
            const userData = new UserData(firebase).fromFirebaseAuth(response.user.toJSON());
            return {...props, userData}
        }
        const checkIfUserVerified = async props => {
            const {userData} = props;
            if (!userData.verified) {
                notifySnackbar({
                    buttonLabel: t("Login.Resend verification"),
                    onButtonClick: () => sendVerificationEmail(firebase),
                    priority: "high",
                    title: t("Login.Your account is not yet verified."),
                    variant: "warning",
                })
                throw "user-not-verified";
            }
            return props;
        }
        const fetchPublicAndPrivateData = async props => {
            const {userData, deviceId} = props;
            await userData.fetch([UserData.ROLE, UserData.PUBLIC, UserData.FORCE])
                .then(() => userData.fetchPrivate(deviceId, true));
            return {...props, userData};
        }
        const changeLocaleByUser = async props => {
            const {userData, deviceId} = props;
            try {
                i18n.changeLanguage(userData.private[deviceId].locale);
            } catch (error) {
                console.error(error);
            }
            return props;
        }
        const checkIfFirstLoginAndOnDevice = async props => {
            const {userData, deviceId} = props;
            const isFirstOnDevice = !!userData.private[deviceId].osName;
            const isFirstLogin = !userData.persisted;
            return {...props, isFirstOnDevice, isFirstLogin};
        }
        const updatePrivateData = async props => {
            const {userData, deviceId} = props;
            await userData.setPrivate(deviceId, {
                osName,
                osVersion,
                deviceType,
                browserName,
                agreement: true
            });
            return props;
        }
        const transformUserDataIfNeeded = async props => {
            let {userData, isFirstLogin} = props;
            if (isFirstLogin && transformUserDataOnFirstLogin) {
                userData = await transformUserDataOnFirstLogin(userData);
            }
            return {...props, userData};
        }
        const publishUserData = async props => {
            const {userData, isFirstLogin} = props;
            await userData.savePrivate();
            if (isFirstLogin) {
                await userData.savePublic();
            } else {
                userData.updateVisitTimestamp();
            }
            return props;
        }
        const updateCurrentUserData = async props => {
            const {userData} = props;
            useCurrentUserData(userData);
            dispatch({type: "currentUserData", userData});
            refreshAll(store);
            return props;
        }
        const checkIfUserDisabled = async props => {
            const {userData} = props;
            if (userData.role === Role.DISABLED) {
                history.push(pages.profile.route);
                throw "user-disabled";
            }
            return props;
        }
        const setupNotifications = async props => {
            const {userData, isFirstOnDevice, deviceId} = props;
            if (iOS) return props;
            if (isFirstOnDevice || userData.private[deviceId].notification) {
                await setupReceivingNotifications(firebase)
                    .then(notification => userData.setPrivate(deviceId, {notification}))
                    .then(() => userData.savePrivate())
                    .then(() => notifySnackbar({title: t("Login.Subscribed to notifications")}))
                    // .then(() => setTimeout(() => {
                    //     setState(state => ({...state, disabled: false}))
                    // }, 10))
                    .catch(error => {
                        if (error && error.code === "messaging/failed-service-worker-registration") return;
                        throw error;
                    })
                    .catch(notifySnackbar)
            }
            return props;
        }
        const doIfFirstLogin = async props => {
            console.log(props)
            const {isFirstLogin} = props;
            if (onLogin && onLogin(isFirstLogin)) return;
            if (isFirstLogin) history.replace(pages.editprofile.route, {isFirstLogin});
            else history.replace(pages.home.route);
        }
        const catchEvent = async event => {
            if (event instanceof Error) throw event;
            console.warn(event);
        }
        const finalize = async () => {
            setState(state => ({...state, requesting: false}));
        }

        importValues()
            .then(checkIfResponseValid)
            .then(createUserDataFromResponse)
            .then(checkIfUserVerified)
            .then(fetchPublicAndPrivateData)
            .then(changeLocaleByUser)
            .then(checkIfFirstLoginAndOnDevice)
            .then(updatePrivateData)
            .then(transformUserDataIfNeeded)
            .then(publishUserData)
            .then(updateCurrentUserData)
            .then(checkIfUserDisabled)
            .then(setupNotifications)
            .then(doIfFirstLogin)
            .catch(catchEvent)
            .catch(notifySnackbar)
            .finally(finalize)
    };

    const checkFirstLogin = async response => {
        console.log(response)
        if (!response || !response.user) throw Error(t("Login.Login cancelled"));
        if (!agreementComponent) return response;
        const deviceId = fetchDeviceId();
        const userData = new UserData(firebase).fromFirebaseAuth(response.user.toJSON());
        await userData.fetchPrivate(deviceId, true);
        const agreement = (userData.private[deviceId] || {}).agreement;
        if (agreement) return response;
        setState(state => ({...state, showAgreement: true, response}));
    }

    const handleAgree = () => {
        setState(state => ({...state, showAgreement: false}));
        loginSuccess(response);
    }

    const handleDecline = () => {
        setState(state => ({...state, showAgreement: false}));
        notifySnackbar(t("Login.Agreement rejected"));
        history.goBack();
    }

    if (currentUserData && currentUserData.id) {
        if (location.pathname === pages.login.route) {
            return <Redirect to={pages.profile.route}/>
        } else {
            return <Redirect to={location.pathname}/>
        }
    }

    React.useEffect(() => {
        if (location.state && location.state.loginWith) {
            if (location.state.loginWith === "google") {
                requestLoginGoogle();
            } else if (location.state.loginWith === "facebook") {
                requestLoginFacebook();
            } else if (location.state.loginWith === "token") {
                requestLoginToken(location.state.credential);
            }
            return;
        }
        if (!popup && window.localStorage.getItem(pages.login.route)) {
            window.localStorage.removeItem(pages.login.route);
            firebase.auth().getRedirectResult()
                .then(checkFirstLogin)
                .then(loginSuccess)
                .catch(errorCallback)
                .finally(() => dispatch(ProgressView.HIDE));
        } else {
            setState(state => ({...state, requesting: false}));
        }
    }, [])

    if (requesting) return <LoadingComponent/>

    return <layout.type
        {...props}
        {...layout.props}
        agreementComponent={showAgreement ? agreementComponent : null}
        disabled={requesting}
        email={email}
        onAgree={handleAgree}
        onChangeEmail={ev => setState(state => ({...state, email: ev.target.value}))}
        onChangePassword={ev => setState(state => ({...state, password: ev.target.value}))}
        onDecline={handleDecline}
        onRequestGoogle={requestLoginGoogle}
        onRequestFacebook={requestLoginFacebook}
        onRequestLogin={requestLoginPassword}
        password={password}
    />
}

const LoginLayout = (
    {
        agreementComponent,
        classes,
        disabled,
        email,
        logo,
        onAgree,
        onChangeEmail,
        onChangePassword,
        onDecline,
        onRequestGoogle,
        onRequestFacebook,
        onRequestLogin,
        password,
        signup = true
    }) => {
    const pages = usePages();
    const history = useHistory();
    const {t} = useTranslation();

    return <Grid container className={classes.center}>
        {logo}
        <Box m={1}/>
        <Grid container spacing={1} alignItems={"flex-end"}>
            <Grid item>
                <UserIcon/>
            </Grid>
            <Grid item xs>
                <TextField
                    color={"secondary"}
                    disabled={disabled}
                    fullWidth
                    label={t("User.E-mail")}
                    onChange={onChangeEmail}
                    value={email}
                    // InputProps={{
                    //     inputComponent: TextMaskEmail
                    // }}
                />
            </Grid>
        </Grid>
        <Box m={1}/>
        <Grid container spacing={1} alignItems={"flex-end"}>
            <Grid item>
                <Lock/>
            </Grid>
            <Grid item xs>
                <PasswordField
                    color={"secondary"}
                    disabled={disabled}
                    label={t("User.Password")}
                    onChange={onChangePassword}
                    value={password}
                />
            </Grid>
        </Grid>
        <Box m={2}/>
        <ButtonGroup
            color={"secondary"}
            disabled={disabled}
            fullWidth
            size={"large"}
            variant={"contained"}
        >
            <Button
                children={t("Common.Continue")}
                fullWidth
                onClick={onRequestLogin}
            />
            <Button
                children={t("Common.Cancel")}
                fullWidth
                onClick={() => history.goBack()}
            />
        </ButtonGroup>
        <Box m={1}/>
        <ButtonGroup
            color={"default"}
            disabled={disabled}
            fullWidth
            size={"large"}
            variant={"text"}
        >
            {signup && <Button
                children={t("Login.Create account")}
                fullWidth
                onClick={() => history.push(pages.signup.route)}
                size={"small"}
            />}
            <Button
                children={t("Login.Forgot password?")}
                fullWidth
                onClick={() => history.push(pages.restore.route)}
                size={"small"}
            />
        </ButtonGroup>
        <Box m={1}/>
        <Grid container alignItems={"center"} justify={"center"} spacing={1}>
            <Button
                color={"secondary"}
                disabled={disabled}
                onClick={onRequestGoogle}
                size={"large"}
                variant={"text"}
            >
                <img src={GoogleLogo} width={20} height={20} alt={""}/>
                <Box m={0.5}/>
                {t("Login.Login with")} Google
            </Button>
            <Button
                color={"secondary"}
                disabled={disabled}
                onClick={onRequestFacebook}
                size={"large"}
                variant={"text"}
            >
                <img src={FacebookLogo} width={20} height={20} alt={""}/>
                <Box m={0.5}/>
                {t("Login.Login with")} Facebook
            </Button>
        </Grid>
        <Box m={1}/>
        {agreementComponent && <ConfirmComponent
            confirmLabel={t("Login.Agree")}
            modal
            onCancel={onDecline}
            onConfirm={onAgree}
            title={t("Login.User agreement")}
        >
            <agreementComponent.type
                {...agreementComponent.props}
            />
        </ConfirmComponent>}
    </Grid>
}

Login.propTypes = {
    agreementComponent: PropTypes.element,
    layout: PropTypes.objectOf(LoginLayout),
    logo: PropTypes.any,
    onLogin: PropTypes.func,
    popup: PropTypes.bool,
    signup: PropTypes.bool,
    transformUserDataOnFirstLogin: PropTypes.func,
};

LoginLayout.propTypes = {
    agreementComponent: PropTypes.element,
    disabled: PropTypes.bool,
    email: PropTypes.string,
    logo: PropTypes.any,
    onAgree: PropTypes.func,
    onChangeEmail: PropTypes.func,
    onChangePassword: PropTypes.func,
    onDecline: PropTypes.func,
    onRequestGoogle: PropTypes.func,
    onRequestLogin: PropTypes.func,
    password: PropTypes.any,
    signup: PropTypes.bool
};

export default withRouter(withStyles(styles)(Login));
