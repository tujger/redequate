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
import {useFirebase, usePages} from "../../controllers/General";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import ProgressView from "../ProgressView";
import notifySnackbar from "../../controllers/notifySnackbar";
import AvatarView from "../AvatarView";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import {toDateString} from "../../controllers/DateFormat";
import {stylesList} from "../../controllers/Theme";

const MutualRequestItem = (
    {
        classes,
        data,
        skeleton,
        label,
        typeId,
        onDelete = () => {
        },
        unsubscribeLabel = "Unsubscribe"
    }) => {
    const pages = usePages();
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const [state, setState] = React.useState({});
    const {disabled} = state;
    const {key, userData, value} = data;

    const handleUnsubscribe = evt => {
        console.log("handleUnsubscribe", key, currentUserData.id, value);
        evt.stopPropagation();
        dispatch(ProgressView.SHOW);
        setState({...state, disabled: true});
        firebase.database().ref("mutual").child(key).set(null)
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
        title: buttonLabel,
        variant: isSameUser ? "contained" : "outlined",
    }

    if (label) return <ItemPlaceholderComponent label={label} classes={classes}/>
    if (skeleton) return <ItemPlaceholderComponent classes={classes}/>;

    return <>
        <Card className={classes.card}>
            <CardActionArea
                disabled={disabled}
                onClick={evt => {
                    history.push(pages.user.route + userData.id);
                }}
            >
                <CardHeader
                    classes={{content: classes.cardContent}}
                    className={[classes.cardHeader, classes.post].join(" ")}
                    avatar={<AvatarView
                        className={classes.avatar}
                        image={userData.image}
                        initials={userData.initials}
                        verified={true}
                    />}
                    title={<Grid container alignItems={"center"}>
                        <Grid item className={classes.userName}>
                            <b>{userData.name}</b>
                        </Grid>
                        <Grid item className={classes.date} title={new Date(value.timestamp).toLocaleString()}>
                            {toDateString(value.timestamp)}
                        </Grid>
                    </Grid>}
                    subheader={<>
                        <Grid container alignItems={"flex-end"}>
                            <Grid item xs>
                                {value.message}
                            </Grid>
                        </Grid>
                        {(isSameUser || isAdminUser) && <Hidden smUp>
                            <Grid container justify={"flex-end"}>
                                <Button {...buttonProps}/>
                            </Grid>
                        </Hidden>}
                    </>}
                    action={(isSameUser || isAdminUser) && <Grid>
                        <Hidden smDown>
                            <Button {...buttonProps}/>
                        </Hidden>
                    </Grid>}
                />
            </CardActionArea>
        </Card>
    </>
}
export default withStyles(stylesList)(MutualRequestItem);
