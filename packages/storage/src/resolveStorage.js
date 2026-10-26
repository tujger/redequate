import {resolvePackage} from "../../common";

export default async storage => resolvePackage(storage, "storage", async () => {
    const {default: LocalStorage} = await import("./local/index");
    return new LocalStorage();
});
