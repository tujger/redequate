import {createAuthUser} from "../common";

export default function from(json) {
    return createAuthUser({
        id: json?.uid,
        name: json?.displayName,
        email: json?.email,
        verified: json?.emailVerified,
        image: json?.photoURL,
        provider: json?.provider || json?.providerData?.[0]?.providerId || "password",
        created: json?.createdAt,
        lastLogin: json?.lastLoginAt,
    });
}
