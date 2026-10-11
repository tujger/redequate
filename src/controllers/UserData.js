import {SERVER_TIMESTAMP, UserData as UserDataCommon, UserRole} from "../../packages/common";
import {restoreLanguage} from "../reducers/languageReducer";
import {firebaseMessaging} from "./Firebase";
import {cacheDatas} from "./General";
import notifySnackbar from "./notifySnackbar";

export {
    currentRole, matchRole, needAuth, normalizeSortName, SERVER_TIMESTAMP, UserRole
} from "../../packages/common";

export function watchUserChanged({auth, store, firebase}) {
    return new Promise((resolve, reject) => {
        try {
            const refreshAction = () => {
                currentUserDataInstance.fetch([UserData.PUBLIC, UserData.ROLE, UserData.FORCE])
                    .then(userData => {
                        useCurrentUserData(userData);
                        store.dispatch({type: "currentUserData", userData});
                        resolve();
                    })
                    .catch(notifySnackbar)
            }

            auth.onAuthStateChanged(async userData => {
                if (!currentUserDataInstance.id || !userData) return;
                let changed = false;
                if (currentUserDataInstance.role === UserRole.USER_NOT_VERIFIED && userData.verified) {
                    console.warn("[UserData] verified", currentUserDataInstance.id, userData?.toJSON());
                    changed = true;
                } else if (userData.verified && currentUserDataInstance.verified !== userData.verified) {
                    console.warn("[UserData] changed", currentUserDataInstance.id, userData?.toJSON());
                    changed = true;
                } else if (userData && userData.id === currentUserDataInstance.id) {
                    const data = await firebase.database().ref("users_public").child(userData.id).child("updated").once("value");
                    if (data.val() > currentUserDataInstance.public.updated) {
                        console.warn(`[UserData] last timestamp ${data.val()} > than saved ${currentUserDataInstance.public.updated}`);
                        changed = true;
                    }
                }
                if (changed) {
                    return notifySnackbar({
                        title: "Your profile has been changed. Please refresh for update",
                        variant: "warning",
                        priority: "high",
                        buttonLabel: "Refresh",
                        onButtonClick: refreshAction
                    })
                }
            });
        } catch (error) {
            reject(error);
        }
    })
}

export const logoutUser = async ({auth, store}) => {
    // window.localStorage.removeItem("notification-token");
    await auth.signOut();
    console.log("[UserData] logout", currentUserDataInstance);
    currentUserDataInstance = new UserData();
    restoreLanguage(store);
    if (store) {
        store.dispatch({type: "currentUserData", userData: null});
    }
    return null;
}

export function currentUserData(state = {
    userData: null
}, action) {
    const {type, userData} = action;
    if (type === "currentUserData") {
        // This legacy accessor stores an instance; it is not a React hook.
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useCurrentUserData(userData);
        console.warn("[UserData] set current", userData && userData.public);
        return {...state, userData: userData ? userData.toJSON() : null};
    } else {
        return state;
    }
}

export function UserData() {
    const extend = (_body, state) => {
        let _lastVisitUpdate = 0;
        const firebase = firebaseMessaging;
        const _fetch = async ref => ref.once("value");

        const prepareUpdates = (includePublic, includePrivate) => {
            const updates = {};
            if (!state.id) throw new Error("[UserData] save failed: id is not defined");
            if (includePublic) {
                if (!state.public) throw new Error("[UserData] public section is not ready");
                state.public._sort_name = state.sortName;
                for (const x in state.public) {
                    if (state.public[x] !== undefined) {
                        if (state.public[x] !== undefined && (state.public[x] || "").constructor.name === "String") {
                            state.public[x] = (state.public[x] || "").trim();
                        }
                        updates[`users_public/${state.id}/${x}`] = state.public[x];
                    }
                }
                updates[`users_public/${state.id}/updated`] = SERVER_TIMESTAMP;
            }
            if (includePrivate) {
                if (!state.private) throw new Error("[UserData] private section is not ready");
                for (const deviceId in state.private) {
                    for (const x in state.private[deviceId]) {
                        if (state.private[deviceId][x] !== undefined) {
                            if (state.private[deviceId][x] !== undefined && (state.private[deviceId][x] || "").constructor.name === "String") {
                                state.private[deviceId][x] = (state.private[deviceId][x] || "").trim();
                            }
                            updates[`users_private/${state.id}/${deviceId}/${x}`] = state.private[deviceId][x];
                        }
                    }
                }
            }
            if (!state.public.updated) {
                updates[`users_public/${state.id}/updated`] = SERVER_TIMESTAMP;
            }
            return updates;
        }

        return {
            delete: async () => {
                // const updates = {};
                // updates[`users_public/${state.id}`] = null;
                // updates[`roles/${state.id}`] = null;
                // updates[`users_private/${state.id}`] = null;

                console.log("[UserData] delete", state.id);
                await firebase.database().ref("users_public").child(state.id).set(null);
                // await firebase.database().ref().update(updates);
                cacheDatas.remove(state.id);
                return _body;
            },
            fetch: async (id, options = [UserData.PUBLIC]) => {
                if (id instanceof Array) {
                    options = id;
                } else if (id && state.id && id !== state.id) {
                    throw new Error(`Another user id fetched: ${id}!=${state.id}.`);
                } else if (id) {
                    state.id = id;
                }
                if (!state.id) throw new Error("Can't fetch unidentified user data");
                if (!options) options = [UserData.PUBLIC];
                const fetchFull = options.indexOf(UserData.FULL) >= 0;
                const fetchEmail = options.indexOf(UserData.EMAIL) >= 0;
                const fetchImage = options.indexOf(UserData.IMAGE) >= 0;
                const fetchName = options.indexOf(UserData.NAME) >= 0;
                const fetchRole = options.indexOf(UserData.ROLE) >= 0;
                const fetchPublic = options.indexOf(UserData.PUBLIC) >= 0;
                const fetchPrivate = options.indexOf(UserData.PRIVATE) >= 0;
                const fetchUpdated = options.indexOf(UserData.UPDATED) >= 0;
                const force = options.indexOf(UserData.FORCE) >= 0;

                let _loading = {...state.loaded};
                const ref = firebase.database().ref("users_public");

                const tasks = [];
                if ((!_loading.public || force) && (fetchPublic || fetchFull)) {
                    tasks.push(new Promise((resolve, reject) => {
                        _fetch(ref.child(state.id))
                            .then(snap => {
                                if (snap.exists()) state.persisted = true;
                                state.public = {...state.public, ...(snap.val() || {})};
                                if (!state.public.email) {
                                    cacheDatas.remove(state.id);
                                    state.id = undefined;
                                    reject(new Error("User not found"));
                                }
                                state.loaded = {
                                    ...state.loaded,
                                    public: true,
                                    email: true,
                                    name: true,
                                    updated: true,
                                    image: true
                                };
                                // console.warn("[UserData] public", state.id, state.public);
                                resolve(state.public);
                            }).catch(reject);
                    }))
                    _loading = {..._loading, public: true, email: true, name: true, updated: true, image: true};
                }
                if (fetchPrivate === true || fetchFull) {
                    tasks.push(new Promise((resolve, reject) => {
                        _fetch(firebase.database().ref("users_private").child(state.id))
                            .then(snap => {
                                if (snap.exists()) state.persisted = true;
                                state.private = {...state.private, ...(snap.val() || {})};
                                state.loaded = {...state.loaded, private: true};
                                // console.warn("[UserData] private", state.id, state.private);
                                resolve(state.private);
                            }).catch(reject);
                    }))
                    _loading = {..._loading, private: true};
                }
                if ((!_loading.role || force) && (fetchRole || fetchFull)) {
                    tasks.push(new Promise((resolve, reject) => {
                        _fetch(firebase.database().ref("roles").child(state.id))
                            .then(snap => {
                                state.role = snap.val();
                                // console.warn("[UserData] role", state.id, state.role);
                                state.loaded = {...state.loaded, role: true};
                                resolve(state.role);
                            }).catch(reject);
                    }))
                    _loading = {..._loading, role: true};
                }
                if ((!_loading.updated || force) && (fetchUpdated && !fetchFull && !fetchPublic)) {
                    tasks.push(new Promise((resolve, reject) => {
                        _fetch(ref.child(state.id).child("updated"))
                            .then(snap => {
                                state.public.updated = snap.val();
                                // console.warn("[UserData] updated", state.id, state.public.updated);
                                state.loaded = {...state.loaded, updated: true};
                                resolve(state.public.updated);
                            }).catch(reject);
                    }))
                    _loading = {..._loading, updated: true};
                }
                if ((!_loading.name || force) && (fetchName && !fetchFull && !fetchPublic)) {
                    tasks.push(new Promise((resolve, reject) => {
                        _fetch(ref.child(state.id).child("name"))
                            .then(snap => {
                                if (snap.exists()) state.persisted = true;
                                state.public.name = snap.val() || "";
                                // if (!state.public.name) {
                                //     cacheDatas.remove(state.id);
                                //     state.id = undefined;
                                //     reject(new Error("User not found"));
                                // }
                                // console.warn("[UserData] name", state.id, state.public.name);
                                state.loaded = {...state.loaded, name: true};
                                resolve(state.public.name);
                            }).catch(reject);
                    }))
                    _loading = {..._loading, name: true};
                }
                if ((!_loading.image || force) && (fetchImage && !fetchFull && !fetchPublic)) {
                    tasks.push(new Promise((resolve, reject) => {
                        _fetch(ref.child(state.id).child("image"))
                            .then(snap => {
                                if (snap.exists()) state.persisted = true;
                                state.public.image = snap.val();
                                // console.warn("[UserData] image", state.id, state.public.image);
                                state.loaded = {...state.loaded, image: true};
                                resolve(state.public.image);
                            }).catch(reject);
                    }))
                    _loading = {..._loading, image: true};
                }
                if ((!_loading.email || force) && (fetchEmail && !fetchFull && !fetchPublic)) {
                    tasks.push(new Promise((resolve, reject) => {
                        _fetch(ref.child(state.id).child("email"))
                            .then(snap => {
                                if (snap.exists()) state.persisted = true;
                                state.public.email = snap.val();
                                if (!state.public.email) {
                                    cacheDatas.remove(state.id);
                                    state.id = undefined;
                                    reject(new Error("User not found"));
                                }
                                state.loaded = {...state.loaded, email: true};
                                // console.warn("[UserData] email", state.id, state.public.email);
                                resolve(state.public.email);
                            }).catch(reject);
                    }))
                    _loading = {..._loading, email: true};
                }
                await Promise.all(tasks);
                state.public._sort_name = state.sortName;
                state.requestedTimestamp = new Date().getTime();
                return _body;
            },
            fetchPrivate: async (deviceId, force) => {
                if (!state.loaded.private || force) {
                    if (!deviceId) {
                        const snap = await _fetch(firebase.database().ref("users_private").child(state.id));
                        if (snap.exists()) state.persisted = true;
                        state.private = {...state.private, ...(snap.val() || {})}
                        state.loaded = {...state.loaded, private: true};
                    } else {
                        const snap = await _fetch(firebase.database().ref("users_private").child(state.id).child(deviceId));
                        if (snap.exists()) state.persisted = true;
                        state.private[deviceId] = {...state.private[deviceId], ...(snap.val() || {})};
                        state.loaded = {...state.loaded, private: true};
                    }
                }
                return _body;
            },
            save: async () => {
                const updates = prepareUpdates(true, true);
                await firebase.database().ref().update(updates);
                return _body;
            },
            savePublic: async () => {
                const updates = prepareUpdates(true, false);
                await firebase.database().ref().update(updates);
                state.persisted = true;
                return _body;
            },
            savePrivate: async () => {
                const updates = prepareUpdates(false, true);
                await firebase.database().ref().update(updates);
                return _body;
            },
            updateVisitTimestamp: () => {
                const now = new Date().getTime();
                if (state.id && state.persisted && (now - _lastVisitUpdate) > 60000) {
                    firebase.database().ref("users_public").child(state.id).child("email").once("value")
                        .then(snapshot => {
                            if (!snapshot.exists()) return;
                            firebase.database().ref("users_public").child(state.id).child("visit").set(SERVER_TIMESTAMP);
                            _lastVisitUpdate = now;
                        })
                }
                return _body;
            },

        };
    };
    return UserDataCommon({extend});
}

Object.assign(UserData, UserDataCommon);

let currentUserDataInstance = new UserData();
export const useCurrentUserData = userData => {
    if (userData !== undefined) currentUserDataInstance = userData;
    if (userData === null) currentUserDataInstance = new UserData();
    return currentUserDataInstance;
}
