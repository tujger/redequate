import React from 'react';
import LazyListComponent from "../components/LazyListComponent";
import ChatItem from "./ChatItem";
import {useFirebase} from "../controllers";
import Pagination from "../controllers/FirebasePagination";

const ChatList = ({chatKey, chatMeta, containerRef, textComponent}) => {
    const firebase = useFirebase();
    return <LazyListComponent
        containerRef={containerRef}
        disableProgress={true}
        itemComponent={item => <ChatItem key={item.key} data={item.value} chatMeta={chatMeta} textComponent={textComponent}/>}
        itemTransform={item => {
            if(item.key === "!meta") return null;
            return item
        }}
        live
        noItemsComponent={<div/>}
        reverse
        pagination={() => new Pagination({
            ref: firebase.database().ref("chats").child(chatKey),
            size: 20,
            order: "desc"
        })}
        placeholder={<ChatItem skeleton/>}
    />
}

export default ChatList;
