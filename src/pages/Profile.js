import React from "react";
import Tooltip from "@material-ui/core/Tooltip";
import Fab from "@material-ui/core/Fab";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import Grid from "@material-ui/core/Grid";
import InputLabel from "@material-ui/core/InputLabel";
import TextField from "@material-ui/core/TextField";
import ProfileComponentOrigin from "../components/ProfileComponent";
import ProgressView from "../components/ProgressView";
import {matchRole, Role, sendVerificationEmail, useCurrentUserData, UserData} from "../controllers/UserData";
import {useHistory, useParams} from "react-router-dom";
import {useDispatch} from "react-redux";
import {notifySnackbar} from "../controllers/Notifications";
import {useFirebase, usePages} from "../controllers/General";
import NameIcon from "@material-ui/icons/Person";
import AddressIcon from "@material-ui/icons/LocationCity";
import PhoneIcon from "@material-ui/icons/Phone";
import {fetchCallable} from "../controllers/Firebase";
import {TextMaskPhone} from "../controllers/TextMasks";
import LoadingComponent from "../components/LoadingComponent";
import IconButton from "@material-ui/core/IconButton";
import EditIcon from "@material-ui/icons/Edit";
import PlacesTextField from "../components/PlacesTextField";
import InfoIcon from "@material-ui/icons/Info";
import FixIcon from "@material-ui/icons/BugReport";
import RoleIcon from "@material-ui/icons/Security";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import ChatIcon from "@material-ui/icons/ChatBubbleOutline";
import withStyles from "@material-ui/styles/withStyles";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import {styles} from "../controllers/Theme";
import NavigationToolbar from "../components/NavigationToolbar";

const stylesProfile = theme => ({
    root: {
        [theme.breakpoints.down("sm")]: {
            textAlign: "center",
        },
    },
    buttons: null,
    edit: null,
    logout: null,
});

export const publicFields = [
    {
        icon: <NameIcon/>,
        id: "name",
        label: "Name",
        required: true,
        unique: true,
        viewComponent: userData => <Typography variant={"h6"}>{userData.name}</Typography>
    },
    {
        id: "created",
        label: "Date since",
        editComponent: null,
        viewComponent: userData => <React.Fragment>
            <Typography variant={"caption"}>Since {userData.created}</Typography>
            <Box m={1}/>
        </React.Fragment>
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
        editComponent: ({value}) => <div>
            User data updated: {new Date(value).toLocaleString()}
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

const Profile = (
    {
        publicFields = publicFields,
        privateFields,
        classes,
        ProfileComponent =
            <ProfileComponentOrigin/>,
        provider,
    }) => {
    const [state, setState] = React.useState({disabled: false});
    const {userData, disabled} = state;
    const history = useHistory();
    const pages = usePages();
    const firebase = useFirebase();
    const dispatch = useDispatch();
    const currentUserData = useCurrentUserData();
    const {id} = useParams();

    const handleChatClick = () => {
        history.push(pages.chat.route + userData.id);
    }

    const fixErrors = () => {
        fetchCallable(firebase)("fixUser", {
            key: userData.id
        })
            .then(({result = "Complete"}) => notifySnackbar(result))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE));
    }

    const isCurrentUserAdmin = matchRole([Role.ADMIN], currentUserData);
    const isSameUser = userData && currentUserData && userData.id === currentUserData.id;
    const isEditAllowed = (isSameUser && matchRole([Role.USER], userData)) || isCurrentUserAdmin;

    React.useEffect(() => {
        let isMounted = true;
        if (!currentUserData) {
            history.goBack();
            return;
        }
        if (!id) {
            setState({...state, userData: currentUserData});
            return;
        }
        new UserData(firebase).fetch(id)
            .then(userData => isMounted && setState({...state, userData}))
            .catch(error => {
                // notifySnackbar
                history.goBack();
                console.error(error);
            });
        return () => {
            isMounted = false;
        }
        // eslint-disable-next-line
    }, [id]);

    if (!userData) return <LoadingComponent/>;
    return <div className={classes.root}>
        <NavigationToolbar
            mediumButton={isCurrentUserAdmin && <IconButton
                aria-label={"Fix possible errors"}
                children={<FixIcon/>}
                onClick={fixErrors}
                title={"Fix possible errors"}
            />}
            rightButton={isEditAllowed && <IconButton
                aria-label={"Edit"}
                children={<EditIcon/>}
                onClick={() => {
                    history.push(isSameUser ? pages.editprofile.route : pages.edituser.route + userData.id)
                }}
                title={"Edit"}
            />}
        />
        {userData.disabled && <Grid container>
            <InputLabel error>
                <h4>Account is suspended. Please contact with administrator.</h4>
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
            provider={provider}
            publicFields={publicFields}
            userData={userData}
        />
        <ButtonGroup
            className={classes.buttons}
            color={"secondary"}
            disabled={disabled}
            size={"large"}
            variant={"contained"}
        >
            {!currentUserData.verified && currentUserData.email && !currentUserData.disabled && <Button
                children={"Resend verification"}
                className={classes.resendVerification}
                onClick={() => {
                    dispatch(ProgressView.SHOW);
                    console.log(currentUserData)
                    sendVerificationEmail(firebase)
                        .catch(notifySnackbar)
                        .finally(() => dispatch(ProgressView.HIDE));
                }}
            />}
        </ButtonGroup>
        {(isSameUser || !pages.chat || pages.chat.disabled) ? null : <Tooltip title={"Start chat"}>
            <Fab
                aria-label={"Start chat"}
                color={"primary"}
                className={classes.fab}
                onClick={handleChatClick}
            >
                <ChatIcon/>
            </Fab>
        </Tooltip>}
    </div>;
};

export default withStyles((theme) => ({
    ...styles(theme),
    ...stylesProfile(theme),
}))(Profile);
