import validateReadOptions from "../../../../common/helpers/validateReadOptions.js";
import {fail} from "../../../../../../common";
import parsePath from "../../../../../../database/src/firebase/parsePath";
import invalidPath from "../../common/invalidPath";

export default async function (path, options = {}, ...args) {
    if (args.length) fail("database/invalid-argument", "Expected (path, options?).");
    const database = this.getDatabaseInstance();
    const address = parsePath(path).address;
    if (invalidPath.test(address)) fail("database/invalid-argument", "Invalid Firebase path.");
    const {field, equalTo} = validateReadOptions(options);
    let query = database.ref(address);
    if (field !== undefined) query = field ? query.orderByChild(field) : query.orderByValue();
    else if (equalTo !== undefined) query = query.orderByValue();
    if (equalTo !== undefined) query = query.equalTo(equalTo);
    const snapshot = await query.get();
    return snapshot.val();
}
