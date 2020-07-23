import React from "react";
import Grid from "@material-ui/core/Grid";
import {IconButton, withStyles} from "@material-ui/core";
import {Link, useHistory} from "react-router-dom";
import BackIcon from "@material-ui/icons/ArrowBack";
import {usePages} from "../controllers";
import AvatarView from "../components/AvatarView";

const styles = theme => ({
    avatar: {
        height: theme.spacing(4),
        marginRight: theme.spacing(1),
        width: theme.spacing(4),
    },
    nounderline: {
        textDecoration: "none"
    },
    presence: {
        borderRadius: theme.spacing(1),
        height: theme.spacing(1),
        marginLeft: theme.spacing(1),
        marginRight: theme.spacing(1),
        width: theme.spacing(1),
    },
    offline: {
        backgroundColor: "#bbbbbb",
    },
    online: {
        backgroundColor: "#008800",
    },
    userName: {
        color: "inherit",
        fontWeight: "bolder",
        textDecoration: "none",
    },
    visitDate: {
        color: "#888888",
        fontSize: "smaller",
    },
});

const ChatHeader = ({chatMeta, classes, id, userComponent, userData}) => {
    const history = useHistory();
    const pages = usePages();
    const [state, setState] = React.useState({});
    const {online, timestamp} = state;

    React.useEffect(() => {
        chatMeta.watchOnline({uid: userData.id, onChange: ({online, timestamp}) => {
            setState(state => ({...state, online, timestamp}));
        }});
        return () => {
            chatMeta.unwatchOnline();
        }
        // eslint-disable-next-line
    }, [id]);

    return <Grid container alignItems={"center"}>
            <IconButton onClick={() => history.goBack()}>
                <BackIcon/>
            </IconButton>
            <Grid item><Link to={pages.user.route + userData.id} className={classes.nounderline}>
                <AvatarView
                    className={classes.avatar}
                    image={userData.image}
                    initials={userData.initials}
                    verified={true}
                /></Link></Grid>
            <Grid item className={classes.userName}>
                {userComponent(userData)}
            </Grid>
            <Grid item>
                <div className={[classes.presence, online ? classes.online : classes.offline].join(" ")} title={online ? "Online" : "Offline"}/>
            </Grid>
            {timestamp > 0 && <Grid
                item className={classes.visitDate}>
                {new Date(timestamp).toLocaleString()}
            </Grid>}
        </Grid>
};

export default withStyles(styles)(ChatHeader);
