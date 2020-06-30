import React from "react";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import {default as ProfileComponentOrigin} from "../components/ProfileComponent";
import ProgressView from "../components/ProgressView";
import {
    fetchUserPrivate,
    logoutUser,
    sendVerificationEmail,
    updateUserPrivate, useCurrentUserData,
    watchUserChanged
} from "../controllers/User";
import {Link, Redirect, withRouter} from "react-router-dom";
import {useDispatch} from "react-redux";
import {refreshAll} from "../controllers/Store";
import {hasNotifications, notifySnackbar, setupReceivingNotifications} from "../controllers/Notifications";
import {fetchDeviceId, useFirebase, usePages, useStore} from "../controllers/General";
import {useUser} from "../controllers";

const Profile = ({notifications = true, additionalPublicFields, additionalPrivateFields, ProfileComponent = <ProfileComponentOrigin/>}) => {
    const [state, setState] = React.useState({disabled: false});
    const {disabled} = state;
    const pages = usePages();
    const store = useStore();
    const firebase = useFirebase();
    const dispatch = useDispatch();
    const user = useUser();
    const userData = useCurrentUserData();

    React.useEffect(() => {
        watchUserChanged(firebase);
    }, []);

    if (!user.uid()) {
        return <Redirect to={pages.users.route}/>
    }

    const handleNotifications = (evt, enable) => {
        dispatch(ProgressView.SHOW);
        setState({...state, disabled: true});
        if (enable) {
            setupReceivingNotifications(firebase)
                .then(token => fetchUserPrivate(firebase)(user.uid())
                    .then(data => updateUserPrivate(firebase)(user.uid(), fetchDeviceId(), {notification: token}))
                    .then(result => {
                        notifySnackbar({title: "Subscribed"});
                        dispatch(ProgressView.HIDE);
                        setState({...state, disabled: false});
                    }))
                .catch(notifySnackbar)
                .finally(() => {
                    dispatch(ProgressView.HIDE);
                    setState({...state, disabled: false});
                });
        } else {
            fetchUserPrivate(firebase)(user.uid())
                .then(data => updateUserPrivate(firebase)(user.uid(), fetchDeviceId(), {notification: null}))
                .then(result => {
                    localStorage.removeItem("notification-token");
                    notifySnackbar({title: "Unsubscribed"});
                    return firebase.messaging().deleteToken();
                })
                .catch(notifySnackbar)
                .finally(() => {
                    dispatch(ProgressView.HIDE);
                    setState({...state, disabled: false});
                });
        }
    };

    return <div>
        <ProfileComponent.type {...ProfileComponent.props} userData={userData} additionalPublicFields={additionalPublicFields}/>
        {!user.public().emailVerified && <Grid container>
            <Grid item xs>
                <Typography>Note! You have still not verified email. Some features will not
                    be available. If you were already verified please log out and log in again.</Typography>
            </Grid>
        </Grid>}
        {notifications && <Grid container><FormControlLabel
            control={
                <Checkbox
                    disabled={disabled}
                    checked={hasNotifications()}
                    onChange={handleNotifications}
                />
            }
            label={"Get notifications"}
        /></Grid>}
            <ButtonGroup disabled={disabled} variant="contained" color={"secondary"} size="large">
            <Button
                color={"secondary"}
                onClick={() => {
                    logoutUser(firebase)();
                    refreshAll(store);
                }}
                variant={"contained"}
            >
                Logout
            </Button>
            {!user.public().emailVerified && user.public().email && <Button
                color={"secondary"}
                onClick={() => {
                    refreshAll(store);
                    dispatch(ProgressView.SHOW);
                    console.log(user)
                    sendVerificationEmail(firebase)
                        .then(() => {
                            refreshAll(store);
                        }).catch(error => {
                        refreshAll(store);
                    });
                }}
                variant={"contained"}
            >
                Resend verification
            </Button>}
            {user.public().emailVerified && <Button
                color={"secondary"}
                // onClick={() => {
                //     props.history.push(pages.edituser.route);
                // }}
                variant={"contained"}
                component={React.forwardRef((props, ref) => (
                    <Link ref={ref} to={{
                        pathname: pages.edituser.route,
                        // state: {
                        //     data: {uid: user.uid(), role: user.role(), ...user.public()},
                        //     tosuccessroute: pages.profile.route
                        // },
                    }} {...props}/>
                ))}
            >
                Edit
            </Button>}
        </ButtonGroup>
    </div>;
};

export default withRouter(Profile);
