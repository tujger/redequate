import React from "react";
import AvatarView from "../components/AvatarView";
import ItemPlaceholderComponent from "../components/ItemPlaceholderComponent";
import ListItemComponent from "../components/ListItemComponent";
import {cacheDatas, notifySnackbar, toDateString, useCurrentUserDataValue, useDatabase, UserData} from "../controllers";
import chatStyles from "./styles/ChatItem.module.css";

export default (props) => {
    const {data, skeleton, textComponent} = props;
    const currentUserData = useCurrentUserDataValue();
    const database = useDatabase();
    const [authorData, setAuthorData] = React.useState(null);
    const uid = data?.uid;
    const isItemOut = currentUserData.id === uid;
    const userData = isItemOut ? currentUserData : authorData;

    React.useEffect(() => {
        if (skeleton || isItemOut) return;
        let isMounted = true;
        const authorData = cacheDatas.put(uid, new UserData(database));
        authorData.fetch(uid, [UserData.IMAGE, UserData.NAME])
            .then(() => isMounted && setAuthorData(authorData))
            .catch(error => {
                if (isMounted) notifySnackbar(error);
            });

        return () => {
            isMounted = false;
        }
    }, [skeleton, uid, database, isItemOut]);

    if (skeleton) return <ItemPlaceholderComponent/>;

    if (!userData || userData.id !== uid) return null;

    return <ListItemComponent
        avatar={<AvatarView
            image={userData.image}
            initials={userData.initials}
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
    </ListItemComponent>;
}
