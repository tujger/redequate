import {validateCollectionPath} from "./helpers/parsePath";

export default async function deleteRecord(path, options, run, superDelete) {
    return run(() => {
        validateCollectionPath(path);
        return superDelete(path);
    }, options, "delete", {path});
}
