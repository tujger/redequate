import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import CardHeader from "@material-ui/core/CardHeader";
import Card from "@material-ui/core/Card";
import Grid from "@material-ui/core/Grid";
import CardActionArea from "@material-ui/core/CardActionArea";
import {useHistory} from "react-router-dom";
import {useDispatch} from "react-redux";
import {useCurrentUserData} from "../controllers/UserData";
import {useFirebase, usePages, useWindowData} from "../controllers/General";
import ProgressView from "../components/ProgressView";
import notifySnackbar from "../controllers/notifySnackbar";
import ItemPlaceholderComponent from "../components/ItemPlaceholderComponent";
import AvatarView from "../components/AvatarView";
import {toDateString} from "../controllers/DateFormat";
import {stylesList} from "../controllers/Theme";

const AlertItem = ({classes, data, skeleton, label, fetchAlertContent}) => {
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const windowData = useWindowData();
    const [state, setState] = React.useState({});
    const {new: isNew, type, id, timestamp, avatar, title, text, removed, route} = state

    const handleClick = () => {
        dispatch(ProgressView.SHOW);
        firebase.database().ref("alerts").child(currentUserData.id).child(data.key).child("new").set(null)
            .then(() => {
                try {
                    delete data.value.new;
                } catch (ignored) {
                }
                setState({...state, isNew: false});
                if (route) history.push(route);
            })
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE))
    }

    React.useEffect(() => {
        if (!data) return;
        let isMounted = true;
        fetchAlertContent({firebase, pages}, data.value)
            .then(result => isMounted && setState(state => ({...state, ...data.value, ...result})))
            .catch(error => {
                isMounted && setState(state => ({...state, removed: true}));
                console.error(data.value, error);
            })
        return () => {
            isMounted = false;
        }
        // eslint-disable-next-line
    }, []);

    if (removed) return null;
    if (label) return <ItemPlaceholderComponent label={label} classes={null} flat/>
    if (skeleton || !type) return <ItemPlaceholderComponent classes={null} flat/>;

    return <>
        <Card className={[classes.card, classes.cardFlat].join(" ")}>
            <CardActionArea className={classes.root} onClick={handleClick}>
                <CardHeader
                    classes={{content: classes.cardContent}}
                    className={[classes.cardHeader, classes.post].join(" ")}
                    avatar={<AvatarView className={classes.avatarSmall} icon={avatar} initials={type} verified={true}/>}
                    title={<Grid container>
                        <Grid item className={[classes.userName, isNew ? classes.unread : classes.read].join(" ")}>
                            {title}
                        </Grid>
                        {windowData.isNarrow() && <Grid item xs/>}
                        {timestamp && <Grid item className={classes.date} title={new Date(timestamp).toLocaleString()}>
                            {toDateString(timestamp)}
                        </Grid>}
                    </Grid>}
                    subheader={<>
                        <Grid container>
                            <Grid item className={[isNew ? classes.unread : classes.read].join(" ")}>
                                {text || id}
                            </Grid>
                        </Grid>
                    </>}
                />
            </CardActionArea>
        </Card>
    </>
}

export default withStyles(stylesList)(AlertItem);
