import {resolvePackage} from "../../common";

export default async (auth, options = {}) => resolvePackage(auth, "auth", async () => {
    const {default: LocalAuth} = await import("./local");
    return new LocalAuth(options);
});
