export const resolveAuth = async auth => {
    if (auth === undefined) {
        const {default: LocalTestAuth} = await import("./local-test/index.js");
        return new LocalTestAuth();
    }
    if (auth === null || typeof auth !== "object" || Array.isArray(auth)) {
        throw new Error("Dispatcher auth must be an Auth instance created with new Auth(...)");
    }
    return auth;
};
