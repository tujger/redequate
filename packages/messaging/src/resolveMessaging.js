import {resolvePackage} from "../../_common/src/_packages";

export const resolveMessaging = async messaging => resolvePackage(messaging, "messaging", async () => {
    const {default: LocalTestMessaging} = await import("./local-test/index.js");
    return new LocalTestMessaging();
});
