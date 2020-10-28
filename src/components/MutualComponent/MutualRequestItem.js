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
import {mutualRequestAccept, mutualRequestReject} from "./mutualComponentControls";
import {useFirebase, usePages} from "../../controllers/General";
import ProgressView from "../ProgressView";
import notifySnackbar from "../../controllers/notifySnackbar";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import AvatarView from "../AvatarView";
import {toDateString} from "../../controllers/DateFormat";
import {stylesList} from "../../controllers/Theme";

const MutualRequestItem = (
    {
        classes,
        data,
        label,
        onDelete = () => {
        },
        skeleton,
    }) => {
    const pages = usePages();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const [state, setState] = React.useState({});
    const {disabled} = state;
    const {key, userData, value} = data;

    const handleAccept = evt => {
        evt.stopPropagation();
        dispatch(ProgressView.SHOW);
        setState({...state, disabled: true});
        mutualRequestAccept({requestId: key, firebase})
            .then(result => {
                console.log(result);
                onDelete(result);
            })
            .catch(error => {
                notifySnackbar(error);
                setState({...state, disabled: false});
            })
            .finally(() => {
                dispatch(ProgressView.HIDE);
            })
    }

    const handleReject = evt => {
        evt.stopPropagation();
        mutualRequestReject({requestId: key, firebase})
            .then(result => {
                console.log(result);
                onDelete(result);
            })
            .catch(error => {
                notifySnackbar(error);
                setState({...state, disabled: false});
            })
            .finally(() => {
                dispatch(ProgressView.HIDE);
            })
    }

    const buttonProps = {
        color: "secondary",
        component: "div",
        disabled: disabled,
        size: "small",
        variant: "contained",
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
                        <Hidden smUp>
                            <Grid container justify={"flex-end"}>
                                <Button
                                    {...buttonProps}
                                    aria-label={"Accept"}
                                    children={"Accept"}
                                    onClick={handleAccept}
                                    title={"Accept"}
                                />
                                <Button
                                    {...buttonProps}
                                    aria-label={"Reject"}
                                    children={"Reject"}
                                    onClick={handleReject}
                                    title={"Reject"}
                                />
                            </Grid>
                        </Hidden>
                    </>}
                    action={<Grid>
                        <Hidden smDown>
                            <Button
                                {...buttonProps}
                                aria-label={"Accept"}
                                children={"Accept"}
                                onClick={handleAccept}
                                title={"Accept"}
                            />
                            <Button
                                {...buttonProps}
                                aria-label={"Reject"}
                                children={"Reject"}
                                onClick={handleReject}
                                title={"Reject"}
                            />
                        </Hidden>
                    </Grid>}
                />
            </CardActionArea>
        </Card>
    </>
}

export default withStyles(stylesList)(MutualRequestItem);

