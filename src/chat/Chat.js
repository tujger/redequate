import React from "react";
import {useDispatch} from "react-redux";
import {useHistory, useParams} from "react-router-dom";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import LoadingComponent from "../components/LoadingComponent";
import ProgressView from "../components/ProgressView";
import {useDatabase, useRedirectToLogin} from "../controllers";
import {cacheDatas, usePages} from "../controllers/General";
import notifySnackbar from "../controllers/notifySnackbar";
import {useCurrentUserDataValue} from "../controllers/useCurrentUserData";
import {UserData} from "../controllers/UserData";
import TextField from "../controls/TextField/TextField";
import baseStyles from "../themes/Base.module.css";
import ChatHeader from "./ChatHeader";
import ChatInputBox from "./ChatInputBox";
import ChatList from "./ChatList";
import {ChatMeta} from "./ChatMeta";
import chatStyles from "./styles/Chat.module.css";

export default (props) => {
    const {
        id: idFromProps,
        inputComponent = <TextField
            placeholder={"Type message"}
        />,
        textComponent = text => <div>{text}</div>,
        userComponent = userData => userData.name,
    } = props;
    const currentUserData = useCurrentUserDataValue();
    const database = useDatabase();
    const dispatch = useDispatch();
    const history = useHistory();
    const pages = usePages();
    const {id: idFromParams} = useParams();
    const shouldRedirectToLogin = useRedirectToLogin();
    const [state, setState] = React.useState({});
    const {userData, chatMeta} = state;
    const inputRef = React.useRef();
    const containerRef = React.useRef();

    const id = idFromProps || idFromParams;

    const handleSend = (value) => {
        dispatch(ProgressView.SHOW);
        const uid = currentUserData.id;
        database.create(["chats", chatMeta.id]).save({
            created: database.TIMESTAMP,
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
        if (shouldRedirectToLogin || !id) return;
        let isMounted = true;
        dispatch(ProgressView.SHOW);
        dispatch({type: lazyListComponentReducer.RESET, cache: "chats"});
        const chatMeta = ChatMeta(database);
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
            .then(() => cacheDatas.put(chatMeta.uidOtherThan(currentUserData.id), new UserData(database)))
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
    }, [id, currentUserData.id, shouldRedirectToLogin]);

    if (shouldRedirectToLogin || !id) return <LoadingComponent/>
    if (!chatMeta || !userData) return <LoadingComponent/>
    return <>
        {idFromParams && <ChatHeader
            chatMeta={chatMeta}
            id={id}
            userComponent={userComponent}
            userData={userData}
        />}
        <div
            className={[baseStyles.content, chatStyles.chat].join(" ")}
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
