import FirebaseBackendClient from "../../../backend/src/firebase-client";
import resolvePath from "../common/resolvePath";

export default async function deleteRecord(firebase, backend, path) {
    const address = resolvePath(path);
    const client = backend ?? new FirebaseBackendClient({firebase});
    await client.request("database.delete", address);
}
