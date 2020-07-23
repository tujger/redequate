import {
    cacheDatas,
    MenuBadge,
    notifySnackbar,
    useCurrentUserData,
    useFirebase,
    usePages,
    UserData
} from "../controllers";
import React from "react";
import Pagination from "../controllers/FirebasePagination";
import {ChatMeta} from "./ChatMeta";
import LazyListComponent from "../components/LazyListComponent";
import {ChatsCounter, useStylesDaemon} from "./Chats";
import {useTheme} from "@material-ui/styles";
import {useDispatch} from "react-redux";
import {Link, useHistory, useParams, matchPath} from "react-router-dom";

export const ChatsDaemon = ({clearText, textComponent}) => {
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const theme = useTheme();
    const classes = useStylesDaemon(theme)({});

    React.useEffect(() => {
        const daemonNew = firebase.database().ref("_chats").child(currentUserData.id);
        const metas = {};
        const pagination = new Pagination({
            child: "timestamp",
            order: "desc",
            ref: daemonNew,
            size: 10000,
        });
        pagination.next()
            .then(async chats => {
                const chatsWithNewMessages = [];
                const newMessage = (data, chatId) => {
                    if (data.uid === currentUserData.id) return;
                    const userData = cacheDatas.put(data.uid, UserData(firebase));
                    userData.fetch(data.uid, [UserData.NAME])
                        .then(() => notifySnackbar({
                            id: pages.chat.route + data.uid,
                            onClick: () => history.push(pages.chat.route + data.uid),
                            system: true,
                            title: <React.Fragment>
                                {userData.name}: {clearText(data.text)}
                            </React.Fragment>
                        }))
                }
                const installListenerIfNeeded = (id, live) => ChatMeta(firebase).fetch(id)
                    .then(meta => {
                        if (meta.lastVisit(currentUserData.id) > meta.timestamp) return;
                        if (chatsWithNewMessages.indexOf(id) >= 0) return;
                        const match = matchPath(window.location.pathname, {
                            path: pages.chat._route,
                            exact: true,
                            strict: true
                        });
                        if (match && match.params
                            && match.params.id === meta.uidOtherThan(currentUserData.id)) {
                            return;
                        }
                        if (live) newMessage(meta.lastMessage, id);
                        chatsWithNewMessages.push(id);
                        dispatch({type: LazyListComponent.RESET, cache: "chats"});
                        dispatch({type: MenuBadge.INCREASE, page: pages.chats});
                        dispatch({type: ChatsCounter.COUNTER, counter: chatsWithNewMessages.length});
                        meta.watch(update => {
                            if (update.type === "visit") {
                                if (update.uid !== currentUserData.id) return;
                                if (meta.timestamp < update.timestamp) {
                                    if (chatsWithNewMessages.indexOf(id) >= 0) {
                                        chatsWithNewMessages.splice(chatsWithNewMessages.indexOf(id), 1);
                                    }
                                    meta.unwatch();
                                    delete metas[meta.id];
                                    dispatch({type: LazyListComponent.RESET, cache: "chats"});
                                    dispatch({type: MenuBadge.DECREASE, page: pages.chats});
                                    dispatch({type: ChatsCounter.COUNTER, counter: chatsWithNewMessages.length});
                                }
                            } else {
                                newMessage(update, id);
                            }
                        })
                        metas[meta.id] = meta;
                    })

                chats.forEach(chat => installListenerIfNeeded(chat.key))
                daemonNew.on("child_changed", snapshot => {
                    installListenerIfNeeded(snapshot.key, true);
                });
            })
            .catch(error => console.log(error));

        return () => {
            daemonNew && daemonNew.off();
            pagination.reset();
            for (let id in metas) {
                id && metas[id] && metas[id].unwatch();
            }
        }
        // eslint-disable-next-line
    }, []);

    return null;
}
