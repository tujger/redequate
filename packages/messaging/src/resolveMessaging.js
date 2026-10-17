import {resolvePackage} from "../../common";

export const resolveMessaging = async messaging => resolvePackage(messaging, "messaging", async () => {
    const {default: LocalMessaging} = await import("./local/index.js");
    return new LocalMessaging();
});
