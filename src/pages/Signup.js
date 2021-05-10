import React from "react";
import {Redirect, useHistory, useParams} from "react-router-dom";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import TextField from "@material-ui/core/TextField";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Lock from "@material-ui/icons/Lock";
import UserIcon from "@material-ui/icons/Mail";
import {useDispatch} from "react-redux";
import withStyles from "@material-ui/styles/withStyles";
import {useTranslation} from "react-i18next";
import {sendVerificationEmail, useCurrentUserData} from "../controllers/UserData";
import LoadingComponent from "../components/LoadingComponent";
import PasswordField from "../components/PasswordField";
import ProgressView from "../components/ProgressView";
import {useFirebase, usePages, useStore} from "../controllers/General";
import {refreshAll} from "../controllers/Store";
import notifySnackbar from "../controllers/notifySnackbar";
import {styles} from "../controllers/Theme";
import GoogleLogo from "../images/google-logo.svg";
import FacebookLogo from "../images/facebook-logo.svg";

const Signup = ({classes, signup = true, additional}) => {
    const [state, setState] = React.useState({
        email: "",
        password: "",
        confirm: "",
        requesting: false,
    });
    const {email, password, confirm, requesting, requestPasswordFor} = state;
    const pages = usePages();
    const dispatch = useDispatch();
    const store = useStore();
    const firebase = useFirebase();
    const history = useHistory();
    const currentUserData = useCurrentUserData();
    const params = useParams();
    const {t} = useTranslation();

    const requestSignupPassword = () => {
        if (!email && !requestPasswordFor) {
            notifySnackbar(new Error(t("User.Empty e-mail")));
            setState({...state, requesting: false});
            return;
        }
        if (!password) {
            notifySnackbar(new Error(t("User.Empty password")));
            setState({...state, requesting: false});
            return;
        }
        if (password.length < 8) {
            notifySnackbar(new Error(t("User.Password must be at least 8 symbols")));
            setState({...state, requesting: false});
            return;
        }
        // if (password !== confirm) {
        //     notifySnackbar(new Error("Passwords not equal"));
        //     setState({...state, requesting: false});
        //     return;
        // }

        dispatch(ProgressView.SHOW);
        setState({...state, requesting: true});
        if (requestPasswordFor) {
            const user = firebase.auth().currentUser;
            user.updatePassword(password)
                .then(() => {
                    notifySnackbar({
                        title: t("User.Now you may login with your e-mail and password.")
                    });
                    history.replace(pages.login.route);
                })
                .catch(signupError)
                .finally(() => {
                    setState({...state, requesting: false});
                    dispatch(ProgressView.HIDE);
                });
        } else {
            firebase.auth().createUserWithEmailAndPassword(email, password)
                .then(signupVerification)
                .catch(signupError)
                .finally(() => dispatch(ProgressView.HIDE));
        }
    };

    const signupVerification = response => {
        return sendVerificationEmail()
            .then(() => {
                notifySnackbar("Verification email has been sent");
                setState({...state, requesting: false});
                history.push(pages.login.route);
            })
            .catch(notifySnackbar)
    };

    const signupError = error => {
        refreshAll(store);
        notifySnackbar(error);
        history.push(pages.login.route);
        setState({...state, requesting: false});
    };

    const onRequestGoogle = () => {
        history.push(pages.login.route, {loginWith: "google"})
    }

    const onRequestFacebook = () => {
        history.push(pages.login.route, {loginWith: "facebook"})
    }

    if (!signup) return <Redirect to={pages.home.route}/>;

    if (!requestPasswordFor && firebase.auth().isSignInWithEmailLink(window.location.href)) {
        let email = params.email;
        dispatch(ProgressView.SHOW);

        console.log("[Signup] with link for", email)
        if (!email) {
            email = window.prompt(t("User.Please provide your e-mail for confirmation"));
            if (!email) return <Redirect to={pages.home.route}/>
        }
        firebase.auth().signInWithEmailLink(email, window.location.href)
            .then(() => setState({...state, requestPasswordFor: email}))
            .catch(signupError)
            .finally(() => dispatch(ProgressView.HIDE));

        return <LoadingComponent/>
    } else if (currentUserData.id) {
        return <Redirect to={pages.profile.route}/>
    }

    return <Grid container className={classes.center}>
        <Box m={0.5}/>
        {!requestPasswordFor && <Grid container spacing={1} alignItems={"flex-end"}>
            <Grid item>
                <UserIcon/>
            </Grid>
            <Grid item xs>
                <TextField
                    color={"secondary"}
                    disabled={requesting}
                    label={t("User.E-mail")}
                    fullWidth
                    onChange={ev => {
                        setState({...state, email: ev.target.value});
                    }}
                    value={email}
                    // InputProps={{
                    //     inputComponent: TextMaskEmail
                    // }}
                />
            </Grid>
        </Grid>}
        {!requestPasswordFor && <Box m={1}/>}
        {requestPasswordFor && <Grid container spacing={1} alignItems={"flex-end"}>
            <h4>{t("User.Please create password for your account.")}</h4>
        </Grid>}
        {!requestPasswordFor && <Box m={1}/>}
        <Grid container spacing={1} alignItems={"flex-end"}>
            <Grid item>
                <Lock/>
            </Grid>
            <Grid item xs>
                <PasswordField
                    color={"secondary"}
                    disabled={requesting}
                    label={t("User.Password")}
                    onChange={ev => {
                        setState({...state, password: ev.target.value});
                    }}
                    value={password}
                />
            </Grid>
        </Grid>
        {/*<Box m={1}/>
        <Grid container spacing={1} alignItems={"flex-end"}>
            <Grid item>
                <Lock/>
            </Grid>
            <Grid item xs>
                <PasswordField
                    color={"secondary"}
                    disabled={requesting}
                    label={"Confirm password"}
                    onChange={ev => {
                        setState({...state, confirm: ev.target.value});
                    }}
                    value={confirm}
                />
            </Grid>
        </Grid>*/}
        {additional}
        <Box m={2}/>
        <ButtonGroup variant={"contained"} color={"secondary"} size={"large"} fullWidth disabled={requesting}>
            <Button
                children={t("Definitions.Sign up")}
                onClick={requestSignupPassword}
            />
            <Button
                children={t("Common.Cancel")}
                onClick={() => history.goBack()}
            />
        </ButtonGroup>
        <Box m={2}/>
        <Grid container alignItems={"center"} justify={"center"} spacing={1}>
            <Button variant={"text"} color={"secondary"} onClick={onRequestGoogle} size={"large"}>
                <img src={GoogleLogo} width={20} height={20} alt={""}/>
                <Box m={0.5}/>
                {t("Login.Sign up with")} Google
            </Button>
            <Button variant={"text"} color={"secondary"} onClick={onRequestFacebook} size={"large"}>
                <img src={FacebookLogo} width={20} height={20} alt={""}/>
                <Box m={0.5}/>
                {t("Login.Sign up with")} Facebook
            </Button>
        </Grid>
    </Grid>
};

export default withStyles(styles)(Signup);
