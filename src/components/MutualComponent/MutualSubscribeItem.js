import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import CardHeader from "@material-ui/core/CardHeader";
import Card from "@material-ui/core/Card";
import Grid from "@material-ui/core/Grid";
import {useDispatch} from "react-redux";
import {useHistory} from "react-router-dom";
import Button from "@material-ui/core/Button";
import CardActionArea from "@material-ui/core/CardActionArea";
import Hidden from "@material-ui/core/Hidden";
import {cacheDatas, useFirebase, usePages, useWindowData} from "../../controllers/General";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import ProgressView from "../ProgressView";
import notifySnackbar from "../../controllers/notifySnackbar";
import AvatarView from "../AvatarView";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import {toDateString} from "../../controllers/DateFormat";
import {stylesList} from "../../controllers/Theme";

const MutualSubscribeItem = (
    {
        classes,
        data,
        skeleton,
        label,
        typeId,
        onDelete = () => {
        },
        type = "users_public",
        unsubscribeLabel = "Unsubscribe"
    }) => {
    const pages = usePages();
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const windowData = useWindowData();
    const [state, setState] = React.useState({});
    const {disabled} = state;
    const {key, userData = {}, value} = data;

    const handleUnsubscribe = evt => {
        console.log("handleUnsubscribe", key, typeId, currentUserData.id, value);
        evt.stopPropagation();
        dispatch(ProgressView.SHOW);
        setState({...state, disabled: true});
        cacheDatas.remove(key);
        cacheDatas.remove(value.id);
        firebase.database().ref("mutual").child(typeId).child(key).set(null)
            .then(() => onDelete({key, value}))
            .catch(error => {
                if (error && error.code === "PERMISSION_DENIED") {
                    notifySnackbar(new Error("Can't unsubscribe"));
                } else {
                    notifySnackbar(error);
                }
                setState({...state, disabled: false});
            })
            .finally(() => dispatch(ProgressView.HIDE));
    }

    const isSameUser = value && value.uid === currentUserData.id;
    const isAdminUser = matchRole([Role.ADMIN], currentUserData);
    const buttonLabel = unsubscribeLabel + ((isAdminUser && !isSameUser) ? " - force as Administrator" : "");

    const buttonProps = {
        "aria-label": buttonLabel,
        children: unsubscribeLabel,
        color: "secondary",
        component: "div",
        disabled: disabled,
        onClick: handleUnsubscribe,
        size: "small",
        style: isSameUser ? undefined : {backgroundColor: "red"},
        title: buttonLabel,
        // variant: isSameUser ? "contained" : "outlined",
        variant: "contained",
    }

    if (label) return <ItemPlaceholderComponent label={label} classes={classes} flat/>
    if (skeleton) return <ItemPlaceholderComponent classes={classes} flat/>;

    return <>
        <Card className={[classes.card, classes.cardFlat].join(" ")}>
            <CardActionArea
                className={classes.root}
                disabled={disabled}
                onClick={evt => {
                    if (!type || type === "users_public") {
                        history.push(pages.user.route + userData.id);
                    } else {
                        history.push(pages[type].route + value.id);
                    }
                }}
            >
                <CardHeader
                    classes={{content: classes.cardContent}}
                    className={[classes.cardHeader, classes.post].join(" ")}
                    avatar={<AvatarView
                        className={[
                            classes.avatar,
                        ].join(" ")}
                        image={userData.image}
                        initials={userData.initials}
                        verified={true}
                    />}
                    title={<Grid container alignItems={"center"}>
                        <Grid item className={classes.userName}>
                            <b>{userData.name}</b>
                        </Grid>
                        {windowData.isNarrow() && <Grid item xs/>}
                        {value.timestamp && <Grid item className={classes.date} title={new Date(value.timestamp).toLocaleString()}>
                            {toDateString(value.timestamp)}
                        </Grid>}
                    </Grid>}
                    subheader={<>
                        <Grid container alignItems={"flex-end"}>
                            <Grid item xs>
                                {value.message}
                            </Grid>
                        </Grid>
                        {(isSameUser || isAdminUser) && unsubscribeLabel && <Hidden smUp>
                            <Grid container justify={"flex-end"}>
                                <Button {...buttonProps}/>
                            </Grid>
                        </Hidden>}
                    </>}
                    action={(isSameUser || isAdminUser) && unsubscribeLabel && <Grid>
                        <Hidden smDown>
                            <Button {...buttonProps}/>
                        </Hidden>
                    </Grid>}
                />
            </CardActionArea>
        </Card>
    </>
}
export default withStyles(stylesList)(MutualSubscribeItem);
