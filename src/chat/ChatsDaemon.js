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
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import ChatsCounter from "./ChatsCounter";
import {useDispatch} from "react-redux";
import {matchPath, useHistory} from "react-router-dom";

export const ChatsDaemon = ({clearText = text => text}) => {
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();

    React.useEffect(() => {
        const daemonNew = firebase.database().ref("_chats").child(currentUserData.id);
        const metas = {};
        const chatsWithNewMessages = [];
        const pagination = new Pagination({
            child: "timestamp",
            order: "desc",
            ref: daemonNew,
            size: 10000,
        });
        const newMessage = (data, chatId) => {
            if (data.uid === currentUserData.id) return;
            if (!document.hasFocus()) return;
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
                    exact: true,
                    path: pages.chat._route,
                    strict: true
                });
                if (match && match.params
                    && match.params.id === meta.uidOtherThan(currentUserData.id)) {
                    return;
                }
                if (live) newMessage(meta.lastMessage, id);
                console.warn("NEW", meta.lastVisit(currentUserData.id), meta, meta.lastMessage, match);
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
            }).catch(error => {
                console.error(error);
                console.error(`[ChatsDaemon] failed for ${currentUserData.id}`)
            });

        pagination.next()
            .then(chats => {
                chats.forEach(chat => installListenerIfNeeded(chat.key))
                daemonNew.on("child_changed", snapshot => {
                    return installListenerIfNeeded(snapshot.key, true);
                });
            })
            .catch(console.error);

        return () => {
            daemonNew && daemonNew.off();
            pagination.reset();
            for (let id in metas) {
                id && metas[id] && metas[id].unwatch();
            }
        }
        // eslint-disable-next-line
    }, []);
    console.log("[ChatsDaemon] installed")
    return null;
}
