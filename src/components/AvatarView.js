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
    const {onclick, user: givenUser, userData: givenUserData, uid: givenUid, className} = props;
    const [state, setState] = React.useState({user: givenUser, uid: givenUid, userData: givenUserData});
    const {user, userData, uid} = state;
    const classes = useStyles();
    const firebase = useFirebase();
    const userDatas = useUserDatas();

    React.useEffect(() => {
        if(!userData && uid) {
            (userDatas[uid] = userDatas[uid] || new UserData(firebase)).fetch(uid, [UserData.IMAGE]).then(userData => {
                setState(state => ({...state, userData}));
            }).catch(notifySnackbar);
        }
    }, []);

    if (!user && !userData) return <Skeleton animation={false} variant="circle"
                                             className={className}/>

    const isAdmin = currentRole(user) === Role.ADMIN;
    const isVerified = true;//user.public().emailVerified !== false;

    if (userData) return <Avatar
        className={[isVerified ? (isAdmin ? classes.admin : null) : classes.notVerified, classes.avatar, className || ""].join(" ")}
        onClick={onclick}
        title={isVerified ? (isAdmin ? "Administrator" : null) : "Not verified"}
    >
        {userData.public.image && <img src={userData.public.image} alt="" className={classes.avatarImage}/>}
        {!userData.public.image && userData.public.initials}
    </Avatar>

    return <Avatar
        className={[isVerified ? (isAdmin ? classes.admin : null) : classes.notVerified, className || ""].join(" ")}
        onClick={onclick}
        title={isVerified ? (isAdmin ? "Administrator" : null) : "Not verified"}
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
