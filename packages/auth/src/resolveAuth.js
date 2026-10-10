import {resolvePackage} from "../../_common/src/_packages";

export const resolveAuth = async auth => resolvePackage(auth, "auth", async () => {
    const {default: LocalTestAuth} = await import("./local-test/index.js");
    return new LocalTestAuth();
});
