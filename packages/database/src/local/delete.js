import {validateCollectionPath} from "./helpers";

export default async function deleteRecord(path, options, run, superDelete) {
    return run(() => {
        validateCollectionPath(path);
        return superDelete(path);
    }, options, "delete", {path});
}
