import {cacheDatas} from "../controllers";

const ONLINE_TIMEOUT = 60000;
export const ChatMeta = (firebase) => {
    let _id, _meta, _persisted = false, _lastMessage, _timestamp, _watchRef, _visitRef, _onlineRef, _removeRef;
    const indexRef = firebase.database().ref("_chats");
    const chatsRef = firebase.database().ref("chats");

    const fetchUids = () => {
        return (_meta || {}).members || {};
    }

    const _body = {
        get asString() {
            return _body.toString();
        },
        get id() {
            return _id;
        },
        get lastMessage() {
            return _lastMessage || {};
        },
        get persisted() {
            return _persisted;
        },
        get timestamp() {
            return _timestamp;
        },
        create: (id, meta) => {
            _id = id;
            if (meta !== undefined) {
                _meta = meta;
            }
            return _body;
        },
        fetch: async (id) => {
            _id = _id || id;
            const tokens = _id.split("_");
            const tasks = [];
            tasks.push(new Promise((resolve, reject) => {
                chatsRef.child(_id).child("!meta").once("value")
                    .then(snapshot => {
                        if(snapshot.exists()) {
                            _persisted = true;
                        }
                        _meta = snapshot.val();
                        resolve();
                    })
            }));
            tasks.push(new Promise((resolve, reject) => {
                indexRef.child(tokens[0]).child(_id).once("value")
                    .then(snapshot => {
                        _timestamp = (snapshot.val() || {}).timestamp;
                        resolve();
                    })
            }));
            // tasks.push(new Promise((resolve, reject) => {
            //     indexRef.child(tokens[1]).child(_id).once("value")
            //         .then(snapshot => {
            //             _users[tokens[1]] = snapshot.val();
            //             resolve();
            //         })
            // }));
            tasks.push(new Promise((resolve, reject) => {
                chatsRef.child(_id).orderByChild("created").limitToLast(1).once("value", snap => {
                    snap.forEach(snapshot => {
                        if(snapshot.key !== "!meta") {
                            _lastMessage = snapshot.val();
                        }
                    })
                    resolve();
                })
            }));
            await Promise.all(tasks);
            return _body;
        },
        lastVisit: uid => {
            return fetchUids()[uid] || 0;
        },
        mix: (uid1, uid2, meta) => {
            return _body.create([uid1, uid2].sort().join("_"), meta);
        },
        uidOtherThan: uid => {
            for(let userId in fetchUids()) {
                if(userId === uid) continue;
                if(userId) return userId;
            }
            for(let userId of _id.split("_")) {
                if(userId === uid) continue;
                return userId;
            }
        },
        update: async () => {
            const updatesMeta = {};
            const tokens = _id.split("_");

            if(!_persisted) {
                try {
                    updatesMeta["members"] = {
                        [tokens[0]]: 0,
                        [tokens[1]]: 0
                    }
                    await chatsRef.child(_id).child("!meta").update(updatesMeta);
                    _persisted = true;
                } catch (error) {
                    console.error(error)
                }
            }
            const updatesIndex = {};
            updatesIndex[`${tokens[0]}/${_id}/timestamp`] = firebase.database.ServerValue.TIMESTAMP;
            updatesIndex[`${tokens[1]}/${_id}/timestamp`] = firebase.database.ServerValue.TIMESTAMP;

            await indexRef.update(updatesIndex);
            return _body;
        },
        unwatch: () => {
            _watchRef && _watchRef._listener && _watchRef.off("child_added", _watchRef._listener);
            _watchRef = null;
            _visitRef && _visitRef._listener && _visitRef.off("child_changed", _visitRef._listener);
            _visitRef = null;
            _removeRef && _removeRef._listener && _removeRef.off("child_removed", _removeRef._listener);
            _removeRef = null;
        },
        unwatchOnline: () => {
            _onlineRef && _onlineRef._listener && _onlineRef.off("value", _onlineRef._listener);
            _onlineRef = null;
        },
        updateVisit: async uid => {
            if(!_persisted) return;
            return await chatsRef.child(_id).child("!meta/members").child(uid).set(firebase.database.ServerValue.TIMESTAMP);
        },
        watch: onChange => {
            const watchListener = snapshot => {
                const message = snapshot.val() || {};
                if(!_lastMessage || (message && message.created !== _lastMessage.created
                    && message.text !== _lastMessage.text)) {
                    _lastMessage = message;
                    _timestamp = message.created;
                    onChange(message);
                }
            };
            const visitListener = snapshot => {
                onChange({uid: snapshot.key, timestamp: snapshot.val(), type: "visit"});
            }
            const removeListener = snapshot => {
                _persisted = false;
                onChange({removed: true, timestamp: snapshot.val(), type: "remove"});
            }
            _watchRef = chatsRef.child(_id).orderByChild("created").limitToLast(1);
            _watchRef.on("child_added", watchListener);
            _watchRef._listener = watchListener;
            _visitRef = chatsRef.child(_id).child("!meta/members").orderByKey();
            _visitRef.on("child_changed", visitListener);
            _visitRef._listener = visitListener;
            _removeRef = chatsRef.child(_id).child("!meta/members");
            _removeRef.on("child_removed", removeListener);
            _removeRef._listener = removeListener;
        },
        watchOnline: ({uid, timeout = ONLINE_TIMEOUT, onChange}) => {
            let task;
            const onlineListener = snapshot => {
                const now = new Date().getTime();
                const timestamp = snapshot.val();
                if(now - timestamp < timeout) {
                    _meta = _meta || {};
                    _meta.members = _meta.members || {};
                    clearTimeout(task);
                    task = setTimeout(() => {
                        onChange({online: false, timestamp});
                    }, timeout - (now - timestamp))
                    onChange({online: true, timestamp});
                } else {
                    onChange({online: false, timestamp});
                }
            }
            _onlineRef = chatsRef.child(_id).child("!meta/members").child(uid);
            _onlineRef.on("value", onlineListener);
            _onlineRef._listener = onlineListener;
        },
        toString: () => {
            return `[ChatMeta] ${_id}, persisted: ${_persisted}, meta: ${JSON.stringify((_meta))}`;
        }
    }
    return _body;
}
