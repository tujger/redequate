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

export function ChatMeta(firebase) {
    // eslint-disable-next-line one-var
    let _id, _meta, _persisted = false, _lastMessage, _timestamp, _watchRef, _visitRef, _onlineRef, _removeRef,
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
                const snapshot = await chatsRef.child(_id).child("!meta").once("value");
                if (snapshot.exists()) {
                    _persisted = true;
                    _meta = snapshot.val();
                }
            }
            if (!_meta) throw Error(`[ChatMeta] no meta for ${_id}`);

            const tasks = [];
            _activeUids = [];
            if (_persisted) {
                for (let uid in _meta.members) {
                    tasks.push(new Promise((resolve, reject) => {
                        indexRef.child(uid).child(_id).once("value")
                            .then(snapshot => {
                                if (snapshot.exists()) {
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
                chatsRef.child(_id).orderByChild("created").limitToLast(1).once("value")
                    .then(snap => {
                        snap.forEach(snapshot => {
                            if (snapshot.key !== "!meta") {
                                _lastMessage = snapshot.val();
                                _timestamp = _lastMessage.created;
                            }
                        })
                        resolve();
                    }).catch(reject)
            }));
            await Promise.all(tasks);
            return _body;
        },
        fetchFor: async (currentUid, oppositeUid) => {
            let chats = [];
            const snapshot = await chatsRef.child(oppositeUid).child("!meta").once("value");
            if (snapshot.exists()) {
                chats.push({key: oppositeUid, meta: snapshot.val(), persisted: true});
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
                    const snapshot = await chatsRef.child(chat.key).child("!meta").once("value");
                    chat.redirect = true;
                    chat.meta = snapshot.val();

                    if (chat.meta && chat.meta.members) {
                        let remove = false;
                        for (let uid in chat.meta.members) {
                            try {
                                const snapshot = await indexRef.child(uid).child(chat.key).once("value");
                                if (!snapshot.exists()) {
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
                const snapshot = await indexRef.child(currentUid).child(mixedId).once("value");
                if (snapshot.exists()) {
                    chats.push({
                        key: snapshot.ref.key,
                        value: snapshot.val(),
                        redirect: true,
                        meta: {members: {[currentUid]: 0, [oppositeUid]: 0}}
                    });
                }
            }
            if (!chats.length) {
                const snapshot = await firebase.database().ref("users_public").child(oppositeUid).child(UserData.NAME).once("value");
                if (snapshot.exists()) {
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
                const snapshot = await indexRef.child(uid).child(_id).once("value");
                if (!snapshot.exists()) return;
                updatesIndex[`${uid}/${_id}/timestamp`] = firebase.database.ServerValue.TIMESTAMP;
            });
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
        updateVisit: uid => {
            if (!_persisted) return;
            if (!_activeUids.indexOf(uid) < 0) return;
            console.log(`[ChatMeta] update visit for ${_id}`);
            return chatsRef.child(_id).child("!meta/members").child(uid).set(firebase.database.ServerValue.TIMESTAMP);
        },
        watch: onChange => {
            const watchListener = snapshot => {
                const message = snapshot.val() || {};
                if (!_lastMessage || (message && message.created !== _lastMessage.created
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
            _onlineRef = chatsRef.child(_id).child("!meta/members").child(uid);
            _onlineRef.on("value", onlineListener);
            _onlineRef._listener = onlineListener;
        },
        toString: () => {
            return `[ChatMeta] ${_id}, active: ${_activeUids}, persisted: ${_persisted}, meta: ${JSON.stringify((_meta))}`;
        }
    }
    return _body;
}
