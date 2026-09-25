import React from "react";
import {useTranslation} from "react-i18next";
import classes from "./styles/AvatarView.module.css";

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

const getContrastText = bgcolor => {
    const matches = bgcolor && bgcolor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!matches) return "#fff";

    const values = matches.slice(1).map(value => Number(value) / 255).map(value => (
        value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
    ));
    const luminance = 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
    const contrastWithDark = (luminance + 0.05) / 0.05;

    return contrastWithDark >= 3 ? "rgba(0, 0, 0, 0.87)" : "#fff";
}

const AvatarView = ({admin, className, image, icon, initials, onclick, verified}) => {
    const bgcolor = calculateBgColor(image, initials);
    const {t} = useTranslation();
    const statusClass = verified ? (admin ? classes.admin : "") : classes.notVerified;
    const classNames = [classes.avatar, statusClass, className || ""].filter(Boolean).join(" ");
    const style = bgcolor ? {
        "--avatar-background-color": bgcolor,
        "--avatar-text-color": getContrastText(bgcolor),
    } : undefined;

    return <div
        className={classNames}
        style={style}
        onClick={onclick}
        title={verified ? (admin ? t("User.Administrator") : null) : t("User.Not verified")}
    >
        {image && <img src={image} alt={t("User.Avatar")} className={classes.avatarImage}/>}
        {!image && icon}
        {!image && !icon && initials && initials.substr(0, 2).toUpperCase()}
    </div>
}

export default AvatarView;
