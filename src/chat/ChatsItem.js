import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import {Link, useHistory} from "react-router-dom";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import Grid from "@material-ui/core/Grid";
import CardActionArea from "@material-ui/core/CardActionArea";
import {cacheDatas, usePages} from "../controllers/General";
import {useCurrentUserData, UserData} from "../controllers/UserData";
import {ChatMeta} from "./ChatMeta";
import AvatarView from "../components/AvatarView";
import ItemPlaceholderComponent from "../components/ItemPlaceholderComponent";
import {useDispatch} from "react-redux";
import {stylesList} from "../controllers/Theme";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import {useTranslation} from "react-i18next";

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
            height: theme.spacing(0.5),
            marginBottom: theme.spacing(0.5),
            width: theme.spacing(0.5),
        },
        [theme.breakpoints.down("sm")]: {
            height: theme.spacing(1),
            width: theme.spacing(1),
        },
    },
});

function ChatsItem(props) {
    // eslint-disable-next-line react/prop-types
    const {id, classes, skeleton, label, onClick, userComponent, textComponent} = props;
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const history = useHistory();
    const pages = usePages();
    const [state, setState] = React.useState({});
    const {shown, userData, chatMeta, online, removed} = state;
    const {t} = useTranslation();

    const fetchIsNew = () => {
        const latestVisit = chatMeta.lastVisit(currentUserData.id);
        // console.log(data.created > latestVisit, data.created, latestVisit);
        // console.log(new Date(data.created).toLocaleString(), new Date(latestVisit).toLocaleString());
        return chatMeta.lastMessage.created > latestVisit;
    }

    React.useEffect(() => {
        if (skeleton || label) return;
        let isMounted = true;
        const chatMeta = ChatMeta();
        chatMeta.getOrCreateFor(currentUserData.id, id)
            .then(() => chatMeta.fetch())
            .then(() => {
                const uid = chatMeta.uidOtherThan(currentUserData.id);
                return cacheDatas.put(uid, UserData()).fetch(uid, [UserData.IMAGE, UserData.NAME]);
            })
            .then(userData => {
                chatMeta.watch(({removed}) => {
                    if (removed) {
                        dispatch({type: lazyListComponentReducer.RESET, cache: "chats"});
                        history.goBack();
                    }
                    isMounted && setState(state => ({...state, chatMeta}));
                });
                chatMeta.watchOnline({
                    uid: userData.id,
                    onChange: ({online, timestamp}) => {
                        isMounted && setState(state => ({...state, online, timestamp}));
                    }
                });
                isMounted && setState({...state, userData, chatMeta});
            })
            .catch(error => {
                console.error(error)
                isMounted && setState({...state, removed: true})
            });

        return () => {
            chatMeta.unwatch();
            chatMeta.unwatchOnline();
            isMounted = false;
        }
        // eslint-disable-next-line
    }, []);

    if (removed) return null;
    if (label) return <ItemPlaceholderComponent label={label} pattern={"flat"}/>;
    if (skeleton || !chatMeta || !userData) return <ItemPlaceholderComponent skeleton pattern={"flat"}/>;

    const isNew = fetchIsNew() && !shown;

    return <Card className={[classes.card, classes.cardFlat].join(" ")}>
        <CardActionArea
            className={classes.root}
            onClick={(event) => {
            event.stopPropagation();
            onClick ? onClick(chatMeta.id) : history.push(pages.chat.route + chatMeta.id);
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
                    <Grid item className={[classes.userName, isNew ? classes.unread : classes.read].join(" ")}>
                        {userComponent(userData)}
                    </Grid>
                    <Grid item>
                        <div
                            className={[classes.presence, online ? classes.online : classes.offline].join(" ")}
                            title={online ? t("Chat.Online") : t("Chat.Offline")}/>
                    </Grid>
                    {/*<Grid
                        className={classes.date}
                        item
                        title={new Date(chatMeta.lastMessage.created).toLocaleString()}
                    >
                        {toDateString(chatMeta.lastMessage.created)}
                    </Grid>
                    {chatMeta.readonly && <Grid item className={classes.date}>
                        Read-only
                    </Grid>}*/}
                </Grid>}
                subheader={<Grid container>
                    <Grid item xs className={isNew ? classes.unread : classes.read}>
                        {textComponent((cacheDatas.get(chatMeta.lastMessage.uid) || {}).name
                            + ": " + chatMeta.lastMessage.text)}
                    </Grid>
                </Grid>}
            />
        </CardActionArea>
    </Card>
}

export default withStyles((theme) => ({
    ...stylesList(theme),
    ...stylesChat(theme),
}))(ChatsItem);
