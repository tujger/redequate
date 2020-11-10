import React from "react";
import {useDispatch} from "react-redux";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import withStyles from "@material-ui/styles/withStyles";
import {useHistory, useParams} from "react-router-dom";
import {InView} from "react-intersection-observer";
import {useCurrentUserData, UserData} from "../controllers/UserData";
import ProgressView from "../components/ProgressView";
import LoadingComponent from "../components/LoadingComponent";
import ChatList from "./ChatList";
import {ChatMeta} from "./ChatMeta";
import ChatHeader from "./ChatHeader";
import ChatInputBox from "./ChatInputBox";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import {styles, stylesList} from "../controllers/Theme";
import notifySnackbar from "../controllers/notifySnackbar";
import {cacheDatas, useFirebase, usePages} from "../controllers/General";

const stylesCurrent = theme => ({
    indent: {
        marginTop: theme.spacing(10),
    },
});

const Chat = (props) => {
    const {
        classes,
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
        const chatMeta = ChatMeta(firebase);
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
            .then(() => cacheDatas.put(chatMeta.uidOtherThan(currentUserData.id), UserData(firebase)))
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
            className={classes.topSticky}
            chatMeta={chatMeta}
            id={id}
            userComponent={userComponent}
            userData={userData}
        />}
        <Grid
            className={classes.center}
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
                scrollerClassName={classes.indent}
                textComponent={textComponent}/>
        </Grid>
        {/*<InView
            children={<div id={"inview"}/>}
            onChange={(inView) => {
                if (inputRef.current) {
                    if (inView) {
                        const tokens = [];//classes.messageboxFixed.split(/\s+/);
                        for (const token of tokens) {
                            inputRef.current.classList.remove(token);
                        }
                    } else {
                        const sizes = inputRef.current.getBoundingClientRect();
                        const containerSizes = containerRef.current.getBoundingClientRect();
                        // inputRef.current.style.left = sizes.left + "px";
                        inputRef.current.style.width = containerSizes.width + "px";
                        inputRef.current.classList.add(classes.messageboxFixed);
                    }
                }
            }}
        />*/}
        {!chatMeta.readonly && <>
            <ChatInputBox
                className={classes.bottomSticky}
                style={{position: "relative", opacity: 0}}
                inputComponent={inputComponent}
            />
            <ChatInputBox
                className={classes.bottomSticky}
                inputComponent={inputComponent}
                onSend={handleSend}
                ref={inputRef}
            />
        </>}
    </>
};

export default withStyles((theme) => ({
    ...styles(theme),
    ...stylesCurrent(theme),
}))(Chat);
