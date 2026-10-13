import React from "react";
import {useDispatch} from "react-redux";
import {matchPath, useHistory} from "react-router-dom";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import {useBackend, useDatabase} from "../controllers";
import Pagination from "../controllers/FirebasePagination";
import {cacheDatas, MenuBadge, useFirebase, usePages} from "../controllers/General";
import notifySnackbar from "../controllers/notifySnackbar";
import {UserData} from "../controllers/UserData";
import {useCurrentUserDataValue} from "../controllers/useCurrentUserData";
import {ChatMeta} from "./ChatMeta";
import {chatsCounterReducer} from "./chatsCounterReducer";

export default ({clearText = text => text}) => {
    const backend = useBackend();
    const currentUserData = useCurrentUserDataValue();
    const database = useDatabase();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();

    React.useEffect(() => {
        if (!currentUserData.id) return;
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
            const userData = cacheDatas.put(data.uid, new UserData(database));
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
        const installListenerIfNeeded = (id, live) => ChatMeta(database).fetch(id)
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
                dispatch({type: lazyListComponentReducer.RESET, cache: "chats"});
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
                            dispatch({type: lazyListComponentReducer.RESET, cache: "chats"});
                            dispatch({type: MenuBadge.DECREASE, page: pages.chats});
                            dispatch({type: chatsCounterReducer.COUNTER, counter: chatsWithNewMessages.length});
                        }
                    } else {
                        // newMessage(update, id);
                    }
                })
                metas[meta.id] = meta;
            }).catch(error => {
                console.error(`[ChatsDaemon] failed for ${currentUserData.id}`, error)
                backend.request("fixChat", {id, uid: currentUserData.id})
                    .then(console.log)
                    .catch(console.error);
            });

        const listener = database.addEventListener(["_chats", currentUserData.id], {
            onChildAdd({key, value}) {
                return installListenerIfNeeded(key);
            },
            onChildChange({key, value}) {
                return installListenerIfNeeded(key, true);
            }
        });

        console.log("[ChatsDaemon] installed");
        return () => {
            listener.remove();
            pagination.reset();
            for (let id in metas) {
                id && metas[id] && metas[id].unwatch();
            }
        }
    }, [currentUserData.id]);
    return null;
}
