import {fail} from "../../../common";
import compareKeys from "./compareKeys";

export const hasIntermediateWildcard = path => Array.isArray(path) && path.slice(1, -1).some(segment => typeof segment === "string");

export function validateCursorPattern(path) {
    if (!hasIntermediateWildcard(path)) return;
    if (typeof path.at(-1) !== "string") fail("database/invalid-argument", "A wildcard cursor must end with a key wildcard.");
    const names = path.slice(1).filter(segment => typeof segment === "string");
    if (new Set(names).size !== names.length) fail("database/invalid-argument", "Cursor wildcard names must be distinct.");
}

export async function expandCursorBranches(path, listKeys) {
    const branches = [];
    const visit = async (index, prefix, params) => {
        if (index === path.length - 1) {
            branches.push({path: [...prefix, path[index]], params});
            return;
        }
        const segment = path[index];
        if (typeof segment !== "string") return visit(index + 1, [...prefix, segment], params);
        const keys = await listKeys(prefix, segment);
        for (const key of [...new Set(keys)].sort(compareKeys)) {
            await visit(index + 1, [...prefix, {[segment]: key}], {...params, [segment]: key});
        }
    };
    await visit(1, [path[0]], {});
    return branches;
}

export function compareCursorPaths(a, b) {
    const left = a.split("/");
    const right = b.split("/");
    for (let i = 0; i < Math.min(left.length, right.length); i++) {
        const result = compareKeys(left[i], right[i]);
        if (result) return result;
    }
    return left.length - right.length;
}
