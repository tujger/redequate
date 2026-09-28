import UserIcon from "@material-ui/icons/Mail";
import React from "react";
import {useTranslation} from "react-i18next";
import FacebookLogo from "../images/facebook-logo.svg";
import GoogleLogo from "../images/google-logo.svg"
import AvatarView from "./AvatarView";
import styles from "./styles/ProfileComponent.module.css";

const ProfileComponent = (props) => {
    const {userData, publicFields, provider = true} = props;
    const {t} = useTranslation();

    return <div className={styles.profile}>
        {userData.image && <div className={styles.profileFieldImage}>
            <AvatarView
                className={styles.profileImage}
                image={userData.image}
                initials={userData.initials}
                verified={userData.verified}/>
        </div>}
        <div className={styles.profileFields}>
            {publicFields && publicFields.map(field => {
                if (!userData.public[field.id] && !field.viewComponent) return null;
                return <div className={styles.profileField} key={field.id}>
                    {field.viewComponent
                        ? field.viewComponent(userData)
                        : <div className={styles.bodyText}>{userData.public[field.id]}</div>}
                </div>
            })}
        </div>
        {provider && <div className={styles.signedWith}>
            {userData.public.provider && userData.public.provider === "google.com" && <>
                <img className={styles.providerLogo} src={GoogleLogo} width={40} height={40} alt={""}/>
                <div className={styles.bodyText}>{t("User.Signed with {{provider}}", {provider: "Google"})}</div>
            </>}
            {userData.public.provider && userData.public.provider === "facebook.com" && <>
                <img className={styles.providerLogo} src={FacebookLogo} width={40} height={40} alt={""}/>
                <div className={styles.bodyText}>{t("User.Signed with {{provider}}", {provider: "Facebook"})}</div>
            </>}
            {userData.public.provider && userData.public.provider === "password" && <>
                <UserIcon className={styles.providerLogo}/>
                <div className={styles.bodyText}>{t("User.Signed with {{provider}}", {provider: "e-mail"})}</div>
                {!userData.verified && <div className={styles.bodyText}>Not verified</div>}
            </>}
            {userData.public.provider && userData.public.provider !== "password" && userData.public.provider !== "google.com" && userData.public.provider !== "facebook.com" &&
                <>
                    <div
                        className={styles.bodyText}>{t("User.Signed with {{provider}}", {provider: userData.public.provider})}</div>
                    {!userData.verified && <div className={styles.bodyText}>{t("User.Not verified")}</div>}
                </>}
        </div>}
    </div>
};

export default ProfileComponent;
