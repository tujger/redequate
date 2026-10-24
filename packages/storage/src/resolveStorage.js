import {resolvePackage} from "../../common";

export default async storage => resolvePackage(storage, "storage", async () => {
    const {default: LocalStorage} = await import("./local/index.js");
    return new LocalStorage();
});
