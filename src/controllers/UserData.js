import {cacheDatas} from "./General";
import notifySnackbar from "./notifySnackbar";
import {restoreLanguage} from "../reducers/languageReducer";
import {firebaseMessaging} from "./Firebase";

export const Role = {
    AUTH: "auth",
    ADMIN: "admin",
    AUTHOR: "author", // child of USER
    DISABLED: "disabled",
    LOGIN: "login",
    USER: "user",
    USER_NOT_VERIFIED: "userNotVerified",
};

export function watchUserChanged(firebase, store) {
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

            firebase.auth().onAuthStateChanged(async result => {
                // const ud = new UserData(firebase).fromFirebaseAuth(result.toJSON())
                if (!currentUserDataInstance.id || !result) return;
                let changed = false;
                if (currentUserDataInstance.role === Role.USER_NOT_VERIFIED && result.emailVerified) {
                    console.warn("[UserData] verified", currentUserDataInstance.id, result && result.toJSON());
                    changed = true;
                } else if (result.emailVerified && currentUserDataInstance.verified !== result.emailVerified) {
                    console.warn("[UserData] changed", currentUserDataInstance.id, result && result.toJSON());
                    changed = true;
                } else if (result && result.uid === currentUserDataInstance.id) {
                    const data = await firebase.database().ref("users_public").child(result.uid).child("updated").once("value");
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

export const logoutUser = async (store) => {
    // window.localStorage.removeItem("notification-token");
    await firebaseMessaging.auth().signOut();
    console.log("[UserData] logout", currentUserDataInstance);
    currentUserDataInstance = new UserData();
    restoreLanguage(store);
    if (store) {
        store.dispatch({type: "currentUserData", userData: null});
    }
    return null;
}

export function currentRole(user) {
    if (user) return user.role;
    return Role.LOGIN;
}

export function matchRole(roles, user) {
    if (!roles) return true;
    if (roles.indexOf(Role.AUTH) >= 0) return true;
    if (!currentRole(user)) return false;
    if (roles.indexOf(Role.USER) >= 0 && roles.indexOf(Role.AUTHOR) < 0) roles.push(Role.AUTHOR);
    return roles.indexOf(currentRole(user)) >= 0;
}

export function needAuth(roles, user) {
    if (!roles) return false;
    if (roles.indexOf(currentRole(user)) >= 0) return false;
    return currentRole(user) === Role.LOGIN;
}

export function sendInvitationEmail(email) {
    return new Promise((resolve, reject) => {
        const actionCodeSettings = {
            url: window.location.origin + "/signup/" + email,
            handleCodeInApp: true,
        };
        return firebaseMessaging.auth().sendSignInLinkToEmail(email, actionCodeSettings)
            .then(resolve)
            .catch(reject);
    })
}

export function sendVerificationEmail() {
    return new Promise((resolve, reject) => {
        firebaseMessaging.auth().currentUser.sendEmailVerification()
            .then(resolve)
            .catch(reject);
    })
}

export function sendPasswordResetEmail(email) {
    return new Promise((resolve, reject) => {
        firebaseMessaging.auth().sendPasswordResetEmail(email)
            .then(resolve)
            .catch(reject);
    })
}

export function currentUserData(state = {
    userData: null
}, action) {
    const {type, userData} = action;
    if (type === "currentUserData") {
        useCurrentUserData(userData);
        console.warn("[UserData] set current", userData && userData.public);
        return {...state, userData: userData ? userData.toJSON() : null};
    } else {
        return state;
    }
}

// new stuff
export function UserData() {
    // eslint-disable-next-line one-var
    let _id, _public = {}, _private = {}, _role = null, _requestedTimestamp, _loaded = {}, _persisted,
        _lastVisitUpdate = 0;

    const firebase = firebaseMessaging;

    const _dateFormatted = date => {
        if (!date) return "";
        if (date === firebase.database.ServerValue.TIMESTAMP) return _dateFormatted(new Date().getTime());
        const _date = new Date(date);
        const now = new Date();
        if (now.getUTCFullYear() === _date.getUTCFullYear() &&
            now.getUTCMonth() === _date.getUTCMonth() &&
            now.getUTCDate() === _date.getUTCDate()) {
            return _date.toLocaleTimeString();
        }
        return _date.toLocaleDateString();
    }

    const _fetch = async ref => {
        return ref.once("value");
    }

    const prepareUpdates = (includePublic, includePrivate) => {
        const updates = {};
        if (!_id) throw new Error("[UserData] save failed: id is not defined");
        if (includePublic) {
            if (!_public) throw new Error("[UserData] public section is not ready");
            _public._sort_name = fetchSortName();
            for (const x in _public) {
                if (_public[x] !== undefined) {
                    if (_public[x] !== undefined && (_public[x] || "").constructor.name === "String") {
                        _public[x] = (_public[x] || "").trim();
                    }
                    updates[`users_public/${_id}/${x}`] = _public[x];
                }
            }
            updates[`users_public/${_id}/updated`] = firebase.database.ServerValue.TIMESTAMP;
        }
        if (includePrivate) {
            if (!_private) throw new Error("[UserData] private section is not ready");
            for (const deviceId in _private) {
                for (const x in _private[deviceId]) {
                    if (_private[deviceId][x] !== undefined) {
                        if (_private[deviceId][x] !== undefined && (_private[deviceId][x] || "").constructor.name === "String") {
                            _private[deviceId][x] = (_private[deviceId][x] || "").trim();
                        }
                        updates[`users_private/${_id}/${deviceId}/${x}`] = _private[deviceId][x];
                    }
                }
            }
        }
        if (!_public.updated) {
            updates[`users_public/${_id}/updated`] = firebase.database.ServerValue.TIMESTAMP;
        }
        return updates;
    }

    const fetchSortName = () => {
        if (_public.name || _public.email) {
            return normalizeSortName(_public.name || _public.email) + "_" + _id;
        }
        return null;
    }

    const _body = {
        get asString() {
            // eslint-disable-next-line no-control-regex
            return _body.toString().replace(/\x1b\[\d+m/g, "");
        },
        get created() {
            return _dateFormatted(_public.created);
        },
        get disabled() {
            return matchRole([Role.DISABLED], _body);
        },
        get email() {
            return _public.email;
        },
        get persisted() {
            return _persisted;
        },
        get id() {
            return _id
        },
        get image() {
            return _public.image;
        },
        get initials() {
            const tokens = (_public.name || _public.email || "Some user").split(/[\W]/, 2);
            let result = tokens.map(token => token.substr(0, 1).toUpperCase()).join("");
            if (!result) result = _public.name.trim().substr(0, 1);
            return result;
        },
        get name() {
            return _public.name || _public.email || "Some user";
        },
        get private() {
            return _private;
        },
        get public() {
            return _public
        },
        get role() {
            return _id ? (_role || (_body.verified ? Role.USER : Role.USER_NOT_VERIFIED)) : Role.LOGIN;
        },
        get updated() {
            return _dateFormatted(_public.updated);
        },
        get verified() {
            return _public.emailVerified || false;
        },
        create: (id, role, data) => {
            if (!data) {
                data = role || {};
                role = null;
            }
            let {public: publicData, private: privateData} = data;
            if (!publicData) publicData = data;
            if (!id || !publicData) throw new Error("Not enough data to create UserData instance.")
            if (publicData) _public = publicData || {};
            if (privateData) _private = privateData || {};
            _id = id;
            _role = role;
            _public.created = _public.created || new Date().getTime();
            _public._sort_name = fetchSortName();
            return _body;
        },
        date: (format = "M-D-YYYY HH:mm A") => {
            if (_public.created && !_public.created[".sv"]) {
                return new Date(_public.created).toLocaleString();
            } else {
                return "";
            }
        },
        delete: async () => {
            // const updates = {};
            // updates[`users_public/${_id}`] = null;
            // updates[`roles/${_id}`] = null;
            // updates[`users_private/${_id}`] = null;

            console.log("[UserData] delete", _id);
            await firebase.database().ref("users_public").child(_id).set(null);
            // await firebase.database().ref().update(updates);
            cacheDatas.remove(_id);
            return _body;
        },
        fetch: async (id, options = [UserData.PUBLIC]) => {
            if (id instanceof Array) {
                options = id;
            } else if (id && _id && id !== _id) {
                throw new Error(`Another user id fetched: ${id}!=${_id}.`);
            } else if (id) {
                _id = id;
            }
            if (!_id) throw new Error("Can't fetch unidentified user data");
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

            let _loading = {..._loaded};
            const ref = firebase.database().ref("users_public");

            const tasks = [];
            if ((!_loading.public || force) && (fetchPublic || fetchFull)) {
                tasks.push(new Promise((resolve, reject) => {
                    _fetch(ref.child(_id))
                        .then(snap => {
                            if (snap.exists()) _persisted = true;
                            _public = {..._public, ...(snap.val() || {})};
                            if (!_public.email) {
                                cacheDatas.remove(_id);
                                _id = undefined;
                                reject(new Error("User not found"));
                            }
                            _loaded = {..._loaded, public: true, email: true, name: true, updated: true, image: true};
                            // console.warn("[UserData] public", _id, _public);
                            resolve(_public);
                        }).catch(reject);
                }))
                _loading = {..._loading, public: true, email: true, name: true, updated: true, image: true};
            }
            if (fetchPrivate === true || fetchFull) {
                tasks.push(new Promise((resolve, reject) => {
                    _fetch(firebase.database().ref("users_private").child(_id))
                        .then(snap => {
                            if (snap.exists()) _persisted = true;
                            _private = {..._private, ...(snap.val() || {})};
                            _loaded = {..._loaded, private: true};
                            // console.warn("[UserData] private", _id, _private);
                            resolve(_private);
                        }).catch(reject);
                }))
                _loading = {..._loading, private: true};
            }
            if ((!_loading.role || force) && (fetchRole || fetchFull)) {
                tasks.push(new Promise((resolve, reject) => {
                    _fetch(firebase.database().ref("roles").child(_id))
                        .then(snap => {
                            _role = snap.val();
                            // console.warn("[UserData] role", _id, _role);
                            _loaded = {..._loaded, role: true};
                            resolve(_role);
                        }).catch(reject);
                }))
                _loading = {..._loading, role: true};
            }
            if ((!_loading.updated || force) && (fetchUpdated && !fetchFull && !fetchPublic)) {
                tasks.push(new Promise((resolve, reject) => {
                    _fetch(ref.child(_id).child("updated"))
                        .then(snap => {
                            _public.updated = snap.val();
                            // console.warn("[UserData] updated", _id, _public.updated);
                            _loaded = {..._loaded, updated: true};
                            resolve(_public.updated);
                        }).catch(reject);
                }))
                _loading = {..._loading, updated: true};
            }
            if ((!_loading.name || force) && (fetchName && !fetchFull && !fetchPublic)) {
                tasks.push(new Promise((resolve, reject) => {
                    _fetch(ref.child(_id).child("name"))
                        .then(snap => {
                            if (snap.exists()) _persisted = true;
                            _public.name = snap.val() || "";
                            // if (!_public.name) {
                            //     cacheDatas.remove(_id);
                            //     _id = undefined;
                            //     reject(new Error("User not found"));
                            // }
                            // console.warn("[UserData] name", _id, _public.name);
                            _loaded = {..._loaded, name: true};
                            resolve(_public.name);
                        }).catch(reject);
                }))
                _loading = {..._loading, name: true};
            }
            if ((!_loading.image || force) && (fetchImage && !fetchFull && !fetchPublic)) {
                tasks.push(new Promise((resolve, reject) => {
                    _fetch(ref.child(_id).child("image"))
                        .then(snap => {
                            if (snap.exists()) _persisted = true;
                            _public.image = snap.val();
                            // console.warn("[UserData] image", _id, _public.image);
                            _loaded = {..._loaded, image: true};
                            resolve(_public.image);
                        }).catch(reject);
                }))
                _loading = {..._loading, image: true};
            }
            if ((!_loading.email || force) && (fetchEmail && !fetchFull && !fetchPublic)) {
                tasks.push(new Promise((resolve, reject) => {
                    _fetch(ref.child(_id).child("email"))
                        .then(snap => {
                            if (snap.exists()) _persisted = true;
                            _public.email = snap.val();
                            if (!_public.email) {
                                cacheDatas.remove(_id);
                                _id = undefined;
                                reject(new Error("User not found"));
                            }
                            _loaded = {..._loaded, email: true};
                            // console.warn("[UserData] email", _id, _public.email);
                            resolve(_public.email);
                        }).catch(reject);
                }))
                _loading = {..._loading, email: true};
            }
            await Promise.all(tasks);
            _public._sort_name = fetchSortName();
            _requestedTimestamp = new Date().getTime();
            return _body;
        },
        fetchPrivate: async (deviceId, force) => {
            if (!_loaded.private || force) {
                if (!deviceId) {
                    const snap = await _fetch(firebase.database().ref("users_private").child(_id));
                    if (snap.exists()) _persisted = true;
                    _private = {..._private, ...(snap.val() || {})}
                    _loaded = {..._loaded, private: true};
                } else {
                    const snap = await _fetch(firebase.database().ref("users_private").child(_id).child(deviceId));
                    if (snap.exists()) _persisted = true;
                    _private[deviceId] = {..._private[deviceId], ...(snap.val() || {})};
                    _loaded = {..._loaded, private: true};
                }
            }
            return _body;
        },
        fromFirebaseAuth: json => {
            _id = json.uid;
            _role = null;
            const providerItem = json.providerData[0];
            const provider = providerItem ? providerItem.providerId : "anonymous";
            const emailVerified = json.emailVerified || provider === "google.com" || provider === "facebook.com";
            _public = {
                name: json.displayName,
                email: json.email || providerItem.email,
                emailVerified,
                image: json.photoURL,
                lastLogin: +json.lastLoginAt,
                provider,
                // created: +json.createdAt,
            };
            _requestedTimestamp = new Date();
            _loaded = {
                [UserData.PUBLIC]: true,
                [UserData.NAME]: true,
                [UserData.EMAIL]: true,
                [UserData.IMAGE]: true
            };
            _body.create(_id, _role, {
                public: _public,
                private: _private,
            });
            return _body;
        },
        fromJSON: json => {
            _id = json.id;
            _role = json.role;
            _public = json.public;
            _private = json.private;
            _requestedTimestamp = json.require;
            _loaded = json.loaded;
            _body.create(_id, _role, {
                public: _public,
                private: _private,
            });
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
            _persisted = true;
            return _body;
        },
        savePrivate: async () => {
            const updates = prepareUpdates(false, true);
            await firebase.database().ref().update(updates);
            return _body;
        },
        set: async (data) => {
            const {role, ...rest} = data;
            if (data.public) {
                _public = {..._public, ...rest.public};
                // _private = {..._private, ...(data.private || {})};
            } else {
                _public = {..._public, ...rest};
            }
            if (role) _role = role;
            _body.create(_id, _role, {
                public: _public,
                private: _private,
            });
            return _body;
        },
        setPrivate: async (deviceId, data) => {
            if (!data) {
                data = deviceId || {};
                deviceId = null;
            }
            if (deviceId) {
                _private[deviceId] = {...(_private[deviceId] || {}), ...data};
            } else {
                _private = {..._private, ...data};
            }
            return _private;
        },
        toJSON: () => ({
            id: _id,
            role: _role,
            public: _public,
            private: _private,
            requested: _requestedTimestamp,
            loaded: _loaded,
        }),
        toString: () => {
            return `id: \x1b[34m${_id}\x1b[30m, name: \x1b[34m${_public.name}\x1b[30m, role: \x1b[34m${_role}\x1b[30m, public: ${JSON.stringify(_public)}`
        },
        update: (data, key = data) => {
            if (key === data) {
                key = null;
            }
            if (!key && data.constructor.name === "String") throw new Error("Value defined without key");
            if (!key) {
                const {public: publicData, private: privateData, role, name, id} = data;
                if (publicData) _public = publicData || {};
                if (privateData) _private = privateData || {};
                if (role) _role = role;
                if (id) _id = id;
                if (name) {
                    _public.name = name;
                }
            } else {
                console.log("[UserData] still ignoring", key, data);
            }
        },
        updateVisitTimestamp: () => {
            const now = new Date().getTime();
            if (_id && _persisted && (now - _lastVisitUpdate) > 60000) {
                firebase.database().ref("users_public").child(_id).child("email").once("value")
                    .then(snapshot => {
                        if (!snapshot.exists()) return;
                        firebase.database().ref("users_public").child(_id).child("visit").set(firebase.database.ServerValue.TIMESTAMP);
                        _lastVisitUpdate = now;
                    })
            }
            return _body;
        },
        _userData: true,
    }
    return _body;
}

UserData.PUBLIC = "public";
UserData.PRIVATE = "private";
UserData.ROLE = "role";
UserData.NAME = "name";
UserData.EMAIL = "email";
UserData.IMAGE = "image";
UserData.UPDATED = "updated";
UserData.FULL = "full";
UserData.FORCE = "force";

let currentUserDataInstance = new UserData();
export const useCurrentUserData = userData => {
    if (userData !== undefined) currentUserDataInstance = userData;
    if (userData === null) currentUserDataInstance = new UserData();
    return currentUserDataInstance;
}

export const normalizeSortName = text => {
    if (!text || !(text.constructor.name === "String")) return text;
    return (text || "")
        .trim()
        .replace(/[^\wа-яА-Я]/g, "")
        // .replace(/[~`!@#$%^&*()\-_=+[\]{}|\\;:'",<.>/?\s™®～]+/g, "")
        .toLowerCase();
}
