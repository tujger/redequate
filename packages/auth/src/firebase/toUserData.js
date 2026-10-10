import {UserData} from "../../../_common";
import {fail} from "../../../_common/src/_packages";

export const toUserData = user => {
    if (!user) return null;
    const json = user.toJSON();
    if (!json.uid) {
        fail("auth/invalid-user-data", "Auth user has no identifier.")
    }
    const providerItem = json.providerData?.[0];
    const provider = providerItem?.providerId || "anonymous";
    const timestamp = value => {
        const number = Number(value);
        return value !== null && value !== undefined && value !== "" && Number.isFinite(number) ? number : null;
    };
    return new UserData().fromJSON({
        id: json.uid,
        role: null,
        public: {
            name: json.displayName ?? null,
            email: json.email || providerItem?.email || null,
            emailVerified: Boolean(json.emailVerified || provider === "google.com" || provider === "facebook.com"),
            image: json.photoURL ?? null,
            provider,
            created: timestamp(json.createdAt) ?? Date.now(),
            lastLogin: timestamp(json.lastLoginAt),
        },
        private: {},
        requested: Date.now(),
        loaded: {public: true, name: true, email: true, image: true},
    });
};
