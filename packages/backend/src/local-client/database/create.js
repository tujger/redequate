import {fail} from "../../../../common";

export default function createRecord({database, args}) {
    if (args.length !== 2) fail("database/invalid-argument", "Expected (path, value).");
    const [path, value] = args;
    return database.create(path, value);
}
