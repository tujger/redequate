import React from "react";
import {withStyles} from "@mui/styles";
import {CardHeader} from "@mui/material";
import {Typography} from "@mui/material";
import {Card} from "@mui/material";
import {Grid} from "@mui/material";
import {useDispatch} from "react-redux";
import {useHistory} from "react-router-dom";
import {CardActionArea} from "@mui/material";
import {MenuItem} from "@mui/material";
import {Menu} from "@mui/material";
import {IconButton} from "@mui/material";
import {Fade} from "@mui/material";
import MenuIcon from "@mui/icons-material/MoreVert";
import {useTranslation} from "react-i18next";
import {cacheDatas, useFirebase, usePages, useWindowData} from "../../controllers/General";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import ProgressView from "../ProgressView";
import notifySnackbar from "../../controllers/notifySnackbar";
import AvatarView from "../AvatarView";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import {toDateString} from "../../controllers/DateFormat";
import {stylesList} from "../../controllers/Theme";
import CounterComponent from "../CounterComponent";

const MutualSubscribeItem = props => {
    const {t} = useTranslation();
    const {
        classes,
        counter = false,
        data,
        skeleton,
        label,
        typeId,
        onDelete = () => {
        },
        pattern,
        type = "users_public",
        unsubscribeLabel = t("Mutual.Unsubscribe")
    } = props;
    const pages = usePages();
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const windowData = useWindowData();
    const [state, setState] = React.useState({});
    const {disabled, anchor} = state;
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
                    notifySnackbar(new Error(t("Mutual.Can't unsubscribe")));
                } else {
                    notifySnackbar(error);
                }
                setState({...state, disabled: false});
            })
            .finally(() => dispatch(ProgressView.HIDE));
    }

    const handleMenuClick = event => {
        event.stopPropagation();
        setState(state => ({...state, anchor: event.currentTarget}));
    };

    const handleMenuClose = (event) => {
        event.stopPropagation();
        setState(state => ({...state, anchor: null}));
    };

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

    if (label) return <ItemPlaceholderComponent label={label} classes={classes} pattern={"flat"}/>
    if (skeleton) return <ItemPlaceholderComponent classes={classes} pattern={"flat"}/>;

    return <>
        <Card
            className={[
                classes.card,
                pattern ? classes[`card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`] : classes.cardFlat
            ].join(" ")}
            style={value.hidden ? {opacity: 0.5} : undefined}
        >
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
                        {counter && windowData.isNarrow() && <Grid item>
                            <CounterComponent
                                live
                                path={`${key}/mutual/${typeId}_s`}
                                prefix={"- "}
                                suffix={" follower(s)"}/>
                        </Grid>}
                        {windowData.isNarrow() && <Grid item xs/>}
                        {value.timestamp &&
                        <Grid item className={classes.date} title={new Date(value.timestamp).toLocaleString()}>
                            {toDateString(value.timestamp)}
                        </Grid>}
                        {counter && !windowData.isNarrow() && <Grid item>
                            <CounterComponent
                                live
                                path={`${key}/mutual/${typeId}_s`}
                                prefix={"- "}
                                suffix={" follower(s)"}/>
                        </Grid>}
                        {unsubscribeLabel && (isSameUser || isAdminUser) && <>
                            <IconButton
                                children={<MenuIcon/>}
                                className={classes.cardMenuButton}
                                component={"div"}
                                onClick={handleMenuClick}
                            />
                            <Menu
                                anchorEl={anchor}
                                keepMounted
                                onClose={handleMenuClose}
                                open={Boolean(anchor)}
                                TransitionComponent={Fade}
                            >
                                <MenuItem
                                    children={unsubscribeLabel + (isSameUser ? "" : " - force as Admin")}
                                    onClick={handleUnsubscribe}
                                    id={"unsubscribe"}
                                />
                            </Menu>
                        </>}
                    </Grid>}
                    subheader={<>
                        <Typography variant={"body2"}>
                            {value.message}
                        </Typography>
                        {/*{(isSameUser || isAdminUser) && unsubscribeLabel && <Hidden smUp>
                            <Grid container justify={"flex-end"}>
                                <Button {...buttonProps}/>
                            </Grid>
                        </Hidden>}*/}
                    </>}
                    /*action={(isSameUser || isAdminUser) && unsubscribeLabel && <Grid>
                        <Hidden smDown>
                            <Button {...buttonProps}/>
                        </Hidden>
                    </Grid>}*/
                />
            </CardActionArea>
        </Card>
    </>
}
export default withStyles(stylesList)(MutualSubscribeItem);
