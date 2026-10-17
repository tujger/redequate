import {resolvePackage} from "../../common";

export const resolveDatabase = async database => resolvePackage(database, "database", async () => {
    const {default: LocalDatabase} = await import("./local/index.js");
    return new LocalDatabase();
});
