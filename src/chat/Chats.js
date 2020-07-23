import React from "react";
import {connect} from "react-redux";
import {withStyles} from "@material-ui/core";
import {useTheme} from "@material-ui/styles";
import {makeStyles} from "@material-ui/core/styles";
import {useCurrentUserData, useFirebase} from "../controllers";
import LazyListComponent from "../components/LazyListComponent";
import Pagination from "../controllers/FirebasePagination";
import {Layout} from "../controllers/Store";
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
        clearText = text => text,
        daemon,
        userComponent = userData => userData.name,
        textComponent = text => text,
    } = props;
    const firebase = useFirebase();
    const currentUserData = useCurrentUserData();

    React.useEffect(() => {
        // eslint-disable-next-line
    }, []);

    if (daemon) return <ChatsDaemon {...props}/>

    return <React.Fragment>
        <LazyListComponent
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
    </React.Fragment>
};

export default withStyles(styles)(Chats);

export const useStylesDaemon = theme => makeStyles({
    label: {
        color: "inherit"
    },
    badge: {
        color: "#ff0000",
        fontSize: "small",
        fontWeight: "bolder",
        marginBottom: theme.spacing(.5),
        marginLeft: theme.spacing(.5),
        verticalAlign: "super",
    }
})

const _ChatsCounter = ({counter}) => {
    const theme = useTheme();
    const classes = useStylesDaemon(theme)({});
    if (!counter) return null;
    return <span className={classes.badge}>{counter}</span>
}
_ChatsCounter.COUNTER = "chatsCounter_Counter";

export const chatsCounterReducer = (state = {counter: 0}, action) => {
    switch (action.type) {
        case _ChatsCounter.COUNTER:
            return {...state, counter: action.counter};
        case Layout.REFRESH:
            return {...state, random: Math.random()};
        default:
            return state;
    }
};
chatsCounterReducer.skipStore = true;

const mapStateToProps = ({chatsCounterReducer}) => ({
    counter: chatsCounterReducer.counter,
});

export const ChatsCounter = connect(mapStateToProps)(_ChatsCounter);
