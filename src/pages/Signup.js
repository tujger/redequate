import Lock from "@material-ui/icons/Lock";
import UserIcon from "@material-ui/icons/Mail";
import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {Redirect, useHistory, useParams} from "react-router-dom";
import LoadingComponent from "../components/LoadingComponent";
import PasswordField from "../components/PasswordField";
import ProgressView from "../components/ProgressView";
import {useFirebase, usePages, useStore} from "../controllers/General";
import notifySnackbar from "../controllers/notifySnackbar";
import {refreshAll} from "../controllers/Store";
import {sendVerificationEmail, useCurrentUserData} from "../controllers/UserData";
import Button from "../controls/Button/Button";
import TextField from "../controls/TextField/TextField";
import FacebookLogo from "../images/facebook-logo.svg";
import GoogleLogo from "../images/google-logo.svg";
import styles from "./styles/Signup.module.css";

const Signup = ({signup = true, additional}) => {
    const [state, setState] = React.useState({
        email: "",
        password: "",
        requesting: false,
    });
    const {email, password, requesting, requestPasswordFor} = state;
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

    return <div className={styles.center}>
        {requestPasswordFor && <div className={styles.passwordPrompt}>
            <h4>{t("User.Please create password for your account.")}</h4>
        </div>}
        {!requestPasswordFor && <div className={styles.fieldRow}>
            <div className={styles.fieldIcon}>
                <UserIcon/>
            </div>
            <div className={styles.fieldControl}>
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
            </div>
        </div>}
        <div className={styles.fieldRow}>
            <div className={styles.fieldIcon}>
                <Lock/>
            </div>
            <div className={styles.fieldControl}>
                <PasswordField
                    color={"secondary"}
                    disabled={requesting}
                    label={t("User.Password")}
                    onChange={ev => {
                        setState({...state, password: ev.target.value});
                    }}
                    value={password}
                />
            </div>
        </div>
        {additional}
        <div className={styles.buttonGroup}>
            <Button
                disabled={requesting}
                onClick={requestSignupPassword}
            >
                {t("Definitions.Sign up")}
            </Button>
            <Button
                disabled={requesting}
                onClick={() => history.goBack()}
            >
                {t("Common.Cancel")}
            </Button>
        </div>
        <div className={styles.socialActions}>
            <Button
                onClick={onRequestGoogle}
                variant={"text"}
            >
                <img src={GoogleLogo} width={20} height={20} alt={""}/>
                <span className={styles.logoSpacer}/>
                {t("Login.Sign up with")} Google
            </Button>
            <Button
                onClick={onRequestFacebook}
                variant={"text"}
            >
                <img src={FacebookLogo} width={20} height={20} alt={""}/>
                <span className={styles.logoSpacer}/>
                {t("Login.Sign up with")} Facebook
            </Button>
        </div>
    </div>
};

export default Signup;
