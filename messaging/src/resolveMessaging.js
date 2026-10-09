export const resolveMessaging = async messaging => {
    if (messaging === undefined) {
        const {default: LocalTestMessaging} = await import("./local-test/index.js");
        return new LocalTestMessaging();
    }
    if (messaging === null || typeof messaging !== "object" || Array.isArray(messaging)) {
        throw new Error("Dispatcher messaging must be a Messaging instance created with new Messaging(...)");
    }
    return messaging;
};
