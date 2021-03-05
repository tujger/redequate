import React from "react";
import PropTypes from "prop-types";
import AppBar from "@material-ui/core/AppBar";
import Button from "@material-ui/core/Button";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import withStyles from "@material-ui/styles/withStyles";
import BackIcon from "@material-ui/icons/ChevronLeft";
import {Link, useHistory, useLocation, withRouter} from "react-router-dom";
import AvatarView from "../../components/AvatarView";
import ProgressView from "../../components/ProgressView";
import {
    currentRole,
    matchRole,
    needAuth,
    Role,
    useCurrentUserData
} from "../../controllers/UserData";
import {usePages} from "../../controllers/General";

const stylesCurrent = theme => ({
    appbar: {
        // backgroundColor: theme.palette.background.default,
        // color: theme.palette.getContrastText(theme.palette.background.default),
    },
    back: {
        color: theme.palette.secondary.main,
        paddingLeft: 0,
        paddingRight: 0,
        zIndex: 1
    },
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    },
    title: {
        flex: "1 1 auto",
        fontWeight: "bold",
        left: 0,
        position: "absolute",
        textAlign: "center",
        width: "100%"
    },
    avatar: {
        height: theme.spacing(4),
        width: theme.spacing(4),
    },
    avatarContainer: {
        position: "absolute",
        right: theme.spacing(1),
    },
    toolbar: {
        height: theme.spacing(5),
        minHeight: theme.spacing(5),
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
    },
    content: null,
    indent: null,
});

function Titlebar(props) {
    const {classes, className} = props;
    const pages = usePages();
    const location = useLocation();
    const history = useHistory();
    const currentUserData = useCurrentUserData();

    const itemsFlat = Object.keys(pages).map(item => pages[item]);

    const label = itemsFlat.filter(item => item.route === location.pathname).map((item, index) => {
        return needAuth(item.roles, currentUserData)
            ? pages.login.title || pages.login.label
            : (matchRole(item.roles, currentUserData)
                ? item.title || item.label : pages.notfound.title || pages.notfound.label)
    }).filter(item => !!item)[0];

    return <AppBar position={"fixed"} className={[classes.appbar, className || ""].join(" ")}>
        <Toolbar className={classes.toolbar}>
            {location.pathname !== pages.home.route ?
                <Button
                    className={classes.back}
                    color={"inherit"}
                    aria-label={"go back"}
                    edge={"start"}
                    onClick={() => {
                        history.goBack();
                    }}>
                    <BackIcon/>
                    Back
                </Button> : null}
            <Typography variant={"h6"} noWrap className={classes.title}>
                {label}
            </Typography>
            {currentUserData.id &&
            <Link to={pages.profile.route} className={[classes.label, classes.avatarContainer].join(" ")}>
                <AvatarView
                    admin={currentRole(currentUserData) === Role.ADMIN}
                    className={classes.avatar}
                    image={currentUserData.image}
                    initials={currentUserData.initials}
                    verified={currentUserData.verified}/>
            </Link>}
        </Toolbar>
        <ProgressView/>
    </AppBar>
}

Titlebar.propTypes = {
    title: PropTypes.string,
};

export default withRouter(withStyles(theme => ({
    ...stylesCurrent(theme),
    // ...styles(theme),
}))(Titlebar));
