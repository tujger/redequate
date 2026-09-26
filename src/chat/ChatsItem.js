import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {Link, useHistory} from "react-router-dom";
import AvatarView from "../components/AvatarView";
import ItemPlaceholderComponent from "../components/ItemPlaceholderComponent";
import UserName from "../controls/UserName/UserName";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import {cacheDatas, usePages} from "../controllers/General";
import {useCurrentUserData, UserData} from "../controllers/UserData";
import useRippleEffect from "../helpers/useRippleEffect";
import {ChatMeta} from "./ChatMeta";
import chatStyles from "./styles/ChatsItem.module.css";

export default props => {
    // eslint-disable-next-line react/prop-types
    const {id, skeleton, label, onClick, userComponent, textComponent} = props;
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const history = useHistory();
    const pages = usePages();
    const [state, setState] = React.useState({});
    const {shown, userData, chatMeta, online, removed} = state;
    const {t} = useTranslation();
    const onPointerDown = useRippleEffect();

    const fetchIsNew = () => {
        const latestVisit = chatMeta.lastVisit(currentUserData.id);
        // console.log(data.created > latestVisit, data.created, latestVisit);
        // console.log(new Date(data.created).toLocaleString(), new Date(latestVisit).toLocaleString());
        return chatMeta.lastMessage.created > latestVisit;
    }

    React.useEffect(() => {
        if (skeleton || label) return;
        let isMounted = true;
        const chatMeta = ChatMeta();
        chatMeta.getOrCreateFor(currentUserData.id, id)
            .then(() => chatMeta.fetch())
            .then(() => {
                const uid = chatMeta.uidOtherThan(currentUserData.id);
                return cacheDatas.put(uid, UserData()).fetch(uid, [UserData.IMAGE, UserData.NAME]);
            })
            .then(userData => {
                chatMeta.watch(({removed}) => {
                    if (removed) {
                        dispatch({type: lazyListComponentReducer.RESET, cache: "chats"});
                        history.goBack();
                    }
                    isMounted && setState(state => ({...state, chatMeta}));
                });
                chatMeta.watchOnline({
                    uid: userData.id,
                    onChange: ({online, timestamp}) => {
                        isMounted && setState(state => ({...state, online, timestamp}));
                    }
                });
                isMounted && setState({...state, userData, chatMeta});
            })
            .catch(error => {
                console.error(error)
                isMounted && setState({...state, removed: true})
            });

        return () => {
            chatMeta.unwatch();
            chatMeta.unwatchOnline();
            isMounted = false;
        }
        // eslint-disable-next-line
    }, []);

    if (removed) return null;
    if (label) return <ItemPlaceholderComponent label={label} pattern={"flat"}/>;
    if (skeleton || !chatMeta || !userData) return <ItemPlaceholderComponent skeleton pattern={"flat"}/>;

    const isNew = fetchIsNew() && !shown;

    const handleClick = event => {
        event.stopPropagation();
        onClick ? onClick(chatMeta.id) : history.push(pages.chat.route + chatMeta.id);
    };

    const handleKeyDown = event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        handleClick(event);
    };

    return <div
        className={[chatStyles.card, chatStyles.cardFlat, chatStyles.cardActionArea].join(" ")}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={onPointerDown}
        role='button'
        tabIndex={0}
    >
        <div className={chatStyles.cardHeader}>
            <Link
                className={chatStyles.avatarLink}
                onClick={event => event.stopPropagation()}
                to={pages.user.route + userData.id}
            >
                <AvatarView
                    className={chatStyles.avatar}
                    image={userData.image}
                    initials={userData.initials}
                    verified={true}
                />
            </Link>
            <div className={chatStyles.cardContent}>
                <div className={chatStyles.titleRow}>
                    <UserName
                        className={[isNew ? chatStyles.unread : chatStyles.read].join(" ")}
                        id={userData.id}
                    >
                        {userComponent(userData)}
                    </UserName>
                    <div
                        className={[chatStyles.presence, online ? chatStyles.online : chatStyles.offline].join(" ")}
                        title={online ? t("Chat.Online") : t("Chat.Offline")}
                    />
                </div>
                <div className={[chatStyles.message, isNew ? chatStyles.unread : chatStyles.read].join(" ")}>
                    {textComponent(
                        (cacheDatas.get(chatMeta.lastMessage.uid) || {}).name
                        + ": " + chatMeta.lastMessage.text
                    )}
                </div>
            </div>
        </div>
    </div>
}
