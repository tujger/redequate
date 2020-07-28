import React from 'react';
import {useTheme, withStyles,} from "@material-ui/core";
import PropTypes from 'prop-types';
import {InView} from "react-intersection-observer";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import Skeleton from "@material-ui/lab/Skeleton";
import Grid from "@material-ui/core/Grid";
import {makeStyles} from "@material-ui/core/styles";
import {cacheDatas, toDateString, useCurrentUserData, useFirebase, UserData} from "../controllers";
import AvatarView from "../components/AvatarView";
import {styles} from "../components/styles";
import ItemPlaceholderComponent from "../components/ItemPlaceholderComponent";

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
        height: theme.spacing(3),
        width: theme.spacing(3),
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
    chatItem: {
        borderRadius: theme.spacing(2),
        width: "90%"
    },
    chatItemOut: {
        backgroundColor: "#def6fc",//"#0099ff",
        marginLeft: "10%",
    },
    chatItemIn: {
        backgroundColor: "#f1f0f0",
        marginRight: "10%",
    },
    label: {
        color: "#000000"
    },
    text: {
        marginBottom: theme.spacing(1),
    },
    timestamp: {
        bottom: theme.spacing(.5),
        color: "#888888",
        fontSize: theme.spacing(1.25),
        position: "absolute",
        right: theme.spacing(1),
    },
    transparent: {
        opacity: 0,
    },
});

const ChatItem = React.forwardRef((props, ref) => {
    const {data, chatMeta = {}, classes, skeleton, textComponent} = props;
    const currentUserData = useCurrentUserData();
    const firebase = useFirebase();
    const [state, setState] = React.useState({});
    const {shown, authorData} = state;
    const theme = useTheme();
    const classesChat = useStylesChat(theme)();

    const fetchIsNew = () => {
        const latestVisit = chatMeta[currentUserData.id + "_visit"] || 0;
        // const latestIncoming = meta[currentUserData.id] || 0;
        return data.created > latestVisit;
    }

    React.useEffect(() => {
        if (skeleton) return;
        let authorData = cacheDatas.put(data.uid, UserData(firebase));
        authorData.fetch(data.uid, [UserData.IMAGE, UserData.NAME])
            .then(() => setState({...state, authorData}))

        // setTimeout(() => {
        //     setState(state => ({...state, shown: true}));
        // }, 2000)
        // eslint-disable-next-line
    }, []);

    if (skeleton) return <ItemPlaceholderComponent classes={{avatar: classesChat.avatar}}/>;

    const isNew = fetchIsNew() && !shown;
    const isItemOut = currentUserData.id === data.uid;

    if (!authorData) return null;
    return <Card ref={ref} className={[
            classes.card,
            classesChat.chatItem,
            isItemOut ? classesChat.chatItemOut : classesChat.chatItemIn
        ].join(" ")}>
            <CardHeader
                classes={{content: classes.cardContent}}
                className={[classes.cardHeader, classes.post].join(" ")}
                avatar={<AvatarView className={classesChat.avatar} image={authorData.image} initials={authorData.initials} verified={true}/>}
                title={<Grid container>
                    {/*<Grid item className={classes.userName}>
                        <UserNameComponent
                            className={[classes.label].join(" ")}
                            id={data.uid}
                            prefix={"@"}
                            // needVerify={user.uid()}
                        />
                    </Grid>*/}
                    {/*<Grid item className={classes.date} title={new Date(data.created).toLocaleString()}>
                        {toDateString(data.created)}
                    </Grid>*/}
                </Grid>}
                subheader={<Grid container className={classesChat.text}>
                    <Grid item xs>{textComponent(data.text)}</Grid>
                    <Grid className={classesChat.timestamp}>{toDateString(data.created)}</Grid>
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

ChatItem.propTypes = {
    onSwipe: PropTypes.func
};

export default withStyles(styles)(ChatItem);
