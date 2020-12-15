import React from "react";
import Grid from "@material-ui/core/Grid";
import CardActionArea from "@material-ui/core/CardActionArea";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import {UserData} from "../../../controllers/UserData";
import {cacheDatas, useFirebase} from "../../../controllers/General";
import AvatarView from "../../../components/AvatarView";
import ItemPlaceholderComponent from "../../../components/ItemPlaceholderComponent";
import withStyles from "@material-ui/styles/withStyles";
import ConfirmComponent from "../../../components/ConfirmComponent";
import {toDateString} from "../../../controllers/DateFormat";
import {useDispatch} from "react-redux";
import {stylesList} from "../../../controllers/Theme";
import TypeIcon from "@material-ui/icons/ArrowRight";

function ErrorItemComponent(props) {
    const {data, classes, skeleton, label, onItemClick} = props;
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const [state, setState] = React.useState({});
    const {alert, userData, removed} = state;

    const handleUserClick = (event) => onItemClick("uid")(event, userData.id);

    React.useEffect(() => {
        if (!data || !data.value) return;
        let isMounted = true;
        if(data.value.uid) {
            const userData = cacheDatas.put(data.value.uid, UserData(firebase));
            userData.fetch(data.value.uid, [UserData.NAME, UserData.IMAGE])
                .then(userData => isMounted && setState(state => ({...state, userData})))
                .catch(error => {
                    console.log(error);
                    if (!isMounted) return;
                    userData.public.name = userData.public.name || (data.value.uid === "anonymous" ? "Anonymous" : "User deleted");
                    if (data.value.uid !== "anonymous") console.log("[Activity] user deleted", data.value.uid);
                    setState(state => ({...state, userData}))
                });
        } else {
            isMounted && setState(state => ({...state, userData: {name: "Anonymous"}}))
        }
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
                avatar={<div onClick={handleUserClick}>
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
                    <Grid container onClick={event => onItemClick("type")(event, data.value.type)}>
                        <TypeIcon/>
                        {data.value.type}
                    </Grid>
                    <Grid container>
                        {(JSON.stringify(data.value.details) || "").substr(0, 100)}
                    </Grid>
                </Grid>}
                title={<Grid container>
                    <Grid item className={classes.userName}>
                        <div onClickCapture={handleUserClick}>
                            {userData.name}
                        </div>
                    </Grid>
                    <Grid item className={classes.date}>
                        {toDateString(data.value.timestamp)}
                    </Grid>
                </Grid>}
            />
        </CardActionArea>
        {alert && <ConfirmComponent
            confirmLabel={"Try to fix"}
            onCancel={() => setState({...state, alert: false})}
            // onConfirm={handleConfirm}
            title={"Details"}
        >
            <pre style={{whiteSpace: "pre-wrap"}}>{
                typeof data.value.details === "object"
                    ? JSON.stringify(data.value.details, null, "   ")
                    : data.value.details
            }</pre>
        </ConfirmComponent>}
    </Card>
}

export default withStyles(stylesList)(ErrorItemComponent);
