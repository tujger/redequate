import React from "react";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import Grid from "@material-ui/core/Grid";
import InputLabel from "@material-ui/core/InputLabel";
import TextField from "@material-ui/core/TextField";
import {useHistory, useParams} from "react-router-dom";
import {useDispatch} from "react-redux";
import NameIcon from "@material-ui/icons/Person";
import AddressIcon from "@material-ui/icons/LocationCity";
import PhoneIcon from "@material-ui/icons/Phone";
import IconButton from "@material-ui/core/IconButton";
import EditIcon from "@material-ui/icons/Edit";
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
import {useTranslation} from "react-i18next";
import ProfileComponentOrigin from "../components/ProfileComponent";
import ProgressView from "../components/ProgressView";
import {
    matchRole,
    Role,
    sendVerificationEmail,
    useCurrentUserData,
    UserData
} from "../controllers/UserData";
import {useFirebase, usePages} from "../controllers/General";
import {fetchCallable} from "../controllers/Firebase";
import {TextMaskPhone} from "../controllers/TextMasks";
import LoadingComponent from "../components/LoadingComponent";
import PlacesTextField from "../components/PlacesTextField";
import {styles} from "../controllers/Theme";
import NavigationToolbar from "../components/NavigationToolbar";
import notifySnackbar from "../controllers/notifySnackbar";
import FlexFabComponent from "../components/FlexFabComponent";
import MetaInfoView from "../components/MetaInfoView";

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
        label: "User.Name",
        required: true,
        unique: true,
        viewComponent: userData => <Typography variant={"h6"}>{userData.name}</Typography>
    },
    {
        id: "created",
        label: "User.Date since",
        editComponent: null,
        viewComponent: userData => <>
            <Typography variant={"caption"}>Since {userData.created}</Typography>
            <Box m={1}/>
        </>
    },
    {
        id: "address",
        label: "User.Address",
        icon: <AddressIcon/>,
        editComponent: <PlacesTextField
            type={"formatted"}
        />
    },
    {
        id: "phone",
        label: "User.Phone",
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
                {
                    Object.keys(Role).map(key => {
                        return <MenuItem key={key} value={Role[key]}>{key}</MenuItem>
                    })
                }
            </Select>
        </FormControl>
    },
]

const Profile = (
    {
        publicFields = publicFields,
        privateFields,
        classes,
        ProfileComponent = <ProfileComponentOrigin/>,
        provider,
    }) => {
    const [state, setState] = React.useState({disabled: false});
    const {userData, disabled} = state;
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const {id} = useParams();
    const {t} = useTranslation();

    const handleChatClick = () => {
        history.push(pages.chat.route + userData.id);
    }

    const fixErrors = () => {
        fetchCallable("fixUser", {
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
        new UserData().fetch(id, [UserData.PUBLIC, UserData.ROLE, UserData.FORCE])
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
    return <>
        <NavigationToolbar
            className={classes.top}
            mediumButton={isCurrentUserAdmin && <IconButton
                aria-label={t("Common.Fix possible errors")}
                children={<FixIcon/>}
                onClick={fixErrors}
                title={t("Common.Fix possible errors")}
            />}
            rightButton={isEditAllowed && <IconButton
                aria-label={t("Common.Edit")}
                children={<EditIcon/>}
                onClick={() => {
                    history.push(isSameUser ? pages.editprofile.route : pages.edituser.route + userData.id)
                }}
                title={t("Common.Edit")}
            />}
        />
        <Grid container className={classes.center}>
            {userData.disabled && <MetaInfoView
                message={
                    <h4>{t("User.Account is suspended. Please contact with administrator.")}</h4>}
            />}
            {!userData.verified && <MetaInfoView
                message={
                    <h4>{t("User.You still have email not verified. Some features will not be available. If you were already verified please log out and log in again.")}</h4>}
            />}
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
                {!currentUserData.verified && currentUserData.email && !currentUserData.disabled &&
                <Button
                    children={t("User.Resend verification")}
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
        </Grid>
        {(isSameUser || !pages.chat || pages.chat.disabled)
            ? null
            : <FlexFabComponent
                tooltip={t("Chat.Start private chat")}
                icon={<ChatIcon/>}
                label={t("Chat.Private chat")}
                onClick={handleChatClick}
            />}
    </>;
};

export default withStyles((theme) => ({
    ...styles(theme),
    ...stylesProfile(theme),
}))(Profile);
