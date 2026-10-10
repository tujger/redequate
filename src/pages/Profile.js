import FixIcon from "@mui/icons-material/BugReport";
import ChatIcon from "@mui/icons-material/ChatBubbleOutlined";
import EditIcon from "@mui/icons-material/Edit";
import InfoIcon from "@mui/icons-material/Info";
import AddressIcon from "@mui/icons-material/LocationCity";
import NameIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import RoleIcon from "@mui/icons-material/Security";
import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {useHistory, useParams} from "react-router-dom";
import {useAuth} from "../../packages/auth";
import {useBackend} from "../../packages/backend";
import FlexFabComponent from "../components/FlexFabComponent";
import LoadingComponent from "../components/LoadingComponent";
import NavigationToolbar from "../components/NavigationToolbar";
import PlacesTextField from "../components/PlacesTextField";
import ProfileComponentOrigin from "../components/ProfileComponent";
import ProgressView from "../components/ProgressView";
import SystemAlert from "../components/SystemAlert";
import {usePages} from "../controllers/General";
import notifySnackbar from "../controllers/notifySnackbar";
import {TextMaskPhone} from "../controllers/TextMasks";
import {matchRole, Role, useCurrentUserData, UserData} from "../controllers/UserData";
import Button from "../controls/Button/Button";
import Select from "../controls/Select/Select";
import TextField from "../controls/TextField/TextField";
import baseStyles from "../themes/Base.module.css";
import styles from "./styles/Profile.module.css";

export const publicFields = [
    {
        icon: <NameIcon/>,
        id: "name",
        label: "User.Name",
        required: true,
        unique: true,
        viewComponent: userData => <h6 className={styles.name}>{userData.name}</h6>
    },
    {
        id: "created",
        label: "User.Date since",
        editComponent: null,
        viewComponent: userData => <>
            <small className={styles.caption}>Since {userData.created}</small>
            <div className={styles.fieldSpacer}/>
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
            inputComponent={TextMaskPhone}
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
        editComponent: props => <label className={styles.roleField}>
            <span className={styles.roleLabel} id={"profile-role-label"}>Role</span>
            <Select
                aria-labelledby={"profile-role-label"}
                className={styles.roleSelect}
                disabled={props.disabled}
                onChange={props.onChange}
                options={Object.keys(Role).map(key => ({label: key, value: Role[key]}))}
                value={props.value}
            />
        </label>
    },
]

const Profile = (
    {
        publicFields: publicFieldsApplied = publicFields,
        privateFields,
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
    const auth = useAuth();
    const backend = useBackend();

    const handleChatClick = () => {
        history.push(pages.chat.route + userData.id);
    }

    const fixErrors = () => {
        backend.callFunction("fixUser", {
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
            mediumButton={isCurrentUserAdmin && <Button
                icon={<FixIcon/>}
                onClick={fixErrors}
                title={t("Common.Fix possible errors")}
            />}
            rightButton={isEditAllowed && <Button
                icon={<EditIcon/>}
                onClick={() => {
                    history.push(isSameUser ? pages.editprofile.route : pages.edituser.route + userData.id)
                }}
                title={t("Common.Edit")}
            />}
        />
        <div className={baseStyles.content}>
            {userData.disabled && <SystemAlert
                message={
                    <h4>{t("User.Account is suspended. Please contact with administrator.")}</h4>}
            />}
            {!userData.verified && <SystemAlert
                message={
                    <h4>{t("User.You still have email not verified. Some features will not be available. If you were already verified please log out and log in again.")}</h4>}
            />}
            <ProfileComponent.type
                {...ProfileComponent.props}
                provider={provider}
                publicFields={publicFieldsApplied}
                userData={userData}
            />
            <div className={styles.actions}>
                {!currentUserData.verified && currentUserData.email && !currentUserData.disabled &&
                    <Button
                        disabled={disabled}
                        onClick={() => {
                            dispatch(ProgressView.SHOW);
                            console.log(currentUserData)
                            auth.sendEmailVerification()
                                .then(() => notifySnackbar("Verification email has been sent"))
                                .catch(notifySnackbar)
                                .finally(() => dispatch(ProgressView.HIDE));
                        }}
                        variant={"contained"}
                    >
                        {t("User.Resend verification")}
                    </Button>}
            </div>
        </div>
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

export default Profile;
