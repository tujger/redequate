import React from "react";
import Grid from "@material-ui/core/Grid";
import withStyles from "@material-ui/styles/withStyles";
import IconButton from "@material-ui/core/IconButton";
import {Link, useHistory} from "react-router-dom";
import {notifySnackbar, toDateString, useCurrentUserData, usePages} from "../controllers";
import AvatarView from "../components/AvatarView";
import {useDispatch} from "react-redux";
import {stylesList} from "../controllers/Theme";
import NavigationToolbar from "../components/NavigationToolbar";
import ClearIcon from "@material-ui/icons/Clear";
import ConfirmComponent from "../components/ConfirmComponent";
import ProgressView from "../components/ProgressView";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import {useTranslation} from "react-i18next";

const stylesCurrent = theme => ({
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
});

const ChatHeader = ({chatMeta, classes, className, id, userComponent, userData}) => {
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const history = useHistory();
    const pages = usePages();
    const [state, setState] = React.useState({});
    const {online, timestamp, deleteOpen} = state;
    const {t} = useTranslation();

    const handleConfirmDeletion = evt => {
        dispatch(ProgressView.SHOW);
        console.log(chatMeta.toString());
        chatMeta.removeUid(currentUserData.id)
            .then(() => history.goBack())
            .catch(notifySnackbar)
            .finally(() => {
                dispatch(ProgressView.HIDE);
                setState({...state, deleteOpen: false});
            })
    }

    React.useEffect(() => {
        let isMounted = true;
        if (!userData || !userData.id) {
            history.goBack();
            return;
        }
        // chatMeta.watch(({removed}) => {
        //     if (removed) {
        //         dispatch({type: lazyListComponentReducer.RESET, cache: "chats"});
        //         history.goBack();
        //     }
        // });
        chatMeta.watchOnline({
            uid: userData.id,
            onChange: ({online, timestamp, removed}) => {
                if (removed) {
                    dispatch({type: lazyListComponentReducer.RESET, cache: "chats"});
                    history.goBack();
                }
                isMounted && setState(state => ({...state, online, timestamp}));
            }
        });
        return () => {
            isMounted = false;
            chatMeta.unwatchOnline();
            // chatMeta.unwatch();
        }
        // eslint-disable-next-line
    }, [id]);

    return <>
        <NavigationToolbar
            className={className}
            rightButton={<IconButton onClick={() => setState({...state, deleteOpen: true})}>
                <ClearIcon/>
            </IconButton>}
        >
            <Grid container spacing={1} className={classes.root}>
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
                    <div
                        className={[classes.presence, online ? classes.online : classes.offline].join(" ")}
                        title={online ? t("Chat.Online") : t("Chat.Offline")}
                    />
                </Grid>
                {timestamp > 0 && <Grid item className={classes.date}>
                    {toDateString(timestamp)}
                </Grid>}
                {chatMeta.readonly && <Grid
                    item className={classes.date}
                    title={`${userData.name} has removed this chat at his side, so you can not chat here anymore`}
                >
                    Read-only
                </Grid>}
            </Grid>
        </NavigationToolbar>
        {deleteOpen && <ConfirmComponent
            children={t("Chat.Chat will be deleted for you.")}
            confirmLabel={t("Chat.Delete chat")}
            critical
            onCancel={() => setState({...state, deleteOpen: false})}
            onConfirm={handleConfirmDeletion}
            title={t("Chat.Delete chat")}
        />}
    </>
};

export default withStyles((theme) => ({
    ...stylesList(theme),
    ...stylesCurrent(theme),
}))(ChatHeader);
