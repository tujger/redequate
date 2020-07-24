import React from "react";
import {useDispatch} from "react-redux";
import {withStyles} from "@material-ui/core";
import {useCurrentUserData, useFirebase} from "../controllers";
import LazyListComponent from "../components/LazyListComponent";
import Pagination from "../controllers/FirebasePagination";
import ChatsItem from "./ChatsItem";
import {ChatsDaemon} from "./ChatsDaemon";

const styles = theme => ({
    inputbox: {
        flex: "1 auto",
    },
    messagebox: {
        backgroundColor: theme.palette.background.paper,
        bottom: theme.spacing(-1),
        marginBottom: theme.spacing(-1),
        paddingBottom: theme.spacing(1),
        position: "sticky",
        width: "100%"
    },
    observer: {
        height: 0,
        width: "100%",
    },
});

const Chats = (props) => {
    const {
        daemon,
        userComponent = userData => userData.name,
        textComponent = text => text,
    } = props;
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();

    React.useEffect(() => {
        dispatch({type: LazyListComponent.RESET, cache: "chats"});
        // eslint-disable-next-line
    }, []);

    if (daemon) return <ChatsDaemon {...props}/>

    return <LazyListComponent
            cache={"chats"}
            pagination={() => new Pagination({
                child: "timestamp",
                order: "desc",
                ref: firebase.database().ref("_chats").child(currentUserData.id),
                size: 10,
            })}
            itemTransform={async item => {
                if (item.key === "!meta") return null;
                return item
            }}
            itemComponent={item => <ChatsItem
                id={item.key}
                key={item.key}
                lastMessageTimestamp={item.value.timestamp}
                textComponent={textComponent}
                userComponent={userComponent}
            />}
            noItemsComponent={<ChatsItem label={"No chats found"}/>}
            placeholder={<ChatsItem skeleton/>}
        />
};

export default withStyles(styles)(Chats);
