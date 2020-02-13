import React from 'react';
import PropTypes from "prop-types";
import {Avatar, makeStyles} from "@material-ui/core";
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
    const {onclick, user} = props;
    const classes = useStyles();

    if (!user) return <div/>;
    const isAdmin = currentRole(user) === Role.ADMIN;
    const isVerified = user.emailVerified !== false;

    return <Avatar
        className={isVerified ? (isAdmin ? classes.admin : null) : classes.notVerified}
        onClick={onclick}
        title={isVerified ? (isAdmin ? "Administrator": null) : "Not verified"}
    >
        {user.image && <img src={user.image} alt="" className={classes.avatarImage}/>}
        {!user.image && user.name && user.name.substr(0, 1).toUpperCase()}
        {!user.image && !user.name && user.email && user.email.substr(0, 1).toUpperCase()}
    </Avatar>
}

AvatarView.propTypes = {
    onclick: PropTypes.func,
    user: PropTypes.any
};

export default AvatarView;
