import {fail} from "../../../common";
import LocalDatabase from "../../../database/src/local";
import BackendBase from "../BackendBase";
import handlers from "./handlers";

export default class LocalBackendClient extends BackendBase {
    #database;

    constructor({database = new LocalDatabase()} = {}) {
        super();
        this.#database = database;
    }

    async request(name, ...args) {
        if (!Object.hasOwn(handlers, name)) {
            fail("backend/not-implemented", `Backend request ${name} is not implemented.`);
        }
        return handlers[name]({database: this.#database, args});
    }
}
