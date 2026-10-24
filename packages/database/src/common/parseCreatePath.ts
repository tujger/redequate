import {fail} from "../../../common";
import validatePath from "./validatePath";
import type {DatabasePath, DatabasePathSegment} from "./DatabaseTypes";

export default function parseCreatePath(path: DatabasePath): {parentPath: DatabasePathSegment[]; fieldName: string; key?: string} {
    validatePath(path);
    if (!Array.isArray(path) || path.length < 2 || path.at(-1) === "_") {
        fail("database/invalid-argument", "create requires a collection path followed by a key field name.");
    }
    const last = path.at(-1)!;
    if (typeof last === "string") return {parentPath: path.slice(0, -1), fieldName: last};
    const fieldName = Object.keys(last).find(name => name !== "_")!;
    if (Object.hasOwn(last, "_") || typeof last[fieldName] !== "string") {
        fail("database/invalid-argument", "create ID must be a named string segment.");
    }
    return {parentPath: path.slice(0, -1), fieldName, key: last[fieldName] as string};
}
