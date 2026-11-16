import {resolvePackage} from "../../common/src/index";

export {default as DatabaseCursor} from "../../database/src/common/DatabaseCursor";
export {default as DatabaseBase} from "../../database/src/common/DatabaseBase";
export {DatabaseOrder} from "../../database/src/common/DatabaseOrder";
export const resolveDatabase = async database => resolvePackage(database, "database", () => {
    throw new Error("Server database must be supplied explicitly.");
});
