import {resolvePackage} from "../../common";

export const resolveAuth = async (auth, database) => resolvePackage(auth, "auth", async () => {
    const {default: LocalAuth} = await import("./local/index.js");
    return new LocalAuth({database});
});
