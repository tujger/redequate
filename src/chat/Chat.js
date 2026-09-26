import TextField from "@material-ui/core/TextField";
import React from "react";
import {useDispatch} from "react-redux";
import {useHistory, useParams} from "react-router-dom";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import LoadingComponent from "../components/LoadingComponent";
import ProgressView from "../components/ProgressView";
import {cacheDatas, useFirebase, usePages} from "../controllers/General";
import notifySnackbar from "../controllers/notifySnackbar";
import {useCurrentUserData, UserData} from "../controllers/UserData";
import ChatHeader from "./ChatHeader";
import ChatInputBox from "./ChatInputBox";
import ChatList from "./ChatList";
import {ChatMeta} from "./ChatMeta";
import chatStyles from "./styles/Chat.module.css";

const Chat = (props) => {
    const {
        id: idFromProps,
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
    const {id: idFromParams} = useParams();
    const [state, setState] = React.useState({});
    const {userData, chatMeta} = state;
    const inputRef = React.useRef();
    const containerRef = React.useRef();

    const id = idFromProps || idFromParams;
    const db = firebase.database();

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
            .then(() => dispatch({type: lazyListComponentReducer.RESET, cache: "chats"}))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE));
    }

    React.useEffect(() => {
        if (!id) return;
        let isMounted = true;
        dispatch(ProgressView.SHOW);
        dispatch({type: lazyListComponentReducer.RESET, cache: "chats"});
        const chatMeta = ChatMeta();
        chatMeta.getOrCreateFor(currentUserData.id, id, history.location.state && history.location.state.meta)
            // .then(console.log)
            .catch(error => {
                if (error.code === "PERMISSION_DENIED") return;
                notifySnackbar(error);
            })
            .then(() => {
                if (chatMeta.redirect) {
                    history.replace(pages.chat.route + chatMeta.id, {meta: chatMeta.meta});
                    // eslint-disable-next-line no-throw-literal
                    throw "redirect";
                }
            })
            .then(() => chatMeta.fetch())
            .then(() => cacheDatas.put(chatMeta.uidOtherThan(currentUserData.id), UserData()))
            .then(userData => userData.fetch(chatMeta.uidOtherThan(currentUserData.id), [UserData.IMAGE, UserData.NAME]))
            .then(userData => isMounted && setState(state => ({...state, chatMeta, userData})))
            .then(() => chatMeta.updateVisit(currentUserData.id))
            .catch(error => {
                if (error === "redirect") return;
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

    if (!id) return <LoadingComponent/>
    if (!chatMeta || !userData) return <LoadingComponent/>
    return <>
        {idFromParams && <ChatHeader
            chatMeta={chatMeta}
            id={id}
            userComponent={userComponent}
            userData={userData}
        />}
        <div
            className={chatStyles.center}
            ref={containerRef}
        >
            <ChatList
                chatKey={chatMeta.id}
                chatMeta={chatMeta}
                classes={null}
                containerRef={containerRef}
                scrollerClassName={chatStyles.indent}
                textComponent={textComponent}/>
        </div>
        {!chatMeta.readonly && <>
            <ChatInputBox
                className={chatStyles.bottomSticky}
                style={{position: "relative", opacity: 0}}
                inputComponent={inputComponent}
            />
            <ChatInputBox
                className={chatStyles.bottomSticky}
                inputComponent={inputComponent}
                onSend={handleSend}
                ref={inputRef}
            />
        </>}
    </>
};

export default Chat;
