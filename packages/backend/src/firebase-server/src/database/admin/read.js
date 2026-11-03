import {applicationDefault} from "firebase-admin/app";
import {shallowReadUrl, fetchShallowKeys} from "../../../../../../database/src/common/shallowRead";
import validateReadOptions from "../../../../common/helpers/validateReadOptions.js";
import {fail} from "../../../../../../common";
import parsePath from "../../../../../../database/src/firebase/parsePath";
import invalidPath from "../../common/invalidPath";

export default async function (path, options = {}, ...args) {
    if (args.length) fail("database/invalid-argument", "Expected (path, options?).");
    const database = this.getDatabaseInstance();
    const address = parsePath(path, "collection").address;
    if (invalidPath.test(address)) fail("database/invalid-argument", "Invalid Firebase path.");
    const {field, equalTo} = validateReadOptions(options);
    if (options.shallow) {
        const emulatorHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
        const url = shallowReadUrl(database.ref(address).toString(), database.app.options.databaseURL, emulatorHost);
        let token = "owner";
        if (!emulatorHost) {
            const credential = database.app.options.credential ?? applicationDefault();
            token = (await credential.getAccessToken()).access_token;
            if (!token) fail("database/permission-denied", "No access token for shallow read.");
        }
        return fetchShallowKeys(url, {Authorization: `Bearer ${token}`});
    }
    let query = database.ref(address);
    if (field !== undefined) query = field ? query.orderByChild(field) : query.orderByValue();
    else if (equalTo !== undefined) query = query.orderByValue();
    if (equalTo !== undefined) query = query.equalTo(equalTo);
    const snapshot = await query.get();
    return snapshot.val();
}
