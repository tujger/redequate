import {resolvePackage} from "../../common";

export const resolveStorage = async storage => resolvePackage(storage, "storage", async () => {
    const {default: LocalStorage} = await import("./local/index.js");
    return new LocalStorage();
});
