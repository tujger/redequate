import React from "react";
import {cacheDatas, toDateString, useCurrentUserData, UserData} from "../controllers";
import AvatarView from "../components/AvatarView";
import ItemPlaceholderComponent from "../components/ItemPlaceholderComponent";
import chatStyles from "./styles/ChatItem.module.css";

const ChatItem = (props) => {
    // eslint-disable-next-line react/prop-types
    const {data, skeleton, textComponent} = props;
    const currentUserData = useCurrentUserData();
    const [state, setState] = React.useState({});
    const {authorData} = state;

    /* const fetchIsNew = () => {
        const latestVisit = chatMeta[currentUserData.id + "_visit"] || 0;
        // const latestIncoming = meta[currentUserData.id] || 0;
        return data.created > latestVisit;
    } */

    React.useEffect(() => {
        if (skeleton) return;
        let isMounted = true;
        const authorData = cacheDatas.put(data.uid, UserData());
        authorData.fetch(data.uid, [UserData.IMAGE, UserData.NAME])
            .then(() => isMounted && setState({...state, authorData}))

        // setTimeout(() => {
        //     setState(state => ({...state, shown: true}));
        // }, 2000)
        return () => {
            isMounted = false;
        }
        // eslint-disable-next-line
    }, []);

    if (skeleton) return <ItemPlaceholderComponent/>;

    // const isNew = fetchIsNew() && !shown;
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

    /* return <li>
        {isNew && <InView
            onChange={(inView) => {
                if (inView) setState({...state, shown: true});
            }}
            ref={ref => {
                if (!ref) return;
                setTimeout(() => {
                    if (ref && ref.node) ref.node.style.display = "";
                }, 1000)
            }}
            style={{display: "none"}}
        ><b>NEW</b></InView>}
    </li> */
}

export default ChatItem;
