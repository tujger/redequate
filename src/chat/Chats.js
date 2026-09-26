import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import Pagination from "../controllers/FirebasePagination";
import {useCurrentUserData} from "../controllers/UserData";
import ChatsDaemon from "./ChatsDaemon";
import ChatsItem from "./ChatsItem";
import chatStyles from "./styles/Chats.module.css";

export default (
    {
        daemon,
        textComponent = text => text,
        userComponent = userData => userData.name,
        ...rest
    }) => {
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const {t} = useTranslation();

    React.useEffect(() => {
        dispatch({type: lazyListComponentReducer.RESET, cache: "chats"});
        // eslint-disable-next-line
    }, []);

    if (daemon) {
        return <ChatsDaemon
            {...rest}
            daemon={daemon}
            textComponent={textComponent}
            userComponent={userComponent}
        />
    }

    return <div className={chatStyles.center}>
        <LazyListComponent
            cache={"chats"}
            itemComponent={item => <ChatsItem
                id={item.key}
                key={item.key}
                lastMessageTimestamp={item.value.timestamp}
                textComponent={textComponent}
                userComponent={userComponent}
            />}
            itemTransform={async item => {
                if (item.key === "!meta") return null;
                return item
            }}
            noItemsComponent={<ChatsItem label={t("Chat.No chats found")}/>}
            pagination={() => new Pagination({
                child: "timestamp",
                order: "desc",
                start: 0,
                ref: "_chats/" + currentUserData.id,
            })}
            placeholder={<ChatsItem skeleton/>}
        />
    </div>
}
