import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import {InView} from "react-intersection-observer";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import Grid from "@material-ui/core/Grid";
import {cacheDatas, toDateString, useCurrentUserData, useFirebase, UserData} from "../controllers";
import AvatarView from "../components/AvatarView";
import ItemPlaceholderComponent from "../components/ItemPlaceholderComponent";
import {stylesList} from "../controllers/Theme";

const stylesChat = theme => ({
    avatarChat: {
        height: theme.spacing(3),
        width: theme.spacing(3),
    },
    chatItem: {
        borderRadius: theme.spacing(2),
        width: "90%"
    },
    chatItemOut: {
        backgroundColor: "#def6fc",
        marginLeft: "10%",
    },
    chatItemIn: {
        backgroundColor: "#f1f0f0",
        marginRight: "10%",
    },
    text: {
        color: "#101010",
        marginBottom: theme.spacing(1),
    },
    timestamp: {
        bottom: theme.spacing(0.5),
        color: "#888888",
        fontSize: theme.spacing(1.25),
        position: "absolute",
        right: theme.spacing(1),
    },
});

const ChatItem = React.forwardRef((props, ref) => {
    // eslint-disable-next-line react/prop-types
    const {data, chatMeta = {}, classes, skeleton, textComponent} = props;
    const currentUserData = useCurrentUserData();
    const firebase = useFirebase();
    const [state, setState] = React.useState({});
    const {shown, authorData} = state;

    const fetchIsNew = () => {
        const latestVisit = chatMeta[currentUserData.id + "_visit"] || 0;
        // const latestIncoming = meta[currentUserData.id] || 0;
        return data.created > latestVisit;
    }

    React.useEffect(() => {
        if (skeleton) return;
        let isMounted = true;
        let authorData = cacheDatas.put(data.uid, UserData(firebase));
        authorData.fetch(data.uid, [UserData.IMAGE, UserData.NAME])
            .then(() => isMounted && setState({...state, authorData}))

        // setTimeout(() => {
        //     setState(state => ({...state, shown: true}));
        // }, 2000)
        return () => {
            isMounted = false;
        }
        // eslint-disable-next-line
    }, []);

    if (skeleton) return <ItemPlaceholderComponent classes={{avatar: classes.avatarChat}}/>;

    // const isNew = fetchIsNew() && !shown;
    const isItemOut = currentUserData.id === data.uid;

    if (!authorData) return null;
    return <Card ref={ref} className={[
        classes.root,
        classes.card,
        classes.chatItem,
        isItemOut ? classes.chatItemOut : classes.chatItemIn
    ].join(" ")}>
        <CardHeader
            classes={{content: classes.cardContent}}
            className={[classes.cardHeader, classes.post].join(" ")}
            avatar={<AvatarView
                className={[classes.avatar, classes.avatarChat].join(" ")}
                image={authorData.image}
                initials={authorData.initials}
                verified={true}
            />}
            title={<Grid container>
                {/* <Grid item className={classes.userName}>
                        <UserNameComponent
                            className={[classes.label].join(" ")}
                            id={data.uid}
                            prefix={"@"}
                            // needVerify={user.uid()}
                        />
                    </Grid> */}
                {/* <Grid item className={classes.date} title={new Date(data.created).toLocaleString()}>
                        {toDateString(data.created)}
                    </Grid> */}
            </Grid>}
            subheader={<Grid container className={classes.text}>
                <Grid item xs>{textComponent(data.text)}</Grid>
                <Grid className={classes.timestamp}>{toDateString(data.created)}</Grid>
            </Grid>}
        />
    </Card>

    return <li>
        {isNew && <InView
            onChange={(inView) => {
                if (inView) setState({...state, shown: true});
            }}
            ref={ref => {
                if (!ref) return;
                setTimeout(() => {
                    if (ref && ref.node) ref.node.style.display = "";
                }, 1000)
            }}
            style={{display: "none"}}
        ><b>NEW</b></InView>}
    </li>
})

export default withStyles((theme) => ({
    ...stylesList(theme),
    ...stylesChat(theme),
}))(ChatItem);
