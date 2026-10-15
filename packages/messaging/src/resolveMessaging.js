import {resolvePackage} from "../../common";

export const resolveMessaging = async messaging => resolvePackage(messaging, "messaging", async () => {
    const {default: LocalTestMessaging} = await import("./local-test/index.js");
    return new LocalTestMessaging();
});
