import {resolvePackage} from "../../common";

export const resolveAuth = async (auth, options = {}) => resolvePackage(auth, "auth", async () => {
    const {default: LocalAuth} = await import("./local/index.js");
    return new LocalAuth(options);
});
