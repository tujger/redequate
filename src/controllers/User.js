import {notifySnackbar} from "./Notifications";

const User = (data) => {
    let private_ = null, public_ = null, uid_ = null, role_ = null;
    let body = {
        "private": () => private_,
        "public": () => public_,
        role: () => role_,
        uid: () => uid_,
        set: (type, data) => {
            if (data === "null") data = null;
            if (type === "private") private_ = data;
            else if (type === "public") public_ = data;
            else if (type === "uid") uid_ = data;
            else if (type === "role") role_ = data;
            else if (type === "updated") public_.updated = data;
            else console.error(`Unknown type "${type}" set to "${data}"`);
        },
        parse: data => {
            if (data.public) {
                public_ = data.public;
                private_ = data.private;
                uid_ = data.uid;
                role_ = data.role;
            } else {
                const {address, created, email, emailVerified, image, name, phone, provider, uid, role, updated} = data;
                uid_ = uid;
                role_ = role;
                public_ = {
                    created, address, email, emailVerified, image, name, phone, provider, updated
                }
            }
        },
        toString: () => JSON.stringify(toJSON()),
        toJSON: () => toJSON(),
    };
    const toJSON = () => ({"public": public_, "private": private_, uid: uid_, role: role_});
    if (data) body.parse(data);
    return body;
};

export default User;

export const fetchUserPublic = firebase => (uid, child) => new Promise((resolve, reject) => {
    fetchUserSection(firebase, "public", uid, child, resolve, reject);
});

export const fetchUserPrivate = firebase => (uid, deviceId) => new Promise((resolve, reject) => {
    fetchUserSection(firebase, "private", uid, deviceId, resolve, reject);
});

const fetchUserSection = (firebase, section, uid, child, onsuccess, onerror) => {
    const db = firebase.database();
    if (uid) {
        let ref = db.ref("users_" + section).child(uid);
        if (child) ref = ref.child(child);
        ref.once("value").then(snapshot => {
            let val = snapshot.val() || {};
            if (child) {
                onsuccess && onsuccess(val);
            } else {
                if (val.emailVerified) {
                    db.ref("roles").child(uid).once("value").then(snapshot => {
                        val.role = snapshot.val() || Role.USER;
                        onsuccess && onsuccess(val);
                    }).catch(error => {
                        val.role = Role.USER;
                        onsuccess && onsuccess(val);
                    });
                } else {
                    val.role = Role.USER_NOT_VERIFIED;
                    onsuccess && onsuccess(val);
                }
            }
        }).catch(onerror);
    } else {
        try {
            // logoutUser(firebase)();
            onsuccess && onsuccess(null);
        } catch (e) {
            onerror(e);
        }
    }
};

export const updateUserPublic = firebase => (uid, props) => new Promise((resolve, reject) => {
    updateUserSection(firebase, "public", uid, null, props, val => {
        try {
            val.name = val.name || val.email;
            const name = val.name;
            console.warn(name, val)
            if (name) {
                const sort = `${name.trim().toLowerCase()}_${uid}`;
                firebase.database().ref("users_public").child(uid).child("_sort_name").set(sort);
            }
            resolve(val);
        } catch (e) {
            reject(e);
        }
    }, reject);
});

export const updateUserPrivate = firebase => (uid, deviceId = "", props) =>
    new Promise((resolve, reject) => {
        if (!props && deviceId instanceof Object) {
            props = deviceId;
            deviceId = null;
        }
        updateUserSection(firebase, "private", uid, deviceId, props, resolve, reject);
    });

const updateUserSection = (firebase, section, uid, child, props, onsuccess, onerror) => {
    const db = firebase.database();
    if (uid) {
        fetchUserSection(firebase, section, uid, child, data => {
            const {role, uid: ignored1, ...existed} = data;
            const {current, role: ignored2, uid: ignored3, ...updates} = props;
            let val = {...existed, ...updates};
            let ref = db.ref("users_" + section).child(uid);
            if (child) ref = ref.child(child);
            ref.set(val)
                .then(() => {
                    // .then(() => db.ref("users_public").child(uid).child("updated").once("value"))
                    // .then(updated => {
                    if (current || user.uid() === uid) {
                        user.set(section, val);
                        user.set("uid", uid);
                        // user.set("updated", updated.val());
                        window.localStorage.setItem("user_uid", uid);
                        window.localStorage.setItem("user_" + (section.split("/")[0]), JSON.stringify(val));
                        if (role) {
                            user.set("role", role);
                            window.localStorage.setItem("user_role", role);
                        }
                    }
                    onsuccess && onsuccess(val);
                });
        }, onerror);
    } else {
        onerror(new Error("UID is not defined"));
    }
};

export const firstOf = (...args) => {
    for (let i in args) {
        if (args[i] !== undefined && args[i] !== null && args[i] !== "") {
            return args[i];
        }
    }
    return null;
};

export const watchUserChanged = (firebase, store) => {
    try {
        firebase.auth().onAuthStateChanged(result => {
            // const ud = new UserData(firebase).fromFirebaseAuth(result.toJSON())
            console.log("[AuthStateChanged]", currentUserDataInstance, result && result.toJSON());

            if(!currentUserDataInstance || !result) return;
            if (currentUserDataInstance.role === Role.USER_NOT_VERIFIED && result.emailVerified) {
                notifySnackbar({
                    buttonLabel: "Log out",
                    onButtonClick: () => {
                        logoutUser(firebase, store)();
                        window.location.reload();
                    },
                    title: "Your profile has been changed. Please relogin to update",
                    variant: "warning"
                })
                return;
            }
            if (currentUserDataInstance.public.emailVerified !== result.emailVerified) {
                notifySnackbar({
                    buttonLabel: "Log out",
                    onButtonClick: () => {
                        logoutUser(firebase, store)();
                        window.location.reload();
                    },
                    title: "Your profile has been changed. Please relogin to update",
                    variant: "warning"
                })
                return;
            }
            if (result && result.uid === currentUserDataInstance.id) {
                firebase.database().ref("users_public").child(result.uid).child("updated").once("value")
                    .then(data => {
                        if (data.val() > currentUserDataInstance.public.updated) {
                            console.log(`[User] last timestamp ${data.val()} > than saved ${currentUserDataInstance.public.updated}`)
                            notifySnackbar({
                                buttonLabel: "Log out",
                                onButtonClick: () => {
                                    logoutUser(firebase, store)();
                                    window.location.reload();
                                },
                                title: "Your profile has been changed. Please relogin to update",
                                variant: "warning"
                            })
                        }
                    }).catch(console.error);
            }
        });
    } catch (error) {
        console.error(error);
    }
};

export const logoutUser = (firebase, store) => async () => {
    window.localStorage.removeItem("user_public");
    window.localStorage.removeItem("user_private");
    window.localStorage.removeItem("user_uid");
    window.localStorage.removeItem("user_role");
    window.localStorage.removeItem("notification-token");
    user.set("private", null);
    user.set("public", null);
    user.set("role", null);
    user.set("uid", null);
    await firebase.auth().signOut();
    currentUserDataInstance = null;
    if(store) {
        store.dispatch({type:"user", user: {}});
        store.dispatch({type:"currentUserData", userData:null});
    }
    console.log("[Logout]", user);
};

export const user = User();
user.set("public", JSON.parse(window.localStorage.getItem("user_public")));
user.set("private", JSON.parse(window.localStorage.getItem("user_private")));
user.set("role", window.localStorage.getItem("user_role"));
user.set("uid", window.localStorage.getItem("user_uid"));

export const currentRole = user => {
    if (user && user._userData) return user.role;
    if (user && user.uid() && !user.role()) {
        // console.error("Current user role is invalid, reset ro USER");
        return Role.USER;
    }
    return user ? user.role() || Role.LOGIN : Role.LOGIN;
};

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
    LOGIN: "login",
    USER: "user",
    USER_NOT_VERIFIED: "userNotVerified"
};

export const sendConfirmationEmail = (firebase, store) => options => new Promise((resolve, reject) => {
    let actionCodeSettings = {
        url: window.location.origin + "/signup" + (options.includeEmail ? "?email=" + options.email : ""),
        handleCodeInApp: true,
    };
    firebase.auth().sendSignInLinkToEmail(options.email, actionCodeSettings).then(() => {
        window.localStorage.setItem("emailForSignIn", options.email);
        notifySnackbar({
            title: "Confirmation email has sent"
        });
        resolve();
    }).catch(error => {
        notifySnackbar({
            title: error.message,
            variant: "error"
        });
        reject(error);
    });
});

export const sendVerificationEmail = (firebase) => new Promise((resolve, reject) => {
    firebase.auth().currentUser.sendEmailVerification().then(() => {
        notifySnackbar({
            title: "Verification email has sent"
        });
        resolve();
    }).catch(error => {
        notifySnackbar({
            title: error.message,
            variant: "error"
        });
        reject(error);
    });
});

export const useUser = () => {
    return user;
}

export const currentUser = (state = {
    public: null,
    private: null,
    uid: null,
    role: null,
}, action) => {
    const {type, user, ...rest} = action;
    if (type === "user") {
        const {
            public: publicData = () => null,
            private: privateData = () => null,
            uid = () => null,
            role = () => null
        } = user;
        return {...state, uid: uid(), role: role(), public: publicData(), private: privateData(), ...rest};
    } else {
        return state;
    }
};

export const currentUserData = (state = {
    userData: null
}, action) => {
    const {type, userData} = action;
    if (type === "currentUserData") {
        useCurrentUserData(userData);
        console.log("[User] update current", userData);
        return {...state, userData: userData ? userData.toJSON() : null};
    } else {
        return state;
    }
};

// new stuff
export const UserData = function (firebase) {
    let _id, _public = {}, _email, _private = {}, _role = null, _name = "", _image = "", _updated, _requestedTimestamp,
        _error, _loaded = {};

    const _dateFormatted = date => {
        if (!date) return "";
        if(date === firebase.database.ServerValue.TIMESTAMP) return _dateFormatted(new Date().getTime());
        const _date = new Date(date);
        const now = new Date();
        if (now.getUTCFullYear() === _date.getUTCFullYear()
            && now.getUTCMonth() === _date.getUTCMonth()
            && now.getUTCDate() === _date.getUTCMonth()) {
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
        if(!_id) throw new Error("[UserData] save failed: id is not defined");
        if(includePublic) {
            if(!_public) throw new Error("[UserData] public section is not ready");
            for(let x in _public) {
                if(_public[x] !== undefined) {
                    updates[`users_public/${_id}/${x}`] = _public[x];
                }
            }
            updates[`users_public/${_id}/updated`] = firebase.database.ServerValue.TIMESTAMP;
        }
        if(includePrivate) {
            if(!_private) throw new Error("[UserData] private section is not ready");
            for(let deviceId in _private) {
                for(let x in _private[deviceId]) {
                    if(_private[deviceId][x] !== undefined) {
                        updates[`users_private/${_id}/${deviceId}/${x}`] = _private[deviceId][x];
                    }
                }
            }
        }
        if(!_updated) {
            updates[`users_public/${_id}/updated`] = firebase.database.ServerValue.TIMESTAMP;
        }
        console.log(updates);
        return updates;
    }

    const _body = {
        get asString() {
            return _body.toString().replace(/\[\d+m/g, "");
        },
        get created() {
            return _dateFormatted(_public.created);
        },
        get email() {
            return _email;
        },
        get id() {
            return _id
        },
        get image() {
            return _image;
        },
        get initials() {
            if (_name) return _name.substr(0, 1);
            return null;
        },
        get name() {
            return _name || _email;
        },
        get private() {
            return _private;
        },
        get public() {
            return _public
        },
        get role() {
            return _role || Role.USER;
        },
        get updated() {
            return _dateFormatted(_public.updated);
        },
        get verified() {
            return _public.emailVerified || false;
        },
        create: (id, role, data) => {
            if (!data) {
                data = role;
                role = null;
            }
            let {public: publicData, private: privateData} = data;
            if (!publicData) publicData = data;
            if (!id || !publicData) throw new Error("Not enough data to create UserData instance.")
            if (publicData) _public = publicData || {};
            if (privateData) _private = privateData || {};
            _id = id;
            _email = _public.email || "";
            _image = _public.image || "";
            _name = _public.name || "";
            _role = role;
            _public.created = _public.created || new Date().getTime();
            if(_name || _email) {
                _public._sort_name = (_name || _email).trim().toLowerCase()
                    + "_" + _id;
            }
            return _body;
        },
        date: (format = "M-D-YYYY HH:mm A") => {
            if (_public.created && !_public.created[".sv"]) {
                return new Date(_public.created).toLocaleString();
            } else {
                return "";
            }
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
            let snap;
            if ((!_loaded.public || force) && (fetchPublic || fetchFull)) {
                snap = await _fetch(ref.child(_id));
                _public = {..._public, ...(snap.val() || {})};
                _email = _public.email;
                _image = _public.image;
                _name = _public.name;
                _updated = _public.updated;
                _loaded = {..._loaded, public: true, email: true, name: true, updated: true, image: true};
            }
            if (fetchPrivate === true || fetchFull) {
                snap = await _fetch(firebase.database().ref("users_private").child(_id));
                _private = {..._private, ...(snap.val() || {})};
                _loaded = {..._loaded, private: true};
            }
            if ((!_loaded.role || force) && (fetchRole || fetchFull)) {
                snap = await _fetch(firebase.database().ref("roles").child(_id));
                _role = snap.val();
                _loaded = {..._loaded, role: true};
            }
            if ((!_loaded.updated || force) && (fetchUpdated && !fetchFull && !fetchPublic)) {
                snap = await _fetch(ref.child(_id).child("updated"));
                _updated = snap.val();
                _public.updated = _updated;
                _loaded = {..._loaded, updated: true};
            }
            if ((!_loaded.name || force) && (fetchName && !fetchFull && !fetchPublic)) {
                snap = await _fetch(ref.child(_id).child("name"));
                _name = snap.val();
                _public.name = _name;
                _loaded = {..._loaded, name: true};
            }
            if ((!_loaded.image || force) && (fetchImage && !fetchFull && !fetchPublic)) {
                snap = await _fetch(ref.child(_id).child("image"));
                _image = snap.val();
                _public.image = _image;
                _loaded = {..._loaded, image: true};
            }
            if ((!_loaded.email || force) && (fetchEmail && !fetchFull && !fetchPublic)) {
                snap = await _fetch(ref.child(_id).child("image"));
                _email = snap.val();
                _public.email = _email;
                _loaded = {..._loaded, email: true};
            }
            if(_public.name || _public.email) {
                _public._sort_name = (_public.name || _public.email).trim().toLowerCase()
                    + "_" + _id;
            }
            _requestedTimestamp = new Date().getTime();
            return _body;
        },
        fetchPrivate: async (deviceId, force) => {
            if(!_loaded.private || force) {
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
            return _body;
        },
        savePrivate: async () => {
            const updates = prepareUpdates(false, true);
            await firebase.database().ref().update(updates);
            return _body;
        },
        set: async (data) => {
            const {role, ...rest} = data;
            if(data.public) {
                _public = {..._public, ...rest.public};
                // _private = {..._private, ...(data.private || {})};
            } else {
                _public = {..._public, ...rest};
            }
            if(role) _role = role;
            _body.create(_id, _role, {
                public: _public,
                private: _private,
            });
            return _body;
        },
        setPrivate: async (deviceId, data) => {
            if(!data) {
                data = deviceId || {};
                deviceId = null;
            }
            if(deviceId) {
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
            return `[UserData] id: \x1b[34m${_id}\x1b[30m, name: \x1b[34m${_name}\x1b[30m, role: \x1b[34m${_role}\x1b[30m, public: ${JSON.stringify(_public)}`
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
                    _name = name;
                    _public.name = _name;
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
UserData.EMAIL = "name";
UserData.IMAGE = "image";
UserData.UPDATED = "updated";
UserData.FULL = "full";
UserData.FORCE = "force";

let currentUserDataInstance;
export const useCurrentUserData = userData => {
    if (userData !== undefined) currentUserDataInstance = userData;
    return currentUserDataInstance;
}
