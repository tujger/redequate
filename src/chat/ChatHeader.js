import ClearIcon from "@material-ui/icons/Clear";
import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {Link, useHistory} from "react-router-dom";
import AvatarView from "../components/AvatarView";
import ConfirmComponent from "../components/ConfirmComponent";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import NavigationToolbar from "../components/NavigationToolbar";
import ProgressView from "../components/ProgressView";
import {notifySnackbar, toDateString, useCurrentUserData, usePages} from "../controllers";
import UserName from "../controls/UserName/UserName";
import useRippleEffect from "../helpers/useRippleEffect";
import chatHeaderStyles from "./styles/ChatHeader.module.css";

export default ({chatMeta, className, id, userComponent, userData}) => {
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const history = useHistory();
    const pages = usePages();
    const onPointerDown = useRippleEffect();
    const [state, setState] = React.useState({});
    const {online, timestamp, deleteOpen} = state;
    const {t} = useTranslation();

    const handleConfirmDeletion = evt => {
        dispatch(ProgressView.SHOW);
        console.log(chatMeta.toString());
        chatMeta.removeUid(currentUserData.id)
            .then(() => history.goBack())
            .catch(notifySnackbar)
            .finally(() => {
                dispatch(ProgressView.HIDE);
                setState({...state, deleteOpen: false});
            })
    }

    React.useEffect(() => {
        let isMounted = true;
        if (!userData || !userData.id) {
            history.goBack();
            return;
        }
        chatMeta.watchOnline({
            uid: userData.id,
            onChange: ({online, timestamp, removed}) => {
                if (removed) {
                    dispatch({type: lazyListComponentReducer.RESET, cache: "chats"});
                    history.goBack();
                }
                isMounted && setState(state => ({...state, online, timestamp}));
            }
        });
        return () => {
            isMounted = false;
            chatMeta.unwatchOnline();
        }
    }, [id]);

    const handleDeleteKeyDown = event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        setState({...state, deleteOpen: true});
    };

    return <>
        <NavigationToolbar
            className={className}
            rightButton={<div
                aria-label={t("Chat.Delete chat")}
                className={chatHeaderStyles.deleteButton}
                onClick={() => setState({...state, deleteOpen: true})}
                onKeyDown={handleDeleteKeyDown}
                onPointerDown={onPointerDown}
                role='button'
                tabIndex={0}
                title={t("Chat.Delete chat")}
            >
                <ClearIcon/>
            </div>}
        >
            <div className={chatHeaderStyles.root}>
                <Link to={pages.user.route + userData.id} className={chatHeaderStyles.nounderline}>
                    <AvatarView
                        image={userData.image}
                        initials={userData.initials}
                        verified={true}
                    />
                </Link>
                <UserName id={userData.id}>{userComponent(userData)}</UserName>
                <div
                    className={[chatHeaderStyles.presence, online ? chatHeaderStyles.online : chatHeaderStyles.offline].join(" ")}
                    title={online ? t("Chat.Online") : t("Chat.Offline")}
                />
                {timestamp > 0 && <div className={chatHeaderStyles.date}>
                    {toDateString(timestamp)}
                </div>}
                {chatMeta.readonly && <div
                    className={chatHeaderStyles.date}
                    title={`${userData.name} has removed this chat at his side, so you can not chat here anymore`}
                >
                    Read-only
                </div>}
            </div>
        </NavigationToolbar>
        {deleteOpen && <ConfirmComponent
            children={t("Chat.Chat will be deleted for you.")}
            confirmLabel={t("Chat.Delete chat")}
            critical
            onCancel={() => setState({...state, deleteOpen: false})}
            onConfirm={handleConfirmDeletion}
            title={t("Chat.Delete chat")}
        />}
    </>
};
