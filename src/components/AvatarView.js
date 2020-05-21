import React from "react";
import PropTypes from "prop-types";
import Avatar from "@material-ui/core/Avatar";
import makeStyles from "@material-ui/styles/makeStyles";
import {currentRole, Role} from "../controllers/User";

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
    const {onclick, user, className} = props;
    const classes = useStyles();

    if (!user) return <div/>;
    const isAdmin = currentRole(user) === Role.ADMIN;
    const isVerified = user.public().emailVerified !== false;

    return <Avatar
        className={[isVerified ? (isAdmin ? classes.admin : null) : classes.notVerified, className || ""].join(" ")}
        onClick={onclick}
        title={isVerified ? (isAdmin ? "Administrator": null) : "Not verified"}
    >
        {user.public().image && <img src={user.public().image} alt="" className={classes.avatarImage}/>}
        {!user.public().image && user.public().name && user.public().name.substr(0, 1).toUpperCase()}
        {!user.public().image && !user.public().name && user.public().email && user.public().email.substr(0, 1).toUpperCase()}
    </Avatar>
}

AvatarView.propTypes = {
    onclick: PropTypes.func,
    user: PropTypes.any
};

export default AvatarView;
