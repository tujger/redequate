import {getDatabase} from "firebase-admin/database";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import resolvePath from "../../../../../../database/src/common/resolvePath";
import checkResponse from "../../common/checkResponse";
import createDatabaseUrl from "../../common/createDatabaseUrl";
import getRequestToken from "../../common/getRequestToken";
import invalidPath from "../../common/invalidPath";
import sendRequest from "../../common/sendRequest";
import throwDatabaseError from "../../common/throwDatabaseError";

const prepare = request => {
    const address = resolvePath(request.data);
    if (invalidPath.test(address)) throw new HttpsError("invalid-argument", "Invalid Firebase path.");
    const token = getRequestToken(request);
    const database = getDatabase();
    console.debug("[Backend:Delete]", `delete [${address}]`);
    const reference = address ? database.ref(address) : database.ref();
    const url = createDatabaseUrl({database, reference, token});
    return {url};
};

const prepareRequest = props => ({...props, method: "DELETE"});

const readResponse = async props => {
    const {response} = props;
    await response.body?.cancel();
    checkResponse(response, "Record deletion failed.");
    return null;
};

export default onCall(async request => {
    try {
        return await Promise.resolve(prepare(request)).then(prepareRequest).then(sendRequest).then(readResponse);
    } catch (error) {
        throwDatabaseError(error, "Record deletion failed.");
    }
});
