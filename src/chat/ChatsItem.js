import React from 'react';
import {useTheme, withStyles,} from "@material-ui/core";
import PropTypes from 'prop-types';
import {Link, useHistory} from "react-router-dom";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import Grid from "@material-ui/core/Grid";
import CardActionArea from "@material-ui/core/CardActionArea";
import {
    cacheDatas,
    notifySnackbar, Role,
    toDateString,
    useCurrentUserData,
    useFirebase,
    usePages,
    UserData
} from "../controllers";
import {ChatMeta} from "./ChatMeta";
import AvatarView from "../components/AvatarView";
import ItemPlaceholderComponent from "../components/ItemPlaceholderComponent";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import {useDispatch} from "react-redux";
import {stylesList} from "../controllers/Theme";

const stylesChat = theme => ({
    offline: {
        backgroundColor: "#bbbbbb",
    },
    online: {
        backgroundColor: "#00bb00",
    },
    presence: {
        borderRadius: theme.spacing(1),
        marginLeft: theme.spacing(1),
        marginRight: theme.spacing(1),
        [theme.breakpoints.up("md")]: {
            height: theme.spacing(.5),
            marginBottom: theme.spacing(.5),
            width: theme.spacing(.5),
        },
        [theme.breakpoints.down("sm")]: {
            height: theme.spacing(1),
            width: theme.spacing(1),
        },
    },
});

function ChatsItem(props) {
    const {id, classes, skeleton, label, userComponent, textComponent} = props;
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const theme = useTheme();
    const [state, setState] = React.useState({});
    const {shown, userData, chatMeta, online, timestamp} = state;

    const fetchIsNew = () => {
        const latestVisit = chatMeta.lastVisit(currentUserData.id);
        // console.log(data.created > latestVisit, data.created, latestVisit);
        // console.log(new Date(data.created).toLocaleString(), new Date(latestVisit).toLocaleString());
        return chatMeta.lastMessage.created > latestVisit;
    }

    React.useEffect(() => {
        if (skeleton || label) return;
        let isMounted = true;
        const chatMeta = ChatMeta(firebase);
        chatMeta.getOrCreateFor(currentUserData.id, id)
            .then(() => chatMeta.fetch())
            .then(() => {
                const uid = chatMeta.uidOtherThan(currentUserData.id);
                return cacheDatas.put(uid, UserData(firebase)).fetch(uid, [UserData.IMAGE, UserData.NAME]);
            })
            .then(userData => {
                chatMeta.watch(({removed}) => {
                    if (removed) {
                        dispatch({type: LazyListComponent.RESET, cache: "chats"});
                        history.goBack();
                    }
                    isMounted && setState(state => ({...state, chatMeta}));
                });
                chatMeta.watchOnline({
                    uid: userData.id, onChange: ({online, timestamp}) => {
                        isMounted && setState(state => ({...state, online, timestamp}));
                    }
                });
                isMounted && setState({...state, userData, chatMeta});
            })
            .catch(notifySnackbar)
        return () => {
            chatMeta.unwatch();
            chatMeta.unwatchOnline();
            isMounted = false;
        }
        // eslint-disable-next-line
    }, []);

    if (label) return <ItemPlaceholderComponent label={label}/>;
    if (skeleton || !chatMeta || !userData) return <ItemPlaceholderComponent/>;

    const isNew = fetchIsNew() && !shown;

    return <React.Fragment>
        <Card className={[
            classes.card,
        ].join(" ")}>
            <CardActionArea onClick={(event) => {
                event.stopPropagation();
                history.push(pages.chat.route + chatMeta.id);
            }}>
                <CardHeader
                    avatar={<Link
                        className={classes.nounderline}
                        onClick={evt => evt.stopPropagation()}
                        to={pages.user.route + userData.id}
                    >
                        <AvatarView
                            className={classes.avatar}
                            image={userData.image}
                            initials={userData.initials}
                            verified={true}/>
                    </Link>}
                    classes={{content: classes.cardContent}}
                    className={[classes.cardHeader, classes.post].join(" ")}
                    title={<Grid container alignItems={"baseline"}>
                        <Grid item className={[classes.userName, classes.read].join(" ")}>
                            {userComponent(userData)}
                        </Grid>
                        <Grid item>
                            <div
                                className={[classes.presence, online ? classes.online : classes.offline].join(" ")}
                                title={online ? "Online" : "Offline"}/>
                        </Grid>
                        <Grid
                            className={classes.date}
                            item
                            title={new Date(chatMeta.lastMessage.created).toLocaleString()}
                        >
                            {toDateString(chatMeta.lastMessage.created)}
                        </Grid>
                        {chatMeta.readonly && <Grid item className={classes.date}>
                            Read-only
                        </Grid>}
                    </Grid>}
                    subheader={<Grid container>
                        <Grid item xs
                              className={isNew ? classes.unread : classes.read}>
                            {textComponent((cacheDatas.get(chatMeta.lastMessage.uid) || {}).name
                                + ": " + chatMeta.lastMessage.text)}
                        </Grid>
                    </Grid>}
                />
            </CardActionArea>
        </Card>
    </React.Fragment>
}

ChatsItem.propTypes = {
    onSwipe: PropTypes.func
};

export default withStyles((theme) => ({
    ...stylesList(theme),
    ...stylesChat(theme),
}))(ChatsItem);
