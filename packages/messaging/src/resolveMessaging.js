import {resolvePackage} from "../../common";

export default async messaging => resolvePackage(messaging, "messaging", async () => {
    const {default: LocalMessaging} = await import("./local/index.js");
    return new LocalMessaging();
});
