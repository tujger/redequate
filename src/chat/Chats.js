import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {DatabaseOrder} from "../../packages/database/src";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import LoadingComponent from "../components/LoadingComponent";
import {useDatabase, useRedirectToLogin} from "../controllers";
import {useCurrentUserDataValue} from "../controllers/useCurrentUserData";
import baseStyles from "../themes/Base.module.css";
import ChatsDaemon from "./ChatsDaemon";
import ChatsItem from "./ChatsItem";

export default (
    {
        daemon,
        textComponent = text => text,
        userComponent = userData => userData.name,
        ...props
    }) => {
    if (daemon) return <ChatsDaemon {...props} textComponent={textComponent} userComponent={userComponent}/>;
    return <ChatsPage {...props} textComponent={textComponent} userComponent={userComponent}/>;
}

const ChatsPage = (
    {
        textComponent,
        userComponent
    }) => {
    const currentUserData = useCurrentUserDataValue();
    const database = useDatabase();
    const dispatch = useDispatch();
    const shouldRedirectToLogin = useRedirectToLogin();
    const {t} = useTranslation();

    React.useEffect(() => {
        dispatch({type: lazyListComponentReducer.RESET, cache: "chats"});
    }, [currentUserData.id, dispatch]);

    if (shouldRedirectToLogin) return <LoadingComponent/>;

    return <div className={baseStyles.content}>
        <LazyListComponent
            // cache={"chats"}
            cursor={database.cursor(["_chats", currentUserData.id], {
                order: DatabaseOrder.DESC,
                orderBy: ["timestamp"],
                start: 0
            })}
            ItemComponent={item => <ChatsItem
                id={item.id}
                lastMessageTimestamp={item.value.timestamp}
                textComponent={textComponent}
                userComponent={userComponent}
            />}
            itemTransform={async item => {
                if (item.key === "!meta") return null;
                return {id: item.key, ...item}
            }}
            noItemsComponent={<ChatsItem label={t("Chat.No chats found")}/>}
            placeholder={<ChatsItem skeleton/>}
        />
    </div>
}
