import FixIcon from "@mui/icons-material/BugReport";
import ChatIcon from "@mui/icons-material/ChatBubbleOutlined";
import EditIcon from "@mui/icons-material/Edit";
import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {useHistory, useParams} from "react-router-dom";
import {userPrivateFields, userPublicFields} from "../components";
import FlexFabComponent from "../components/FlexFabComponent";
import LoadingComponent from "../components/LoadingComponent";
import NavigationToolbar from "../components/NavigationToolbar";
import ProfileComponentOrigin from "../components/ProfileComponent/ProfileComponent";
import ProgressView from "../components/ProgressView";
import SystemAlert from "../components/SystemAlert";
import {useAuth, useBackend, useDatabase, useRedirectToLogin} from "../controllers";
import {usePages} from "../controllers/General";
import notifySnackbar from "../controllers/notifySnackbar";
import {useCurrentUserDataValue} from "../controllers/useCurrentUserData";
import UserData, {matchRole, UserRole} from "../controllers/UserData";
import Button from "../controls/Button/Button";
import baseStyles from "../themes/Base.module.css";
import styles from "./styles/Profile.module.css";

export default (
    {
        publicFields: publicFieldsApplied = userPublicFields,
        privateFields = userPrivateFields,
        ProfileComponent = <ProfileComponentOrigin/>,
        provider,
    }) => {
    const auth = useAuth();
    const backend = useBackend();
    const currentUserData = useCurrentUserDataValue();
    const database = useDatabase();
    const dispatch = useDispatch();
    const history = useHistory();
    const pages = usePages();
    const {id} = useParams();
    const shouldRedirectToLogin = useRedirectToLogin();
    const [state, setState] = React.useState({disabled: false});
    const {t} = useTranslation();

    const {userData, disabled} = state;

    const handleChatClick = () => {
        history.push(pages.chat.route + userData.id);
    }

    const fixErrors = () => {
        backend.request("fixUser", {
            key: userData.id
        })
            .then(({result = "Complete"}) => notifySnackbar(result))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE));
    }

    const isCurrentUserAdmin = matchRole([UserRole.ADMIN], currentUserData);
    const isSameUser = userData && currentUserData && userData.id === currentUserData.id;
    const isEditAllowed = (isSameUser && matchRole([UserRole.USER], userData)) || isCurrentUserAdmin;

    React.useEffect(() => {
        if (shouldRedirectToLogin) return;
        let isMounted = true;
        if (!id) {
            setState(state => ({...state, userData: new UserData(database).fromJSON(currentUserData.toJSON())}));
            return;
        }
        new UserData(database).fetch(id, [UserData.PUBLIC, UserData.ROLE, UserData.FORCE])
            .then(userData => isMounted && setState(state => ({...state, userData})))
            .catch(error => {
                if (!isMounted) return;
                history.goBack();
                console.error(error);
            });
        return () => {
            isMounted = false;
        }
    }, [id, currentUserData, database, history, shouldRedirectToLogin]);

    if (shouldRedirectToLogin || !userData) return <LoadingComponent/>;
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
                privateFields={privateFields}
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
