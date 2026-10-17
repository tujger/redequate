import React from "react";
import {DatabaseOrder} from "../../packages/database/src";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import {useDatabase} from "../controllers";
import ChatItem from "./ChatItem";

export default ({chatKey, chatMeta, containerRef, textComponent, scrollerClassName}) => {
    const database = useDatabase();

    return <LazyListComponent
        containerRef={containerRef}
        cursor={database.cursor(["chats", chatKey], {order: DatabaseOrder.DESC})}
        disableProgress
        ItemComponent={item => <ChatItem
            chatMeta={chatMeta}
            data={item.value}
            key={item.id}
            textComponent={textComponent}
        />}
        itemTransform={item => {
            if (item.key === "!meta") return null;
            return {id: item.key, ...item}
        }}
        live
        noItemsComponent={<div/>}
        page={100}
        placeholder={<ChatItem skeleton/>}
        reverse
        scrollerClassName={scrollerClassName}
    />
}
