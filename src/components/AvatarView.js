import React from "react";
import Avatar from "@material-ui/core/Avatar";
import makeStyles from "@material-ui/styles/makeStyles";
import {useTranslation} from "react-i18next";

const useStyles = bgcolor => makeStyles(theme => ({
    bgcolor: bgcolor ? {
        backgroundColor: bgcolor,
        color: theme.palette.getContrastText(bgcolor),
    } : null,
    avatarImage: {
        height: "100%",
        objectFit: "cover",
        width: "100%"
    },
    admin: {
        borderWidth: 2,
        borderColor: "#00ff00",
        borderStyle: "solid",
    },
    notVerified: {
        borderWidth: 2,
        borderColor: "#ffff00",
        borderStyle: "solid",
    }
}));

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
    const classes = useStyles(bgcolor)();
    const {t} = useTranslation();

    return <Avatar
        className={[verified ? (admin ? classes.admin : null) : classes.notVerified, classes.bgcolor, classes.avatar, className || ""].join(" ")}
        onClick={onclick}
        title={verified ? (admin ? t("User.Administrator") : null) : t("User.Not verified")}
    >
        {image && <img src={image} alt={t("User.Avatar")} className={classes.avatarImage}/>}
        {!image && icon}
        {!image && !icon && initials && initials.substr(0, 2).toUpperCase()}
    </Avatar>
}

export default AvatarView;
