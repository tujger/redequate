import {UserRole} from "./UserRole.js";
import {SERVER_TIMESTAMP} from "./constants.js";

export function currentRole(user) {
    if (user) return user.role;
    return UserRole.LOGIN;
}

export function matchRole(roles, user) {
    if (!roles) return true;
    if (roles.indexOf(UserRole.AUTH) >= 0) return true;
    if (!currentRole(user)) return false;
    if (roles.indexOf(UserRole.USER) >= 0 && roles.indexOf(UserRole.AUTHOR) < 0) roles.push(UserRole.AUTHOR);
    return roles.indexOf(currentRole(user)) >= 0;
}

export function needAuth(roles, user) {
    if (!roles) return false;
    if (roles.indexOf(currentRole(user)) >= 0) return false;
    return currentRole(user) === UserRole.LOGIN;
}

export const normalizeSortName = text => {
    if (!text || !(text.constructor.name === "String")) return text;
    return (text || "")
        .trim()
        .replace(/[^\wа-яА-Я]/g, "")
        // .replace(/[~`!@#$%^&*()\-_=+[\]{}|\\;:'",<.>/?\s™®～]+/g, "")
        .toLowerCase();
}

export function UserData({extend} = {}) {
    const state = {
        id: undefined,
        public: {},
        private: {},
        role: null,
        requestedTimestamp: undefined,
        loaded: {},
        persisted: undefined,
        get sortName() {
            if (this.public.name || this.public.email) {
                return normalizeSortName(this.public.name || this.public.email) + "_" + this.id;
            }
            return null;
        },
    };

    const _dateFormatted = date => {
        if (!date) return "";
        if (date[".sv"] === SERVER_TIMESTAMP[".sv"]) return _dateFormatted(new Date().getTime());
        const _date = new Date(date);
        const now = new Date();
        if (now.getUTCFullYear() === _date.getUTCFullYear() &&
            now.getUTCMonth() === _date.getUTCMonth() &&
            now.getUTCDate() === _date.getUTCDate()) {
            return _date.toLocaleTimeString();
        }
        return _date.toLocaleDateString();
    }

    const _body = {
        get asString() {
            // eslint-disable-next-line no-control-regex
            return _body.toString().replace(/\x1b\[\d+m/g, "");
        },
        get created() {
            return _dateFormatted(state.public.created);
        },
        get disabled() {
            return matchRole([UserRole.DISABLED], _body);
        },
        get email() {
            return state.public.email;
        },
        get persisted() {
            return state.persisted;
        },
        get id() {
            return state.id
        },
        get image() {
            return state.public.image;
        },
        get initials() {
            const tokens = (state.public.name || state.public.email || "Some user").split(/[\W]/, 2);
            let result = tokens.map(token => token.substr(0, 1).toUpperCase()).join("");
            if (!result) result = state.public.name.trim().substr(0, 1);
            return result;
        },
        get name() {
            return state.public.name || state.public.email || "Some user";
        },
        get private() {
            return state.private;
        },
        get public() {
            return state.public
        },
        get role() {
            return state.id ? (state.role || (_body.verified ? UserRole.USER : UserRole.USER_NOT_VERIFIED)) : UserRole.LOGIN;
        },
        get updated() {
            return _dateFormatted(state.public.updated);
        },
        get verified() {
            return state.public.emailVerified || false;
        },
        create: (id, role, data) => {
            if (!data) {
                data = role || {};
                role = null;
            }
            let {public: publicData, private: privateData} = data;
            if (!publicData) publicData = data;
            if (!id || !publicData) throw new Error("Not enough data to create UserData instance.")
            if (publicData) state.public = publicData || {};
            if (privateData) state.private = privateData || {};
            state.id = id;
            state.role = role;
            state.public.created = state.public.created || new Date().getTime();
            state.public._sort_name = state.sortName;
            return _body;
        },
        date: (format = "M-D-YYYY HH:mm A") => {
            if (state.public.created && !state.public.created[".sv"]) {
                return new Date(state.public.created).toLocaleString();
            } else {
                return "";
            }
        },
        fromJSON: json => {
            state.id = json.id;
            state.role = json.role;
            state.public = json.public;
            state.private = json.private;
            state.requestedTimestamp = json.requested;
            state.loaded = json.loaded;
            _body.create(state.id, state.role, {
                public: state.public,
                private: state.private,
            });
            return _body;
        },
        set: async (data) => {
            const {role, ...rest} = data;
            if (data.public) {
                state.public = {...state.public, ...rest.public};
                // state.private = {...state.private, ...(data.private || {})};
            } else {
                state.public = {...state.public, ...rest};
            }
            if (role) state.role = role;
            _body.create(state.id, state.role, {
                public: state.public,
                private: state.private,
            });
            return _body;
        },
        setPrivate: async (deviceId, data) => {
            if (!data) {
                data = deviceId || {};
                deviceId = null;
            }
            if (deviceId) {
                state.private[deviceId] = {...(state.private[deviceId] || {}), ...data};
            } else {
                state.private = {...state.private, ...data};
            }
            return state.private;
        },
        toJSON: () => ({
            id: state.id,
            role: state.role,
            public: state.public,
            private: state.private,
            requested: state.requestedTimestamp,
            loaded: state.loaded,
        }),
        toString: () => {
            return `id: \x1b[34m${state.id}\x1b[30m, name: \x1b[34m${state.public.name}\x1b[30m, role: \x1b[34m${state.role}\x1b[30m, public: ${JSON.stringify(state.public)}`
        },
        update: (data, key = data) => {
            if (key === data) {
                key = null;
            }
            if (!key && data.constructor.name === "String") throw new Error("Value defined without key");
            if (!key) {
                const {public: publicData, private: privateData, role, name, id} = data;
                if (publicData) state.public = publicData || {};
                if (privateData) state.private = privateData || {};
                if (role) state.role = role;
                if (id) state.id = id;
                if (name) {
                    state.public.name = name;
                }
            } else {
                console.log("[UserData] still ignoring", key, data);
            }
        },
        _userData: true,
    };
    if (extend) Object.assign(_body, extend(_body, state));
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
