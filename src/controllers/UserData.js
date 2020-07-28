import {notifySnackbar} from "./Notifications";
import {refreshAll} from "./Store";
import {cacheDatas} from "./General";

export const watchUserChanged = (firebase, store) => {
    try {
        const refreshAction = () => {
            currentUserDataInstance.fetch([UserData.PUBLIC, UserData.ROLE, UserData.FORCE])
                .then(userData => {
                    useCurrentUserData(userData);
                    store.dispatch({type: "currentUserData", userData});
                    refreshAll(store);
                })
                .catch(notifySnackbar)
        }

        return firebase.auth().onAuthStateChanged(async result => {
            // const ud = new UserData(firebase).fromFirebaseAuth(result.toJSON())
            if (!currentUserDataInstance.id || !result) return;
            let changed = false;
            if (currentUserDataInstance.role === Role.USER_NOT_VERIFIED && result.emailVerified) {
                console.warn("[UserData] verified", currentUserDataInstance.id, result && result.toJSON());
                changed = true;
            } else if (currentUserDataInstance.verified !== result.emailVerified) {
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
        console.error(error);
    }
};

export const logoutUser = (firebase, store) => async () => {
    // window.localStorage.removeItem("notification-token");
    await firebase.auth().signOut();
    console.log("[UserData] logout", currentUserDataInstance);
    currentUserDataInstance = new UserData();
    if (store) {
        store.dispatch({type: "currentUserData", userData: null});
    }
};

export const currentRole = user => {
    if (user) return user.role;
    return Role.LOGIN;
}

export const matchRole = (roles, user) => {
    if (!roles) return true;
    if (roles.indexOf(Role.AUTH) >= 0) return true;
    if (!currentRole(user)) return false;
    return roles.indexOf(currentRole(user)) >= 0;
};

export const needAuth = (roles, user) => {
    if (!roles) return false;
    return currentRole(user) === Role.LOGIN;
};

export const roleIs = (role, user) => {
    if (!role) return true;
    if (!currentRole(user)) return false;
    return role.indexOf(currentRole(user)) >= 0;
};

export const Role = {
    AUTH: "auth",
    ADMIN: "admin",
    DISABLED: "disabled",
    LOGIN: "login",
    USER: "user",
    USER_NOT_VERIFIED: "userNotVerified",
};

export const sendInvitationEmail = (firebase) => options => new Promise((resolve, reject) => {
    let actionCodeSettings = {
        url: window.location.origin + "/signup/" + options.email,
        handleCodeInApp: true,
    };
    return firebase.auth().sendSignInLinkToEmail(options.email, actionCodeSettings)
        .then(() => notifySnackbar("Invitation email has been sent"))
        .then(resolve).catch(error => {
            notifySnackbar(error);
            reject(error);
        });
});

export const sendVerificationEmail = (firebase) => new Promise((resolve, reject) => {
    firebase.auth().currentUser.sendEmailVerification().then(() => {
        notifySnackbar("Verification email has been sent");
        resolve();
    }).catch(error => {
        notifySnackbar(error);
        reject(error);
    });
});

export const currentUserData = (state = {
    userData: null
}, action) => {
    const {type, userData} = action;
    if (type === "currentUserData") {
        useCurrentUserData(userData);
        console.warn("[UserData] set current", userData && userData.public);
        return {...state, userData: userData ? userData.toJSON() : null};
    } else {
        return state;
    }
};

// new stuff
export const UserData = function (firebase) {
    let _id, _public = {}, _private = {}, _role = null, _requestedTimestamp,
        _error, _loaded = {}, _persisted;

    const _dateFormatted = date => {
        if (!date) return "";
        if (date === firebase.database.ServerValue.TIMESTAMP) return _dateFormatted(new Date().getTime());
        const _date = new Date(date);
        const now = new Date();
        if (now.getUTCFullYear() === _date.getUTCFullYear()
            && now.getUTCMonth() === _date.getUTCMonth()
            && now.getUTCDate() === _date.getUTCDate()) {
            return _date.toLocaleTimeString();
        }
        return _date.toLocaleDateString();
    }

    const _fetch = async ref => {
        // try {
        return await ref.once("value");
        // } catch (error) {
        //     console.error(error);
        //     _error = error;
        // }
    }

    const prepareUpdates = (includePublic, includePrivate) => {
        const updates = {};
        if (!_id) throw new Error("[UserData] save failed: id is not defined");
        if (includePublic) {
            if (!_public) throw new Error("[UserData] public section is not ready");
            _public._sort_name = fetchSortName();
            for (let x in _public) {
                if (_public[x] !== undefined) {
                    if(_public[x] !== undefined && (_public[x] || "").constructor.name === "String") {
                        _public[x] = (_public[x] || "").trim();
                    }
                    updates[`users_public/${_id}/${x}`] = _public[x];
                }
            }
            updates[`users_public/${_id}/updated`] = firebase.database.ServerValue.TIMESTAMP;
        }
        if (includePrivate) {
            if (!_private) throw new Error("[UserData] private section is not ready");
            for (let deviceId in _private) {
                for (let x in _private[deviceId]) {
                    if (_private[deviceId][x] !== undefined) {
                        if(_private[deviceId][x] !== undefined && (_private[deviceId][x] || "").constructor.name === "String") {
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
            return _body.toString().replace(/\[\d+m/g, "");
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
            if (_public.name) return _public.name.substr(0, 1);
            return null;
        },
        get name() {
            return _public.name || _public.email;
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
            console.log("delete", _body);
            const updates = {};
            updates[`users_public/${_id}`] = null;
            updates[`roles/${_id}`] = null;
            updates[`users_private/${_id}`] = null;

            console.log("[UserData] delete", updates);
            await firebase.database().ref().update(updates);
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
            let fetchFull = options.indexOf(UserData.FULL) >= 0;
            let fetchEmail = options.indexOf(UserData.EMAIL) >= 0;
            let fetchImage = options.indexOf(UserData.IMAGE) >= 0;
            let fetchName = options.indexOf(UserData.NAME) >= 0;
            let fetchRole = options.indexOf(UserData.ROLE) >= 0;
            let fetchPublic = options.indexOf(UserData.PUBLIC) >= 0;
            let fetchPrivate = options.indexOf(UserData.PRIVATE) >= 0;
            let fetchUpdated = options.indexOf(UserData.UPDATED) >= 0;
            let force = options.indexOf(UserData.FORCE) >= 0;

            let ref = firebase.database().ref("users_public");

            const tasks = [];
            if ((!_loaded.public || force) && (fetchPublic || fetchFull)) {
                tasks.push(new Promise((resolve, reject) => {
                    _fetch(ref.child(_id))
                        .then(snap => {
                            if (snap.exists() && snap.val().email) _persisted = true;
                            _public = {..._public, ...(snap.val() || {})};
                            if(!_public.email) {
                                cacheDatas.remove(_id);
                                _id = undefined;
                                reject(new Error("User not found"));
                            }
                            // console.warn("[UserData] public", _id, _public);
                            resolve(_public);
                        }).catch(reject);
                }))
                _loaded = {..._loaded, public: true, email: true, name: true, updated: true, image: true};
            }
            if (fetchPrivate === true || fetchFull) {
                tasks.push(new Promise((resolve, reject) => {
                    _fetch(firebase.database().ref("users_private").child(_id))
                        .then(snap => {
                            _private = {..._private, ...(snap.val() || {})};
                            // console.warn("[UserData] private", _id, _private);
                            resolve(_private);
                        }).catch(reject);
                }))
                _loaded = {..._loaded, private: true};
            }
            if ((!_loaded.role || force) && (fetchRole || fetchFull)) {
                tasks.push(new Promise((resolve, reject) => {
                    _fetch(firebase.database().ref("roles").child(_id))
                        .then(snap => {
                            _role = snap.val();
                            // console.warn("[UserData] role", _id, _role);
                            resolve(_role);
                        }).catch(reject);
                }))
                _loaded = {..._loaded, role: true};
            }
            if ((!_loaded.updated || force) && (fetchUpdated && !fetchFull && !fetchPublic)) {
                tasks.push(new Promise((resolve, reject) => {
                    _fetch(ref.child(_id).child("updated"))
                        .then(snap => {
                            _public.updated = snap.val();
                            // console.warn("[UserData] updated", _id, _public.updated);
                            resolve(_public.updated);
                        }).catch(reject);
                }))
                _loaded = {..._loaded, updated: true};
            }
            if ((!_loaded.name || force) && (fetchName && !fetchFull && !fetchPublic)) {
                tasks.push(new Promise((resolve, reject) => {
                    _fetch(ref.child(_id).child("name"))
                        .then(snap => {
                            _public.name = snap.val();
                            // console.warn("[UserData] name", _id, _public.name);
                            resolve(_public.name);
                        }).catch(reject);
                }))
                _loaded = {..._loaded, name: true};
            }
            if ((!_loaded.image || force) && (fetchImage && !fetchFull && !fetchPublic)) {
                tasks.push(new Promise((resolve, reject) => {
                    _fetch(ref.child(_id).child("image"))
                        .then(snap => {
                            _public.image = snap.val();
                            // console.warn("[UserData] image", _id, _public.image);
                            resolve(_public.image);
                        }).catch(reject);
                }))
                _loaded = {..._loaded, image: true};
            }
            if ((!_loaded.email || force) && (fetchEmail && !fetchFull && !fetchPublic)) {
                tasks.push(new Promise((resolve, reject) => {
                    _fetch(ref.child(_id).child("email"))
                        .then(snap => {
                            if (snap.exists()) _persisted = true;
                            _public.email = snap.val();
                            if(!_public.email) {
                                cacheDatas.remove(_id);
                                _id = undefined;
                                reject(new Error("User not found"));
                            }
                            // console.warn("[UserData] email", _id, _public.email);
                            resolve(_public.email);
                        }).catch(reject);
                }))
                _loaded = {..._loaded, email: true};
            }
            const res = await Promise.all(tasks);
            // if(res.length) console.warn("[UserData] resolved", res);
            _public._sort_name = fetchSortName();
            _requestedTimestamp = new Date().getTime();
            return _body;
        },
        fetchPrivate: async (deviceId, force) => {
            if (!_loaded.private || force) {
                if (!deviceId) {
                    const snap = await _fetch(firebase.database().ref("users_private").child(_id));
                    _private = {..._private, ...(snap.val() || {})}
                    _loaded = {..._loaded, private: true};
                } else {
                    const snap = await _fetch(firebase.database().ref("users_private").child(_id).child(deviceId));
                    _private[deviceId] = {..._private[deviceId], ...(snap.val() || {})};
                    _loaded = {..._loaded, private: true};
                }
            }
            return _body;
        },
        fromFirebaseAuth: json => {
            _id = json.uid;
            _role = null;
            _public = {
                name: json.displayName,
                email: json.email,
                emailVerified: json.emailVerified,
                image: json.photoURL,
                lastLogin: +json.lastLoginAt,
                provider: json.providerData.map(item => item.providerId)[0],
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
        update: (key = data, data) => {
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
        .replace(/[~`!@#$%^&*()\-_=+\[\]{}|\\;:'",<.>\/?\s™®～]+/g, '')
        .toLowerCase();
}
