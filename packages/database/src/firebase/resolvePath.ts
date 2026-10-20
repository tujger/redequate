import validatePath from "../common/validatePath";
import type {DatabasePath} from "../common/DatabaseTypes";

/** Resolve named segment values; _ is local metadata, not a Firebase path component. */
export default function resolvePath(path: DatabasePath): string {
    validatePath(path);
    const resolved = typeof path === "string" ? path : path.map(segment => typeof segment === "string" ? segment
        : segment[Object.getOwnPropertyNames(segment).find(name => name !== "_")!]).join("/");
    return resolved.split("/").filter(Boolean).join("/");
}
