import React from "react";
import Grid from "@material-ui/core/Grid";
import {IconButton, withStyles} from "@material-ui/core";
import {Link, useHistory} from "react-router-dom";
import BackIcon from "@material-ui/icons/ArrowBack";
import {toDateString, usePages} from "../controllers";
import AvatarView from "../components/AvatarView";
import LazyListComponent from "../components/LazyListComponent";
import {useDispatch} from "react-redux";
import {stylesList} from "../controllers/Theme";

const stylesHeader = theme => ({
    presence: {
        borderRadius: theme.spacing(1),
        height: theme.spacing(1),
        width: theme.spacing(1),
    },
    offline: {
        backgroundColor: "#bbbbbb",
    },
    online: {
        backgroundColor: "#008800",
    },
    root: {
        alignItems: "center",
        flex: "0 0 auto",
    },
    userName: {
        color: "inherit",
        fontWeight: "bolder",
        textDecoration: "none",
    },
});

const ChatHeader = ({chatMeta, classes, id, userComponent, userData}) => {
    const history = useHistory();
    const pages = usePages();
    const [state, setState] = React.useState({});
    const {online, timestamp} = state;
    const dispatch = useDispatch();

    React.useEffect(() => {
        if (!userData || !userData.id) {
            history.goBack();
            return;
        }
        chatMeta.watch(({removed}) => {
            if (removed) {
                dispatch({type: LazyListComponent.RESET, cache: "chats"});
                history.goBack();
            }
        });
        chatMeta.watchOnline({
            uid: userData.id, onChange: ({online, timestamp, removed}) => {
                if (removed) {
                    dispatch({type: LazyListComponent.RESET, cache: "chats"});
                    history.goBack();
                }
                setState(state => ({...state, online, timestamp}));
            }
        });
        return () => {
            chatMeta.unwatchOnline();
            chatMeta.unwatch();
        }
        // eslint-disable-next-line
    }, [id]);

    return <Grid container spacing={1} className={classes.root}>
        <IconButton onClick={() => history.goBack()}>
            <BackIcon/>
        </IconButton>
        <Grid item><Link to={pages.user.route + userData.id} className={classes.nounderline}>
            <AvatarView
                className={classes.avatarSmall}
                image={userData.image}
                initials={userData.initials}
                verified={true}
            />
        </Link></Grid>
        <Grid item className={classes.userName}>
            {userComponent(userData)}
        </Grid>
        <Grid item>
            <div className={[classes.presence, online ? classes.online : classes.offline].join(" ")}
                 title={online ? "Online" : "Offline"}/>
        </Grid>
        {timestamp > 0 && <Grid item className={classes.date}>
            {toDateString(timestamp)}
        </Grid>}
    </Grid>
};

export default withStyles((theme) => ({
    ...stylesList(theme),
    ...stylesHeader(theme),
}))(ChatHeader);

