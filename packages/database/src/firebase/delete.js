import resolvePath from "../common/resolvePath";

export default async function deleteRecord(path, options, run, superDelete) {
    return run(() => superDelete(resolvePath(path)), options, "delete", {path});
}
