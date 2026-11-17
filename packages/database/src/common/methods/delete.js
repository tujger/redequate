import validatePath from "../helpers/validatePath";

export default async function deleteRecord(backend, path) {
    validatePath(path);
    await backend.request("database.delete", path);
}
