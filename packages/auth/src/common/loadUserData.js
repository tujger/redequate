/** Load the profile attached to an authenticated identity through the injected database. */
export default function loadUserData(user, database) {
    if (!user?.id || !database) return user;

    return Promise.all([
        database.read(["users_public", {user_id: user.id}]),
        database.read(["roles", {user_id: user.id}]),
        (database.readSubtree ?? database.read).call(database, ["users_private", {user_id: user.id}])
    ]).then(([publicData, role, privateData]) => {
        const state = user._getState();
        if (publicData != null) state.public = {...state.public, ...publicData};
        if (role !== undefined) state.role = role;
        if (privateData != null) state.private = {...state.private, ...privateData};
        state.loaded = {
            ...state.loaded,
            public: true,
            name: true,
            email: true,
            image: true,
            updated: true,
            role: true,
            private: true
        };
        state.persisted = publicData !== undefined || privateData !== undefined;
        state.requestedTimestamp = Date.now();
        return user;
    });
}
