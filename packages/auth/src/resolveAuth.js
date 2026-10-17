import {resolvePackage} from "../../common";

export const resolveAuth = async (auth, database) => resolvePackage(auth, "auth", async () => {
    const {default: LocalTestAuth} = await import("./local-test/index.js");
    return new LocalTestAuth();
});
