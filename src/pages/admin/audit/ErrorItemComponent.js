import React from "react";
import Grid from "@material-ui/core/Grid";
import CardActionArea from "@material-ui/core/CardActionArea";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import IconButton from "@material-ui/core/IconButton";
import withStyles from "@material-ui/styles/withStyles";
import {useDispatch} from "react-redux";
import ClearIcon from "@material-ui/icons/Clear";
import {UserData} from "../../../controllers/UserData";
import {cacheDatas, useFirebase} from "../../../controllers/General";
import AvatarView from "../../../components/AvatarView";
import ItemPlaceholderComponent from "../../../components/ItemPlaceholderComponent";
import ConfirmComponent from "../../../components/ConfirmComponent";
import {toDateString} from "../../../controllers/DateFormat";
import {fetchCallable} from "../../../controllers/Firebase";
import ProgressView from "../../../components/ProgressView";
import {stylesList} from "../../../controllers/Theme";
import notifySnackbar from "../../../controllers/notifySnackbar";

function ErrorItemComponent(props) {
    const {data, classes, skeleton, label, onUserClick} = props;
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const [state, setState] = React.useState({});
    const {alert, userData, removed} = state;

    const handleClick = (event) => onUserClick(event, userData.id);

    const handleConfirm = () => {
        dispatch(ProgressView.SHOW);
        setState({...state, alert: false});
        console.log("[Error] try to fix", data);
        fetchCallable("fixError", {
            key: data.key
        })
            .then(({result}) => notifySnackbar(result))
            .then(() => firebase.database().ref("errors").child(data.key).set(null))
            .then(() => setState({...state, removed: true}))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE));
    }

    const handleRemove = () => {
        dispatch(ProgressView.SHOW);
        firebase.database().ref("errors").child(data.key).set(null)
            .then(() => setState({...state, removed: true}))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE));
    }

    React.useEffect(() => {
        if (!data || !data.value || !data.value.uid) return;
        let isMounted = true;
        const userData = cacheDatas.put(data.value.uid, UserData());
        userData.fetch(data.value.uid, [UserData.NAME, UserData.IMAGE])
            .then(() => isMounted && setState(state => ({...state, userData})))
            .catch(error => {
                if (!isMounted) return;
                console.log(error, userData)
                userData.public.name = userData.public.name || (data.value.uid === "anonymous" ? "Anonymous" : "User deleted");
                if (data.value.uid !== "anonymous") console.log("[Error] user deleted", data.value.uid);
                setState(state => ({...state, userData}))
            });
        return () => {
            isMounted = false;
        }
    }, [])

    if (removed) return null;
    if (label) return <ItemPlaceholderComponent classes={classes} label={label} pattern={"flat"}/>
    if (skeleton || !userData) return <ItemPlaceholderComponent classes={classes} pattern={"flat"}/>

    return <Card className={[classes.card, classes.cardFlat].join(" ")}>
        <CardActionArea
            className={classes.root}
            onClick={() => {
                setState({...state, alert: true});
            }}>
            <CardHeader
                action={<IconButton component={"div"} onClick={handleRemove}>
                    <ClearIcon/>
                </IconButton>}
                avatar={<div onClick={handleClick}>
                    <AvatarView
                        image={userData.image}
                        initials={userData.name}
                        onclick={(event) => onUserClick(event, userData.id)}
                        verified={true}
                    />
                </div>}
                classes={{content: classes.cardContent}}
                className={[classes.cardHeader, classes.post].join(" ")}
                subheader={<Grid container>
                    {(JSON.stringify(data.value.error) || "").substr(0, 100)}
                </Grid>}
                title={<Grid container>
                    <Grid item className={classes.userName}>
                        <div onClickCapture={handleClick}>
                            {userData.name}
                        </div>
                    </Grid>
                    <Grid item className={classes.date}>
                        {toDateString(data.value.timestamp)}
                    </Grid></Grid>}
            />
        </CardActionArea>
        {alert && <ConfirmComponent
            confirmLabel={"Try to fix"}
            onCancel={() => setState({...state, alert: false})}
            onConfirm={handleConfirm}
            title={"Error stacktrace"}
        >
            <pre style={{whiteSpace: "pre-wrap"}}>{
                typeof data.value.error === "object"
                    ? JSON.stringify(data.value.error, null, "   ")
                    : data.value.error
            }</pre>
        </ConfirmComponent>}
    </Card>
}

export default withStyles(stylesList)(ErrorItemComponent);
