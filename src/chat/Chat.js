import React from "react";
import {useDispatch} from "react-redux";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import {withStyles} from "@material-ui/core";
import {useHistory, useParams} from "react-router-dom";
import {InView} from "react-intersection-observer";
import {cacheDatas, notifySnackbar, useCurrentUserData, useFirebase, usePages, UserData} from "../controllers";
import ProgressView from "../components/ProgressView";
import LoadingComponent from "../components/LoadingComponent";
import ChatList from "./ChatList";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import {ChatMeta} from "./ChatMeta";
import ChatHeader from "./ChatHeader";
import ChatInputBox from "./ChatInputBox";

const styles = theme => ({
    messageboxFixed: {
        bottom: theme.spacing(1),
        position: "fixed",
    },
    messagesList: {
        overflow: "auto",
        [theme.breakpoints.up("lg")]: {
            height: window.innerHeight - theme.spacing(16) - theme.spacing(16),
        },
    },
});

const Chat = (props) => {
    const {
        classes,
        inputComponent = <TextField
            placeholder={"Type message"}
        />,
        textComponent = text => <div>{text}</div>,
        userComponent = userData => userData.name,
    } = props;
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const {id} = useParams();
    const [state, setState] = React.useState({});
    const {userData, chatMeta} = state;
    const inputRef = React.useRef();
    const containerRef = React.useRef();

    const db = firebase.database();

    const fetchChatKey = () => {
        return [id, currentUserData.id].sort().join("_");
    }
    const chatKey = fetchChatKey();

    const handleSend = (value) => {
        dispatch(ProgressView.SHOW);
        const uid = currentUserData.id;
        db.ref("chats").child(chatMeta.id).push({
            created: firebase.database.ServerValue.TIMESTAMP,
            text: value,
            uid,
        })
            .then(() => chatMeta.update())
            .then(() => chatMeta.updateVisit(currentUserData.id))
            .then(() => dispatch({type: LazyListComponent.RESET, cache: "chats"}))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE));
    }

    React.useEffect(() => {
        let isMounted = true;
        dispatch(ProgressView.SHOW);
        dispatch({type: LazyListComponent.RESET, cache: "chats"});
        const chatMeta = ChatMeta(firebase);
        chatMeta.getOrCreateFor(currentUserData.id, id, history.location.state && history.location.state.meta)
            // .then(console.log)
            .catch(error => {
                if(error.code === "PERMISSION_DENIED") return;
                notifySnackbar(error);
            })
            .then(() => {
                if(chatMeta.redirect) {
                    history.replace(pages.chat.route + chatMeta.id, {meta: chatMeta.meta});
                    throw "redirect";
                }
            })
            .then(() => chatMeta.fetch())
            .then(() => cacheDatas.put(chatMeta.uidOtherThan(currentUserData.id), UserData(firebase)))
            .then(userData => userData.fetch(chatMeta.uidOtherThan(currentUserData.id), [UserData.IMAGE, UserData.NAME]))
            .then(userData => isMounted && setState(state => ({...state, chatMeta, userData})))
            .then(() => chatMeta.updateVisit(currentUserData.id))
            .catch(error => {
                if(error === "redirect") return;
                notifySnackbar(error);
                history.goBack();
            })
            .finally(() => dispatch(ProgressView.HIDE));
        return () => {
            isMounted = false;
            chatMeta.updateVisit(currentUserData.id);
        }
        // eslint-disable-next-line
    }, [id]);

    /*React.useEffect(() => {
        const chatMeta = ChatMeta(firebase);
        const chats = chatMeta.getOrCreateFor(currentUserData.id, id);

    }, [])*/

    if (!chatMeta || !userData) return <LoadingComponent/>
    return <React.Fragment>
        <ChatHeader
            chatMeta={chatMeta}
            classes={null}
            id={id}
            userComponent={userComponent}
            userData={userData}
        />
        <Grid
            className={classes.messagesList}
            container
            direction={"column"}
            ref={containerRef}
            wrap={"nowrap"}
        >
            <ChatList
                chatKey={chatMeta.id}
                chatMeta={chatMeta}
                classes={null}
                containerRef={containerRef}
                textComponent={textComponent}/>
        </Grid>
        <InView
            children={<div/>}
            onChange={(inView) => {
                if (inputRef.current) {
                    if (inView) {
                        const tokens = classes.messageboxFixed.split(/\s+/);
                        for (let token of tokens) {
                            inputRef.current.classList.remove(token);
                        }
                    } else {
                        const sizes = inputRef.current.getBoundingClientRect();
                        inputRef.current.style.left = sizes.left + "px";
                        inputRef.current.style.width = sizes.width + "px";
                        inputRef.current.classList.add(classes.messageboxFixed);
                    }
                }
            }}
        />
        {!chatMeta.readonly && <ChatInputBox inputComponent={inputComponent} ref={inputRef} onSend={handleSend}/>}
    </React.Fragment>
};

export default withStyles(styles)(Chat);

