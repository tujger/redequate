export default function from(json) {
    return {
        id: json.uid,
        role: null,
        public: {
            name: json.displayName,
            email: json.email,
            emailVerified: json.emailVerified,
            image: json.photoURL,
            lastLogin: +json.lastLoginAt,
            provider: json.providerData?.[0]?.providerId || "password",
        },
        requestedTimestamp: new Date(),
        loaded: {public: true, name: true, email: true, image: true},
    };
}
