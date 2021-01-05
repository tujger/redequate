import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import Grid from "@material-ui/core/Grid";
import {cacheDatas, toDateString, useCurrentUserData, useFirebase, UserData} from "../controllers";
import AvatarView from "../components/AvatarView";
import ItemPlaceholderComponent from "../components/ItemPlaceholderComponent";
import {stylesList} from "../controllers/Theme";

const stylesChat = theme => ({
    chatItem: {
        marginBottom: theme.spacing(0.5),
        width: "90%",
        "& $cardHeader": {
            padding: 0,
        }
    },
    chatItemOut: {
        marginLeft: "10%",
        "& $cardContent": {
            backgroundColor: "#def6fc",
        }
    },
    cardContent: {},
    cardHeader: {},
    chatItemIn: {
        marginRight: "10%",
    },
    _text: {
        marginBottom: theme.spacing(1),
    },
    timestamp: {
        bottom: theme.spacing(0.5),
        fontSize: theme.spacing(1.25),
        position: "absolute",
        right: theme.spacing(1),
    },
});

const ChatItem = (props) => {
    // eslint-disable-next-line react/prop-types
    const {data, classes, skeleton, textComponent} = props;
    const currentUserData = useCurrentUserData();
    const firebase = useFirebase();
    const [state, setState] = React.useState({});
    const {authorData} = state;

    /*const fetchIsNew = () => {
        const latestVisit = chatMeta[currentUserData.id + "_visit"] || 0;
        // const latestIncoming = meta[currentUserData.id] || 0;
        return data.created > latestVisit;
    }*/

    React.useEffect(() => {
        if (skeleton) return;
        let isMounted = true;
        const authorData = cacheDatas.put(data.uid, UserData(firebase));
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
    return <Card className={[
        classes.root,
        classes.card,
        classes.cardCloud,
        classes.chatItem,
        isItemOut ? classes.chatItemOut : classes.chatItemIn
    ].join(" ")}>
        <CardHeader
            classes={{content: classes.cardContent}}
            className={[classes.cardHeader, classes.post].join(" ")}
            avatar={<AvatarView
                className={[classes.avatar, classes.avatarSmallest].join(" ")}
                image={authorData.image}
                initials={authorData.initials}
                verified={true}
            />}
            title={<Grid container>
            </Grid>}
            subheader={<Grid container className={classes._text}>
                <Grid item xs>{textComponent(data.text)}</Grid>
                <Grid className={[classes.date, classes.timestamp].join(" ")}>{toDateString(data.created)}</Grid>
            </Grid>}
        />
    </Card>

    /*return <li>
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
    </li>*/
}

export default withStyles((theme) => ({
    ...stylesList(theme),
    ...stylesChat(theme),
}))(ChatItem);
