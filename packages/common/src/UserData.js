import {UserRole} from "./UserRole.js";
import {SERVER_TIMESTAMP} from "./constants.js";

export class UserData {
    static PUBLIC = "public";
    static PRIVATE = "private";
    static ROLE = "role";
    static NAME = "name";
    static EMAIL = "email";
    static IMAGE = "image";
    static UPDATED = "updated";
    static FULL = "full";
    static FORCE = "force";

    _state = {
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

    constructor() {
        for (const method of ["create", "date", "fromJSON", "set", "setPrivate", "toJSON", "toString", "update"]) {
            this[method] = this[method].bind(this);
        }

    }

    // Internal access for subclasses; state is excluded from serialization.
    _getState() {
        return this._state;
    }

    _dateFormatted(date) {
        if (!date) return "";
        if (date[".sv"] === SERVER_TIMESTAMP[".sv"]) return this._dateFormatted(new Date().getTime());
        const _date = new Date(date);
        const now = new Date();
        if (now.getUTCFullYear() === _date.getUTCFullYear() &&
            now.getUTCMonth() === _date.getUTCMonth() &&
            now.getUTCDate() === _date.getUTCDate()) {
            return _date.toLocaleTimeString();
        }

        return _date.toLocaleDateString();
    }

    get asString() {
        // eslint-disable-next-line no-control-regex
        return this.toString().replace(/\x1b\[\d+m/g, "");
    }

    get created() {
        return this._dateFormatted(this._state.public.created);
    }

    get disabled() {
        return matchRole([UserRole.DISABLED], this);
    }

    get email() {
        return this._state.public.email;
    }

    get persisted() {
        return this._state.persisted;
    }

    get id() {
        return this._state.id
    }

    get image() {
        return this._state.public.image;
    }

    get initials() {
        const tokens = (this._state.public.name || this._state.public.email || "Some user").split(/[\W]/, 2);
        let result = tokens.map(token => token.substr(0, 1).toUpperCase()).join("");
        if (!result) result = this._state.public.name.trim().substr(0, 1);
        return result;
    }

    get name() {
        return this._state.public.name || this._state.public.email || "Some user";
    }

    get private() {
        return this._state.private;
    }

    get public() {
        return this._state.public
    }

    get role() {
        return this._state.id ? (this._state.role || (this.verified ? UserRole.USER : UserRole.USER_NOT_VERIFIED)) : UserRole.LOGIN;
    }

    get updated() {
        return this._dateFormatted(this._state.public.updated);
    }

    get verified() {
        return this._state.public.emailVerified || false;
    }

    create(id, role, data) {
        if (!data) {
            data = role || {};
            role = null;
        }

        let {public: publicData, private: privateData} = data;
        if (!publicData) publicData = data;
        if (!id || !publicData) throw new Error("Not enough data to create UserData instance.")
        if (publicData) this._state.public = publicData || {};
        if (privateData) this._state.private = privateData || {};
        this._state.id = id;
        this._state.role = role;
        this._state.public.created = this._state.public.created || new Date().getTime();
        this._state.public._sort_name = this._state.sortName;
        return this;
    }

    date(format = "M-D-YYYY HH:mm A") {
        if (this._state.public.created && !this._state.public.created[".sv"]) {
            return new Date(this._state.public.created).toLocaleString();
        } else {
            return "";
        }

    }
    fromJSON(json) {
        this._state.id = json.id;
        this._state.role = json.role;
        this._state.public = json.public;
        this._state.private = json.private;
        this._state.requestedTimestamp = json.requested;
        this._state.loaded = json.loaded;
        this.create(this._state.id, this._state.role, {
            public: this._state.public,
            private: this._state.private,
        });
        return this;
    }

    async set(data) {
        const {role, ...rest} = data;
        if (data.public) {
            this._state.public = {...this._state.public, ...rest.public};
            // this.#state.private = {...this.#state.private, ...(data.private || {})};
        } else {
            this._state.public = {...this._state.public, ...rest};
        }

        if (role) this._state.role = role;
        this.create(this._state.id, this._state.role, {
            public: this._state.public,
            private: this._state.private,
        });
        return this;
    }

    async setPrivate(deviceId, data) {
        if (!data) {
            data = deviceId || {};
            deviceId = null;
        }

        if (deviceId) {
            this._state.private[deviceId] = {...(this._state.private[deviceId] || {}), ...data};
        } else {
            this._state.private = {...this._state.private, ...data};
        }

        return this._state.private;
    }

    toJSON() {
        return structuredClone({
            id: this._state.id,
            role: this._state.role,
            public: this._state.public,
            private: this._state.private,
            requested: this._state.requestedTimestamp,
            loaded: this._state.loaded,
        });
    }

    toString() {
        return `id: \x1b[34m${this._state.id}\x1b[30m, name: \x1b[34m${this._state.public.name}\x1b[30m, role: \x1b[34m${this._state.role}\x1b[30m, public: ${JSON.stringify(this._state.public)}`
    }

    update(data, key = data) {
        if (key === data) {
            key = null;
        }

        if (!key && data.constructor.name === "String") throw new Error("Value defined without key");
        if (!key) {
            const {public: publicData, private: privateData, role, name, id} = data;
            if (publicData) this._state.public = publicData || {};
            if (privateData) this._state.private = privateData || {};
            if (role) this._state.role = role;
            if (id) this._state.id = id;
            if (name) {
                this._state.public.name = name;
            }

        } else {
            console.log("[UserData] still ignoring", key, data);
        }

    }
    _userData = true;
}

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
