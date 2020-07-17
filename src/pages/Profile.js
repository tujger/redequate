import React from "react";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import Grid from "@material-ui/core/Grid";
import InputLabel from "@material-ui/core/InputLabel";
import TextField from "@material-ui/core/TextField";
import {default as ProfileComponentOrigin} from "../components/ProfileComponent";
import ProgressView from "../components/ProgressView";
import {logoutUser, Role, sendVerificationEmail, useCurrentUserData, UserData} from "../controllers/UserData";
import {Link, Redirect, useHistory, useParams} from "react-router-dom";
import {useDispatch} from "react-redux";
import {refreshAll} from "../controllers/Store";
import {hasNotifications, notifySnackbar, setupReceivingNotifications} from "../controllers/Notifications";
import {useFirebase, usePages, useStore} from "../controllers/General";
import NameIcon from "@material-ui/icons/Person";
import AddressIcon from "@material-ui/icons/LocationCity";
import PhoneIcon from "@material-ui/icons/Phone";
import {matchRole, TextMaskPhone} from "../controllers";
import withStyles from "@material-ui/styles/withStyles";
import LoadingComponent from "../components/LoadingComponent";

const styles = theme => ({
    root: {},
    buttons: {},
    logout: {}
});

export const publicFields = [
    {
        id: "name",
        label: "Name",
        icon: <NameIcon/>,
    },
    {
        id: "address",
        label: "Address",
        icon: <AddressIcon/>,
    },
    {
        id: "phone",
        label: "Phone",
        icon: <PhoneIcon/>,
        editComponent: <TextField
            InputProps={{
                inputComponent: TextMaskPhone
            }}
        />
    },
]

const Profile = ({
                     notifications = true, publicFields = publicFields, privateFields, classes, ProfileComponent =
        <ProfileComponentOrigin/>
                 }) => {
    const [state, setState] = React.useState({disabled: false});
    const {userData, disabled} = state;
    const history = useHistory();
    const pages = usePages();
    const store = useStore();
    const firebase = useFirebase();
    const dispatch = useDispatch();
    const currentUserData = useCurrentUserData();
    const {id} = useParams();

    const isCurrentUserAdmin = matchRole([Role.ADMIN], currentUserData);
    const isSameUser = userData && currentUserData && userData.id === currentUserData.id;
    const isEditEnabled = (isSameUser && matchRole([Role.USER], userData)) || isCurrentUserAdmin;

    // if (!currentUserData || !currentUserData.id) {
    //     return <Redirect to={pages.home.route}/>
    // }

    const handleNotifications = (evt, enable) => {
        dispatch(ProgressView.SHOW);
        setState({...state, disabled: true});
        if (enable) {
            setupReceivingNotifications(firebase)
                // .then(token => fetchUserPrivate(firebase)(currentUserData.id)
                //     .then(data => updateUserPrivate(firebase)(currentUserData.id, fetchDeviceId(), {notification: token}))
                    .then(result => {
                        notifySnackbar({title: "Subscribed"});
                        dispatch(ProgressView.HIDE);
                        setState({...state, disabled: false});
                    })
                .catch(notifySnackbar)
                .finally(() => {
                    dispatch(ProgressView.HIDE);
                    setState({...state, disabled: false});
                });
        } else {
            // fetchUserPrivate(firebase)(currentUserData.id)
            //     .then(data => updateUserPrivate(firebase)(currentUserData.id, fetchDeviceId(), {notification: null}))
            //     .then(result => {
                    localStorage.removeItem("notification-token");
                    notifySnackbar({title: "Unsubscribed"});
                    firebase.messaging().deleteToken()
                // })
                // .catch(notifySnackbar)
                // .finally(() => {
                    dispatch(ProgressView.HIDE);
                    setState({...state, disabled: false});
                // });
        }
    };

    React.useEffect(() => {
        if(!id) {
            setState({...state, userData:currentUserData});
            return;
        }
        new UserData(firebase).fetch(id)
            .then(userData => setState({...state, userData}))
            .catch(error => {
                // notifySnackbar
                history.goBack();
                console.error(error);
            });
        return () => {
        }
        // eslint-disable-next-line
    }, [id]);

    console.log(id, userData);
    if(!userData) return <LoadingComponent/>;
    return <div className={classes.root}>
        {userData.disabled && <Grid container>
            <InputLabel error>
                <h4>Your account is suspended. Please contact with administrator.</h4>
            </InputLabel>
        </Grid>}
        {!userData.verified && <Grid container>
            <InputLabel error>
                <h4>You have still not verified email. Some features will not
                    be available. If you were already verified please log out and log in again.</h4>
            </InputLabel>
        </Grid>}
        <ProfileComponent.type
            {...ProfileComponent.props}
            publicFields={publicFields}
            userData={userData}
        />
        {isSameUser && isEditEnabled && notifications && <Grid container><FormControlLabel
            control={
                <Checkbox
                    disabled={disabled}
                    checked={hasNotifications()}
                    onChange={handleNotifications}
                />
            }
            label={"Get notifications"}
        /></Grid>}
        <ButtonGroup
            className={classes.buttons}
            color={"secondary"}
            disabled={disabled}
            size="large"
            variant="contained"
        >
            {isSameUser && <Button
                className={classes.logout}
                color={"secondary"}
                onClick={() => {
                    logoutUser(firebase, store)()
                        .then(() => refreshAll(store));
                }}
                variant={"contained"}
            >
                Logout
            </Button>}
            {!currentUserData.verified && currentUserData.email && !currentUserData.disabled && <Button
                color={"secondary"}
                className={classes.resendVerification}
                onClick={() => {
                    refreshAll(store);
                    dispatch(ProgressView.SHOW);
                    console.log(currentUserData)
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
            {isEditEnabled && <Button
                color={"secondary"}
                // onClick={() => {
                //     props.history.push(pages.editprofile.route);
                // }}
                className={classes.edit}
                variant={"contained"}
                component={React.forwardRef((props, ref) => (
                    <Link ref={ref} to={pages.editprofile.route + userData.id} {...props}/>
                ))}
            >
                Edit
            </Button>}
        </ButtonGroup>
    </div>;
};

export default withStyles(styles)(Profile);
