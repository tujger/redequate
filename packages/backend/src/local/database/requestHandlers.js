import create from "./callable/create";
import deleteRecord from "./callable/delete";
import read from "./callable/read";
import update from "./callable/update";

export default {
    "database.create": create,
    "database.delete": deleteRecord,
    "database.read": read,
    "database.update": update,
};
