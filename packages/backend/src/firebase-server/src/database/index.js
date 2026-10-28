import * as handlers from "../../../common-server";
import create from "./create";
import deleteRecord from "./delete";
import onWrite from "./onWrite.js";
import update from "./update";

export {create, update, deleteRecord as delete};

export const onwrite = Object.entries(handlers).reduce((acc, [name, value]) => {
    acc[name] = onWrite(value);
    return acc;
}, {});
