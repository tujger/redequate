import {Avatar} from "@mui/material";
import React from "react";
import {useTranslation} from "react-i18next";
import styles from "./styles/AvatarView.module.css";

const calculateBgColor = (image, initials) => {
    if (image || !initials) return null;
    let hash = 0
    for (let i = 0; i < initials.length; i++) {
        hash = initials.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    const rgb = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
        rgb[i] = (hash >> (i * 8)) & 255;
    }
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

const AvatarView = ({admin, className, image, icon, initials, onclick, verified}) => {
    const bgcolor = calculateBgColor(image, initials);
    const {t} = useTranslation();

    return <Avatar
        className={[verified ? (admin ? styles.admin : null) : styles.notVerified, styles.bgcolor, styles.avatar, className || ""].join(" ")}
        onClick={onclick}
        title={verified ? (admin ? t("User.Administrator") : null) : t("User.Not verified")}
    >
        {image && <img src={image} alt={t("User.Avatar")} className={styles.avatarImage}/>}
        {!image && icon}
        {!image && !icon && initials && initials.substr(0, 2).toUpperCase()}
    </Avatar>
}

export default AvatarView;
