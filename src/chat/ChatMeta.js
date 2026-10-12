import {firebaseMessaging as firebase} from "../controllers/Firebase";
import Pagination from "../controllers/FirebasePagination";
import {UserData} from "../controllers/UserData";

const ONLINE_TIMEOUT = 60000;

/*
Meta:
    chats/__KEY__/!meta/members/__UID__: <last visit timestamp>
    chats/__KEY__/!meta/members/__OPPOSITE_UID__: <last visit timestamp>
    chats/__KEY__/!meta/timestamp: <last message created>
    _chats/__UID__/__KEY__/timestamp: <last message created> (the same as previous)
    _chats/__UID__/__KEY__/private: <__OPPOSITE_UID__> if chat is private
*/

export function ChatMeta(database) {
    // eslint-disable-next-line one-var
    let _id, _meta, _persisted = false, _lastMessage, _timestamp, _watchRef, _visitRef, _onlineRef,
        _redirect, _activeUids = [];
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
        get meta() {
            return _meta;
        },
        get persisted() {
            return _persisted;
        },
        get readonly() {
            return _activeUids.length === 1;
        },
        get redirect() {
            return _redirect;
        },
        get timestamp() {
            return _timestamp;
        },
        create: (id, meta) => {
            _id = id;
            if (meta !== undefined) {
                _meta = meta;
                _activeUids = Object.keys(_meta.members || {});
            }
            return _body;
        },
        fetch: async (id) => {
            _id = _id || id;
            if (!_meta) {
                const value = await database.read(["chats", _id, "!meta"])
                if (value !== undefined) {
                    _persisted = true;
                    _meta = value;
                }
            }
            if (!_meta) throw Error(`[ChatMeta] no meta for ${_id}`);

            const tasks = [];
            _activeUids = [];
            if (_persisted) {
                for (let uid in _meta.members) {
                    tasks.push(new Promise((resolve, reject) => {
                        database.read(["_chats", uid, _id])
                            .then(value => {
                                if (value !== undefined) {
                                    _activeUids.push(uid);
                                }
                                resolve();
                            })
                            .catch(() => {
                                _activeUids.push(uid);
                                resolve();
                            })
                    }));
                }
            } else {
                _activeUids = Object.keys(_meta.members || {});
            }
            tasks.push(new Promise((resolve, reject) => {
                database.read(["chats", _id], {orderBy: "created"})
                    .then(value => {
                        Object.values(value).forEach(last => {
                            _lastMessage = last;
                            _timestamp = last.created;
                        });
                        resolve();
                    }).catch(reject)
            }));
            await Promise.all(tasks);
            return _body;
        },
        fetchFor: async (currentUid, oppositeUid) => {
            let chats = [];
            const value = await database.read(["chats", oppositeUid, "!meta"]);
            if(value !== undefined) {
                chats.push({key: oppositeUid, meta: value, persisted: true});
            }
            if (!chats.length) {
                chats = await Pagination({
                    ref: indexRef.child(currentUid),
                    child: "private",
                    equals: oppositeUid,
                    size: 10
                }).next();
                for (let i = chats.length - 1; i >= 0; i--) {
                    let chat = chats[i];
                    chat.meta = await database.read(["chats", chat.key, "!meta"]);
                    chat.redirect = true;
                    if (chat.meta && chat.meta.members) {
                        let remove = false;
                        for (let uid in chat.meta.members) {
                            try {
                                const value = await database.read(["_chats", uid, chat.key]);
                                if (value === undefined) {
                                    remove = true;
                                    break;
                                }
                            } catch (e) {
                                console.error(e)
                                remove = true;
                                break;
                            }
                        }
                        if (remove) {
                            chats.splice(i, 1);
                        }
                    }
                }
            }
            if (!chats.length) {
                const mixedId = [currentUid, oppositeUid].sort().join("_");
                const value = await database.read(["_chats", currentUid, mixedId]);
                if (value !== undefined) {
                    chats.push({
                        key: mixedId,
                        value,
                        redirect: true,
                        meta: {members: {[currentUid]: 0, [oppositeUid]: 0}}
                    });
                }
            }
            if (!chats.length) {
                const value = await database.read(["users_public", oppositeUid, UserData.NAME]);
                if (value !== undefined) {
                    const ref = chatsRef.push();
                    chats.push({
                        key: ref.key,
                        value: {private: oppositeUid},
                        redirect: true,
                        meta: {members: {[currentUid]: 0, [oppositeUid]: 0}}
                    });
                }
            }
            if (!chats.length) {
                chats.push({
                    key: oppositeUid,
                });
            }
            return chats;
        },
        getOrCreateFor: async (currentUid, oppositeUid, meta) => {
            const chats = await _body.fetchFor(currentUid, oppositeUid);
            if (!chats.length) throw Error(`[ChatMeta] not found for ${currentUid}/${oppositeUid}`);
            _body.create(chats[0].key, chats[0].meta || meta);
            if (chats[0].redirect) _redirect = true;
            if (chats[0].persisted) _persisted = true;
            return _body;
        },
        lastVisit: uid => {
            return fetchUids()[uid] || 0;
        },
        mix: (uid1, uid2, meta) => {
            return _body.create([uid1, uid2].sort().join("_"), meta);
        },
        forEachUid: async callback => {
            for (let token in _meta.members) {
                await callback(token);
            }
        },
        removeUid: async uid => {
            const updates = {};
            // updates[`chats/${_id}/!meta/members/${uid}`] = null;
            updates[`_chats/${uid}/${_id}`] = null;
            delete _meta.members[uid];
            if (_activeUids.indexOf(uid) >= 0) _activeUids.splice(_activeUids.indexOf(uid), 1);
            console.log(`[ChatMeta] remove uid ${uid} from ${_id}`);
            if (!_activeUids.length) {
                console.log(`[ChatMeta] chat is empty! removing entirely: ${_id}`);
                updates[`chats/${_id}`] = null;
                _persisted = false;
                _activeUids = [];
            }
            return firebase.database().ref().update(updates);
        },
        uidOtherThan: uid => {
            for (let userId in fetchUids()) {
                if (userId === uid) continue;
                if (userId) return userId;
            }
            throw Error(`Other uid not found within chat ${_id}`);
        },
        update: async () => {
            const updatesMeta = {};
            if (!_persisted) {
                try {
                    updatesMeta["members"] = _meta.members;
                    _activeUids = Object.keys(_meta.members || {});
                    await chatsRef.child(_id).child("!meta").update(updatesMeta);
                    const updatesIndex = {};
                    await _body.forEachUid(uid => {
                        updatesIndex[`${uid}/${_id}/private`] = _body.uidOtherThan(uid);
                        updatesIndex[`${uid}/${_id}/timestamp`] = firebase.database.ServerValue.TIMESTAMP;
                    })
                    await indexRef.update(updatesIndex);
                    _persisted = true;
                } catch (error) {
                    console.error(error)
                }
            }
            await chatsRef.child(_id).child("!meta/timestamp").set(firebase.database.ServerValue.TIMESTAMP);
            const updatesIndex = {};
            await _body.forEachUid(async uid => {
                const value = await database.read(["_chats", uid, _id]);
                if (value === undefined) return;
                updatesIndex[`${uid}/${_id}/timestamp`] = firebase.database.ServerValue.TIMESTAMP;
            });
            await indexRef.update(updatesIndex);
            return _body;
        },
        unwatch: () => {
            _watchRef?.remove();
            _visitRef?.remove();
        },
        unwatchOnline: () => {
            _onlineRef?.remove();
            _onlineRef = null;
        },
        updateVisit: uid => {
            if (!_persisted) return;
            if (!_activeUids.indexOf(uid) < 0) return;
            console.log(`[ChatMeta] update visit for ${_id}`);
            return chatsRef.child(_id).child("!meta/members").child(uid).set(firebase.database.ServerValue.TIMESTAMP);
        },
        watch: onChange => {
            const watchListener = ({value}) => {
                const message = value || {};
                if (!_lastMessage || (message && message.created !== _lastMessage.created
                    && message.text !== _lastMessage.text)) {
                    _lastMessage = message;
                    _timestamp = message.created;
                    onChange(message);
                }
            };
            const visitListener = ({key, value}) => {
                onChange({uid: key, timestamp: value, type: "visit"});
            }
            const removeListener = ({value}) => {
                _persisted = false;
                onChange({removed: true, timestamp: value, type: "remove"});
            }
            _watchRef = database.addEventListener(["chats", _id], {
                onChildAdd: watchListener,
                orderBy: "created"
            });
            _visitRef = database.addEventListener(["chats", _id, "!meta", "members"], {
                onChildChange: visitListener,
                onChildRemove: removeListener
            })
        },
        watchOnline: ({uid, timeout = ONLINE_TIMEOUT, onChange}) => {
            let task;
            const onlineListener = timestamp => {
                const now = new Date().getTime();
                if (now - timestamp < timeout) {
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
            _onlineRef = database.addEventListener(["chats", "!meta", "members", uid], {
                onChange: onlineListener
            });
        },
        toString: () => {
            return `[ChatMeta] ${_id}, active: ${_activeUids}, persisted: ${_persisted}, meta: ${JSON.stringify((_meta))}`;
        }
    }
    return _body;
}
