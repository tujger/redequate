import {UserData} from "../../_common/src/UserData";

export const createAuthUser = ({id, name, email, verified, image, provider, created, lastLogin}) => {
    if (typeof id !== "string" || !id) {
        throw Object.assign(new Error("Auth user has no identifier."), {code: "auth/invalid-user-data"});
    }
    const timestamp = value => {
        const number = Number(value);
        return value !== null && value !== undefined && value !== "" && Number.isFinite(number) ? number : null;
    };
    return new UserData().fromJSON({
        id,
        role: null,
        public: {
            name: name ?? null,
            email: email ?? null,
            emailVerified: Boolean(verified),
            image: image ?? null,
            provider: provider || "anonymous",
            created: timestamp(created) ?? Date.now(),
            lastLogin: timestamp(lastLogin),
        },
        private: {},
        requested: Date.now(),
        loaded: {public: true, name: true, email: true, image: true},
    });
};
