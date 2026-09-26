import React from "react";
import AvatarView from "../components/AvatarView";
import ItemPlaceholderComponent from "../components/ItemPlaceholderComponent";
import {cacheDatas, toDateString, useCurrentUserData, UserData} from "../controllers";
import chatStyles from "./styles/ChatItem.module.css";

export default (props) => {
    const {data, skeleton, textComponent} = props;
    const currentUserData = useCurrentUserData();
    const [state, setState] = React.useState({});
    const {authorData} = state;

    React.useEffect(() => {
        if (skeleton) return;
        let isMounted = true;
        const authorData = cacheDatas.put(data.uid, UserData());
        authorData.fetch(data.uid, [UserData.IMAGE, UserData.NAME])
            .then(() => isMounted && setState({...state, authorData}))

        return () => {
            isMounted = false;
        }
    }, []);

    if (skeleton) return <ItemPlaceholderComponent/>;

    const isItemOut = currentUserData.id === data.uid;

    if (!authorData) return null;
    return <div className={[chatStyles.chatItem, isItemOut ? chatStyles.chatItemOut : chatStyles.chatItemIn].join(" ")}>
        <div className={chatStyles.messageContent}>
            <AvatarView
                className={chatStyles.avatarSmallest}
                image={authorData.image}
                initials={authorData.initials}
                verified={true}
            />
            <div className={chatStyles.textWrapper}>
                <div className={chatStyles.text}>{textComponent(data.text)}</div>
                <div className={chatStyles.timestamp}>{toDateString(data.created)}</div>
            </div>
        </div>
    </div>
}
