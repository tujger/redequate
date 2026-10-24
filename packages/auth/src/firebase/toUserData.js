export default (user, createUserData) => {
    if (!user) return createUserData();
    const json = user.toJSON();
    const providerItem = json.providerData?.[0];
    const provider = providerItem?.providerId || "anonymous";
    const timestamp = value => {
        const number = Number(value);
        return value !== null && value !== undefined && value !== "" && Number.isFinite(number) ? number : null;
    };
    return createUserData({
        id: json.uid,
        public: {
            name: json.displayName ?? null,
            email: json.email || providerItem?.email || null,
            emailVerified: Boolean(json.emailVerified || provider === "google.com" || provider === "facebook.com"),
            image: json.photoURL ?? null,
            provider,
            created: timestamp(json.createdAt) ?? Date.now(),
            lastLogin: timestamp(json.lastLoginAt),
        },
    });
};
