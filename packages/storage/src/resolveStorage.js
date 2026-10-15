import {resolvePackage} from "../../common";

export const resolveStorage = async storage => resolvePackage(storage, "storage", async () => {
    const {default: LocalTestStorage} = await import("./local-test/index.js");
    return new LocalTestStorage();
});
