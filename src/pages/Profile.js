import React from "react";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import Grid from "@material-ui/core/Grid";
import InputLabel from "@material-ui/core/InputLabel";
import TextField from "@material-ui/core/TextField";
import ProfileComponent, {default as ProfileComponentOrigin} from "../components/ProfileComponent";
import ProgressView from "../components/ProgressView";
import {logoutUser, Role, sendVerificationEmail, useCurrentUserData, UserData} from "../controllers/UserData";
import {useHistory, useParams} from "react-router-dom";
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
import IconButton from "@material-ui/core/IconButton";
import BackIcon from "@material-ui/icons/ArrowBack";
import EditIcon from "@material-ui/icons/Edit";
import PlacesTextField from "../components/PlacesTextField";
import InfoIcon from "@material-ui/icons/Info";
import RoleIcon from "@material-ui/icons/Security";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";

const styles = theme => ({
    root: {},
    buttons: {},
    edit: {},
    logout: {},
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
        editComponent: <PlacesTextField
            type={"formatted"}
        />
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

export const adminFields = [
    {
        id: "updated",
        label: "",
        icon: <InfoIcon/>,
        editComponent: props => <div>
            User data updated: {new Date(props.value).toLocaleString()}
        </div>
    },
    {
        id: "role",
        label: "Role",
        icon: <RoleIcon/>,
        editComponent: props => <FormControl {...props}>
            <InputLabel shrink>
                Role
            </InputLabel>
            <Select
                onChange={props.onChange}
                value={props.value}
            >
                <MenuItem value={Role.USER}>User</MenuItem>
                <MenuItem value={Role.USER_NOT_VERIFIED}>User not verified</MenuItem>
                <MenuItem value={Role.DISABLED}>User disabled</MenuItem>
                <MenuItem value={Role.ADMIN}>Admin</MenuItem>
            </Select>
        </FormControl>
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
    const isEditAllowed = (isSameUser && matchRole([Role.USER], userData)) || isCurrentUserAdmin;

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
        if (!currentUserData) {
            history.goBack();
            return;
        }
        if (!id) {
            setState({...state, userData: currentUserData});
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

    if (!userData) return <LoadingComponent/>;
    return <div className={classes.root}>
        <Grid container>
            <Grid item>
                <IconButton aria-label={"Back"} onClick={() => history.goBack()}>
                    <BackIcon/>
                </IconButton>
            </Grid>
            {isEditAllowed && <React.Fragment><Grid item xs></Grid>
                <Grid item>
                    <IconButton aria-label={"Edit"} onClick={() => {
                        history.push(isSameUser ? pages.editprofile.route : pages.edituser.route + userData.id)
                    }}>
                        <EditIcon/>
                    </IconButton>
                </Grid></React.Fragment>}
        </Grid>
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
        {isSameUser && isEditAllowed && notifications && <Grid container><FormControlLabel
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
        </ButtonGroup>
    </div>;
};

export default withStyles(styles)(Profile);
