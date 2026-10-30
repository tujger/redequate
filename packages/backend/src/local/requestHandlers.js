import create from "./database/callable/create";
import cursor from "./database/callable/cursor";
import deleteRecord from "./database/callable/delete";
import migrate from "./database/callable/migrate";
import read from "./database/callable/read";
import update from "./database/callable/update";
import send from "./notification/send";

export default {
    "database.create": create,
    "database.cursor": cursor,
    "database.delete": deleteRecord,
    "database.migrate": migrate,
    "database.read": read,
    "database.update": update,
    "notification.send": send,
};
