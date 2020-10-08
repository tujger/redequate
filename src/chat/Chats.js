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
import Grid from "@material-ui/core/Grid";
import {styles} from "../controllers/Theme";

const stylesCurrent = theme => ({
    observer: {
        height: 0,
        width: "100%",
    },
});

function Chats(
    {
        classes,
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
    return <Grid container className={classes.center}>
        <LazyListComponent
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
            })}
            placeholder={<ChatsItem skeleton/>}
        />
    </Grid>
}

export default withStyles(theme => ({
    ...styles(theme),
    ...stylesCurrent(theme)
}))(Chats);
