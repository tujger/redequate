import migrate from "./database/callable/migrate";
import send from "./notification/send";
import create from "./database/callable/create";
import deleteRecord from "./database/callable/delete";
import read from "./database/callable/read";
import update from "./database/callable/update";

export default {
    "database.create": create,
    "database.delete": deleteRecord,
    "database.migrate": migrate,
    "database.read": read,
    "database.update": update,
    "notification.send": send,
};
