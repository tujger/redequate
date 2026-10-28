import {handlers} from "../../../common";
import create from "./create";
import deleteRecord from "./delete";
import onWrite from "./onWrite";
import update from "./update";

export {create, update, deleteRecord as delete};

export const onwrite = Object.entries(handlers).reduce((acc, [name, value]) => {
    acc[name] = onWrite(value);
    return acc;
}, {});
