import Lock from "@mui/icons-material/Lock";
import UserIcon from "@mui/icons-material/Mail";
import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {Redirect, useHistory, useParams} from "react-router-dom";
import {useAuth} from "../../auth";
import LoadingComponent from "../components/LoadingComponent";
import PasswordField from "../components/PasswordField";
import ProgressView from "../components/ProgressView";
import {usePages, useStore} from "../controllers/General";
import notifySnackbar from "../controllers/notifySnackbar";
import {refreshAll} from "../controllers/Store";
import {useCurrentUserData} from "../controllers/UserData";
import Button from "../controls/Button/Button";
import TextField from "../controls/TextField/TextField";
import FacebookLogo from "../images/facebook-logo.svg";
import GoogleLogo from "../images/google-logo.svg";
import baseStyles from "../themes/Base.module.css";
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
    const history = useHistory();
    const currentUserData = useCurrentUserData();
    const params = useParams();
    const {t} = useTranslation();
    const auth = useAuth();
    const [component, setComponent] = React.useState(() => <LoadingComponent/>);

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
            auth.updatePassword(password)
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
            auth.createUserWithEmailAndPassword(email, password)
                .then(signupVerification)
                .catch(signupError)
                .finally(() => dispatch(ProgressView.HIDE));
        }
    };

    const signupVerification = response => {
        return auth.sendEmailVerification()
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

    React.useEffect(() => {
        if (!signup) {
            setComponent(() => <Redirect to={pages.home.route}/>);
        } else {
            auth.checkSignInWithEmailLink().then(checked => {
                if (checked && !requestPasswordFor) {
                    let email = params.email;
                    dispatch(ProgressView.SHOW);
                    console.log("[Signup] with link for", email)
                    if (!email) {
                        email = window.prompt(t("User.Please provide your e-mail for confirmation"));
                        if (!email) {
                            setComponent(() => <Redirect to={pages.home.route}/>);
                            return;
                        }
                    }
                    auth.signInWithEmailLink(email)
                        .then(() => setState({...state, requestPasswordFor: email}))
                        .catch(signupError)
                        .finally(() => dispatch(ProgressView.HIDE));

                    setComponent(() => <LoadingComponent/>)
                } else if (currentUserData.id) {
                    setComponent(() => <Redirect to={pages.profile.route}/>)
                } else {
                    setComponent(undefined);
                }
            })
        }
    }, [params.email, requestPasswordFor, signup]);

    if (component) {
        return component;
    }

    return <div className={baseStyles.content}>
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
