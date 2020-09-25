import React from "react";
import {useDispatch} from "react-redux";
import withStyles from "@material-ui/styles/withStyles";
import {useCurrentUserData} from "../controllers/UserData";
import {useFirebase} from "../controllers/General";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import Pagination from "../controllers/FirebasePagination";
import ChatsItem from "./ChatsItem";
import {ChatsDaemon} from "./ChatsDaemon";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";

const styles = theme => ({
    observer: {
        height: 0,
        width: "100%",
    },
});

function Chats(
    {
        daemon,
        textComponent = text => text,
        userComponent = userData => userData.name,
        ...rest
    }) {
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();

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
    return <LazyListComponent
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
        noItemsComponent={<ChatsItem label={"No chats found"}/>}
        pagination={() => new Pagination({
            child: "timestamp",
            order: "desc",
            ref: firebase.database().ref("_chats").child(currentUserData.id),
            size: 10,
        })}
        placeholder={<ChatsItem skeleton/>}
    />
}

export default withStyles(styles)(Chats);
