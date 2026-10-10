import {resolvePackage} from "../../_common/src/_packages";

export const resolveStorage = async storage => resolvePackage(storage, "storage", async () => {
    const {default: LocalTestStorage} = await import("./local-test/index.js");
    return new LocalTestStorage();
});
