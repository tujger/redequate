import React from "react";
import {useTranslation} from "react-i18next";
import {connect} from "react-redux";
import {useHistory, withRouter} from "react-router-dom";
import {useAuth} from "../../packages/auth";
import LoadingComponent from "../components/LoadingComponent";
import {usePages, useStore} from "../controllers/General";
import {refreshAll} from "../controllers/Store";
import {logoutUser} from "../controllers/UserData";
import Button from "../controls/Button/Button";
import baseStyles from "../themes/Base.module.css";
import styles from "./styles/Logout.module.css";

const Logout = (props) => {
    const {immediate = true} = props;
    const history = useHistory();
    const pages = usePages();
    const store = useStore();
    const {t} = useTranslation();
    const auth = useAuth();

    const doLogout = () => {
        window.localStorage.removeItem(pages.login.route);
        logoutUser({auth, store})
            .then(() => {
                refreshAll(store);
                history.push(pages.home.route);
            });
    }

    React.useEffect(() => {
        if (immediate) {
            doLogout();
        }
    }, [])

    if (immediate) {
        return <div className={styles.immediate}>
            <LoadingComponent text={t("Login.Logging out...")}/>
        </div>;
    }
    return <div className={baseStyles.content}>
        <div className={styles.content}>
            {t("Login.Do you want to log out?")}
        </div>
        <Button
            onClick={() => {
                doLogout();
            }}
        >
            {t("Login.Logout")}
        </Button>
    </div>
};

export default connect()(withRouter(Logout));
