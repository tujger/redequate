import {UserData as UserDataCommon, UserRole} from "../../packages/common";
import {decodeRole, encodeRole, roleQuery} from "../../packages/auth/src/common/roleData";
import {restoreLanguage} from "../reducers/languageReducer";
import {cacheDatas} from "./General";
import notifySnackbar from "./notifySnackbar";

export {
    currentRole, matchRole, needAuth, normalizeSortName, UserRole
} from "../../packages/common";

export default class UserData extends UserDataCommon {
    #database;
    #lastVisitUpdate = 0;

    constructor(database) {
        super();
        this.#database = database;
        for (const method of ["delete", "fetch", "fetchPrivate", "save", "savePublic", "savePrivate", "updateVisitTimestamp", "updateRole"]) {
            this[method] = this[method].bind(this);
        }
    }

    _dateFormatted(date) {
        if (date && date === this.#database?.TIMESTAMP) {
            return super._dateFormatted(new Date().getTime());
        }
        return super._dateFormatted(date);
    }

    _prepareUpdates(includePublic, includePrivate) {
        const state = this._getState();
        const updates = new Map();
        if (!state.id) throw new Error("[UserData] save failed: id is not defined");
        if (includePublic) {
            if (!state.public) throw new Error("[UserData] public section is not ready");
            state.public._sort_name = state.sortName;
            for (const x in state.public) {
                if (x === "updated") continue;
                if (state.public[x] !== undefined) {
                    if (state.public[x] !== undefined && (state.public[x] || "").constructor.name === "String") {
                        state.public[x] = (state.public[x] || "").trim();
                    }
                    updates.set(["users_public", {user_id: state.id}, {[x]: x}], state.public[x]);
                }
            }
            updates.set(["users_public", {user_id: state.id}, "updated"], this.#database.TIMESTAMP);
        }

        if (includePrivate) {
            if (!state.private) throw new Error("[UserData] private section is not ready");
            for (const deviceId in state.private) {
                for (const x in state.private[deviceId]) {
                    if (state.private[deviceId][x] !== undefined) {
                        if (state.private[deviceId][x] !== undefined && (state.private[deviceId][x] || "").constructor.name === "String") {
                            state.private[deviceId][x] = (state.private[deviceId][x] || "").trim();
                        }
                        updates.set(["users_private", {user_id: state.id}, {device_id: deviceId}, {[x]: x}], state.private[deviceId][x]);
                    }
                }
            }
        }

        if (!includePublic && !state.public.updated) {
            updates.set(["users_public", {user_id: state.id}, "updated"], this.#database.TIMESTAMP);
        }
        return updates;
    }

    async _assertAdminRemains() {
        const role = decodeRole(this.#database, await this.#database.read(["roles", {user_id: this.id}]));
        if (role !== UserRole.ADMIN) return;
        const roles = await this.#database.read(["roles"], roleQuery(this.#database, UserRole.ADMIN));
        let hasAnotherAdmin = false;
        for (const id of Object.keys(roles || {})) {
            if (id === this.id) continue;
            if (await this.#database.read(["users_public", {user_id: id}]) != null) {
                hasAnotherAdmin = true;
                break;
            }
        }
        UserData.assertAdminRemains(role, hasAnotherAdmin);
    }

    async updateRole(role, updates = new Map()) {
        if (role !== UserRole.ADMIN) await this._assertAdminRemains();
        updates.set(["roles", {user_id: this.id}], encodeRole(this.#database, this.id, role));
        await this.#database.update(updates);
        return this;
    }

    async delete() {
        const state = this._getState();
        console.log("[UserData] delete", state.id);
        await this._assertAdminRemains();
        await this.#database.delete(["users_public", {user_id: state.id}]);
        cacheDatas.remove(state.id);
        return this;
    }

    async fetch(id, options = [UserData.PUBLIC]) {
        const state = this._getState();
        if (id instanceof Array) {
            options = id;
        } else if (id && state.id && id !== state.id) {
            throw new Error(`Another user id fetched: ${id}!=${state.id}.`);
        } else if (id && state.id !== id) {
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

        const tasks = [];
        if ((!_loading.public || force) && (fetchPublic || fetchFull)) {
            tasks.push(new Promise((resolve, reject) => {
                this.#database.read(["users_public", {user_id: state.id}])
                    .then(value => {
                        if (value !== undefined) state.persisted = true;
                        state.public = {...state.public, ...(value || {})};
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
                this.#database.read(["users_private", {user_id: state.id}])
                    .then(value => {
                        if (value !== undefined) state.persisted = true;
                        state.private = {...state.private, ...(value || {})};
                        state.loaded = {...state.loaded, private: true};
                        // console.warn("[UserData] private", state.id, state.private);
                        resolve(state.private);
                    }).catch(reject);
            }))
            _loading = {..._loading, private: true};
        }

        if ((!_loading.role || force) && (fetchRole || fetchFull)) {
            tasks.push(new Promise((resolve, reject) => {
                this.#database.read(["roles", {user_id: state.id}])
                    .then(value => {
                        state.role = decodeRole(this.#database, value);
                        state.loaded = {...state.loaded, role: true};
                        resolve(state.role);
                    }).catch(reject);
            }))
            _loading = {..._loading, role: true};
        }

        if ((!_loading.updated || force) && (fetchUpdated && !fetchFull && !fetchPublic)) {
            tasks.push(new Promise((resolve, reject) => {
                this.#database.read(["users_public", {user_id: state.id}, {updated: "updated"}])
                    .then(value => {
                        state.public.updated = value;
                        // console.warn("[UserData] updated", state.id, state.public.updated);
                        state.loaded = {...state.loaded, updated: true};
                        resolve(state.public.updated);
                    }).catch(reject);
            }))
            _loading = {..._loading, updated: true};
        }

        if ((!_loading.name || force) && (fetchName && !fetchFull && !fetchPublic)) {
            tasks.push(new Promise((resolve, reject) => {
                this.#database.read(["users_public", {user_id: state.id}, {name: "name"}])
                    .then(value => {
                        if (value !== undefined) state.persisted = true;
                        state.public.name = value || "";
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
                this.#database.read(["users_public", {user_id: state.id}, {image: "image"}])
                    .then(value => {
                        if (value !== undefined) state.persisted = true;
                        state.public.image = value;
                        // console.warn("[UserData] image", state.id, state.public.image);
                        state.loaded = {...state.loaded, image: true};
                        resolve(state.public.image);
                    }).catch(reject);
            }))
            _loading = {..._loading, image: true};
        }

        if ((!_loading.email || force) && (fetchEmail && !fetchFull && !fetchPublic)) {
            tasks.push(new Promise((resolve, reject) => {
                this.#database.read(["users_public", {user_id: state.id}, {email: "email"}])
                    .then(value => {
                        if (value !== undefined) state.persisted = true;
                        state.public.email = value;
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
        try {
            state.public._sort_name = state.sortName;
            state.requestedTimestamp = new Date().getTime();
        } catch (e) {
            console.error(e)
        }
        return this;
    }

    async fetchPrivate(deviceId, force) {
        const state = this._getState();
        if (!state.loaded.private || force) {
            if (!deviceId) {
                const value = await this.#database.read(["users_private", {user_id: state.id}]);
                if (value !== undefined) state.persisted = true;
                state.private = {...state.private, ...(value || {})}
                state.loaded = {...state.loaded, private: true};
            } else {
                const value = await this.#database.read(["users_private", {user_id: state.id}, {device_id: deviceId}]);
                if (value !== undefined) state.persisted = true;
                state.private[deviceId] = {...state.private[deviceId], ...(value || {})};
                state.loaded = {...state.loaded, private: true};
            }
        }
        return this;
    }

    async save() {
        const updates = this._prepareUpdates(true, true);
        await this.#database.update(updates);
        return this;
    }

    async savePublic() {
        const state = this._getState();
        const updates = this._prepareUpdates(true, false);
        await this.#database.update(updates);
        state.persisted = true;
        return this;
    }

    async savePrivate() {
        const updates = this._prepareUpdates(false, true);
        await this.#database.update(updates);
        return this;
    }

    updateVisitTimestamp(database) {
        const state = this._getState();
        const now = new Date().getTime();
        if (state.id && state.persisted && (now - this.#lastVisitUpdate) > 60000) {
            database.read(["users_public", {user_id: state.id}, {email: "email"}])
                .then(async value => {
                    if (value === undefined) return;
                    await database.update(["users_public", {user_id: state.id}, "visit"], () => database.TIMESTAMP);
                    this.#lastVisitUpdate = now;
                })
                .catch(console.error);
        }
        return this;
    }
}

export function watchUserChanged({auth, database, getUserData, onUserChanged}) {
    return new Promise(resolve => {
        const refreshAction = () => {
            const snapshot = getUserData();
            if (!snapshot?.id) return;
            new UserData(database).fromJSON(snapshot.toJSON())
                .fetch([UserData.PUBLIC, UserData.ROLE, UserData.FORCE])
                .then(userData => {
                    if (getUserData()?.id !== userData.id) return;
                    onUserChanged(userData);
                    resolve();
                })
                .catch(notifySnackbar)
        }

        auth.onAuthStateChanged(async userData => {
            if (!userData?.id) {
                onUserChanged(userData);
                return;
            }
            const currentUserData = getUserData();
            if (currentUserData.id !== userData.id) return;
            const changed = userData.verified && (
                currentUserData.role === UserRole.USER_NOT_VERIFIED ||
                currentUserData.public.emailVerified !== userData.verified
            ) || (await database.read(["users_public", {user_id: userData.id}, {updated: "updated"}])) > currentUserData.public.updated;
            if (!changed) return;

            console.warn("[UserData] changed", currentUserData.id, userData.toJSON());
            return notifySnackbar({
                title: "Your profile has been changed. Please refresh for update",
                variant: "warning",
                priority: "high",
                buttonLabel: "Refresh",
                onButtonClick: refreshAction
            })
        });
    })
}

export const logoutUser = async ({auth, onLogout}) => {
    await auth.signOut();
    onLogout();
    restoreLanguage();
    return null;
};
