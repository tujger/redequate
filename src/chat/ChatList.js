import React from "react";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import ChatItem from "./ChatItem";
import Pagination from "../controllers/FirebasePagination";

// eslint-disable-next-line react/prop-types
const ChatList = ({chatKey, chatMeta, containerRef, textComponent, scrollerClassName}) => {
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
            if (item.key === "!meta") return null;
            return item
        }}
        live
        noItemsComponent={<div/>}
        pagination={() => new Pagination({
            order: "desc",
            ref: "chats/" + chatKey,
            size: 100,
        })}
        placeholder={<ChatItem skeleton/>}
        reverse
        scrollerClassName={scrollerClassName}
    />
}

export default ChatList;
