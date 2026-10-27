import create from "./database/create";
import update from "./database/update";
import deleteRecord from "./database/delete";

export default {
    "database.create": create,
    "database.update": update,
    "database.delete": deleteRecord,
};
