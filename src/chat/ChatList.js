import React from 'react';
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import ChatItem from "./ChatItem";
import {useFirebase} from "../controllers";
import Pagination from "../controllers/FirebasePagination";

const ChatList = ({chatKey, chatMeta, containerRef, textComponent}) => {
    const firebase = useFirebase();
    return <LazyListComponent
        containerRef={containerRef}
        disableProgress={true}
        itemComponent={item => <ChatItem
            chatMeta={chatMeta}
            data={item.value}
            key={item.key}
            textComponent={textComponent}
        />}
        itemTransform={item => {
            if(item.key === "!meta") return null;
            return item
        }}
        live
        noItemsComponent={<div/>}
        pagination={() => new Pagination({
            order: "desc",
            ref: firebase.database().ref("chats").child(chatKey),
            size: 100,
        })}
        placeholder={<ChatItem skeleton/>}
        reverse
    />
}

export default ChatList;
