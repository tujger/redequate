import React from "react";
import PropTypes from "prop-types";
import Avatar from "@material-ui/core/Avatar";
import makeStyles from "@material-ui/styles/makeStyles";
import {currentRole, Role, UserData} from "../controllers/User";
import {useFirebase, useUserDatas} from "../controllers/General";
import {notifySnackbar} from "../controllers/Notifications";
import Skeleton from "@material-ui/lab/Skeleton";

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

function AvatarView(props) {
    const {onclick, className, image, initials, admin, verified} = props;
    const classes = useStyles();

    // const isAdmin = currentRole(user) === Role.ADMIN;
    // const isVerified = true;//user.public().emailVerified !== false;

    return <Avatar
        className={[verified ? (admin ? classes.admin : null) : classes.notVerified, classes.avatar, className || ""].join(" ")}
        onClick={onclick}
        title={verified ? (admin ? "Administrator" : null) : "Not verified"}
    >
        {image && <img src={image} alt="" className={classes.avatarImage}/>}
        {!image && initials && initials.toUpperCase()}
    </Avatar>
}

AvatarView.propTypes = {
    onclick: PropTypes.func,
    user: PropTypes.any
};

export default AvatarView;
