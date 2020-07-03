import React from "react";
import Avatar from "@material-ui/core/Avatar";
import makeStyles from "@material-ui/styles/makeStyles";

const useStyles = makeStyles(theme => ({
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

function AvatarView({admin, className, image, initials, onclick, verified}) {
    const classes = useStyles();

    return <Avatar
        className={[verified ? (admin ? classes.admin : null) : classes.notVerified, classes.avatar, className || ""].join(" ")}
        onClick={onclick}
        title={verified ? (admin ? "Administrator" : null) : "Not verified"}
    >
        {image && <img src={image} alt="" className={classes.avatarImage}/>}
        {!image && initials && initials.toUpperCase()}
    </Avatar>
}

export default AvatarView;
