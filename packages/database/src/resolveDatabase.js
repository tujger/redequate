import {resolvePackage} from "../../common/src/_packages";

export const resolveDatabase = async database => resolvePackage(database, "database", async () => {
    const {default: LocalTestDatabase} = await import("./local-test/index.js");
    return new LocalTestDatabase();
});
