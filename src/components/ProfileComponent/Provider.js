import UserIcon from "@mui/icons-material/Mail";
import React from "react";
import {useTranslation} from "react-i18next";
import FacebookLogo from "../../images/facebook-logo.svg";
import GoogleLogo from "../../images/google-logo.svg";
import styles from "./styles/ProfileComponent.module.css";

export default ({userData}) => {
    const provider = userData.public.provider;
    const {t} = useTranslation();

    if (!provider) return null;
    if (provider === "google.com") {
        return <div className={styles.signedWith}>
            <img className={styles.providerLogo} src={GoogleLogo} width={40} height={40} alt={""}/>
            <div className={styles.bodyText}>{t("User.Signed with {{provider}}", {provider: "Google"})}</div>
        </div>
    }
    if (provider === "facebook.com") {
        return <div className={styles.signedWith}>
            <img className={styles.providerLogo} src={FacebookLogo} width={40} height={40} alt={""}/>
            <div className={styles.bodyText}>{t("User.Signed with {{provider}}", {provider: "Facebook"})}</div>
        </div>
    }
    if (provider === "password") {
        return <div className={styles.signedWith}>
            <UserIcon className={styles.providerLogo}/>
            <div className={styles.bodyText}>{t("User.Signed with {{provider}}", {provider: "e-mail"})}</div>
            {!userData.verified && <div className={styles.bodyText}>Not verified</div>}
        </div>
    }
    return <div className={styles.signedWith}>
        <div
            className={styles.bodyText}>{t("User.Signed with {{provider}}", {provider: userData.public.provider})}</div>
        {!userData.verified && <div className={styles.bodyText}>{t("User.Not verified")}</div>}
    </div>
}
