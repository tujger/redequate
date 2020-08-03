import React from "react";
import {useDispatch} from "react-redux";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import {IconButton, withStyles} from "@material-ui/core";
import SendIcon from "@material-ui/icons/Send";
import {useHistory, useParams} from "react-router-dom";
import {InView} from "react-intersection-observer";
import {cacheDatas, notifySnackbar, useCurrentUserData, useFirebase, UserData, useWindowData} from "../controllers";
import ProgressView from "../components/ProgressView";
import LoadingComponent from "../components/LoadingComponent";
import ChatList from "./ChatList";
import LazyListComponent from "../components/LazyListComponent";
import {ChatMeta} from "./ChatMeta";
import ChatHeader from "./ChatHeader";

const styles = theme => ({
    /*avatar: {
        height: theme.spacing(4),
        marginRight: theme.spacing(1),
        width: theme.spacing(4),
    },*/
    /*inputbox: {
        flex: "1 auto",
    },*/
    messagebox: {
        backgroundColor: theme.palette.background.default,
        flexWrap: "nowrap",
        [theme.breakpoints.up("md")]: {
            bottom: theme.spacing(-1),
            marginBottom: theme.spacing(-1),
            paddingBottom: theme.spacing(1),
            position: "sticky",
            width: "100%",
        },
        [theme.breakpoints.down("md")]: {
            bottom: 0,
            left: 0,
            margin: 0,
            padding: theme.spacing(1),
            paddingRight: 0,
            position: "fixed",
            right: 0,
        },
    },
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
    inputfield: {
        alignItems: "center",
        display: "flex",
        overflowX: "auto",
    }
});

const InputBox = React.forwardRef(({classes, inputComponent, onSend}, ref) => {
    const windowData = useWindowData()
    const [state, setState] = React.useState({value: ""});
    const {value} = state;

    const handleChange = evt => {
        setState({...state, value: evt.target.value});
    }

    const handleSend = () => {
        if (!value) return;
        onSend(value);
        setState({...state, value: ""})
    }

    return <Grid container ref={ref} className={classes.messagebox}>
        <Grid item xs className={classes.inputfield}>
            <inputComponent.type
                {...inputComponent.props}
                autofocus={!windowData.isNarrow()}
                color={"secondary"}
                fullWidth
                onChange={handleChange}
                onKeyUp={event => {
                    if (event.key === "Enter"/* && event.ctrlKey*/) {
                        handleSend();
                    } else if (event && event.key === "Escape") {
                        handleChange({target: {value: ""}});
                        setState(state => ({...state, value: ""}));
                    }
                }}
                value={value}
            />
        </Grid>
        <Grid item>
            <IconButton aria-label="send message" onClick={handleSend}>
                <SendIcon/>
            </IconButton>
        </Grid>
    </Grid>
})

const Chat = (props) => {
    const {
        classes,
        inputComponent = <TextField
            placeholder={"Type message"}
        />,
        textComponent = text => <div>{text}</div>,
        userComponent = userData => userData.name
    } = props;
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
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
        dispatch(ProgressView.SHOW);
        dispatch({type: LazyListComponent.RESET, cache: "chats"});
        const chatMeta = ChatMeta(firebase).mix(currentUserData.id, id);
        const userData = cacheDatas.put(id, UserData(firebase));
        chatMeta.fetch()
            .then(() => userData.fetch(id, [UserData.IMAGE, UserData.NAME]))
            .then(() => chatMeta.updateVisit(currentUserData.id))
            .then(() => setState(state => ({...state, chatMeta, userData})))
            .catch(error => {
                notifySnackbar(error);
                history.goBack();
            })
            .finally(() => dispatch(ProgressView.HIDE));
        return () => {
            chatMeta.updateVisit(currentUserData.id);
        }
        // eslint-disable-next-line
    }, [id]);

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
                chatKey={chatKey}
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
        <InputBox inputComponent={inputComponent} ref={inputRef} onSend={handleSend} classes={classes}/>
    </React.Fragment>
};

export default withStyles(styles)(Chat);

