import React from "react";
import Grid from "@material-ui/core/Grid";
import CardActionArea from "@material-ui/core/CardActionArea";
import Card from "@material-ui/core/Card";
import Typography from "@material-ui/core/Typography";
import CardHeader from "@material-ui/core/CardHeader";
import {UserData} from "../../../controllers/UserData";
import {cacheDatas, useFirebase} from "../../../controllers/General";
import AvatarView from "../../../components/AvatarView";
import ItemPlaceholderComponent from "../../../components/ItemPlaceholderComponent";
import withStyles from "@material-ui/styles/withStyles";
import ConfirmComponent from "../../../components/ConfirmComponent";
import {toDateString} from "../../../controllers/DateFormat";
import {stylesList} from "../../../controllers/Theme";
import TypeIcon from "@material-ui/icons/ArrowRight";
import {notifySnackbar} from "../../../controllers";
import Linkify from "react-linkify";

function ActivityItemComponent(props) {
    const {data, classes, skeleton, label, onItemClick} = props;
    const firebase = useFirebase();
    const [state, setState] = React.useState({});
    const {alert, detailTimestamp, userData, removed, details, timestamp, type, userDatas = []} = state;

    const handleUserClick = uid => (event) => onItemClick("uid")(event, uid);

    React.useEffect(() => {
        let isMounted = true;
        const checkIfDataValid = async () => {
            if (!data || !data.value) throw data;
            return {...data.value};
        }
        const fetchInitiatorData = async props => {
            const {uid} = props;
            if (!uid) return {...props, userData: {id: "", name: "Anonymous"}};
            if (uid === "0") return {...props, userData: {id: "", name: "No user"}};
            return cacheDatas.fetch(uid, id => UserData(firebase).fetch(id, [UserData.NAME, UserData.IMAGE]))
                .then(userData => ({...props, userData}))
                .catch(error => catchUserFailed(uid)(error).then(userData => ({...props, userData})));
        }
        const fetchDetailsUids = async props => {
            const {details} = props;
            const {uid} = details || {};
            let uids;
            if (uid === undefined) {
                uids = [];
            } else if (uid instanceof Array) {
                uids = uid.map((item, index) => ({key: index, id: item}));
            } else if (uid instanceof Object) {
                uids = Object.keys(uid).map(item => ({key: item, id: uid[item]}));
            } else if (uid.constructor.name === "String") {
                uids = [{key: "uid", id: uid}];
            } else {
                uids = [];
            }
            return {...props, uids};
        }
        const fetchDetailsUserDatas = async props => {
            const {uids, ...rest} = props;
            const userDatas = await Promise.all(uids
                .map(async item => {
                    if (item.id === "0") return {key: item.key, userData: {id: item.id, name: "No user"}};
                    return UserData(firebase)
                        .fetch(item.id, [UserData.NAME, UserData.IMAGE])
                        .then(userData => ({key: item.key, userData}))
                        .catch(error => catchUserFailed(item.id)(error)
                            .then(userData => ({key: item.key, userData})))
                })
            );
            return {...rest, userDatas}
        }
        const fetchDetailTimestamp = async props => {
            const {details} = props;
            const {timestamp} = details || {};
            if (timestamp) {
                const detailTimestamp = new Date(timestamp).toLocaleString();
                return {...props, detailTimestamp}
            }
            return props;
        }
        const updateState = async props => {
            isMounted && setState(state => ({...state, ...props}));
        }
        const catchEvent = async event => {
            if (event instanceof Error) throw event;
            console.warn(event);
        }
        const catchUserFailed = uid => async error => {
            console.warn(error);
            return {id: uid, name: "Some user"};
        }
        const finalize = async () => {
        }

        checkIfDataValid()
            .then(fetchInitiatorData)
            .then(fetchDetailsUids)
            .then(fetchDetailsUserDatas)
            .then(fetchDetailTimestamp)
            .then(updateState)
            .catch(catchEvent)
            .catch(notifySnackbar)
            .finally(finalize);

        return () => {
            isMounted = false;
        }
    }, [data])

    if (removed) return null;
    if (label) return <ItemPlaceholderComponent classes={classes} label={label} pattern={"flat"}/>
    if (skeleton || !type) return <ItemPlaceholderComponent classes={classes} pattern={"flat"}/>

    return <Card className={[classes.card, classes.cardFlat].join(" ")}>
        <CardActionArea
            className={classes.root}
            onClick={() => {
                setState({...state, alert: true});
            }}>
            <CardHeader
                avatar={<div onClick={handleUserClick(userData.id)}>
                    <AvatarView
                        image={userData.image}
                        initials={userData.name}
                        // onclick={(event) => onItemClick("uid")(event, userData.id)}
                        verified={true}
                    />
                </div>}
                classes={{content: classes.cardContent}}
                className={[classes.cardHeader, classes.post].join(" ")}
                subheader={<Grid container>
                    <Grid container onClick={event => onItemClick("type")(event, type)}>
                        <TypeIcon/>
                        {type}
                    </Grid>
                    <Grid container>
                        {(JSON.stringify(details) || "").substr(0, 100)}
                    </Grid>
                </Grid>}
                title={<Grid container>
                    <Grid item className={classes.userName}>
                        <div onClickCapture={handleUserClick(userData.id)}>
                            {userData.name}
                        </div>
                    </Grid>
                    <Grid item className={classes.date}>
                        {toDateString(timestamp)}
                    </Grid>
                </Grid>}
            />
        </CardActionArea>
        {alert && <ConfirmComponent
            cancelLabel={"Close"}
            confirmLabel={null}
            onCancel={() => setState({...state, alert: false})}
            title={"Details"}
        >
            <Linkify><pre style={{whiteSpace: "pre-wrap"}}>{
                typeof details === "object"
                    ? JSON.stringify(details, null, "   ")
                    : details
            }</pre>
            </Linkify>
            <Typography variant={"h6"}>Context</Typography>
            <Grid container spacing={1}>Activity: {type}</Grid>
            {userDatas && userDatas.map((item, index) => <Grid container key={index} spacing={1}>
                <Grid item>{item.key}</Grid>
                <Grid item className={classes.userName} onClickCapture={handleUserClick(item.userData.id)}>
                    {item.userData.name}
                </Grid>
            </Grid>)}
            {detailTimestamp && <Grid container spacing={1}>Timestamp: {detailTimestamp}</Grid>}
        </ConfirmComponent>}
    </Card>
}

export default withStyles(stylesList)(ActivityItemComponent);
