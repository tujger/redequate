import parsePath from "./parsePath";

export default async function deleteRecord(path, options, run, superDelete) {
    return run(() => superDelete(parsePath(path).address), options, "delete", {path});
}
