import React from "react";
import {Link} from "react-router-dom";
import AvatarView from "../components/AvatarView";
import ItemPlaceholderComponent from "../components/ItemPlaceholderComponent";
import ListItemComponent from "../components/ListItemComponent";
import MentionedTextComponent from "../components/MentionedTextComponent";
import PostBody from "../components/PostComponent/PostBody";
import PostButtons from "../components/PostComponent/PostButtons";
import PostMedia from "../components/PostComponent/PostMedia";
import PostMenu from "../components/PostComponent/PostMenu";
import RotatingReplies from "../components/PostComponent/RotatingReplies";
import cardStyles from "../components/PostComponent/styles/PostComponent.module.css";
import textStyles from "../components/PostComponent/styles/PostText.module.css";
import {cacheDatas, toDateString, useCurrentUserData, UserData} from "../controllers";
import {mentionTags} from "../controllers/mentionTypes";
import mentionStyles from "../controllers/styles/MentionTypes.module.css";
import UserName from "../controls/UserName/UserName";
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

    return <ListItemComponent
        avatar={<AvatarView
            image={authorData.image}
            initials={authorData.initials}
            size={"smaller"}
            verified={true}
        />}
        className={[
            chatStyles.chatItem, isItemOut ? chatStyles.chatItemOut : chatStyles.chatItemIn,
        ].filter(Boolean).join(" ")}
        disableClick
        subtitle={textComponent(data.text)}
        variant={"cloud"}
    >
        <div className={chatStyles.timestamp}>{toDateString(data.created)}</div>
    </ListItemComponent>

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
