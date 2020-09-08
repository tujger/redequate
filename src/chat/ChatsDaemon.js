import React from "react";
import {notifySnackbar} from "../controllers/Notifications";
import {cacheDatas, MenuBadge, useFirebase, usePages} from "../controllers/General";
import {useCurrentUserData, UserData} from "../controllers/UserData";
import Pagination from "../controllers/FirebasePagination";
import {ChatMeta} from "./ChatMeta";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import ChatsCounter from "./ChatsCounter";
import {useDispatch} from "react-redux";
import {matchPath, useHistory} from "react-router-dom";
import {fetchCallable} from "../controllers";
import {chatsCounterReducer} from "../reducers/chatsCounterReducer";
import {lazyListReducer} from "../reducers/lazyListReducer";

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
            console.log(`[ChatsDaemon] new message: ${JSON.stringify(data)}`)
            // if (!document.hasFocus()) return;
            const userData = cacheDatas.put(data.uid, UserData(firebase));
            userData.fetch(data.uid, [UserData.NAME])
                .then(() => notifySnackbar({
                    id: pages.chat.route + chatId,
                    onClick: () => history.push(pages.chat.route + chatId),
                    system: true,
                    title: <React.Fragment>
                        {userData.name}: {clearText(data.text)}
                    </React.Fragment>
                }))
        }
        const installListenerIfNeeded = (id, live) => ChatMeta(firebase).fetch(id)
            .then(meta => {
                if (meta.lastMessage.uid === currentUserData.id) return;
                if (meta.lastVisit(currentUserData.id) > meta.timestamp) return;
                const match = matchPath(window.location.pathname, {
                    exact: true,
                    path: pages.chat._route,
                    strict: true
                });
                if (match && match.params && match.params.id === id) {
                    return;
                }
                if (live) newMessage(meta.lastMessage, id);
                if (chatsWithNewMessages.indexOf(id) >= 0) return;
                chatsWithNewMessages.push(id);
                dispatch({type: lazyListReducer.RESET, cache: "chats"});
                dispatch({type: MenuBadge.INCREASE, page: pages.chats});
                dispatch({type: chatsCounterReducer.COUNTER, counter: chatsWithNewMessages.length});
                meta.watch(update => {
                    if (update.type === "visit") {
                        if (update.uid !== currentUserData.id) return;
                        if (meta.timestamp < update.timestamp) {
                            if (chatsWithNewMessages.indexOf(id) >= 0) {
                                chatsWithNewMessages.splice(chatsWithNewMessages.indexOf(id), 1);
                            }
                            meta.unwatch();
                            delete metas[meta.id];
                            dispatch({type: lazyListReducer.RESET, cache: "chats"});
                            dispatch({type: MenuBadge.DECREASE, page: pages.chats});
                            dispatch({type: chatsCounterReducer.COUNTER, counter: chatsWithNewMessages.length});
                        }
                    } else {
                        // newMessage(update, id);
                    }
                })
                metas[meta.id] = meta;
            }).catch(error => {
                console.error(`[ChatsDaemon] failed for ${currentUserData.id}`)
                console.error(error);
                fetchCallable(firebase)("fixChat", {id, uid: currentUserData.id})
                    .then(console.log)
                    .catch(console.error);

            });

        // pagination.next()
        //     .then(chats => {
        //         chats.forEach(chat => installListenerIfNeeded(chat.key))
        //     })
        //     .catch(console.error);
        daemonNew.on("child_added", snapshot => {
            return installListenerIfNeeded(snapshot.key);
        });
        daemonNew.on("child_changed", snapshot => {
            return installListenerIfNeeded(snapshot.key, true);
        });

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
