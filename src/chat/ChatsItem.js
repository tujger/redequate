import React from 'react';
import {useTheme, withStyles,} from "@material-ui/core";
import PropTypes from 'prop-types';
import {Link, useHistory} from "react-router-dom";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import Grid from "@material-ui/core/Grid";
import {styles} from "../components/styles";
import {makeStyles} from "@material-ui/core/styles";
import CardActionArea from "@material-ui/core/CardActionArea";
import {
    cacheDatas,
    notifySnackbar,
    toDateString,
    useCurrentUserData,
    useFirebase,
    usePages,
    UserData
} from "../controllers";
import {ChatMeta} from "./ChatMeta";
import AvatarView from "../components/AvatarView";
import ItemPlaceholderComponent from "../components/ItemPlaceholderComponent";
import LazyListComponent from "../components/LazyListComponent";
import {useDispatch} from "react-redux";

const useStylesChat = theme => makeStyles({
    cardActions: {
        bottom: 0,
        display: "flex",
        paddingBottom: theme.spacing(0),
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(0),
        paddingTop: theme.spacing(0),
        [theme.breakpoints.up("md")]: {
            justifyContent: "flex-end",
            marginTop: theme.spacing(-.5),
            position: "absolute",
            right: theme.spacing(2),
        },
        [theme.breakpoints.down("sm")]: {
            justifyContent: "space-between",
            marginTop: theme.spacing(1),
            paddingLeft: theme.spacing(0),
        },
    },
    avatar: {
        height: theme.spacing(4),
        width: theme.spacing(4),
    },
    icon: {
        [theme.breakpoints.up("md")]: {
            height: theme.spacing(2),
        },
        [theme.breakpoints.down("sm")]: {
            height: theme.spacing(2.5),
        },
    },
    content: null,
    messagebox: null,
    indent: {
        width: theme.spacing(4)
    },
    // chatItem: {
    //     borderRadius: theme.spacing(2),
    //     width: "90%"
    // },
    // chatItemOut: {
    //     backgroundColor: "#def6fc",//"#0099ff",
    //     marginLeft: "10%",
    // },
    // chatItemIn: {
    //     backgroundColor: "#f1f0f0",
    //     marginRight: "10%",
    // },
    label: {
        color: "#000000",
        fontWeight: "initial",
        textDecoration: "none",
    },
    unread: {
        color: "#000000",
        fontWeight: "bolder",
    },
    read: {
        color: "#888888",
    },
    nounderline: {
        textDecoration: "none"
    },
    presence: {
        borderRadius: theme.spacing(1),
        height: theme.spacing(.5),
        marginLeft: theme.spacing(1),
        marginRight: theme.spacing(1),
        width: theme.spacing(.5),
        [theme.breakpoints.up("md")]: {
            marginBottom: theme.spacing(.5),
        },
        [theme.breakpoints.down("sm")]: {
            height: theme.spacing(1),
            width: theme.spacing(1),
        },
    },
    offline: {
        backgroundColor: "#bbbbbb",
    },
    online: {
        backgroundColor: "#00bb00",
    },
});

function ChatsItem(props) {
    const {id, classes, skeleton, label, userComponent, textComponent} = props;
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const [state, setState] = React.useState({});
    const {shown, userData, chatMeta, online, timestamp} = state;
    const theme = useTheme();
    const classesChat = useStylesChat(theme)();

    const fetchIsNew = () => {
        const latestVisit = chatMeta.lastVisit(currentUserData.id);
        // console.log(data.created > latestVisit, data.created, latestVisit);
        // console.log(new Date(data.created).toLocaleString(), new Date(latestVisit).toLocaleString());
        return chatMeta.lastMessage.created > latestVisit;
    }

    React.useEffect(() => {
        if (skeleton || label) return;
        const chatMeta = ChatMeta(firebase).create(id);
        chatMeta.fetch()
            .then(() => {
                const uid = chatMeta.uidOtherThan(currentUserData.id);
                return cacheDatas.put(uid, UserData(firebase)).fetch(uid, [UserData.IMAGE, UserData.NAME]);
            })
            .then(userData => {
                chatMeta.watch(({removed}) => {
                    if(removed) {
                        dispatch({type: LazyListComponent.RESET, cache: "chats"});
                        history.goBack();
                    }
                    setState(state => ({...state, chatMeta}));
                });
                chatMeta.watchOnline({uid: userData.id, onChange: ({online, timestamp, removed}) => {
                    setState(state => ({...state, online, timestamp}));
                }});
                setState({...state, userData, chatMeta});
            })
            .catch(notifySnackbar)
        return () => {
            chatMeta.unwatch();
            chatMeta.unwatchOnline();
        }
        // eslint-disable-next-line
    }, []);

    if (skeleton) return <ItemPlaceholderComponent classes={classes}/>;
    if (label) return <ItemPlaceholderComponent classes={classes} label={label}/>;
    if (!chatMeta) return null;

    const isNew = fetchIsNew() && !shown;

    return <React.Fragment>
        <Card className={[
            classes.card,
        ].join(" ")}>
            <CardActionArea onClick={() => {
                history.push(pages.chat.route + userData.id);
            }}>
                <CardHeader
                    classes={{content: classes.cardContent}}
                    className={[classes.cardHeader, classes.post].join(" ")}
                    avatar={<Link
                        className={classesChat.nounderline}
                        to={pages.user.route + userData.id}
                        onClick={evt => {
                        evt.stopPropagation();
                    }}>
                        <AvatarView
                            className={classes.avatar}
                            image={userData.image}
                            initials={userData.initials}
                            verified={true}/>
                    </Link>}
                    title={<React.Fragment>
                        <Grid container alignItems={"baseline"}>
                            <Grid item className={[classes.userName, classesChat.read].join(" ")}>
                                {userComponent(userData)}
                            </Grid>
                            {/*<Hidden smDown>*/}
                                <Grid item>
                                    <div className={[classesChat.presence, online ? classesChat.online : classesChat.offline].join(" ")} title={online ? "Online" : "Offline"}/>
                                        {/*{online ? "" : "·"}*/}
                                </Grid>
                            {/*</Hidden>*/}
                            <Grid item className={classes.date} title={new Date(chatMeta.lastMessage.created).toLocaleString()}>
                                {toDateString(chatMeta.lastMessage.created)}
                            </Grid>
                        </Grid>
                    </React.Fragment>}
                    subheader={<Grid container>
                        <Grid item xs className={isNew ? classesChat.unread : classesChat.read}>
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

export default withStyles(styles)(ChatsItem);
