import UserIcon from "@mui/icons-material/Mail";
import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {Redirect, useHistory} from "react-router-dom";
import {useAuth} from "../../auth";
import ProgressView from "../components/ProgressView";
import {usePages} from "../controllers/General";
import notifySnackbar from "../controllers/notifySnackbar";
import {useCurrentUserData} from "../controllers/UserData";
import Button from "../controls/Button/Button";
import TextField from "../controls/TextField/TextField";
import baseStyles from "../themes/Base.module.css";
import styles from "./styles/RestorePassword.module.css";

const RestorePassword = () => {
    const [state, setState] = React.useState({
        email: "",
        requesting: false
    });
    const {email, requesting} = state;
    const pages = usePages();
    const dispatch = useDispatch();
    const history = useHistory();
    const currentUserData = useCurrentUserData();
    const {t} = useTranslation();
    const auth = useAuth();

    const requestRestorePassword = () => {
        dispatch(ProgressView.SHOW);
        setState({...state, requesting: true});
        auth.sendPasswordResetEmail(email)
            .then(() => {
                notifySnackbar(t("User.Instructions have been sent to e-mail."));
                history.push(pages.login.route);
            }).catch(error => {
                notifySnackbar(error);
            }).finally(() => {
                dispatch(ProgressView.HIDE);
                setState({...state, requesting: false});
            });
    };

    if (currentUserData && currentUserData.id) {
        return <Redirect to={pages.profile.route}/>
    }

    return <div className={baseStyles.content}>
        <div className={styles.fieldRow}>
            <div className={styles.fieldIcon}>
                <UserIcon/>
            </div>
            <div className={styles.fieldControl}>
                <TextField
                    color={"secondary"}
                    disabled={requesting}
                    label={t("User.E-mail")}
                    fullWidth
                    onChange={ev => setState({...state, email: ev.target.value})}
                    value={email}
                />
            </div>
        </div>
        <div className={styles.buttonGroup}>
            <Button
                fullWidth
                onClick={requestRestorePassword}
                title={t("User.Restore password")}
            >
                {t("User.Restore")}
            </Button>
            <Button
                fullWidth
                onClick={() => history.push(pages.login.route)}
                title={t("Common.Cancel")}
            >
                {t("Common.Cancel")}
            </Button>
        </div>
    </div>
};

export default RestorePassword;
