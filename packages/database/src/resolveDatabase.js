import {resolvePackage} from "../../common";

export default async (database, {backend} = {}) => resolvePackage(database, "database", async () => {
    const {default: LocalDatabase} = await import("./local/index");
    return new LocalDatabase({backend});
});
