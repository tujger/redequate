import FixIcon from "@mui/icons-material/BugReport";
import ChatIcon from "@mui/icons-material/ChatBubbleOutline";
import EditIcon from "@mui/icons-material/Edit";
import InfoIcon from "@mui/icons-material/Info";
import AddressIcon from "@mui/icons-material/LocationCity";
import NameIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import RoleIcon from "@mui/icons-material/Security";
import {
    Box,
    Button,
    ButtonGroup,
    FormControl,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography
} from "@mui/material";
import {withStyles} from "@mui/styles";
import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {useHistory, useParams} from "react-router-dom";
import FlexFabComponent from "../components/FlexFabComponent";
import LoadingComponent from "../components/LoadingComponent";
import MetaInfoView from "../components/MetaInfoView";
import NavigationToolbar from "../components/NavigationToolbar";
import PlacesTextField from "../components/PlacesTextField";
import ProfileComponentOrigin from "../components/ProfileComponent";
import ProgressView from "../components/ProgressView.js";
import {fetchCallable} from "../controllers/Firebase";
import {usePages} from "../controllers/General";
import notifySnackbar from "../controllers/notifySnackbar";
import {TextMaskPhone} from "../controllers/TextMasks";
import {styles} from "../controllers/Theme";
import {matchRole, Role, sendVerificationEmail, useCurrentUserData, UserData} from "../controllers/UserData";

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
                variant={"standard"}
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
                        sendVerificationEmail()
                            .then(() => notifySnackbar("Verification email has been sent"))
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
